import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { BaseEvent } from '../../shared/events/event-bus.service';
import { EVENTS } from '../../shared/events/events.constants';
import { NotificationService } from './notification.service';
import { CreateNotificationDto } from './dto/create-notification.dto';

interface MedicationMissedPayload {
  planId: string;
  memberId: string;
  userId: string;
}
interface RedLinePayload {
  memberId: string;
  familyId: string;
  userId: string;
  category: string;
  severity: string;
}
interface MedicationPlanCreatedPayload {
  planId: string;
  memberId: string;
  familyId: string;
  userId: string;
}
interface FamilyMemberAddedPayload {
  familyId: string;
  memberId: string;
  userId: string;
}
interface Recipient {
  userId: string;
  familyId: string;
}

/**
 * 事件订阅者（@OnEvent）—— 修复 P0 根因的核心组件。
 *
 * 订阅 `eventBus.publish(...)` 发出的领域事件，经 `NotificationService.createNotification()`
 * 写入通知记录。所有通知写入均为内部调用，不暴露任何 HTTP 路由，
 * 保证前端既有 GET /notifications 等契约不变。
 */
@Injectable()
export class NotificationConsumer {
  private readonly logger = new Logger(NotificationConsumer.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  // ============================================================
  // 订阅矩阵
  // ============================================================

  /**
   * 漏服事件 → missed_dose 通知
   */
  @OnEvent(EVENTS.MEDICATION_MISSED)
  async handleMedicationMissed(
    event: BaseEvent<MedicationMissedPayload>,
  ): Promise<void> {
    const { planId, memberId } = event.payload;
    const recipient = await this.resolveRecipient(memberId);
    if (!recipient) return;

    const [plan, member] = await Promise.all([
      this.prisma.medicationPlan.findUnique({ where: { id: planId } }),
      this.prisma.familyMember.findUnique({
        where: { id: memberId },
        select: { nickname: true },
      }),
    ]);

    const medicineName = plan?.medicineName ?? '用药';
    const dosage = plan ? `${plan.dosage ?? ''}${plan.dosageUnit ?? ''}`.trim() : '';
    const timeStr = await this.latestPendingTime(planId);
    const nickname = member?.nickname ?? '家庭成员';

    await this.notify({
      userId: recipient.userId,
      familyId: recipient.familyId,
      type: 'missed_dose',
      title: `用药提醒：${medicineName} 未确认`,
      body: `${nickname} 在 ${timeStr} 的 ${medicineName} ${dosage} 尚未确认服用，请尽快处理。`,
      actionUrl: `/medication/${planId}`,
      idempotencyKey: `event:${event.eventId}:${recipient.userId}:missed-dose`,
    });
  }

  /**
   * 就医红线触发事件 → red_line 通知（通知家庭创建者 + 触发者）
   */
  @OnEvent(EVENTS.CONSULTATION_REDLINE_TRIGGERED)
  async handleRedLineTriggered(
    event: BaseEvent<RedLinePayload>,
  ): Promise<void> {
    const { familyId, userId, category, severity } = event.payload;
    const family = await this.prisma.family.findUnique({
      where: { id: familyId },
      select: { createdBy: true },
    });
    if (!family) return;

    const title = '就医红线预警';
    const body = `家庭成员咨询触发就医红线（${category}/${severity}），请立即关注并就医。`;

    // 去重：家庭创建者可能与触发者为同一人
    const recipients = Array.from(new Set([family.createdBy, userId]));
    for (const uid of recipients) {
      await this.notify({
        userId: uid,
        familyId,
        type: 'red_line',
        title,
        body,
        actionUrl: '/consultation',
        idempotencyKey: `event:${event.eventId}:${uid}:red-line`,
      });
    }
  }

  /**
   * 用药计划创建事件 → medication_reminder 欢迎提醒（可选）
   */
  @OnEvent(EVENTS.MEDICATION_PLAN_CREATED)
  async handleMedicationPlanCreated(
    event: BaseEvent<MedicationPlanCreatedPayload>,
  ): Promise<void> {
    const { planId, familyId, userId } = event.payload;
    const plan = await this.prisma.medicationPlan.findUnique({
      where: { id: planId },
    });
    const medicineName = plan?.medicineName ?? '用药';

    await this.notify({
      userId,
      familyId,
      type: 'medication_reminder',
      title: '用药计划已创建',
      body: `已为您创建 ${medicineName} 用药计划，记得按时服药。`,
      actionUrl: `/medication/${planId}`,
      idempotencyKey: `event:${event.eventId}:${userId}:plan-created`,
    });
  }

  /**
   * 新成员加入家庭事件 → system 通知（可选）
   */
  @OnEvent(EVENTS.FAMILY_MEMBER_ADDED)
  async handleFamilyMemberAdded(
    event: BaseEvent<FamilyMemberAddedPayload>,
  ): Promise<void> {
    const { familyId, memberId, userId } = event.payload;
    const member = await this.prisma.familyMember.findUnique({
      where: { id: memberId },
      select: { nickname: true },
    });

    await this.notify({
      userId,
      familyId,
      type: 'system',
      title: '新成员加入家庭',
      body: `${member?.nickname ?? '新成员'} 已加入您的家庭。`,
      actionUrl: `/family/${familyId}`,
      idempotencyKey: `event:${event.eventId}:${userId}:member-added`,
    });
  }

  // ============================================================
  // 辅助
  // ============================================================

  private async notify(dto: CreateNotificationDto): Promise<void> {
    try {
      await this.notificationService.createNotification(dto);
    } catch (err: any) {
      this.logger.error(`写入通知失败 type=${dto.type}: ${err?.message ?? err}`);
    }
  }

  /**
   * 经 FamilyMember 解析接收者 userId / familyId。
   * 未注册成员（userId 为空）回退到家庭创建者。
   */
  private async resolveRecipient(memberId: string): Promise<Recipient | null> {
    const member = await this.prisma.familyMember.findUnique({
      where: { id: memberId },
      include: { family: { select: { createdBy: true } } },
    });
    if (!member) return null;
    const userId = member.userId ?? member.family.createdBy;
    return { userId, familyId: member.familyId };
  }

  /** 取该计划最近一条 pending 依从记录的计划时间（用于通知正文） */
  private async latestPendingTime(planId: string): Promise<string> {
    const adherence = await this.prisma.medicationAdherence.findFirst({
      where: { planId, status: 'pending' },
      orderBy: { scheduledAt: 'desc' },
    });
    if (!adherence) return '本次';
    const d = adherence.scheduledAt;
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }
}
