/**
 * 领域事件名常量 —— 单一事实源（Single Source of Truth）
 *
 * ⚠️ 重要约定：
 * 1. 这里的字符串必须 **逐字等于** 各 `eventBus.publish(eventName, ...)` 的真实 emit 字符串，
 *    否则 `@OnEvent()` 订阅者永远收不到（本次 P0 根因）。
 * 2. 历史上 `event-bus.service.ts` 的 `DomainEvents.MEMBER_ADDED='family.member.added'`
 *    与 **实际上报** 的 `'family.member_added'`（点 vs 下划线）不一致。本文件以「实际上报字符串」为准，
 *    订阅者全部引用本文件的 `EVENTS.*`，杜绝点/下划线错配。
 * 3. metric / medication 模块原本引用 `DomainEvents`（值已正确），此处一并纳入便于统一维护。
 */
export const EVENTS = {
  // —— metric / medication（原 DomainEvents 已正确，纳入统一源） ——
  METRIC_ABNORMAL: 'metric.abnormal',
  METRIC_RECORDED: 'metric.recorded',
  MEDICATION_PLAN_CREATED: 'medication.plan.created',
  MEDICATION_TAKEN: 'medication.taken',
  MEDICATION_MISSED: 'medication.missed',

  // —— assessment ——
  ASSESSMENT_COMPLETED: 'assessment.completed',

  // —— family（注意 member_added 是下划线） ——
  FAMILY_CREATED: 'family.created',
  FAMILY_UPDATED: 'family.updated',
  FAMILY_MEMBER_ADDED: 'family.member_added',
  FAMILY_MEMBER_REMOVED: 'family.member_removed',

  // —— health_record ——
  HEALTH_RECORD_UPDATED: 'health_record.updated',
  HEALTH_RECORD_CHRONIC_UPDATED: 'health_record.chronic_updated',
  HEALTH_RECORD_ALLERGIES_UPDATED: 'health_record.allergies_updated',
  HEALTH_RECORD_SURGERIES_UPDATED: 'health_record.surgeries_updated',
  HEALTH_RECORD_FAMILY_HISTORY_UPDATED: 'health_record.family_history_updated',
  HEALTH_RECORD_VACCINATIONS_UPDATED: 'health_record.vaccinations_updated',

  // —— consultation ——
  CONSULTATION_REDLINE_TRIGGERED: 'consultation.redline.triggered',
  CONSULTATION_COMPLETED: 'consultation.completed',
} as const;

/** 事件名联合类型，便于类型推导与订阅者参数约束 */
export type EventName = (typeof EVENTS)[keyof typeof EVENTS];
