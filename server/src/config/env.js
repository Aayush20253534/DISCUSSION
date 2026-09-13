import { z } from 'zod'

const optionalDatabaseUrl = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z
    .string()
    .url()
    .refine((value) => /^postgres(ql)?:\/\//.test(value), 'Must be a PostgreSQL URL')
    .optional(),
)

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    CLIENT_ORIGIN: z
      .string()
      .default('http://localhost:5173,http://127.0.0.1:5173')
      .transform((value) => value.split(',').map((origin) => origin.trim()))
      .pipe(
        z
          .array(
            z
              .string()
              .url()
              .refine((value) => {
                try {
                  const url = new URL(value)
                  return ['http:', 'https:'].includes(url.protocol) && url.origin === value
                } catch {
                  return false
                }
              }, 'Use an exact origin without a trailing slash'),
          )
          .min(1),
      ),
    API_ORIGIN: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z
        .string()
        .url()
        .refine((value) => {
          try {
            const url = new URL(value)
            return ['http:', 'https:'].includes(url.protocol) && url.origin === value
          } catch {
            return false
          }
        }, 'Use an exact origin without a trailing slash')
        .optional(),
    ),
    PUBLIC_APP_URL: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z
        .string()
        .url()
        .refine((value) => {
          try {
            const url = new URL(value)
            return ['http:', 'https:'].includes(url.protocol) && url.origin === value
          } catch {
            return false
          }
        }, 'Use an exact origin without a trailing slash')
        .optional(),
    ),
    DATABASE_URL: optionalDatabaseUrl,
    DIRECT_URL: optionalDatabaseUrl,
    JWT_SECRET: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().min(64).optional(),
    ),
    ACCESS_TOKEN_MINUTES: z.coerce.number().int().min(1).max(30).default(15),
    SESSION_DAYS: z.coerce.number().int().min(1).max(30).default(7),
    EMAIL_OTP_MINUTES: z.coerce.number().int().min(3).max(30).default(10),
    EMAIL_OTP_RESEND_SECONDS: z.coerce.number().int().min(15).max(300).default(60),
    PASSWORD_RESET_MINUTES: z.coerce.number().int().min(10).max(120).default(30),
    MAILJET_API_KEY: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().min(1).optional(),
    ),
    MAILJET_SECRET_KEY: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().min(1).optional(),
    ),
    MAILJET_FROM_EMAIL: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().email().optional(),
    ),
    MAILJET_FROM_NAME: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().trim().min(1).max(80).optional(),
    ),
    AI_PROVIDER: z.enum(['auto', 'groq', 'gemini']).default('auto'),
    GROQ_API_KEY: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().min(1).optional(),
    ),
    GEMINI_API_KEY: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().min(1).optional(),
    ),
    GROQ_QUEST_MODEL: z.string().trim().min(1).max(120).default('openai/gpt-oss-20b'),
    GEMINI_QUEST_MODEL: z.string().trim().min(1).max(120).default('gemini-2.5-flash-lite'),
    GEMINI_VERIFICATION_MODEL: z.string().trim().min(1).max(120).default('gemini-2.5-flash-lite'),
    GEMINI_VERIFICATION_FALLBACK_MODEL: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .default('gemini-2.5-flash'),
    // Image verification includes upload + multimodal inference and is routinely slower
    // than text-only quest generation, so keep it on a separate budget.
    GEMINI_VERIFICATION_TIMEOUT_MS: z.coerce.number().int().min(5000).max(60000).default(30000),
    AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(3000).max(30000).default(12000),
    UPSTASH_REDIS_REST_URL: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().url().optional(),
    ),
    UPSTASH_REDIS_REST_TOKEN: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().min(1).optional(),
    ),
    REDIS_CACHE_TTL_SECONDS: z.coerce.number().int().min(10).max(300).default(75),
    REDIS_CACHE_TIMEOUT_MS: z.coerce.number().int().min(50).max(1500).default(300),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  })
  .superRefine((value, context) => {
    if ((value.DATABASE_URL || value.NODE_ENV === 'production') && !value.JWT_SECRET) {
      context.addIssue({
        code: 'custom',
        path: ['JWT_SECRET'],
        message: 'Run npm run auth:configure',
      })
    }
    if (value.NODE_ENV === 'production' && !value.DATABASE_URL) {
      context.addIssue({
        code: 'custom',
        path: ['DATABASE_URL'],
        message: 'Required in production',
      })
    }
    if (
      value.NODE_ENV === 'production' &&
      value.CLIENT_ORIGIN.some((origin) => !origin.startsWith('https://'))
    ) {
      context.addIssue({
        code: 'custom',
        path: ['CLIENT_ORIGIN'],
        message: 'Use HTTPS origins in production',
      })
    }
    if (
      value.NODE_ENV === 'production' &&
      value.API_ORIGIN &&
      !value.API_ORIGIN.startsWith('https://')
    ) {
      context.addIssue({
        code: 'custom',
        path: ['API_ORIGIN'],
        message: 'Use an HTTPS API origin in production',
      })
    }
    if (
      value.NODE_ENV === 'production' &&
      value.PUBLIC_APP_URL &&
      !value.PUBLIC_APP_URL.startsWith('https://')
    ) {
      context.addIssue({
        code: 'custom',
        path: ['PUBLIC_APP_URL'],
        message: 'Use an HTTPS public origin in production',
      })
    }
    const redisParts = [value.UPSTASH_REDIS_REST_URL, value.UPSTASH_REDIS_REST_TOKEN]
    if (redisParts.filter(Boolean).length === 1) {
      context.addIssue({
        code: 'custom',
        path: ['UPSTASH_REDIS_REST_URL'],
        message: 'Set both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN',
      })
    }
    if (
      value.NODE_ENV === 'production' &&
      value.UPSTASH_REDIS_REST_URL &&
      !value.UPSTASH_REDIS_REST_URL.startsWith('https://')
    ) {
      context.addIssue({
        code: 'custom',
        path: ['UPSTASH_REDIS_REST_URL'],
        message: 'Use an HTTPS Redis REST URL in production',
      })
    }
  })

function withPlatformDefaults(source) {
  const normalized = { ...source }
  // Also accept Mailjet's conventional variable names when a host provides them directly.
  normalized.MAILJET_API_KEY ||= normalized.MJ_APIKEY_PUBLIC
  normalized.MAILJET_SECRET_KEY ||= normalized.MJ_APIKEY_PRIVATE
  if (normalized.RENDER === 'true' && normalized.RENDER_EXTERNAL_URL) {
    normalized.CLIENT_ORIGIN ||= normalized.RENDER_EXTERNAL_URL
    normalized.API_ORIGIN ||= normalized.RENDER_EXTERNAL_URL
    normalized.PUBLIC_APP_URL ||= normalized.RENDER_EXTERNAL_URL

    // Render always terminates public HTTP traffic at its proxy/load-balancer layer and forwards
    // the client chain in X-Forwarded-For. A stale dashboard value of TRUST_PROXY_HOPS=0 would
    // otherwise disable Express proxy trust and make express-rate-limit reject every proxied
    // request with ERR_ERL_UNEXPECTED_X_FORWARDED_FOR. Keep local/non-Render deployments explicit,
    // but make the Render runtime safe by construction.
    const configuredProxyHops = Number(normalized.TRUST_PROXY_HOPS)
    if (!Number.isFinite(configuredProxyHops) || configuredProxyHops < 1) {
      normalized.TRUST_PROXY_HOPS = '1'
    }
  }
  return normalized
}

export function parseEnv(source) {
  const parsed = schema.safeParse(withPlatformDefaults(source))
  if (!parsed.success) {
    // Do not include the original input: it can contain database credentials.
    const fields = [...new Set(parsed.error.issues.map((issue) => issue.path.join('.')))]
    throw new Error(`Invalid environment fields: ${fields.join(', ')}. Check server/.env.example.`)
  }
  return parsed.data
}
