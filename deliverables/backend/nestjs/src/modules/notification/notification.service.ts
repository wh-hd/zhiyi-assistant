import {
  Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { Notification } from '@prisma/client';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  // 列表
  // ============================================================

  async list(
    userId: string,
    opts: { type?: string; status?: string; page?: number; pageSize?: number } = {},
  ) {
    const page = opts.page ?? 1;
    const pageSize = opts.pageSize ?? 20;

    const where: any = { userId };
    if (opts.type) where.type = opts.type;
    if (opts.status) where.deliveryStatus = opts.status;

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      items,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  // ============================================================
  // 未读计数
  // ============================================================

  async unreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, readAt: null },
    });
    return { unreadCount: count };
  }

  // ============================================================
  // 标记已读
  // ============================================================

  async markRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification) throw new NotFoundException('通知不存在');
    if (notification.userId !== userId) throw new ForbiddenException('无权操作该通知');

    if (notification.readAt) return notification;

    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  // ============================================================
  // 删除
  // ============================================================

  async remove(id: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification) throw new NotFoundException('通知不存在');
    if (notification.userId !== userId) throw new ForbiddenException('无权操作该通知');

    await this.prisma.notification.delete({ where: { id } });
    return { success: true };
  }

  // ============================================================
  // 内部方法：写入通知（不暴露任何 HTTP 路由）
  // 仅由 NotificationConsumer（@OnEvent）与 NotificationSchedulerService（@Cron）调用
  // ============================================================

  /**
   * 创建一条通知记录。
   *
   * ⚠️ 该方法为内部方法，**不挂在任何 @Controller / 路由上**，
   * 以保证前端既有 GET /notifications 等契约完全不变。
   */
  async createNotification(input: CreateNotificationDto) {
    if (!input.idempotencyKey.trim()) {
      throw new Error('notification idempotencyKey is required');
    }
    return this.prisma.notification.upsert({
      where: { idempotencyKey: input.idempotencyKey },
      update: {},
      create: {
        userId: input.userId,
        familyId: input.familyId ?? null,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        actionUrl: input.actionUrl ?? null,
        channel: input.channel ?? 'in_app',
        status: 'pending',
        deliveryStatus: input.deliveryStatus ?? 'pending',
        idempotencyKey: input.idempotencyKey,
      },
    });
  }

  // ============================================================
  // 微信订阅消息投递（P1-U6）
  // ============================================================

  /**
   * 扫描待投递的微信订阅消息（channel=wechat_subscribe 且 deliveryStatus=pending），
   * 逐条尝试投递并更新状态。供定时任务与手动重试端点复用。
   */
  async deliverPendingWechat(batchSize = 50): Promise<{ processed: number; sent: number; failed: number }> {
    const pending = await this.prisma.notification.findMany({
      where: { channel: 'wechat_subscribe', deliveryStatus: 'pending' },
      take: batchSize,
    });

    let sent = 0;
    let failed = 0;
    for (const n of pending) {
      try {
        const updated = await this.deliverOne(n.id);
        if (updated.deliveryStatus === 'sent') sent += 1;
        else if (updated.deliveryStatus === 'failed') failed += 1;
      } catch {
        failed += 1;
      }
    }
    return { processed: pending.length, sent, failed };
  }

  /**
   * 投递单条微信订阅消息。成功置 sent/sentAt，失败递增 retryCount，
   * 超过 maxRetries 则置 failed。供手动重试端点调用。
   */
  async deliverOne(id: string): Promise<Notification> {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification) throw new NotFoundException('通知不存在');
    if (notification.channel !== 'wechat_subscribe') {
      throw new BadRequestException('仅支持微信订阅消息渠道的投递');
    }
    if (notification.deliveryStatus === 'sent') return notification;

    try {
      await this.sendWechatSubscribe(notification);
      return await this.prisma.notification.update({
        where: { id },
        data: {
          deliveryStatus: 'sent',
          status: 'sent',
          sentAt: new Date(),
          lastError: null,
        },
      });
    } catch (err) {
      const retryCount = (notification.retryCount ?? 0) + 1;
      const exhausted = retryCount >= (notification.maxRetries ?? 3);
      return await this.prisma.notification.update({
        where: { id },
        data: {
          deliveryStatus: exhausted ? 'failed' : 'pending',
          status: exhausted ? 'failed' : 'pending',
          retryCount,
          lastError: (err as Error).message,
        },
      });
    }
  }

  /**
   * 微信订阅消息下发（mock 实现 + TODO）。
   *
   * 真实接入需要：
   *  1) 小程序后台配置订阅消息模板 ID（用药提醒 / 健康预警等）；
   *  2) 用户在前端点「允许」完成 subscribe 授权并上报 openid / 订阅令牌；
   *  3) 服务端持有 access_token，调用微信 subscribeMessage.send 接口下发。
   * 当前仅记录日志并模拟成功，用于打通「pending → sent」状态流转。
   */
  private async sendWechatSubscribe(notification: Notification): Promise<void> {
    // TODO: 接入真实微信订阅消息下发（见方法注释）
    this.logger.log(
      `[MOCK] 微信订阅消息投递 userId=${notification.userId} type=${notification.type} title=${notification.title}`,
    );
    return;
  }
}
