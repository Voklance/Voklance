import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5001),
  MONGODB_URI: z
    .string()
    .regex(/^mongodb(\+srv)?:\/\//)
    .optional(),
  CLIENT_URLS: z.string().min(1).default('http://localhost:5173'),
  EMAIL_VERIFICATION_ENABLED: z.enum(['true', 'false']).default('false'),
  APP_PUBLIC_URL: z.url().optional(),
  EMAIL_FROM: z.email().default('no-reply@localhost.test'),
  SMTP_HOST: z.string().min(1).default('127.0.0.1'),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().min(1).default(60),
  EMAIL_RESEND_HOURLY_LIMIT: z.coerce.number().int().min(1).default(5),
  EMAIL_RESEND_IP_HOURLY_LIMIT: z.coerce.number().int().min(1).default(20)
});

const result = schema.safeParse({
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  MONGODB_URI: process.env.MONGODB_URI || undefined,
  CLIENT_URLS: process.env.CLIENT_URLS || process.env.CLIENT_URL,
  EMAIL_VERIFICATION_ENABLED: process.env.EMAIL_VERIFICATION_ENABLED,
  APP_PUBLIC_URL: process.env.APP_PUBLIC_URL,
  EMAIL_FROM: process.env.EMAIL_FROM,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASSWORD: process.env.SMTP_PASSWORD,
  EMAIL_RESEND_COOLDOWN_SECONDS: process.env.EMAIL_RESEND_COOLDOWN_SECONDS,
  EMAIL_RESEND_HOURLY_LIMIT: process.env.EMAIL_RESEND_HOURLY_LIMIT,
  EMAIL_RESEND_IP_HOURLY_LIMIT: process.env.EMAIL_RESEND_IP_HOURLY_LIMIT
});

if (!result.success) {
  const fields = [...new Set(result.error.issues.map((issue) => issue.path.join('.') || 'environment'))];
  throw new Error(`Invalid environment configuration: ${fields.join(', ')}`);
}

const clientOrigins = result.data.CLIENT_URLS.split(',').map((value) => value.trim());
if (
  clientOrigins.some((origin) => {
    try {
      const url = new URL(origin);
      return !['http:', 'https:'].includes(url.protocol) || url.origin !== origin;
    } catch {
      return true;
    }
  })
)
  throw new Error('Invalid environment configuration: CLIENT_URLS');

if (result.data.NODE_ENV === 'production' && !result.data.MONGODB_URI) {
  throw new Error('Invalid environment configuration: MONGODB_URI is required in production');
}
if (
  result.data.NODE_ENV === 'production' &&
  result.data.EMAIL_VERIFICATION_ENABLED === 'true' &&
  !result.data.APP_PUBLIC_URL
)
  throw new Error('Invalid environment configuration: APP_PUBLIC_URL is required in production');
if (
  result.data.NODE_ENV === 'production' &&
  result.data.EMAIL_VERIFICATION_ENABLED === 'true' &&
  (!process.env.EMAIL_FROM || !process.env.SMTP_HOST || !process.env.SMTP_PORT)
)
  throw new Error(
    'Invalid environment configuration: EMAIL_FROM, SMTP_HOST, and SMTP_PORT are required in production'
  );
if (
  result.data.NODE_ENV === 'production' &&
  result.data.EMAIL_VERIFICATION_ENABLED === 'true' &&
  result.data.APP_PUBLIC_URL &&
  new URL(result.data.APP_PUBLIC_URL).protocol !== 'https:'
)
  throw new Error('Invalid environment configuration: APP_PUBLIC_URL must use HTTPS in production');
if (
  result.data.APP_PUBLIC_URL &&
  (new URL(result.data.APP_PUBLIC_URL).origin !== result.data.APP_PUBLIC_URL ||
    !clientOrigins.includes(result.data.APP_PUBLIC_URL))
)
  throw new Error('Invalid environment configuration: APP_PUBLIC_URL must be an allowed frontend origin');
if (Boolean(result.data.SMTP_USER) !== Boolean(result.data.SMTP_PASSWORD))
  throw new Error('Invalid environment configuration: SMTP_USER and SMTP_PASSWORD must be set together');

export const env = {
  nodeEnv: result.data.NODE_ENV,
  port: result.data.PORT,
  mongoUri: result.data.MONGODB_URI,
  clientOrigins,
  secureCookies: result.data.NODE_ENV === 'production',
  emailVerificationEnabled: result.data.EMAIL_VERIFICATION_ENABLED === 'true',
  appPublicUrl: result.data.APP_PUBLIC_URL ?? clientOrigins[0],
  emailFrom: result.data.EMAIL_FROM,
  smtpHost: result.data.SMTP_HOST,
  smtpPort: result.data.SMTP_PORT,
  smtpUser: result.data.SMTP_USER,
  smtpPassword: result.data.SMTP_PASSWORD,
  resendCooldownSeconds: result.data.EMAIL_RESEND_COOLDOWN_SECONDS,
  resendHourlyLimit: result.data.EMAIL_RESEND_HOURLY_LIMIT,
  resendIpHourlyLimit: result.data.EMAIL_RESEND_IP_HOURLY_LIMIT
};

export function isAllowedOrigin(origin: string) {
  return (
    env.clientOrigins.includes(origin) ||
    (env.nodeEnv !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))
  );
}
