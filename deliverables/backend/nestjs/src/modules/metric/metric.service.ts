import {
  BadRequestException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { FamilyMember, HealthMetric, MetricThreshold, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { FamilyPolicyService } from '../../common/policies/family-policy.service';
import { CacheService } from '../../shared/cache/cache.service';
import { EventBusService } from '../../shared/events/event-bus.service';
import { EVENTS } from '../../shared/events/events.constants';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { BatchRecordMetricDto, RecordMetricDto, UpdateThresholdDto } from './dto/metric.dto';

interface MetricEvent {
  metricType: string;
  value: number;
  status: 'normal' | 'high' | 'low';
}

@Injectable()
export class MetricService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly eventBus: EventBusService,
    private readonly policy: FamilyPolicyService,
  ) {}

  async list(
    memberId: string,
    userId: string,
    opts: { type?: string; from?: string; to?: string; limit?: number },
  ) {
    await this.verifyMemberRead(memberId, userId);
    const where: Prisma.HealthMetricWhereInput = { memberId };
    if (opts.type) where.metricType = opts.type;
    if (opts.from || opts.to) {
      where.recordedAt = {
        ...(opts.from ? { gte: new Date(opts.from) } : {}),
        ...(opts.to ? { lte: new Date(opts.to) } : {}),
      };
    }
    return this.prisma.healthMetric.findMany({
      where,
      orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
      take: opts.limit ?? 100,
    });
  }

  /** 单条写入与受影响类型的全序重算在同一事务。 */
  async record(dto: RecordMetricDto, userId: string) {
    const member = await this.verifyMemberWrite(dto.memberId, userId);
    const outcome = await this.prisma.$transaction(async (tx) => {
      const metric = await tx.healthMetric.create({
        data: {
          memberId: dto.memberId,
          metricType: dto.metricType,
          value: dto.value,
          unit: dto.unit,
          recordedAt: dto.recordedAt ? new Date(dto.recordedAt) : new Date(),
          inputMethod: dto.inputMethod ?? 'manual',
          deviceId: dto.deviceId,
          notes: dto.notes,
          groupId: dto.groupId,
        },
      });
      await this.recomputeType(tx, dto.memberId, dto.metricType);
      const recomputed = await tx.healthMetric.findUniqueOrThrow({ where: { id: metric.id } });
      const threshold = await tx.metricThreshold.findUnique({ where: { metricType: dto.metricType } });
      const event = {
        metricType: dto.metricType,
        value: dto.value,
        status: this.evaluate(dto.value, threshold),
      };
      return { metric: recomputed, events: [event] };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30000 });
    await this.afterCommit(member.familyId, outcome.events);
    await this.cache.invalidate(`member:${dto.memberId}:metrics:*`);
    return outcome.metric;
  }

  /** 批量写入、查回和所有受影响类型的重算在同一事务。 */
  async recordBatch(dto: BatchRecordMetricDto, userId: string) {
    if (dto.metrics.length === 0) throw new BadRequestException('指标列表不能为空');
    const member = await this.verifyMemberWrite(dto.memberId, userId);
    const now = new Date();
    const groupId = dto.groupId ?? `g-${randomUUID()}`;
    const data = dto.metrics.map((metric) => ({
      memberId: dto.memberId,
      metricType: metric.metricType,
      value: metric.value,
      unit: metric.unit,
      recordedAt: metric.recordedAt ? new Date(metric.recordedAt) : now,
      inputMethod: metric.inputMethod ?? 'manual',
      deviceId: metric.deviceId,
      notes: metric.notes,
      groupId,
    }));
    const metricTypes = [...new Set(data.map((metric) => metric.metricType))];
    const events = await this.prisma.$transaction(async (tx) => {
      await tx.healthMetric.createMany({ data });
      for (const metricType of metricTypes) {
        await this.recomputeType(tx, dto.memberId, metricType);
      }
      const thresholds = await tx.metricThreshold.findMany({
        where: { metricType: { in: metricTypes } },
      });
      const thresholdByType = new Map(thresholds.map((threshold) => [threshold.metricType, threshold]));
      return data.map((metric) => ({
        metricType: metric.metricType,
        value: metric.value,
        status: this.evaluate(metric.value, thresholdByType.get(metric.metricType) ?? null),
      }));
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30000 });
    await this.afterCommit(member.familyId, events);
    await this.cache.invalidate(`member:${dto.memberId}:metrics:*`);
    return { created: data.length, groupId };
  }

  async getTrend(memberId: string, userId: string, metricType: string, days = 30) {
    await this.verifyMemberRead(memberId, userId);
    if (!metricType) throw new BadRequestException('metricType is required');
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const [metrics, threshold] = await Promise.all([
      this.prisma.healthMetric.findMany({
        where: { memberId, metricType, recordedAt: { gte: from } },
        orderBy: [{ recordedAt: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.metricThreshold.findUnique({ where: { metricType } }),
    ]);
    const series = metrics.map((metric) => ({
      id: metric.id,
      value: metric.value,
      unit: metric.unit,
      recordedAt: metric.recordedAt,
      status: this.evaluate(metric.value, threshold),
    }));
    const values = metrics.map((metric) => metric.value);
    return {
      metricType,
      threshold: threshold ? { minNormal: threshold.minNormal, maxNormal: threshold.maxNormal } : null,
      unit: metrics[0]?.unit ?? null,
      summary: values.length ? {
        latest: values[values.length - 1],
        avg: Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100,
        min: values.reduce((min, value) => (value < min ? value : min), values[0]),
        max: values.reduce((max, value) => (value > max ? value : max), values[0]),
        abnormalCount: series.filter((item) => item.status !== 'normal').length,
      } : null,
      series,
    };
  }

  async getThresholds() {
    return this.prisma.metricThreshold.findMany({ orderBy: { metricType: 'asc' } });
  }

  async updateThreshold(metricType: string, dto: UpdateThresholdDto) {
    if (dto.minNormal !== undefined && dto.maxNormal !== undefined && dto.minNormal > dto.maxNormal) {
      throw new BadRequestException('正常下限不能大于正常上限');
    }
    return this.prisma.metricThreshold.upsert({
      where: { metricType },
      update: {
        ...(dto.minNormal !== undefined ? { minNormal: dto.minNormal } : {}),
        ...(dto.maxNormal !== undefined ? { maxNormal: dto.maxNormal } : {}),
        ...(dto.alertConsecutiveCount !== undefined
          ? { alertConsecutiveCount: dto.alertConsecutiveCount }
          : {}),
      },
      create: {
        metricType,
        minNormal: dto.minNormal ?? null,
        maxNormal: dto.maxNormal ?? null,
        alertConsecutiveCount: dto.alertConsecutiveCount ?? 3,
      },
    });
  }

  /** 每个 member+type 仅返回全序中最新且尚未告警的满足记录。 */
  async findConsecutiveAbnormal() {
    const thresholds = await this.prisma.metricThreshold.findMany();
    const candidates: HealthMetric[] = [];
    for (const threshold of thresholds) {
      const rows = await this.prisma.healthMetric.findMany({
        where: {
          metricType: threshold.metricType,
          abnormalStreak: { gte: threshold.alertConsecutiveCount },
          abnormalAlerted: false,
        },
        orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
        take: 500,
      });
      const seen = new Set<string>();
      for (const row of rows) {
        const key = `${row.memberId}:${row.metricType}`;
        if (!seen.has(key)) {
          seen.add(key);
          candidates.push(row);
        }
      }
    }
    return candidates;
  }

  private async recomputeType(
    tx: Prisma.TransactionClient,
    memberId: string,
    metricType: string,
  ): Promise<void> {
    const [threshold, metrics] = await Promise.all([
      tx.metricThreshold.findUnique({ where: { metricType } }),
      tx.healthMetric.findMany({
        where: { memberId, metricType },
        orderBy: [{ recordedAt: 'asc' }, { id: 'asc' }],
      }),
    ]);
    if (!threshold) {
      for (const metric of metrics) {
        if (metric.abnormalStreak !== 0) {
          await tx.healthMetric.update({ where: { id: metric.id }, data: { abnormalStreak: 0 } });
        }
      }
      return;
    }
    let streak = 0;
    for (const metric of metrics) {
      const status = this.evaluate(metric.value, threshold);
      streak = status === 'normal' ? 0 : streak + 1;
      if (metric.abnormalStreak !== streak) {
        await tx.healthMetric.update({ where: { id: metric.id }, data: { abnormalStreak: streak } });
      }
    }
  }

  private async afterCommit(familyId: string, events: MetricEvent[]): Promise<void> {
    const latestByType = new Map<string, MetricEvent>();
    for (const event of events) latestByType.set(event.metricType, event);
    for (const event of latestByType.values()) {
      await this.eventBus.publish(EVENTS.METRIC_RECORDED, {
        familyId, metricType: event.metricType, value: event.value,
      });
      if (event.status !== 'normal') {
        await this.eventBus.publish(EVENTS.METRIC_ABNORMAL, {
          familyId, metricType: event.metricType, value: event.value, status: event.status,
        });
      }
    }
  }

  private evaluate(value: number, threshold: MetricThreshold | null): 'normal' | 'high' | 'low' {
    if (!threshold) return 'normal';
    if (threshold.maxNormal !== null && value > threshold.maxNormal) return 'high';
    if (threshold.minNormal !== null && value < threshold.minNormal) return 'low';
    return 'normal';
  }

  private async verifyMemberRead(memberId: string, userId: string): Promise<FamilyMember> {
    const target = await this.prisma.familyMember.findUnique({ where: { id: memberId } });
    if (!target) throw new NotFoundException('成员不存在');
    const actor = await this.prisma.familyMember.findUnique({
      where: { familyId_userId: { familyId: target.familyId, userId } },
    });
    if (!actor) throw new ForbiddenException('无权访问该成员的健康指标');
    return target;
  }

  private async verifyMemberWrite(memberId: string, userId: string): Promise<FamilyMember> {
    const target = await this.verifyMemberRead(memberId, userId);
    const actor = await this.prisma.familyMember.findUniqueOrThrow({
      where: { familyId_userId: { familyId: target.familyId, userId } },
    });
    this.policy.authorize({ action: 'health:write', actor, target });
    return target;
  }
}
