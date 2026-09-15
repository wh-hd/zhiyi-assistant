export type NodeEnvironment = 'development' | 'test' | 'production';

export interface EnvironmentConfig {
  NODE_ENV: NodeEnvironment;
  APP_PORT: number;
  DATABASE_URL: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_ACCESS_EXPIRES: number;
  JWT_REFRESH_EXPIRES: number;
  ALLOW_DEV_IDENTITY: boolean;
  UPLOAD_ENABLED: boolean;
  SECURITY_ALERT_CHANNEL: 'disabled' | 'log' | 'webhook';
  SECURITY_ALERT_WEBHOOK_URL?: string;
  WX_APP_ID?: string;
  WX_APP_SECRET?: string;
}
