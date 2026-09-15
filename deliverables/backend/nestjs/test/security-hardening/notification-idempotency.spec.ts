import { NotificationService } from '../../src/modules/notification/notification.service';

describe('NotificationService idempotency', () => {
  it('uses the unique business key for an atomic upsert', async () => {
    const upsert = jest.fn().mockResolvedValue({ id: 'n1' });
    const service = new NotificationService({ notification: { upsert } } as never);
    await service.createNotification({
      userId: 'u1',
      familyId: 'f1',
      type: 'system',
      title: '系统通知',
      idempotencyKey: 'event:e1:u1:system',
    });
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { idempotencyKey: 'event:e1:u1:system' },
      update: {},
    }));
  });

  it('rejects an empty idempotency key', async () => {
    const service = new NotificationService({ notification: {} } as never);
    await expect(service.createNotification({
      userId: 'u1', type: 'system', title: '系统通知', idempotencyKey: ' ',
    })).rejects.toThrow('idempotencyKey is required');
  });
});
