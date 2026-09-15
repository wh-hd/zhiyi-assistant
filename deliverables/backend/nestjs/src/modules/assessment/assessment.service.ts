import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { FamilyPolicyService } from '../../common/policies/family-policy.service';
import { CacheService } from '../../shared/cache/cache.service';
import { EventBusService } from '../../shared/events/event-bus.service';
import { EVENTS } from '../../shared/events/events.constants';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { StartAssessmentDto, SubmitAnswerDto } from './dto/assessment.dto';

interface AssessmentOption {
  label: string;
  value: number;
  score: number;
}

interface AssessmentQuestion {
  id: string;
  step: number;
  category: string;
  question: string;
  type: 'single' | 'multiple' | 'scale';
  options: AssessmentOption[];
}

interface ScoreResult {
  totalScore: number;
  categoryScores: Record<string, number>;
  topConcerns: Array<{ category: string; score: number; suggestion: string }>;
  radarChart: Array<{ category: string; score: number }>;
  fullAnalysis: string;
}

type AnswerMap = Record<string, number | number[]>;

// 题目池：每个维度 4 道，共 24 道。每次自评从中随机抽取 10 道（保证 6 个维度均有覆盖）。
const ASSESSMENT_POOL: AssessmentQuestion[] = [
  // —— 身体状态 ——
  {
    id: 'q1', step: 0, category: '身体状态', type: 'single',
    question: '最近一个月，你的整体身体状况如何？',
    options: [
      { label: '精力充沛，无明显不适', value: 1, score: 10 },
      { label: '偶尔疲劳，但可恢复', value: 2, score: 8 },
      { label: '经常感到疲劳或不适', value: 3, score: 5 },
      { label: '严重影响日常生活', value: 4, score: 2 },
    ],
  },
  {
    id: 'q2', step: 0, category: '身体状态', type: 'single',
    question: '你是否经常出现以下症状？（如头痛、胸闷、关节痛等）',
    options: [
      { label: '几乎没有', value: 1, score: 10 },
      { label: '偶尔出现', value: 2, score: 7 },
      { label: '较常出现', value: 3, score: 4 },
      { label: '频繁出现，影响生活', value: 4, score: 1 },
    ],
  },
  {
    id: 'q9', step: 0, category: '身体状态', type: 'single',
    question: '最近是否有不明原因的体重明显变化？',
    options: [
      { label: '没有明显变化', value: 1, score: 10 },
      { label: '轻微变化（±2kg）', value: 2, score: 7 },
      { label: '明显下降', value: 3, score: 4 },
      { label: '明显上升或下降并伴不适', value: 4, score: 1 },
    ],
  },
  {
    id: 'q10', step: 0, category: '身体状态', type: 'single',
    question: '如你有慢性病史（高血压、糖尿病等），目前控制情况？',
    options: [
      { label: '控制良好', value: 1, score: 10 },
      { label: '基本稳定', value: 2, score: 8 },
      { label: '偶尔波动', value: 3, score: 5 },
      { label: '控制差或未按规律治疗', value: 4, score: 1 },
    ],
  },
  // —— 心理健康 ——
  {
    id: 'q3', step: 0, category: '心理健康', type: 'single',
    question: '最近两周，你感到心情低落、沮丧或绝望的频率是？',
    options: [
      { label: '完全没有', value: 1, score: 10 },
      { label: '有几天', value: 2, score: 7 },
      { label: '一半以上天数', value: 3, score: 4 },
      { label: '几乎每天', value: 4, score: 1 },
    ],
  },
  {
    id: 'q4', step: 0, category: '心理健康', type: 'single',
    question: '近两周，你对做事缺乏兴趣或乐趣的频率是？',
    options: [
      { label: '完全没有', value: 1, score: 10 },
      { label: '有几天', value: 2, score: 7 },
      { label: '一半以上天数', value: 3, score: 4 },
      { label: '几乎每天', value: 4, score: 1 },
    ],
  },
  {
    id: 'q11', step: 0, category: '心理健康', type: 'single',
    question: '近两周，你感到紧张、焦虑或难以放松的频率是？',
    options: [
      { label: '完全没有', value: 1, score: 10 },
      { label: '有几天', value: 2, score: 7 },
      { label: '一半以上天数', value: 3, score: 4 },
      { label: '几乎每天', value: 4, score: 1 },
    ],
  },
  {
    id: 'q12', step: 0, category: '心理健康', type: 'single',
    question: '遇到困难时，你觉得自己能获得足够情感支持吗？',
    options: [
      { label: '总是能', value: 1, score: 10 },
      { label: '多数时候能', value: 2, score: 8 },
      { label: '很少能', value: 3, score: 5 },
      { label: '几乎不能', value: 4, score: 1 },
    ],
  },
  // —— 睡眠质量 ——
  {
    id: 'q5', step: 0, category: '睡眠质量', type: 'single',
    question: '近一个月，你的睡眠质量如何？',
    options: [
      { label: '入睡快，睡眠充足', value: 1, score: 10 },
      { label: '偶尔失眠或早醒', value: 2, score: 7 },
      { label: '经常难以入睡或多梦', value: 3, score: 4 },
      { label: '严重失眠，依赖药物', value: 4, score: 1 },
    ],
  },
  {
    id: 'q13', step: 0, category: '睡眠质量', type: 'single',
    question: '你通常每晚的实际睡眠时间约为？',
    options: [
      { label: '7-8 小时', value: 1, score: 10 },
      { label: '6-7 小时', value: 2, score: 8 },
      { label: '5-6 小时', value: 3, score: 5 },
      { label: '少于 5 小时', value: 4, score: 1 },
    ],
  },
  {
    id: 'q14', step: 0, category: '睡眠质量', type: 'single',
    question: '你是否有打鼾严重或睡眠中憋醒的情况？',
    options: [
      { label: '没有', value: 1, score: 10 },
      { label: '偶尔', value: 2, score: 7 },
      { label: '经常', value: 3, score: 4 },
      { label: '几乎每晚', value: 4, score: 1 },
    ],
  },
  {
    id: 'q15', step: 0, category: '睡眠质量', type: 'single',
    question: '白天你是否常感到困倦并影响工作？',
    options: [
      { label: '从不', value: 1, score: 10 },
      { label: '偶尔', value: 2, score: 7 },
      { label: '经常', value: 3, score: 4 },
      { label: '总是', value: 4, score: 1 },
    ],
  },
  // —— 饮食与代谢 ——
  {
    id: 'q6', step: 0, category: '饮食与代谢', type: 'multiple',
    question: '你的饮食结构中，以下哪些描述符合你？（可多选）',
    options: [
      { label: '三餐规律，荤素搭配合理', value: 1, score: 10 },
      { label: '偏好重口味（咸/辣/油）', value: 2, score: 4 },
      { label: '常吃外卖或速食', value: 3, score: 3 },
      { label: '蔬菜水果摄入不足', value: 4, score: 5 },
    ],
  },
  {
    id: 'q16', step: 0, category: '饮食与代谢', type: 'multiple',
    question: '以下哪些关于你的饮水习惯符合实际？（可多选）',
    options: [
      { label: '每天喝水 ≥1.5L', value: 1, score: 10 },
      { label: '常喝含糖饮料', value: 2, score: 4 },
      { label: '常饮酒', value: 3, score: 3 },
      { label: '很少主动喝水', value: 4, score: 5 },
    ],
  },
  {
    id: 'q17', step: 0, category: '饮食与代谢', type: 'single',
    question: '你的体重是否在正常范围内（BMI）？',
    options: [
      { label: '正常', value: 1, score: 10 },
      { label: '偏胖', value: 2, score: 6 },
      { label: '偏瘦', value: 3, score: 6 },
      { label: '明显超重/肥胖', value: 4, score: 2 },
    ],
  },
  {
    id: 'q18', step: 0, category: '饮食与代谢', type: 'single',
    question: '你在外就餐或点外卖的频率？',
    options: [
      { label: '很少', value: 1, score: 10 },
      { label: '1-2 次/周', value: 2, score: 7 },
      { label: '3-4 次/周', value: 3, score: 4 },
      { label: '几乎每天', value: 4, score: 1 },
    ],
  },
  // —— 运动与活动 ——
  {
    id: 'q7', step: 0, category: '运动与活动', type: 'single',
    question: '近一个月，你平均每周运动（≥30分钟/次）的次数？',
    options: [
      { label: '每周 4 次及以上', value: 1, score: 10 },
      { label: '每周 2-3 次', value: 2, score: 8 },
      { label: '每周 1 次', value: 3, score: 5 },
      { label: '几乎没有运动', value: 4, score: 2 },
    ],
  },
  {
    id: 'q19', step: 0, category: '运动与活动', type: 'single',
    question: '你日常以静坐为主的时间（工作+休闲）约为？',
    options: [
      { label: '不足 4 小时', value: 1, score: 10 },
      { label: '4-8 小时', value: 2, score: 7 },
      { label: '8-10 小时', value: 3, score: 4 },
      { label: '超过 10 小时', value: 4, score: 1 },
    ],
  },
  {
    id: 'q20', step: 0, category: '运动与活动', type: 'single',
    question: '你是否有意识地做拉伸或力量训练？',
    options: [
      { label: '每周 ≥2 次', value: 1, score: 10 },
      { label: '每月几次', value: 2, score: 7 },
      { label: '很少', value: 3, score: 4 },
      { label: '从不', value: 4, score: 1 },
    ],
  },
  {
    id: 'q21', step: 0, category: '运动与活动', type: 'single',
    question: '你每天步行或日常活动量约为？',
    options: [
      { label: '充足（>8000 步）', value: 1, score: 10 },
      { label: '中等', value: 2, score: 7 },
      { label: '偏少', value: 3, score: 4 },
      { label: '极少', value: 4, score: 1 },
    ],
  },
  // —— 用药依从 ——
  {
    id: 'q8', step: 0, category: '用药依从', type: 'single',
    question: '如果你有长期用药需求，你按时服药的频率是？',
    options: [
      { label: '从不漏服', value: 1, score: 10 },
      { label: '偶尔漏服（<2次/周）', value: 2, score: 7 },
      { label: '较常漏服（3-5次/周）', value: 3, score: 4 },
      { label: '经常忘记或自行停药', value: 4, score: 1 },
      { label: '无长期用药', value: 0, score: 10 },
    ],
  },
  {
    id: 'q22', step: 0, category: '用药依从', type: 'single',
    question: '你服药时是否会仔细阅读说明书或遵医嘱？',
    options: [
      { label: '总是', value: 1, score: 10 },
      { label: '多数时候', value: 2, score: 8 },
      { label: '偶尔', value: 3, score: 5 },
      { label: '从不', value: 4, score: 1 },
    ],
  },
  {
    id: 'q23', step: 0, category: '用药依从', type: 'single',
    question: '你是否会自行增减药量或停药？',
    options: [
      { label: '从不', value: 1, score: 10 },
      { label: '偶尔', value: 2, score: 7 },
      { label: '有时', value: 3, score: 4 },
      { label: '经常', value: 4, score: 1 },
    ],
  },
  {
    id: 'q24', step: 0, category: '用药依从', type: 'single',
    question: '你家中是否常备并定期整理家庭药箱？',
    options: [
      { label: '是，且定期整理', value: 1, score: 10 },
      { label: '有但不整理', value: 2, score: 7 },
      { label: '很少备药', value: 3, score: 5 },
      { label: '从不备药', value: 4, score: 1 },
    ],
  },
];

const CATEGORY_WEIGHTS: Record<string, number> = {
  身体状态: 0.2,
  心理健康: 0.2,
  睡眠质量: 0.15,
  饮食与代谢: 0.15,
  运动与活动: 0.15,
  用药依从: 0.15,
};
const DEFAULT_QUESTION_COUNT = 10;
const SESSION_TTL_MS = 30 * 60 * 1000;

@Injectable()
export class AssessmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly eventBus: EventBusService,
    private readonly policy: FamilyPolicyService,
  ) {}

  /** 创建可跨实例恢复的数据库自评会话。 */
  async start(
    userId: string,
    dto: StartAssessmentDto,
    idempotencyKey?: string,
  ): Promise<Record<string, unknown>> {
    const { actor, target } = await this.resolveActorAndTarget(dto.memberId, userId);
    this.policy.authorize({ action: 'health:write', actor, target });
    const requestKey = idempotencyKey?.trim()
      ? `assessment:${userId}:${idempotencyKey.trim()}`
      : null;
    if (requestKey && requestKey.length > 191) {
      throw new BadRequestException('Idempotency-Key 过长');
    }

    let assessment = requestKey
      ? await this.prisma.assessment.findUnique({ where: { requestKey } })
      : null;
    if (assessment) {
      if (assessment.memberId !== dto.memberId || assessment.type !== dto.type) {
        throw new ConflictException('Idempotency-Key 已用于其他自评请求');
      }
      return this.serializeSession(assessment);
    }

    const selected = this.pickRandomQuestions(dto.questionCount ?? DEFAULT_QUESTION_COUNT);
    const questionsWithStep = selected.map((question, index) => ({ ...question, step: index + 1 }));

    try {
      assessment = await this.prisma.assessment.create({
        data: {
          id: `asmt_${randomUUID()}`,
          memberId: target.id,
          familyId: target.familyId,
          ownerUserId: userId,
          type: dto.type,
          currentStep: 0,
          expiresAt: new Date(Date.now() + SESSION_TTL_MS),
          requestKey,
          rawAnswers: '{}',
          questions: JSON.stringify(questionsWithStep),
          topConcerns: '[]',
          status: 'in_progress',
        },
      });
    } catch (error) {
      if (requestKey && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        assessment = await this.prisma.assessment.findUnique({ where: { requestKey } });
      }
      if (!assessment) throw error;
    }
    return this.serializeSession(assessment);
  }

  /** 严格校验当前步骤答案，并以 RepeatableRead 事务推进或完成会话。 */
  async submitAnswer(userId: string, dto: SubmitAnswerDto): Promise<Record<string, unknown>> {
    const outcome = await this.prisma.$transaction(async (tx) => {
      const session = await tx.assessment.findUnique({ where: { id: dto.sessionId } });
      if (!session || session.status === 'expired') throw new NotFoundException('会话不存在或已过期');
      if (session.ownerUserId !== userId) throw new ForbiddenException('无权操作该自评会话');
      const sessionQuestions = this.parseQuestions(session.questions);
      const totalSteps = sessionQuestions.length;
      if (session.status === 'completed') {
        if (dto.step === totalSteps) return { assessment: session, completedNow: false };
        throw new ConflictException('自评已完成');
      }
      if (!session.expiresAt || session.expiresAt.getTime() <= Date.now()) {
        await tx.assessment.update({ where: { id: session.id }, data: { status: 'expired' } });
        throw new NotFoundException('会话已过期，请重新开始自评');
      }
      if (dto.step !== session.currentStep + 1) {
        throw new ConflictException(`请先完成第 ${session.currentStep + 1} 步`);
      }
      const answerPatch = this.validateStepAnswers(sessionQuestions, dto.step, dto.answers);
      const answers = this.parseAnswers(session.rawAnswers);
      Object.assign(answers, answerPatch);

      if (dto.step < totalSteps) {
        const updated = await tx.assessment.update({
          where: { id: session.id },
          data: { currentStep: dto.step, rawAnswers: JSON.stringify(answers) },
        });
        return { assessment: updated, completedNow: false };
      }

      const result = this.calculateScore(answers, sessionQuestions);
      const completedAt = new Date();
      const updated = await tx.assessment.update({
        where: { id: session.id },
        data: {
          currentStep: totalSteps,
          totalScore: new Prisma.Decimal(result.totalScore.toFixed(1)),
          categoryScores: JSON.stringify(result.categoryScores),
          topConcerns: JSON.stringify(result.topConcerns),
          radarChart: JSON.stringify(result.radarChart),
          fullAnalysis: result.fullAnalysis,
          rawAnswers: JSON.stringify(answers),
          status: 'completed',
          completedAt,
          expiresAt: null,
          nextReviewAt: new Date(completedAt.getTime() + 30 * 24 * 60 * 60 * 1000),
        },
      });
      await tx.healthRecord.upsert({
        where: { memberId: session.memberId },
        update: {
          lastAssessmentId: session.id,
          lastAssessmentScore: new Prisma.Decimal(result.totalScore.toFixed(1)),
          lastAssessmentDate: completedAt,
        },
        create: {
          memberId: session.memberId,
          lastAssessmentId: session.id,
          lastAssessmentScore: new Prisma.Decimal(result.totalScore.toFixed(1)),
          lastAssessmentDate: completedAt,
          chronicDiseases: '[]',
          allergies: '[]',
          surgeries: '[]',
          familyHistory: '[]',
          vaccinations: '[]',
        },
      });
      return { assessment: updated, completedNow: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30000 });

    if (outcome.assessment.status !== 'completed') return this.serializeSession(outcome.assessment);
    const response = this.serializeResult(outcome.assessment);
    if (outcome.completedNow) {
      await this.cache.invalidate(`member:${outcome.assessment.memberId}:*`);
      await this.cache.invalidate(`family:${outcome.assessment.familyId}:*`);
      await this.eventBus.publish(EVENTS.ASSESSMENT_COMPLETED, {
        assessmentId: outcome.assessment.id,
        memberId: outcome.assessment.memberId,
        familyId: outcome.assessment.familyId,
        totalScore: Number(outcome.assessment.totalScore),
      });
    }
    return response;
  }

  /** 获取自评结果，并隐藏内部幂等键。 */
  async getResult(assessmentId: string, userId: string): Promise<Record<string, unknown>> {
    const assessment = await this.prisma.assessment.findUnique({ where: { id: assessmentId } });
    if (!assessment) throw new NotFoundException('自评记录不存在');
    await this.assertFamilyRead(assessment.familyId, userId);
    if (assessment.status !== 'completed') throw new ConflictException('自评尚未完成');
    return this.serializeResult(assessment);
  }

  /** 获取已完成自评历史。 */
  async getHistory(userId: string, memberId: string, page = 1, pageSize = 10) {
    const member = await this.prisma.familyMember.findUnique({ where: { id: memberId } });
    if (!member) throw new NotFoundException('成员不存在');
    await this.assertFamilyRead(member.familyId, userId);
    const where = { memberId, status: 'completed' };
    const [items, total] = await Promise.all([
      this.prisma.assessment.findMany({
        where,
        orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, type: true, totalScore: true, topConcerns: true,
          completedAt: true, nextReviewAt: true, status: true,
        },
      }),
      this.prisma.assessment.count({ where }),
    ]);
    return {
      items: items.map((item) => ({ ...item, totalScore: Number(item.totalScore), scoreScale: 1 })),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async manualReview(userId: string, memberId: string) {
    return this.start(userId, { memberId, type: 'manual' });
  }

  async findDueReviews() {
    return this.prisma.assessment.findMany({
      where: {
        nextReviewAt: { lte: new Date() }, status: 'completed', reviewNotified: false,
      },
      include: { member: { select: { userId: true, familyId: true, nickname: true } } },
    });
  }

  /** 解析会话持久化的题目集（含选项分值，用于校验与评分）。 */
  private parseQuestions(raw: string | null): AssessmentQuestion[] {
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (q): q is AssessmentQuestion =>
          !!q && typeof q === 'object' &&
          typeof (q as AssessmentQuestion).id === 'string' &&
          Array.isArray((q as AssessmentQuestion).options),
      );
    } catch {
      return [];
    }
  }

  /** 从题目池中随机抽取 count 道，保证每个维度至少 1 道，最终顺序打散。 */
  private pickRandomQuestions(count = DEFAULT_QUESTION_COUNT): AssessmentQuestion[] {
    const byCategory = new Map<string, AssessmentQuestion[]>();
    for (const question of ASSESSMENT_POOL) {
      const list = byCategory.get(question.category) ?? [];
      list.push(question);
      byCategory.set(question.category, list);
    }
    const categories = [...byCategory.keys()];
    const selected: AssessmentQuestion[] = [];

    if (count <= categories.length) {
      this.shuffle(categories);
      for (const category of categories.slice(0, count)) {
        selected.push(this.randomPick(byCategory.get(category)!));
      }
    } else {
      for (const category of categories) {
        selected.push(this.randomPick(byCategory.get(category)!));
      }
      const leftover: AssessmentQuestion[] = [];
      for (const category of categories) {
        const takenId = selected.find((question) => question.category === category)!.id;
        for (const question of byCategory.get(category)!) {
          if (question.id !== takenId) leftover.push(question);
        }
      }
      this.shuffle(leftover);
      selected.push(...leftover.slice(0, count - categories.length));
    }
    this.shuffle(selected);
    return selected;
  }

  private shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  private randomPick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  private validateStepAnswers(questions: AssessmentQuestion[], step: number, raw: Record<string, unknown>): AnswerMap {
    const stepQuestions = questions.filter((question) => question.step === step);
    const expectedIds = new Set(stepQuestions.map((question) => question.id));
    const suppliedIds = Object.keys(raw);
    if (suppliedIds.length !== stepQuestions.length || suppliedIds.some((id) => !expectedIds.has(id))) {
      throw new BadRequestException('必须且只能提交当前步骤的全部题目');
    }
    const result: AnswerMap = {};
    for (const question of stepQuestions) {
      const answer = raw[question.id];
      const allowed = new Set(question.options.map((option) => option.value));
      if (question.type === 'multiple') {
        if (!Array.isArray(answer) || answer.length === 0 || !answer.every(Number.isInteger)) {
          throw new BadRequestException(`${question.id} 必须为非空整数数组`);
        }
        const values = answer as number[];
        if (new Set(values).size !== values.length || values.some((value) => !allowed.has(value))) {
          throw new BadRequestException(`${question.id} 包含重复或非法选项`);
        }
        result[question.id] = values;
      } else {
        if (!Number.isInteger(answer) || !allowed.has(answer as number)) {
          throw new BadRequestException(`${question.id} 选项无效`);
        }
        result[question.id] = answer as number;
      }
    }
    return result;
  }

  private parseAnswers(raw: string | null): AnswerMap {
    if (!raw) return {};
    try {
      const parsed: unknown = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as AnswerMap
        : {};
    } catch {
      throw new ConflictException('自评会话答案数据损坏');
    }
  }

  private serializeSession(assessment: {
    id: string; currentStep: number; status: string; expiresAt: Date | null;
    totalScore: Prisma.Decimal | null; categoryScores: string | null;
    topConcerns: string; radarChart: string | null; fullAnalysis: string | null;
    questions: string | null;
  }): Record<string, unknown> {
    if (assessment.status === 'completed') return this.serializeResult(assessment);
    const selected = this.parseQuestions(assessment.questions);
    const totalSteps = selected.length;
    const nextStep = assessment.currentStep + 1;
    const stepQuestions = selected.filter((question) => question.step === nextStep);
    return {
      sessionId: assessment.id,
      totalSteps,
      currentStep: nextStep,
      expiresAt: assessment.expiresAt,
      questions: stepQuestions.map((question) => ({
        id: question.id,
        question: question.question,
        type: question.type,
        options: question.options.map(({ label, value }) => ({ label, value })),
      })),
    };
  }

  private serializeResult(assessment: {
    id: string; totalScore: Prisma.Decimal | null; categoryScores: string | null;
    topConcerns: string; radarChart: string | null; fullAnalysis: string | null;
  }): Record<string, unknown> {
    return {
      assessmentId: assessment.id,
      totalScore: Number(assessment.totalScore),
      scoreScale: 1,
      categoryScores: this.parseJson(assessment.categoryScores, {}),
      topConcerns: this.parseJson(assessment.topConcerns, []),
      radarChart: this.parseJson(assessment.radarChart, []),
      fullAnalysis: assessment.fullAnalysis ?? '',
    };
  }

  private parseJson<T>(raw: string | null, fallback: T): T {
    if (!raw) return fallback;
    try { return JSON.parse(raw) as T; } catch { return fallback; }
  }

  private async resolveActorAndTarget(memberId: string, userId: string) {
    const target = await this.prisma.familyMember.findUnique({ where: { id: memberId } });
    if (!target) throw new NotFoundException('成员不存在');
    const actor = await this.prisma.familyMember.findUnique({
      where: { familyId_userId: { familyId: target.familyId, userId } },
    });
    if (!actor) throw new ForbiddenException('无权访问该成员');
    return { actor, target };
  }

  private async assertFamilyRead(familyId: string, userId: string): Promise<void> {
    const actor = await this.prisma.familyMember.findUnique({
      where: { familyId_userId: { familyId, userId } },
      select: { id: true },
    });
    if (!actor) throw new ForbiddenException('无权查看该家庭自评');
  }

  private calculateScore(answers: AnswerMap, questions: AssessmentQuestion[]): ScoreResult {
    const categoryRaw: Record<string, { total: number; count: number }> = {};
    for (const question of questions) {
      const answer = answers[question.id];
      const values = Array.isArray(answer) ? answer : [answer];
      const scores = values.map((value) => question.options.find((option) => option.value === value)?.score ?? 0);
      const score = scores.reduce((sum, current) => sum + current, 0) / scores.length;
      categoryRaw[question.category] ??= { total: 0, count: 0 };
      categoryRaw[question.category].total += score;
      categoryRaw[question.category].count += 1;
    }
    const categoryScores: Record<string, number> = {};
    let weightedTotal = 0;
    for (const [category, raw] of Object.entries(categoryRaw)) {
      categoryScores[category] = Math.round((raw.total / raw.count) * 10) / 10;
      weightedTotal += categoryScores[category] * (CATEGORY_WEIGHTS[category] ?? 0);
    }
    const totalScore = Math.round(weightedTotal * 10) / 10;
    const topConcerns = Object.entries(categoryScores)
      .sort((left, right) => left[1] - right[1])
      .slice(0, 2)
      .map(([category, score]) => ({ category, score, suggestion: this.getSuggestion(category, score) }));
    const radarChart = Object.entries(categoryScores).map(([category, score]) => ({ category, score }));
    const level = totalScore >= 8 ? '良好' : totalScore >= 6 ? '一般' : '需要关注';
    const concerns = topConcerns
      .map((concern) => `• **${concern.category}**（${concern.score}分）：${concern.suggestion}`)
      .join('\n');
    const fullAnalysis = [
      `## 综合评估：${level}`,
      `整体健康自评得分：**${totalScore.toFixed(1)}/10**`,
      '', '### 重点关注领域', concerns, '', '### 温馨提示',
      '> 本自评结果仅供参考，不构成医疗诊断。如有不适，请及时就医。',
      '建议在 **30天后** 进行复评，跟踪健康状态变化。',
    ].join('\n');
    return { totalScore, categoryScores, topConcerns, radarChart, fullAnalysis };
  }

  private getSuggestion(category: string, score: number): string {
    if (score >= 7) return `你在「${category}」方面表现良好，继续保持！`;
    const tips: Record<string, string> = {
      身体状态: '建议进行常规体检，关注身体信号，适当增加休息时间',
      心理健康: '建议多与家人朋友沟通，必要时可寻求心理咨询支持',
      睡眠质量: '建议固定作息时间，睡前避免使用电子设备，营造良好的睡眠环境',
      饮食与代谢: '建议增加蔬菜水果摄入，减少高盐高油食物，保持三餐规律',
      运动与活动: '建议从快步走或轻度运动开始，每周至少 150 分钟中等强度活动',
      用药依从: '建议设置用药提醒，与家人共同监督，不要自行停药或调整剂量',
    };
    return tips[category] ?? `建议关注「${category}」方面的改善`;
  }
}
