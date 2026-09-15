import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AssessmentService } from '../../src/modules/assessment/assessment.service';

describe('AssessmentService 持久会话所有权', () => {
  function setup(session: Record<string, unknown> | null) {
    const update = jest.fn();
    const transactionClient = {
      assessment: { findUnique: jest.fn().mockResolvedValue(session), update },
      healthRecord: { upsert: jest.fn() },
    };
    const prisma: any = {
      $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(transactionClient)),
    };
    const service = new AssessmentService(
      prisma,
      { invalidate: jest.fn() } as any,
      { publish: jest.fn() } as any,
      { authorize: jest.fn() } as any,
    );
    return { service, update };
  }

  it('跨用户提交返回 403 且事务内不写入', async () => {
    const { service, update } = setup({
      id: 'asmt-1', ownerUserId: 'user-a', status: 'in_progress',
      expiresAt: new Date(Date.now() + 60000), currentStep: 0, rawAnswers: '{}',
    });
    await expect(service.submitAnswer('user-b', {
      sessionId: 'asmt-1', step: 1, answers: { q1: 1, q2: 1 },
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(update).not.toHaveBeenCalled();
  });

  it('不存在会话返回 404', async () => {
    const { service } = setup(null);
    await expect(service.submitAnswer('user-a', {
      sessionId: 'missing', step: 1, answers: { q1: 1, q2: 1 },
    })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('过期会话标记 expired 并返回 404', async () => {
    const { service, update } = setup({
      id: 'asmt-1', ownerUserId: 'user-a', status: 'in_progress',
      expiresAt: new Date(Date.now() - 1), currentStep: 0, rawAnswers: '{}',
    });
    await expect(service.submitAnswer('user-a', {
      sessionId: 'asmt-1', step: 1, answers: { q1: 1, q2: 1 },
    })).rejects.toBeInstanceOf(NotFoundException);
    expect(update).toHaveBeenCalledWith({ where: { id: 'asmt-1' }, data: { status: 'expired' } });
  });
});
