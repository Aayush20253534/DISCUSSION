const SENSITIVE_KEY = /(authorization|cookie|password|secret|token|database.?url|direct.?url)/i
const URL_WITH_CREDENTIALS = /\b(?:postgres(?:ql)?|https?):\/\/[^\s/@:]+:[^\s/@]+@[^\s]+/gi
const BEARER = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi

function sanitizeString(value) {
  return value
    .replace(URL_WITH_CREDENTIALS, '[redacted-url]')
    .replace(BEARER, 'Bearer [redacted]')
    .slice(0, 1000)
}

export function sanitizeLogDetails(value, depth = 0) {
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return value
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'string') return sanitizeString(value)
  if (value instanceof Date) return value.toISOString()
  if (value instanceof Error)
    return {
      name: value.name,
      code: typeof value.code === 'string' ? value.code : undefined,
      message: sanitizeString(value.message || ''),
    }
  if (depth >= 4) return '[truncated]'
  if (Array.isArray(value))
    return value.slice(0, 25).map((entry) => sanitizeLogDetails(entry, depth + 1))
  if (typeof value === 'object') {
    const result = {}
    for (const [key, entry] of Object.entries(value).slice(0, 50)) {
      result[key] = SENSITIVE_KEY.test(key) ? '[redacted]' : sanitizeLogDetails(entry, depth + 1)
    }
    return result
  }
  return String(value)
}

export function log(level, event, details = {}) {
  const safeDetails = sanitizeLogDetails(details)
  const entry = JSON.stringify({ time: new Date().toISOString(), level, event, ...safeDetails })
  if (level === 'error') console.error(entry)
  else console.log(entry)
}
