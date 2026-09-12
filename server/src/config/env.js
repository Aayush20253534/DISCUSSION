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
      .default('http://localhost:5173')
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
    DATABASE_URL: optionalDatabaseUrl,
    DIRECT_URL: optionalDatabaseUrl,
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  })
  .superRefine((value, context) => {
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
  })

export function parseEnv(source) {
  const parsed = schema.safeParse(source)
  if (!parsed.success) {
    // Do not include the original input: it can contain database credentials.
    const fields = [...new Set(parsed.error.issues.map((issue) => issue.path.join('.')))]
    throw new Error(`Invalid environment fields: ${fields.join(', ')}. Check server/.env.example.`)
  }
  return parsed.data
}
