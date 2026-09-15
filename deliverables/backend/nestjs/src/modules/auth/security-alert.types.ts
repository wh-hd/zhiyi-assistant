export const SECURITY_ALERT_EVENT_TYPES = {
  REFRESH_TOKEN_REPLAY: 'REFRESH_TOKEN_REPLAY',
} as const;

export interface SecurityAlertEvent {
  eventType: typeof SECURITY_ALERT_EVENT_TYPES.REFRESH_TOKEN_REPLAY;
  environment: string;
  maskedUserId: string;
  occurredAt: string;
  requestId: string;
}

export interface SecurityAlertChannel {
  send(event: SecurityAlertEvent): Promise<void>;
}
