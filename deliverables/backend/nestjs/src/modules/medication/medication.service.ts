import {
  Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FamilyPolicyService } from '../../common/policies/family-policy.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CacheService } from '../../shared/cache/cache.service';
import { EventBusService } from '../../shared/events/event-bus.service';
import { EVENTS } from '../../shared/events/events.constants';
import { CreateMedicationDto } from './dto/create-medication.dto';
import { UpdateMedicationDto } from './dto/update-medication.dto';
import { MarkAdherenceDto } from './dto/mark-adherence.dto';

@Injectable()
export class MedicationService {
  private readonly logger = new Logger(MedicationService.name);

  // 频率 → 默认服药时间点 (HH:mm)
  private readonly FREQUENCY_TIMES: Record<string, string[]> = {
    daily: ['08:00'],
    twice_daily: ['08:00', '20:00'],
    three_times: ['08:00', '14:00', '20:00'],
    every_8h: ['08:00', '16:00', '00:00'],
    custom: [],
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly eventBus: EventBusService,
    private readonly policy: FamilyPolicyService,
  ) {}

  // ============================================================
  // 列表
  // ============================================================

  async list(memberId: string, userId: string, isActive?: boolean) {
    await this.verifyMemberAccess(memberId, userId);

    const where: any = { memberId };
    if (isActive !== undefined) where.isActive = isActive;

    return this.prisma.medicationPlan.findMany({
      where,
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      include: {
        adherences: {
          where: { scheduledAt: this.todayRange() },
          orderBy: { scheduledAt: 'asc' },
          take: 20,
        },
      },
    });
  }

  // ============================================================
  // 创建
  // ============================================================

  async create(dto: CreateMedicationDto, userId: string) {
    const member = await this.verifyMemberAccess(dto.memberId, userId, true);
    const familyId = member.familyId;

    const plan = await this.prisma.$transaction(async (tx) => {
      const createdPlan = await tx.medicationPlan.create({
        data: {
          memberId: dto.memberId,
          familyId,
          medicineName: dto.medicineName,
          medicineCode: dto.medicineCode,
          dosage: dto.dosage,
          dosageUnit: dto.dosageUnit,
          frequency: dto.frequency,
          customSchedule: dto.customSchedule ? JSON.stringify(dto.customSchedule) : null,
          startDate: new Date(dto.startDate),
          endDate: dto.endDate ? new Date(dto.endDate) : null,
          source: dto.source ?? 'manual',
          ocrImageUrl: dto.ocrImageUrl,
          createdBy: userId,
          notes: dto.notes,
        },
      });

      await this.ensureTodayAdherences(
        tx,
        createdPlan.id,
        dto.frequency,
        dto.customSchedule,
      );
      return createdPlan;
    });

    try {
      await this.cache.invalidate(`member:${dto.memberId}:medications:*`);
    } catch {
      this.logger.error(`用药计划提交后缓存失效失败 planId=${plan.id} memberId=${dto.memberId}`);
    }

    try {
      await this.eventBus.publish(EVENTS.MEDICATION_PLAN_CREATED, {
        planId: plan.id, memberId: dto.memberId, familyId, userId,
      });
    } catch {
      this.logger.error(`用药计划提交后事件发布失败 planId=${plan.id} memberId=${dto.memberId}`);
    }

    return plan;
  }

  // ============================================================
  // 详情
  // ============================================================

  async getById(id: string, userId: string) {
    const plan = await this.prisma.medicationPlan.findUnique({
      where: { id },
      include: { adherences: { orderBy: { scheduledAt: 'desc' }, take: 30 } },
    });
    if (!plan) throw new NotFoundException('用药计划不存在');
    await this.verifyMemberAccess(plan.memberId, userId);
    return plan;
  }

  // ============================================================
  // 更新
  // ============================================================

  async update(id: string, dto: UpdateMedicationDto, userId: string) {
    const plan = await this.prisma.medicationPlan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('用药计划不存在');
    await this.verifyMemberAccess(plan.memberId, userId, true);

    const updated = await this.prisma.medicationPlan.update({
      where: { id },
      data: {
        ...(dto.medicineName !== undefined && { medicineName: dto.medicineName }),
        ...(dto.medicineCode !== undefined && { medicineCode: dto.medicineCode }),
        ...(dto.dosage !== undefined && { dosage: dto.dosage }),
        ...(dto.dosageUnit !== undefined && { dosageUnit: dto.dosageUnit }),
        ...(dto.frequency !== undefined && { frequency: dto.frequency }),
        ...(dto.customSchedule !== undefined && {
          customSchedule: JSON.stringify(dto.customSchedule),
        }),
        ...(dto.startDate !== undefined && { startDate: new Date(dto.startDate) }),
        ...(dto.endDate !== undefined && {
          endDate: dto.endDate ? new Date(dto.endDate) : null,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });

    await this.cache.invalidate(`member:${plan.memberId}:medications:*`);
    return updated;
  }

  // ============================================================
  // 删除 (软删除: 停用)
  // ============================================================

  async remove(id: string, userId: string) {
    const plan = await this.prisma.medicationPlan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('用药计划不存在');
    await this.verifyMemberAccess(plan.memberId, userId, true);

    await this.prisma.medicationPlan.update({
      where: { id },
      data: { isActive: false },
    });
    await this.cache.invalidate(`member:${plan.memberId}:medications:*`);
    return { success: true };
  }

  // ============================================================
  // 今日提醒
  // ============================================================

  async getTodayReminders(memberId: string, userId: string, businessDate = new Date()) {
    await this.verifyMemberAccess(memberId, userId);
    await this.materializeForDate(memberId, businessDate);
    const range = this.dateRange(businessDate);

    const plans = await this.prisma.medicationPlan.findMany({
      where: { memberId, isActive: true, startDate: { lt: range.lt }, OR: [{ endDate: null }, { endDate: { gte: range.gte } }] },
    });

    const reminders: any[] = [];
    for (const plan of plans) {
      const times = this.getScheduleTimes(plan);
      const adherences = await this.prisma.medicationAdherence.findMany({
        where: { planId: plan.id, scheduledAt: range },
      });
      const statusByTime = new Map<string, string>();
      for (const a of adherences) {
        statusByTime.set(this.hhmm(a.scheduledAt), a.status);
      }

      for (const t of times) {
        reminders.push({
          planId: plan.id,
          medicineName: plan.medicineName,
          dosage: plan.dosage,
          dosageUnit: plan.dosageUnit,
          time: t,
          status: statusByTime.get(t) ?? 'pending',
        });
      }
    }

    reminders.sort((a, b) => a.time.localeCompare(b.time));
    return reminders;
  }

  // ============================================================
  // 标记依从
  // ============================================================

  async markAdherence(planId: string, dto: MarkAdherenceDto, userId: string) {
    const plan = await this.prisma.medicationPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('用药计划不存在');
    await this.verifyMemberAccess(plan.memberId, userId, true);

    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : this.nearestScheduledTime(plan);

    const data: Prisma.MedicationAdherenceUncheckedUpdateInput = {
      status: dto.status,
      takenAt: dto.status === 'taken' ? new Date() : null,
      confirmedBy: userId,
    };

    const record = await this.prisma.medicationAdherence.upsert({
      where: { planId_scheduledAt: { planId, scheduledAt } },
      update: data,
      create: { planId, scheduledAt, status: dto.status, takenAt: dto.status === 'taken' ? new Date() : null, confirmedBy: userId },
    });

    await this.cache.invalidate(`member:${plan.memberId}:medications:*`);

    if (dto.status === 'taken') {
      this.eventBus.publish(EVENTS.MEDICATION_TAKEN, { planId, memberId: plan.memberId, userId });
    } else if (dto.status === 'missed') {
      this.eventBus.publish(EVENTS.MEDICATION_MISSED, { planId, memberId: plan.memberId, userId });
    }

    return record;
  }

  // ============================================================
  // 依从记录历史
  // ============================================================

  async getAdherences(planId: string, userId: string, from?: string, to?: string) {
    const plan = await this.prisma.medicationPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('用药计划不存在');
    await this.verifyMemberAccess(plan.memberId, userId);

    const where: any = { planId };
    if (from || to) {
      where.scheduledAt = {};
      if (from) where.scheduledAt.gte = new Date(from);
      if (to) where.scheduledAt.lte = new Date(to);
    }

    return this.prisma.medicationAdherence.findMany({
      where,
      orderBy: { scheduledAt: 'desc' },
    });
  }

  /**
   * 供定时任务扫描的逾期未确认依从记录（漏服告警去重）。
   * 条件：status='pending' 且 scheduledAt < now-30min 且 missedNotified=false。
   */
  async findOverdueAdherences() {
    const cutoff = new Date(Date.now() - 30 * 60 * 1000);
    return this.prisma.medicationAdherence.findMany({
      where: {
        status: 'pending',
        scheduledAt: { lt: cutoff },
        missedNotified: false,
      },
      include: {
        plan: {
          select: {
            id: true,
            memberId: true,
            familyId: true,
            medicineName: true,
            dosage: true,
            dosageUnit: true,
          },
        },
      },
    });
  }

  // ============================================================
  // 辅助
  // ============================================================

  async materializeForDate(memberId: string, businessDate: Date): Promise<number> {
    const range = this.dateRange(businessDate);
    return this.prisma.$transaction(async (tx) => {
      const plans = await tx.medicationPlan.findMany({
        where: { memberId, isActive: true, startDate: { lt: range.lt }, OR: [{ endDate: null }, { endDate: { gte: range.gte } }] },
      });
      let count = 0;
      for (const plan of plans) {
        for (const time of this.getScheduleTimes(plan)) {
          const [hour, minute] = time.split(':').map(Number);
          const scheduledAt = new Date(range.gte);
          scheduledAt.setHours(hour, minute, 0, 0);
          await tx.medicationAdherence.upsert({
            where: { planId_scheduledAt: { planId: plan.id, scheduledAt } },
            update: {},
            create: { planId: plan.id, scheduledAt, status: 'pending' },
          });
          count += 1;
        }
      }
      return count;
    });
  }

  /** 计算计划的服药时间点 */
  private getScheduleTimes(plan: any): string[] {
    if (plan.frequency === 'custom' && plan.customSchedule) {
      try {
        const sched = JSON.parse(plan.customSchedule);
        if (Array.isArray(sched) && sched.length > 0) {
          return sched.map((s: any) => s.time).filter(Boolean);
        }
      } catch { /* ignore */ }
    }
    return this.FREQUENCY_TIMES[plan.frequency] ?? this.FREQUENCY_TIMES.daily;
  }

  /** 预生成今日 pending 依从记录 */
  private async ensureTodayAdherences(
    tx: Prisma.TransactionClient,
    planId: string,
    frequency: string,
    customSchedule?: Array<{ time: string }>,
  ): Promise<void> {
    const times = frequency === 'custom' && customSchedule?.length
      ? customSchedule.map((s) => s.time)
      : (this.FREQUENCY_TIMES[frequency] ?? this.FREQUENCY_TIMES.daily);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const t of times) {
      const [h, m] = t.split(':').map(Number);
      const scheduled = new Date(today);
      scheduled.setHours(h, m, 0, 0);
      await tx.medicationAdherence.upsert({
        where: { planId_scheduledAt: { planId, scheduledAt: scheduled } },
        update: {},
        create: { planId, scheduledAt: scheduled, status: 'pending' },
      });
    }
  }

  /** 取最近的一个计划服药时间 (用于未指定 scheduledAt 时) */
  private nearestScheduledTime(plan: any): Date {
    const times = this.getScheduleTimes(plan);
    const now = new Date();
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    let candidate: Date | null = null;
    for (const t of times) {
      const [h, m] = t.split(':').map(Number);
      const d = new Date(today); d.setHours(h, m, 0, 0);
      if (!candidate || Math.abs(d.getTime() - now.getTime()) < Math.abs(candidate.getTime() - now.getTime())) {
        candidate = d;
      }
    }
    return candidate ?? now;
  }

  private dateRange(date: Date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { gte: start, lt: end };
  }

  private todayRange() { return this.dateRange(new Date()); }

  private hhmm(d: Date): string {
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  /** 验证成员归属: 返回 member (含 familyId) 或抛错 */
  private async verifyMemberAccess(memberId: string, userId: string, write = false) {
    const member = await this.prisma.familyMember.findUnique({ where: { id: memberId } });
    if (!member) throw new NotFoundException('成员不存在');
    const membership = await this.prisma.familyMember.findUnique({
      where: { familyId_userId: { familyId: member.familyId, userId } },
    });
    if (!membership) throw new ForbiddenException('无权访问该成员的用药数据');
    if (write) this.policy.authorize({ action: 'health:write', actor: membership, target: member });
    return member;
  }
}
