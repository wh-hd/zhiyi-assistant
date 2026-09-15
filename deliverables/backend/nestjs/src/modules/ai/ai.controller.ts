/**
 * ============================================================
 * AI 能力端点
 *  - GET  /v1/ai/status               模型状态自检
 *  - POST /v1/ai/recognize-medication 用药识别（图片 → 药品名称/剂量/用法）
 *  - POST /v1/ai/analyze-report       体检报告解读（图片 → 关键指标）
 * ============================================================
 */

import {
  Controller, Get, Post, UseGuards, Request, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UploadAvailabilityGuard } from '../upload/upload-availability.guard';
import { LlmGatewayService } from '../../shared/llm-gateway/llm-gateway.service';
import { UploadService } from '../upload/upload.service';

// 本地声明上传文件结构 (避免依赖 @types/multer)
interface UploadedFileShape {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@ApiTags('AI 能力')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  private readonly logger = new Logger(AiController.name);

  constructor(
    private readonly llmGateway: LlmGatewayService,
    private readonly configService: ConfigService,
    private readonly uploadService: UploadService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: '查询当前 LLM 模型状态与可用性（模型接入自检）' })
  async status(@Request() req: any) {
    const available = await this.llmGateway.isAvailable();
    const model =
      this.configService.get<string>('LLM_MODEL', 'nexus-medical') ||
      'nexus-medical';
    const provider = this.llmGateway.getProviderName();

    return {
      provider,
      model,
      available,
      user: req.user?.id || null,
      note: available
        ? '模型已部署且可被程序调用'
        : '模型尚未就绪（正在拉取 / 不可达），AI 咨询将降级',
    };
  }

  @Post('recognize-medication')
  @ApiOperation({ summary: '用药识别：上传药品图片，识别名称/剂量/用法' })
  @ApiConsumes('multipart/form-data')
  @UseGuards(UploadAvailabilityGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async recognizeMedication(
    @Request() req: any,
    @UploadedFile() file: UploadedFileShape,
  ) {
    const saved = await this.persistImage(file, req.user?.id, 'medication');
    const prompt = this.buildMedicationPrompt();

    // TODO: 当前 NEXUS-Medical 1.5B 为纯文本模型，不支持图片输入。
    // 需切换至多模态/视觉模型（如视觉 LLM）后，将图片 OCR 文本或图像直接传入 LLM 完成真实识别。
    if (!this.isMultimodalSupported()) {
      return {
        status: 'unavailable',
        message: '该功能正在开发中，请手动录入药品信息。',
        imageUrl: saved?.url ?? null,
      };
    }

    const result = await this.llmGateway.chat(
      [{ role: 'user', content: prompt }],
      { temperature: 0.2, maxTokens: 1024 },
    );
    return {
      status: 'ok',
      result: result.content,
      imageUrl: saved?.url ?? null,
    };
  }

  @Post('analyze-report')
  @ApiOperation({ summary: '体检报告解读：上传报告图片，提取关键指标与建议' })
  @ApiConsumes('multipart/form-data')
  @UseGuards(UploadAvailabilityGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async analyzeReport(
    @Request() req: any,
    @UploadedFile() file: UploadedFileShape,
  ) {
    const saved = await this.persistImage(file, req.user?.id, 'report');
    const prompt = this.buildReportPrompt();

    // TODO: 同上，需多模态模型支持图片输入；当前文本模型无法处理图片。
    if (!this.isMultimodalSupported()) {
      return {
        status: 'unavailable',
        message: '该功能正在开发中，请手动录入体检指标。',
        imageUrl: saved?.url ?? null,
      };
    }

    const result = await this.llmGateway.chat(
      [{ role: 'user', content: prompt }],
      { temperature: 0.3, maxTokens: 1536 },
    );
    return {
      status: 'ok',
      result: result.content,
      imageUrl: saved?.url ?? null,
    };
  }

  // ============================================================
  // 私有辅助
  // ============================================================

  /** 落盘上传图片，返回可访问 URL（失败不影响主流程，仅记录日志） */
  private async persistImage(file: UploadedFileShape | undefined, userId: string, subdir: string) {
    if (!file || !file.buffer) return null;
    try {
      return await this.uploadService.save(file, userId || 'anonymous', {
        subdir: `ai/${subdir}`,
        allowedPrefix: 'image/',
        maxSize: 10 * 1024 * 1024,
      });
    } catch (err) {
      this.logger.error(`AI 图片落盘失败: ${(err as Error).message}`);
      return null;
    }
  }

  /** 是否启用多模态（视觉）模型识别；当前默认关闭，需配置 LLM_MULTIMODAL_ENABLED=true 并切换模型 */
  private isMultimodalSupported(): boolean {
    return this.configService.get<string>('LLM_MULTIMODAL_ENABLED', 'false') === 'true';
  }

  private buildMedicationPrompt(): string {
    return [
      '你是一名严谨的药剂师。请识别用户上传的药品图片，提取以下信息并以 JSON 返回：',
      '{"name":"药品名称","dosage":"剂量(如 10mg)","usage":"用法用量(如 每日一次，口服)","notes":"注意事项","confidence":"高/中/低"}。',
      '若图片不清晰或无法识别，请如实说明。仅输出 JSON，不要额外解释。',
    ].join('\n');
  }

  private buildReportPrompt(): string {
    return [
      '你是一名专业的健康管理师。请解读用户上传的体检报告图片，提取关键异常指标，',
      '并以 JSON 返回：{"abnormal":[{"item":"指标名","value":"检测值","ref":"参考范围","suggest":"建议"}],"summary":"总体结论"}。',
      '仅输出 JSON，不要额外解释。',
    ].join('\n');
  }
}
