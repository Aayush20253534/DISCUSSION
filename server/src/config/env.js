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
      value.PUBLIC_APP_URL &&
      !value.PUBLIC_APP_URL.startsWith('https://')
    ) {
      context.addIssue({
        code: 'custom',
        path: ['PUBLIC_APP_URL'],
        message: 'Use an HTTPS public origin in production',
      })
    }
  })

function withPlatformDefaults(source) {
  const normalized = { ...source }
  if (normalized.RENDER === 'true' && normalized.RENDER_EXTERNAL_URL) {
    normalized.CLIENT_ORIGIN ||= normalized.RENDER_EXTERNAL_URL
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
