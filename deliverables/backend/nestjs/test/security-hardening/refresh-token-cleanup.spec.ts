import { RefreshTokenCleanupScheduler } from '../../src/modules/auth/refresh-token-cleanup.scheduler';

describe('RefreshTokenCleanupScheduler', () => {
  it('查询和删除均只使用 expiresAt cutoff，保留未过期 revoked', async () => {
    const prisma: any = {
      refreshToken: {
        findMany: jest.fn()
          .mockResolvedValueOnce([{ id: 'expired' }])
          .mockResolvedValueOnce([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const scheduler = new RefreshTokenCleanupScheduler(
      prisma,
      { get: jest.fn((_key: string, fallback: unknown) => fallback) } as any,
    );
    await scheduler.handleExpiredTokenCleanup();
    expect(prisma.refreshToken.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { expiresAt: { lt: expect.any(Date) } },
    }));
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: ['expired'] }, expiresAt: { lt: expect.any(Date) } },
    }));
    const serialized = JSON.stringify(prisma.refreshToken.deleteMany.mock.calls);
    expect(serialized).not.toContain('revokedAt');
  });

  it('批次异常被最外层捕获', async () => {
    const prisma: any = {
      refreshToken: { findMany: jest.fn().mockRejectedValue(new Error('db unavailable')) },
    };
    const scheduler = new RefreshTokenCleanupScheduler(
      prisma,
      { get: jest.fn((_key: string, fallback: unknown) => fallback) } as any,
    );
    await expect(scheduler.handleExpiredTokenCleanup()).resolves.toBeUndefined();
  });

  it('竞争实例删掉当前批次后仍继续处理其余过期记录', async () => {
    const firstBatch = Array.from({ length: 50 }, (_, index) => ({ id: `claimed-${index}` }));
    const prisma: any = {
      refreshToken: {
        findMany: jest.fn()
          .mockResolvedValueOnce(firstBatch)
          .mockResolvedValueOnce([{ id: 'remaining-expired' }])
          .mockResolvedValueOnce([]),
        deleteMany: jest.fn()
          .mockResolvedValueOnce({ count: 0 })
          .mockResolvedValueOnce({ count: 1 }),
      },
    };
    const scheduler = new RefreshTokenCleanupScheduler(
      prisma,
      { get: jest.fn((key: string, fallback: unknown) => (
        key === 'REFRESH_TOKEN_CLEANUP_BATCH_SIZE' ? 50 : fallback
      )) } as any,
    );

    const result = await (scheduler as any).deleteExpiredInBatches(
      new Date('2026-07-10T00:00:00Z'),
    );

    expect(result).toEqual({ deleted: 1, batches: 2 });
    // 第二批为短批次（< batchSize）后立即退出循环，故 findMany 调用 2 次而非 3 次
    expect(prisma.refreshToken.findMany).toHaveBeenCalledTimes(2);
    expect(prisma.refreshToken.deleteMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ['remaining-expired'] } }),
      }),
    );
  });
});
