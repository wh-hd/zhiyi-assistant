import { MedicationService } from '../../src/modules/medication/medication.service';

describe('MedicationService 创建事务', () => {
  const dto = {
    memberId: 'member-1', medicineName: '测试药品', frequency: 'twice_daily',
    startDate: '2026-07-10',
  };

  function setup(adherenceFailureAt?: number) {
    const order: string[] = [];
    let adherenceCall = 0;
    const tx = {
      medicationPlan: { create: jest.fn().mockResolvedValue({ id: 'plan-1' }) },
      medicationAdherence: {
        upsert: jest.fn().mockImplementation(async () => {
          adherenceCall += 1;
          if (adherenceCall === adherenceFailureAt) throw new Error('injected');
          return { id: `a-${adherenceCall}` };
        }),
      },
    };
    const prisma: any = {
      familyMember: {
        findUnique: jest.fn()
          .mockResolvedValueOnce({ id: 'member-1', familyId: 'family-1' })
          .mockResolvedValueOnce({ id: 'membership-1' }),
      },
      $transaction: jest.fn(async (callback: any) => {
        const result = await callback(tx);
        order.push('transaction-resolved');
        return result;
      }),
    };
    const cache = {
      invalidate: jest.fn().mockImplementation(async () => { order.push('cache'); }),
    };
    const eventBus = {
      publish: jest.fn().mockImplementation(async () => { order.push('event'); }),
    };
    return {
      service: new MedicationService(
        prisma, cache as any, eventBus as any, { authorize: jest.fn() } as any,
      ),
      prisma,
      tx,
      cache,
      eventBus,
      order,
    };
  }

  it('计划与依从记录使用同一个事务 client，提交后执行副作用', async () => {
    const { service, prisma, tx, cache, eventBus, order } = setup();
    await expect(service.create(dto as any, 'user-1')).resolves.toEqual({ id: 'plan-1' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.medicationAdherence.upsert).toHaveBeenCalledTimes(2);
    for (const call of tx.medicationAdherence.upsert.mock.calls) {
      expect(call[0]).toMatchObject({
        create: { planId: 'plan-1', status: 'pending', scheduledAt: expect.any(Date) },
      });
    }
    expect(order).toEqual(['transaction-resolved', 'cache', 'event']);
    expect(cache.invalidate).toHaveBeenCalledTimes(1);
    expect(eventBus.publish).toHaveBeenCalledTimes(1);
  });

  it('第 N 条依从写入失败时事务拒绝且没有提交后副作用', async () => {
    const { service, tx, cache, eventBus } = setup(2);
    await expect(service.create(dto as any, 'user-1')).rejects.toThrow('injected');
    expect(cache.invalidate).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
    expect(tx.medicationAdherence.upsert).toHaveBeenCalledTimes(2);
  });

  it('提交后副作用失败不反转创建成功', async () => {
    const { service, cache, eventBus } = setup();
    cache.invalidate.mockRejectedValueOnce(new Error('cache'));
    eventBus.publish.mockRejectedValueOnce(new Error('event'));
    await expect(service.create(dto as any, 'user-1')).resolves.toEqual({ id: 'plan-1' });
  });
});
