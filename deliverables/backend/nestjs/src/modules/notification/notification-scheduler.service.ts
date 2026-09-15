import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { NotificationService } from './notification.service';
import { AssessmentService } from '../assessment/assessment.service';
import { MedicationService } from '../medication/medication.service';
import { MetricService } from '../metric/metric.service';

/**
 * 定时任务（@nestjs/schedule）—— 解决"过期未处理"类通知，事件总线无法覆盖的场景。
 *
 * 三个定时任务：
 *  ① 30 天复评提醒（每天 09:00）
 *  ② 漏服告警（每 15 分钟）
 *  ③ 连续异常预警（每天 08:30）
 *
 * 所有通知写入统一走 `NotificationService.createNotification()`（内部方法，不暴露路由）。
 * 每个任务均带去重字段，防止事件与 cron 重复轰炸、或服务重启后重复调度。
 */
@Injectable()
export class NotificationSchedulerService {
  private readonly logger = new Logger(NotificationSchedulerService.name);
  private static readonly TIMEZONE = 'Asia/Shanghai';

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly assessmentService: AssessmentService,
    private readonly medicationService: MedicationService,
    private readonly metricService: MetricService,
  ) {}

  // ============================================================
  // Cron ① 30 天复评提醒 —— 每天 09:00 (Asia/Shanghai)
  // ============================================================

  @Cron(CronExpression.EVERY_DAY_AT_9AM, { timeZone: NotificationSchedulerService.TIMEZONE })
  async handleReviewReminders(): Promise<void> {
    let count = 0;
    try {
      const due = await this.assessmentService.findDueReviews();
      for (const a of due) {
        const recipient = await this.resolveRecipient(a.member?.userId ?? null, a.member?.familyId ?? a.familyId);
        if (!recipient) continue;
        try {
          await this.notificationService.createNotification({
            userId: recipient.userId,
            familyId: recipient.familyId,
            type: 'assessment_review',
            title: '健康自评复评提醒',
            body: '您上次自评已满 30 天，建议尽快进行复评。',
            actionUrl: '/assessment',
            idempotencyKey: `assessment-review:${a.id}:${recipient.userId}`,
          });
          await this.prisma.assessment.update({
            where: { id: a.id },
            data: { reviewNotified: true },
          });
          count += 1;
        } catch (err: any) {
          this.logger.error(`复评提醒写入失败 assessmentId=${a.id}: ${err?.message ?? err}`);
        }
      }
      if (count) this.logger.log(`复评提醒：已为 ${count} 条自评生成通知`);
    } catch (err: any) {
      this.logger.error(`复评提醒任务异常: ${err?.message ?? err}`);
    }
  }

  // ============================================================
  // Cron ② 漏服告警 —— 每 15 分钟
  // ============================================================

  @Cron('0 */15 * * * *', { timeZone: NotificationSchedulerService.TIMEZONE })
  async handleMissedDoses(): Promise<void> {
    let count = 0;
    try {
      const overdue = await this.medicationService.findOverdueAdherences();
      const now = new Date();
      for (const adh of overdue) {
        const plan = adh.plan;
        if (!plan) continue;
        const recipient = await this.resolveRecipientByMember(plan.memberId, plan.familyId);
        if (!recipient) continue;
        try {
          const dosage = `${plan.dosage ?? ''}${plan.dosageUnit ?? ''}`.trim();
          const hh = String(adh.scheduledAt.getHours()).padStart(2, '0');
          const mm = String(adh.scheduledAt.getMinutes()).padStart(2, '0');
          await this.notificationService.createNotification({
            userId: recipient.userId,
            familyId: recipient.familyId,
            type: 'missed_dose',
            title: `用药提醒：${plan.medicineName} 已漏服`,
            body: `您计划在 ${hh}:${mm} 服用的 ${plan.medicineName} ${dosage} 已超过 30 分钟未确认，请尽快处理。`,
            actionUrl: `/medication/${plan.id}`,
            idempotencyKey: `missed-dose:${adh.id}:${recipient.userId}`,
          });
          await this.prisma.medicationAdherence.update({
            where: { id: adh.id },
            data: { missedNotified: true, missedNotifiedAt: now },
          });
          count += 1;
        } catch (err: any) {
          this.logger.error(`漏服告警写入失败 adherenceId=${adh.id}: ${err?.message ?? err}`);
        }
      }
      if (count) this.logger.log(`漏服告警：已为 ${count} 条依从记录生成通知`);
    } catch (err: any) {
      this.logger.error(`漏服告警任务异常: ${err?.message ?? err}`);
    }
  }

  // ============================================================
  // Cron ③ 连续异常预警 —— 每天 08:30
  // ============================================================

  @Cron('0 30 8 * * *', { timeZone: NotificationSchedulerService.TIMEZONE })
  async handleConsecutiveAbnormal(): Promise<void> {
    let count = 0;
    try {
      const metrics = await this.metricService.findConsecutiveAbnormal();
      for (const m of metrics) {
        const recipient = await this.resolveRecipientByMember(m.memberId);
        if (!recipient) continue;
        try {
          await this.notificationService.createNotification({
            userId: recipient.userId,
            familyId: recipient.familyId,
            type: 'metric_alert',
            title: '健康指标连续异常预警',
            body: `${m.metricType} 连续 ${m.abnormalStreak} 次超出正常范围，请关注。`,
            actionUrl: `/metrics/${m.memberId}`,
            idempotencyKey: `metric-alert:${m.id}:${recipient.userId}`,
          });
          await this.prisma.healthMetric.update({
            where: { id: m.id },
            data: { abnormalAlerted: true },
          });
          count += 1;
        } catch (err: any) {
          this.logger.error(`连续异常预警写入失败 metricId=${m.id}: ${err?.message ?? err}`);
        }
      }
      if (count) this.logger.log(`连续异常预警：已为 ${count} 条指标生成通知`);
    } catch (err: any) {
      this.logger.error(`连续异常预警任务异常: ${err?.message ?? err}`);
    }
  }

  // ============================================================
  // Cron ④ 微信订阅消息投递 —— 每 5 分钟
  // ============================================================

  @Cron(CronExpression.EVERY_5_MINUTES, { timeZone: NotificationSchedulerService.TIMEZONE })
  async handleWechatDelivery(): Promise<void> {
    try {
      const result = await this.notificationService.deliverPendingWechat(50);
      if (result.processed) {
        this.logger.log(`微信订阅消息投递：扫描 ${result.processed} 条，成功 ${result.sent}，失败 ${result.failed}`);
      }
    } catch (err: any) {
      this.logger.error(`微信订阅消息投递任务异常: ${err?.message ?? err}`);
    }
  }

  // ============================================================
  // 辅助：recipient 解析
  // ============================================================

  /** 已知 userId / familyId：userId 为空时回退到家庭创建者 */
  private async resolveRecipient(
    userId: string | null,
    familyId: string,
  ): Promise<{ userId: string; familyId: string } | null> {
    if (userId) return { userId, familyId };
    const family = await this.prisma.family.findUnique({
      where: { id: familyId },
      select: { createdBy: true },
    });
    if (!family) return null;
    return { userId: family.createdBy, familyId };
  }

  /** 经 memberId 解析：未注册成员回退到家庭创建者 */
  private async resolveRecipientByMember(
    memberId: string,
    familyId?: string,
  ): Promise<{ userId: string; familyId: string } | null> {
    const member = await this.prisma.familyMember.findUnique({
      where: { id: memberId },
      include: { family: { select: { createdBy: true } } },
    });
    if (!member) return null;
    const userId = member.userId ?? member.family.createdBy;
    return { userId, familyId: familyId ?? member.familyId };
  }
}
