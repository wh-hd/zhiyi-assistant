import { z } from 'zod';
import { EnvironmentConfig } from './env.types';

const weakSecret = /^(dev|test|change|replace|example|placeholder|your[-_])/i;
const secretSchema = z.string().min(64).refine((value) => !weakSecret.test(value), {
  message: 'secret must be a high-entropy injected value, not a placeholder',
});
const optionalString = z.preprocess((value) => value === '' ? undefined : value, z.string().optional());
const booleanString = z.preprocess((value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false' || normalized === '') return false;
  }
  return value;
}, z.boolean());

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: secretSchema,
  JWT_REFRESH_SECRET: secretSchema,
  JWT_ACCESS_EXPIRES: z.coerce.number().int().min(60).max(86400).default(3600),
  JWT_REFRESH_EXPIRES: z.coerce.number().int().min(3600).max(31536000).default(2592000),
  ALLOW_DEV_IDENTITY: booleanString.default(false),
  UPLOAD_ENABLED: booleanString.default(false),
  SECURITY_ALERT_CHANNEL: z.enum(['disabled', 'log', 'webhook']).default('log'),
  SECURITY_ALERT_WEBHOOK_URL: optionalString,
  WX_APP_ID: optionalString,
  WX_APP_SECRET: optionalString,
}).superRefine((value, context) => {
  if (value.JWT_ACCESS_SECRET === value.JWT_REFRESH_SECRET) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['JWT_REFRESH_SECRET'], message: 'access and refresh secrets must differ' });
  }
  if (value.NODE_ENV === 'production') {
    if (value.ALLOW_DEV_IDENTITY) context.addIssue({ code: z.ZodIssueCode.custom, path: ['ALLOW_DEV_IDENTITY'], message: 'development identity is forbidden in production' });
    if (value.UPLOAD_ENABLED) context.addIssue({ code: z.ZodIssueCode.custom, path: ['UPLOAD_ENABLED'], message: 'upload remains disabled until private storage is implemented' });
    if (!value.WX_APP_ID || !value.WX_APP_SECRET) context.addIssue({ code: z.ZodIssueCode.custom, path: ['WX_APP_ID'], message: 'production WeChat credentials must be injected' });
    if (value.SECURITY_ALERT_CHANNEL !== 'webhook' || !value.SECURITY_ALERT_WEBHOOK_URL) context.addIssue({ code: z.ZodIssueCode.custom, path: ['SECURITY_ALERT_CHANNEL'], message: 'production security alert webhook is required' });
  }
});

export function validateEnvironment(raw: Record<string, unknown>): EnvironmentConfig {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const summary = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${summary}`);
  }
  return parsed.data as EnvironmentConfig;
}
