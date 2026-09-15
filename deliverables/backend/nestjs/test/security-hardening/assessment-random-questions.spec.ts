import { BadRequestException } from '@nestjs/common';
import { AssessmentService } from '../../src/modules/assessment/assessment.service';

const CATEGORIES = ['身体状态', '心理健康', '睡眠质量', '饮食与代谢', '运动与活动', '用药依从'];

function mockMember() {
  return { id: 'member-1', familyId: 'family-1', userId: 'user-a' };
}

function buildService(prisma: any) {
  return new AssessmentService(
    prisma,
    { invalidate: jest.fn() } as any,
    { publish: jest.fn() } as any,
    { authorize: jest.fn() } as any,
  );
}

describe('AssessmentService 随机抽题与持久化', () => {
  it('start 每次抽取 10 道且覆盖全部 6 个维度，并写入数据库 questions 字段', async () => {
    const created: Record<string, unknown> = {};
    const prisma: any = {
      familyMember: { findUnique: jest.fn().mockResolvedValue(mockMember()) },
      assessment: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
          Object.assign(created, data);
          return Promise.resolve({ ...data, id: 'asmt-x' });
        }),
      },
    };
    const service = buildService(prisma);
    const result: any = await service.start('user-a', { memberId: 'member-1', type: 'initial' });

    expect(result.totalSteps).toBe(10);
    expect(result.currentStep).toBe(1);
    expect(result.questions).toHaveLength(1); // 当前步骤只返回 1 题

    const persisted = JSON.parse(created.questions as string);
    expect(persisted).toHaveLength(10);
    const ids = new Set(persisted.map((q: any) => q.id));
    expect(ids.size).toBe(10); // 无重复
    const cats = new Set(persisted.map((q: any) => q.category));
    expect([...cats].sort()).toEqual([...CATEGORIES].sort()); // 六维全覆盖
    for (const q of persisted) {
      expect(q.options.every((o: any) => typeof o.score === 'number')).toBe(true); // 含分值，供评分
      expect(q.step).toBeGreaterThanOrEqual(1);
      expect(q.step).toBeLessThanOrEqual(10);
    }
  });

  it('两次 start 抽出的题目集合不同（随机性）', async () => {
    const captured: string[] = [];
    const make = () => {
      const prisma: any = {
        familyMember: { findUnique: jest.fn().mockResolvedValue(mockMember()) },
        assessment: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
            captured.push(data.questions as string);
            return Promise.resolve({ ...data });
          }),
        },
      };
      return buildService(prisma);
    };
    const s1 = make();
    const s2 = make();
    await s1.start('user-a', { memberId: 'member-1', type: 'initial' });
    await s2.start('user-a', { memberId: 'member-1', type: 'initial' });
    expect(captured).toHaveLength(2);
    expect(captured[0]).not.toBe(captured[1]);
  });

  it('submitAnswer 按会话题目逐步校验并最终评分落库', async () => {
    const questions = [
      { id: 'qa', step: 1, category: '身体状态', type: 'single', options: [{ label: 'a', value: 1, score: 10 }, { label: 'b', value: 2, score: 1 }] },
      { id: 'qb', step: 2, category: '心理健康', type: 'single', options: [{ label: 'a', value: 1, score: 10 }, { label: 'b', value: 2, score: 1 }] },
    ];
    const session: any = {
      id: 'asmt-2', ownerUserId: 'user-a', status: 'in_progress',
      expiresAt: new Date(Date.now() + 60000), currentStep: 0, rawAnswers: '{}',
      questions: JSON.stringify(questions), memberId: 'member-1', familyId: 'family-1',
    };
    const transactionClient = {
      assessment: {
        findUnique: jest.fn().mockResolvedValue(session),
        update: jest.fn(({ data }: { data: Record<string, unknown> }) => {
          Object.assign(session, data);
          return Promise.resolve(session);
        }),
      },
      healthRecord: { upsert: jest.fn() },
    };
    const prisma: any = { $transaction: jest.fn((cb: any) => cb(transactionClient)) };
    const service = buildService(prisma);

    const r1: any = await service.submitAnswer('user-a', { sessionId: 'asmt-2', step: 1, answers: { qa: 1 } });
    expect(r1.currentStep).toBe(2);
    expect(r1.questions).toHaveLength(1);
    expect(r1.questions[0].id).toBe('qb');

    const r2: any = await service.submitAnswer('user-a', { sessionId: 'asmt-2', step: 2, answers: { qb: 1 } });
    expect(r2.assessmentId).toBe('asmt-2');
    expect(r2.totalScore).toBeGreaterThan(0);
    expect(r2.categoryScores['身体状态']).toBe(10);
  });

  it('submitAnswer 提交非本步题目则返回 400', async () => {
    const questions = [
      { id: 'qa', step: 1, category: '身体状态', type: 'single', options: [{ label: 'a', value: 1, score: 10 }] },
    ];
    const session: any = {
      id: 'asmt-3', ownerUserId: 'user-a', status: 'in_progress',
      expiresAt: new Date(Date.now() + 60000), currentStep: 0, rawAnswers: '{}',
      questions: JSON.stringify(questions), memberId: 'member-1', familyId: 'family-1',
    };
    const transactionClient = {
      assessment: { findUnique: jest.fn().mockResolvedValue(session), update: jest.fn() },
      healthRecord: { upsert: jest.fn() },
    };
    const prisma: any = { $transaction: jest.fn((cb: any) => cb(transactionClient)) };
    const service = buildService(prisma);
    await expect(
      service.submitAnswer('user-a', { sessionId: 'asmt-3', step: 1, answers: { qb: 1 } }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
