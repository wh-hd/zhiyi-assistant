/**
 * 创建通知的内部入参（非 API DTO，不暴露任何 HTTP 路由）
 *
 * 仅由 `NotificationConsumer`（@OnEvent 订阅者）与
 * `NotificationSchedulerService`（@Cron 定时任务）调用
 * `NotificationService.createNotification()` 时使用。
 */
export type NotificationType =
  | 'medication_reminder'
  | 'missed_dose'
  | 'metric_alert'
  | 'assessment_review'
  | 'system'
  | 'red_line';

export interface CreateNotificationDto {
  /** 接收用户 id（必填） */
  userId: string;
  /** 关联家庭 id（可选，用于前端按家庭聚合） */
  familyId?: string;
  /** 通知类型（见 NotificationType） */
  type: NotificationType;
  /** 标题（必填） */
  title: string;
  /** 正文（可选） */
  body?: string;
  /** 点击跳转链接（可选） */
  actionUrl?: string;
  /** 推送渠道，默认 in_app（P0 内部通知） */
  channel?: string;
  /** 业务幂等键。相同事件和接收者只能创建一次通知。 */
  idempotencyKey: string;
  /** 发送状态，默认 pending；阅读状态仅由 readAt 表达。 */
  deliveryStatus?: string;
}
