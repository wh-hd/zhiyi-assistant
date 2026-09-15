import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import {
  SECURITY_ALERT_EVENT_TYPES,
  SecurityAlertEvent,
} from './security-alert.types';

const DEFAULT_TIMEOUT_MS = 3000;
const DEFAULT_RATE_LIMIT_SECONDS = 300;
const MAX_REQUEST_ID_LENGTH = 128;

@Injectable()
export class SecurityAlertService {
  private readonly logger = new Logger(SecurityAlertService.name);
  private readonly lastSentAt = new Map<string, number>();

  constructor(private readonly configService: ConfigService) {}

  async emitRefreshTokenReplay(userId: string, requestId?: string): Promise<void> {
    const event: SecurityAlertEvent = {
      eventType: SECURITY_ALERT_EVENT_TYPES.REFRESH_TOKEN_REPLAY,
      environment: this.configService.get<string>('NODE_ENV', 'development'),
      maskedUserId: createHash('sha256').update(userId).digest('hex').slice(0, 12),
      occurredAt: new Date().toISOString(),
      requestId: this.sanitizeRequestId(requestId),
    };
    const key = `${event.eventType}:${event.maskedUserId}`;
    const rateLimitMs = this.getBoundedInteger(
      'SECURITY_ALERT_RATE_LIMIT_SECONDS',
      DEFAULT_RATE_LIMIT_SECONDS,
      1,
      86400,
    ) * 1000;
    const now = Date.now();
    const previous = this.lastSentAt.get(key) ?? 0;
    if (now - previous < rateLimitMs) return;
    this.lastSentAt.set(key, now);

    const defaultChannel = event.environment === 'production' ? 'disabled' : 'log';
    const channel = this.configService
      .get<string>('SECURITY_ALERT_CHANNEL', defaultChannel)
      .trim()
      .toLowerCase();

    try {
      if (channel === 'disabled') return;
      if (channel === 'log') {
        this.logger.warn(`securityAlert=${JSON.stringify(event)}`);
        return;
      }
      if (channel === 'webhook') {
        await this.sendWebhook(event);
        return;
      }
      this.logger.error('安全告警通道配置无效');
    } catch (error) {
      const category = error instanceof Error && error.name === 'AbortError'
        ? 'timeout'
        : 'delivery';
      this.logger.error(`安全告警发送失败 category=${category}`);
    }
  }

  private async sendWebhook(event: SecurityAlertEvent): Promise<void> {
    const url = this.configService.get<string>('SECURITY_ALERT_WEBHOOK_URL', '').trim();
    if (!url) {
      throw new Error('webhook_not_configured');
    }
    const timeoutMs = this.getBoundedInteger(
      'SECURITY_ALERT_TIMEOUT_MS',
      DEFAULT_TIMEOUT_MS,
      500,
      30000,
    );
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(event),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('webhook_http_failure');
    } finally {
      clearTimeout(timer);
    }
  }

  private sanitizeRequestId(requestId?: string): string {
    const clean = (requestId ?? 'unknown')
      .replace(/[^A-Za-z0-9._:-]/g, '_')
      .slice(0, MAX_REQUEST_ID_LENGTH);
    return clean || 'unknown';
  }

  private getBoundedInteger(
    key: string,
    fallback: number,
    minimum: number,
    maximum: number,
  ): number {
    const parsed = Number(this.configService.get<string | number>(key, fallback));
    if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
      return fallback;
    }
    return parsed;
  }
}
