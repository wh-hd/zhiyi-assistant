import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';

/**
 * 领域事件定义（与架构文档 3.3 节同步）
 *
 * @deprecated 请使用 `events.constants.ts` 中的 `EVENTS` 常量。
 * DomainEvents 中的部分值与实际上报字符串不一致（如 MEMBER_ADDED 用点号 'family.member.added'，
 * 而实际 publish 用下划线 'family.member_added'），会导致 @OnEvent 订阅者永远收不到事件。
 * 新代码统一引用 `EVENTS.*`，本常量仅保留向后兼容，后续将移除。
 */
export const DomainEvents = {
  USER_REGISTERED:          'user.registered',
  FAMILY_CREATED:           'family.created',
  MEMBER_ADDED:             'family.member.added',
  MEMBER_REMOVED:           'family.member.removed',
  ASSESSMENT_COMPLETED:     'assessment.completed',
  ASSESSMENT_REVIEW_DUE:    'assessment.review.due',
  CONSULTATION_STARTED:     'consultation.started',
  CONSULTATION_COMPLETED:   'consultation.completed',
  RED_LINE_TRIGGERED:       'consultation.redline.triggered',
  SELF_HARM_DETECTED:       'consultation.selfharm.detected',
  MEDICATION_PLAN_CREATED:  'medication.plan.created',
  MEDICATION_TAKEN:         'medication.taken',
  MEDICATION_MISSED:        'medication.missed',
  METRIC_RECORDED:          'metric.recorded',
  METRIC_ABNORMAL:          'metric.abnormal',
  METRIC_TREND_ALERT:       'metric.trend.alert',
  HEALTH_RECORD_UPDATED:    'health.record.updated',
  ALLERGY_ADDED:            'allergy.added',
} as const;

export interface BaseEvent<T = unknown> {
  eventId: string;
  eventType: string;
  timestamp: string;
  actorId?: string;
  familyId?: string;
  payload: T;
}

/**
 * 事件总线服务 — 封装 @nestjs/event-emitter
 * 用于跨模块松耦合通信（副作用/异步通知）
 */
@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * 发布领域事件（异步，不阻塞主流程）
   */
  async publish<T = unknown>(
    eventType: string,
    payload: T,
    actorId?: string,
    familyId?: string,
  ): Promise<void> {
    const event: BaseEvent<T> = {
      eventId: uuidv4(),
      eventType,
      timestamp: new Date().toISOString(),
      actorId,
      familyId,
      payload,
    };

    this.logger.debug(`📢 发布事件: ${eventType}`, event.eventId);
    await this.eventEmitter.emitAsync(eventType, event);
  }

  /**
   * 监听领域事件
   */
  on(eventType: string, handler: (event: BaseEvent) => void | Promise<void>): void {
    this.logger.debug(`👂 注册监听: ${eventType}`);
    this.eventEmitter.on(eventType, handler);
  }

  /**
   * 监听事件（仅一次）
   */
  once(eventType: string, handler: (event: BaseEvent) => void): void {
    this.eventEmitter.once(eventType, handler);
  }
}
