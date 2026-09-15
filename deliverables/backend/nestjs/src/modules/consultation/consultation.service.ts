import {
  Injectable, Logger, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CacheService } from '../../shared/cache/cache.service';
import { EventBusService } from '../../shared/events/event-bus.service';
import { EVENTS } from '../../shared/events/events.constants';
import { LlmGatewayService } from '../../shared/llm-gateway/llm-gateway.service';
import { buildSystemPrompt, ChatMessage } from '../../shared/llm-gateway/interfaces';
import { RedLineEngine } from '../../shared/red-line-engine/red-line-engine';
import type { RedLineResult, UserHealthProfile } from '../../shared/red-line-engine/red-line-engine';
import { StartConsultationDto } from './dto/consultation.dto';

import { LocalJsonStorageService } from '../../shared/local-json-storage/local-json-storage.service';

@Injectable()
export class ConsultationService {
  private readonly logger = new Logger(ConsultationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly eventBus: EventBusService,
    private readonly llmGateway: LlmGatewayService,
    private readonly redLineEngine: RedLineEngine,
    private readonly configService: ConfigService,
    private readonly localStorage: LocalJsonStorageService,
  ) {}

  // ============================================================
  // SSE 流式咨询（核心接口）
  // ============================================================

  async startSSE(userId: string, dto: StartConsultationDto, res: Response, req?: Request) {
    const startTime = Date.now();

    // 客户端断连检测
    let clientClosed = false;
    const requestController = new AbortController();
    if (req) {
      const close = () => {
        clientClosed = true;
        requestController.abort(new Error('client disconnected'));
        this.logger.debug(`SSE client disconnected, sessionId=${dto.sessionId || 'new'}`);
      };
      req.once('aborted', close);
      req.once('close', close);
    }

    // 1. 验证成员归属（并行，降低 TiDB 高延迟 RTT）
    const [member, membership] = await Promise.all([
      this.prisma.familyMember.findFirst({
        where: { id: dto.memberId, familyId: dto.familyId },
        include: { healthRecord: true },
      }),
      this.prisma.familyMember.findUnique({
        where: { familyId_userId: { familyId: dto.familyId, userId } },
      }),
    ]);
    if (!member) throw new NotFoundException('成员不存在或不属于该家庭');
    if (!membership) throw new ForbiddenException('无权为该成员进行咨询');

    const sessionId = dto.sessionId || uuidv4();

    // 2. 设置 SSE Headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // 3. 构建健康画像
    const healthProfile: UserHealthProfile = {
      age: member.age ?? undefined,
      gender: member.gender ?? undefined,
      chronicDiseases: member.healthRecord?.chronicDiseases
        ? this.safeJsonParse(member.healthRecord.chronicDiseases)
        : undefined,
      allergies: member.healthRecord?.allergies
        ? this.safeJsonParse(member.healthRecord.allergies)
        : undefined,
      bloodType: member.healthRecord?.bloodType ?? undefined,
    };

    // 4. 就医红线检测（本地引擎，<5ms）
    const redLineResult = this.redLineEngine.check(dto.query, healthProfile);
    let redLineTriggered = false;

    if (redLineResult.triggered) {
      redLineTriggered = true;
      this.sendSSEEvent(res, 'red_line', {
        triggered: true,
        category: redLineResult.category,
        severity: redLineResult.severity,
        recommendation: redLineResult.recommendation,
        requiresEmergency: redLineResult.requiresEmergency,
      });

      this.eventBus.publish(EVENTS.CONSULTATION_REDLINE_TRIGGERED, {
        memberId: dto.memberId,
        familyId: dto.familyId,
        userId,
        category: redLineResult.category,
        severity: redLineResult.severity,
      });
    }

    // 5. 免责声明
    this.sendSSEEvent(res, 'disclaimer', {
      text: '温馨提示：本助手提供的是健康建议，不构成医疗诊断。如有不适请及时就医。',
    });

    // 6. 构建消息 + LLM 流式推理
    let systemPrompt = buildSystemPrompt({
      nickname: member.nickname,
      age: member.age ?? undefined,
      gender: member.gender ?? undefined,
      bloodType: member.healthRecord?.bloodType ?? undefined,
      chronicDiseases: healthProfile.chronicDiseases,
      allergies: healthProfile.allergies,
      familyHistory: member.healthRecord?.familyHistory
        ? this.safeJsonParse(member.healthRecord.familyHistory)
        : undefined,
    });

    // 红线触发时增强 system prompt
    if (redLineTriggered) {
      systemPrompt += `\n\n## ⚠️ 安全警告
用户描述的症状已触发就医红线（类别：${redLineResult.category}，等级：${redLineResult.severity}）。
请在回复开头明确提示用户就医的重要性，并给出具体的就医建议。`;
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: dto.query },
    ];

    // 7. 调用 LLM 流式推理
    let fullResponse = '';
    let llmModel = 'unknown';
    let tokensUsed: number | undefined;

    try {
      const stream = this.llmGateway.chatStream(messages, {
        // 医学咨询场景使用更低温度，减少 1.5B 小模型幻觉与离题（默认 0.3）
        temperature: Number(this.configService.get('LLM_TEMPERATURE', 0.3)) || 0.3,
        maxTokens: Number(this.configService.get('LLM_MAX_TOKENS', 2048)) || 2048,
        timeout: Number(this.configService.get('LLM_TIMEOUT', 30000)) || 30000,
        signal: requestController.signal,
      });

      let chunkIndex = 0;
      try {
        while (true) {
          if (clientClosed) break;
          const { done, value } = await stream.next();
          if (done) {
            fullResponse = value.content;
            llmModel = value.model;
            tokensUsed = value.tokensUsed;
            break;
          }
          fullResponse += value;
          if (!this.sendSSEEvent(res, 'chunk', { text: value, index: chunkIndex++ })) {
            requestController.abort(new Error('response closed'));
            clientClosed = true;
            break;
          }
        }
      } finally {
        await stream.return(undefined as never);
      }
    } catch (error) {
      this.logger.error(`LLM stream failed: ${error.message}`);
      // 降级：返回错误提示
      const errorMsg = redLineTriggered
        ? `${redLineResult.recommendation}\n\n（AI 暂时不可用，请关注以上就医建议）`
        : '抱歉，AI 助手暂时遇到了问题。请稍后再试，或直接咨询医生。';
      this.sendSSEEvent(res, 'chunk', { text: errorMsg, index: 0 });
      fullResponse = errorMsg;
      llmModel = 'error';
    }

    // 7.5 最后一道兜底：确保返回内容绝不泄露模板占位符 / 角色提示词 / 英文无关内容。
    // 若 llmGateway 返回空串、仅空白、或仍含 {output} / "You are" 等关键词，
    // 统一替换为固定中文健康咨询兜底回复。
    fullResponse = this.ensureSafeResponse(fullResponse);

    // 8. 持久化对话记录（客户端断连后仍持久化，保证数据完整）
    // 策略：数据库 Consultation 表仅保留关键索引/摘要信息；完整对话写入 tmp/consultations/{userId}/{memberId}/{id}.json
    const responseTimeMs = Date.now() - startTime;
    let consultationId: string | null = null;
    try {
      const summaryQueryText = dto.query.slice(0, 100);
      const summaryResponseText = (fullResponse || '').slice(0, 200);

      const consultation = await this.prisma.consultation.create({
        data: {
          memberId: dto.memberId,
          familyId: dto.familyId,
          sessionId,
          // 数据库只保留摘要，完整内容在 JSON 文件
          queryText: summaryQueryText,
          inputType: dto.inputType ?? 'text',
          responseText: summaryResponseText,
          responseType: clientClosed ? 'cancelled' : (redLineTriggered ? 'red_line_advice' : 'health_advice'),
          redLineTriggered,
          redLineCategory: redLineResult.category,
          redLineSeverity: redLineResult.severity,
          selfHarmDetected: redLineResult.category === 'self_harm_crisis',
          disclaimerShown: true,
          llmModel,
          tokensUsed,
          responseTimeMs,
        },
      });
      consultationId = consultation.id;

      // 完整对话记录保存到本地 JSON
      await this.localStorage.saveRecord(userId, dto.memberId, consultationId, {
        queryText: dto.query,
        responseText: fullResponse,
        inputType: dto.inputType ?? 'text',
        responseType: clientClosed ? 'cancelled' : (redLineTriggered ? 'red_line_advice' : 'health_advice'),
        redLineTriggered,
        redLineCategory: redLineResult.category,
        redLineSeverity: redLineResult.severity,
        selfHarmDetected: redLineResult.category === 'self_harm_crisis',
        disclaimerShown: true,
        llmModel,
        tokensUsed,
        responseTimeMs,
        messages,
        healthProfile,
        sessionId,
        createdAt: new Date().toISOString(),
      });

      this.eventBus.publish(EVENTS.CONSULTATION_COMPLETED, {
        consultationId: consultation.id,
        memberId: dto.memberId,
        familyId: dto.familyId,
        userId,
        sessionId,
        responseTimeMs,
        model: llmModel,
      });
    } catch (error) {
      // 持久化失败不应破坏已经流式返回给用户的回答
      this.logger.error(`持久化咨询记录失败: ${error.message}`);
      this.sendSSEEvent(res, 'error', {
        message: '本次对话回复已完成，但记录保存失败（不影响本次结果）。',
      });
    }

    // 9. 完成事件（客户端未断连时才发送）
    if (!clientClosed) {
      this.sendSSEEvent(res, 'done', {
        sessionId,
        consultationId,
        responseTimeMs,
        model: llmModel,
        disclaimer: '本建议仅供参考，不构成医疗诊断，请及时就医。',
      });
    }

    this.logger.log(
      `Consultation completed: ${responseTimeMs}ms, model=${llmModel}, redLine=${redLineTriggered}, clientClosed=${clientClosed}`,
    );

    if (!clientClosed) res.end();
  }

  // ============================================================
  // 纯红线检测（无 AI 对话）
  // ============================================================

  async checkRedLine(
    userId: string,
    query: string,
    memberId?: string,
  ): Promise<RedLineResult> {
    let profile: UserHealthProfile | undefined;

    if (memberId) {
      const member = await this.prisma.familyMember.findFirst({
        where: { id: memberId },
        include: { healthRecord: true },
      });

      if (member) {
        // 验证权限
        const membership = await this.prisma.familyMember.findUnique({
          where: {
            familyId_userId: {
              familyId: member.familyId,
              userId,
            },
          },
        });
        if (!membership) throw new ForbiddenException('无权访问该成员');

        profile = {
          age: member.age ?? undefined,
          gender: member.gender ?? undefined,
          chronicDiseases: member.healthRecord?.chronicDiseases
            ? this.safeJsonParse(member.healthRecord.chronicDiseases)
            : undefined,
          allergies: member.healthRecord?.allergies
            ? this.safeJsonParse(member.healthRecord.allergies)
            : undefined,
          bloodType: member.healthRecord?.bloodType ?? undefined,
        };
      }
    }

    const start = performance.now();
    const result = this.redLineEngine.check(query, profile);
    const elapsed = (performance.now() - start).toFixed(3);

    this.logger.debug(
      `RedLine check: ${elapsed}ms, triggered=${result.triggered}, category=${result.category || 'none'}`,
    );

    return result;
  }

  // ============================================================
  // 对话历史查询
  // ============================================================

  async getHistory(
    userId: string,
    memberId: string,
    page = 1,
    pageSize = 20,
  ) {
    const member = await this.prisma.familyMember.findUnique({
      where: { id: memberId },
      select: { familyId: true },
    });
    if (!member) throw new NotFoundException('成员不存在');

    const membership = await this.prisma.familyMember.findUnique({
      where: { familyId_userId: { familyId: member.familyId, userId } },
    });
    if (!membership) throw new ForbiddenException('无权查看该成员对话历史');

    const [rows, total] = await Promise.all([
      this.prisma.consultation.findMany({
        where: { memberId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          sessionId: true,
          queryText: true,
          responseText: true,
          responseType: true,
          redLineTriggered: true,
          redLineSeverity: true,
          satisfaction: true,
          llmModel: true,
          responseTimeMs: true,
          createdAt: true,
        },
      }),
      this.prisma.consultation.count({ where: { memberId } }),
    ]);

    // 从本地 JSON 读取完整对话内容，合并到数据库摘要记录中
    const items = await Promise.all(
      rows.map(async (row) => {
        const full = await this.localStorage.readRecord(userId, memberId, row.id);
        return {
          id: row.id,
          sessionId: row.sessionId,
          queryText: (full?.queryText as string) || row.queryText,
          responseText: (full?.responseText as string) || row.responseText,
          responseType: row.responseType,
          redLineTriggered: row.redLineTriggered,
          redLineSeverity: row.redLineSeverity,
          satisfaction: row.satisfaction,
          llmModel: row.llmModel,
          responseTimeMs: row.responseTimeMs,
          createdAt: row.createdAt,
        };
      }),
    );

    return {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getDetail(userId: string, consultationId: string) {
    const consultation = await this.prisma.consultation.findUnique({
      where: { id: consultationId },
      include: {
        member: { select: { nickname: true, familyId: true, id: true } },
      },
    });

    if (!consultation) throw new NotFoundException('对话记录不存在');

    const membership = await this.prisma.familyMember.findUnique({
      where: {
        familyId_userId: {
          familyId: consultation.member.familyId,
          userId,
        },
      },
    });
    if (!membership) throw new ForbiddenException('无权查看该对话');

    // 从本地 JSON 读取完整对话内容
    const full = await this.localStorage.readRecord(
      userId,
      consultation.member.id,
      consultationId,
    );

    return {
      ...consultation,
      queryText: (full?.queryText as string) || consultation.queryText,
      responseText: (full?.responseText as string) || consultation.responseText,
    };
  }

  async submitFeedback(
    userId: string,
    consultationId: string,
    satisfaction: number,
    feedbackText?: string,
  ) {
    const consultation = await this.prisma.consultation.findUnique({
      where: { id: consultationId },
      select: { member: { select: { familyId: true } } },
    });
    if (!consultation) throw new NotFoundException('对话记录不存在');

    const membership = await this.prisma.familyMember.findUnique({
      where: {
        familyId_userId: { familyId: consultation.member.familyId, userId },
      },
    });
    if (!membership) throw new ForbiddenException('无权操作');

    return this.prisma.consultation.update({
      where: { id: consultationId },
      data: { satisfaction, feedbackText },
    });
  }

  // ============================================================
  // SSE 辅助
  // ============================================================

  /**
   * 泄露关键词清单：只要返回内容（去空白后）仍包含其中任意一项，
   * 即视为「未彻底净化」，必须替换为固定中文兜底回复。
   */
  private readonly LEAK_KEYWORDS = [
    '{output}',
    '{/output}',
    '{response}',
    '{/response}',
    '<im_end>',
    '<|im_end|>',
    '<|endoftext|>',
    'you are',
  ];

  /**
   * 最后一道兜底：确保返回给用户的内容绝不包含模板占位符、角色提示词或英文无关内容。
   * 若 llmGateway 返回空串、仅空白、或仍含泄露关键词，返回固定中文健康咨询兜底回复。
   */
  private ensureSafeResponse(text: string): string {
    const trimmed = (text || '').trim();
    if (!trimmed) {
      return '抱歉，智医助手当前无法给出完整建议，请尝试重新描述症状或联系医生。';
    }
    const lowered = trimmed.toLowerCase();
    const leaked = this.LEAK_KEYWORDS.some((k) => lowered.includes(k));
    if (leaked) {
      this.logger.warn(
        'LLM response still contains leaked tokens after provider sanitization, using safe fallback',
      );
      return '抱歉，智医助手当前无法给出完整建议，请尝试重新描述症状或联系医生。';
    }
    return text;
  }

  private sendSSEEvent(res: Response, event: string, data: unknown): boolean {
    if (res.destroyed || res.writableEnded) return false;
    return res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  private safeJsonParse(str: string | null | undefined): any[] {
    if (!str) return [];
    try {
      const parsed = JSON.parse(str);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}
