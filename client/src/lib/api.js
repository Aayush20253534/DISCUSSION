const configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
// Production auth is deliberately same-origin. Vercel/Express proxy /api to the backend so
// session and CSRF cookies remain first-party even in browsers that block third-party cookies.
const baseUrl = import.meta.env.PROD ? '' : configuredBaseUrl
const authPath = '/api/v1/auth'
let refreshInFlight
let localLock = Promise.resolve()

export class ApiError extends Error {
  constructor(message, status, code, fields, requestId, retryAfter) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields || {}
    this.requestId = requestId
    this.retryAfter = retryAfter
  }
}

async function request(path, { method = 'GET', body, signal, csrfToken, timeoutMs = 15000 } = {}) {
  let response
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      credentials: 'include',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        ...(method !== 'GET' && { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }),
      },
      ...(method !== 'GET' && { body: JSON.stringify(body || {}) }),
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])
        : AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    if (signal?.aborted) throw error
    if (error?.name === 'TimeoutError')
      throw new ApiError('The server took too long to respond. Please try again.', 408, 'REQUEST_TIMEOUT')
    throw new ApiError('We could not reach the server. Please try again.', 0, 'NETWORK_ERROR')
  }
  let data
  try {
    data = await response.json()
  } catch {
    throw new ApiError(
      'The server returned an unexpected response.',
      response.status,
      'INVALID_RESPONSE',
      undefined,
      response.headers.get('X-Request-Id') || undefined,
    )
  }
  if (!response.ok)
    throw new ApiError(
      data.error?.message || 'The request failed.',
      response.status,
      data.error?.code,
      data.error?.fields,
      data.error?.requestId || response.headers.get('X-Request-Id') || undefined,
      response.headers.get('Retry-After') || undefined,
    )
  return data.data
}
async function send(path, options) {
  if (options.method === 'GET') return request(path, options)
  // Keep CSRF tokens in memory only; the server reuses an existing valid cookie across tabs.
  const { csrfToken } = await request(`${authPath}/csrf`, { signal: options.signal })
  return request(path, { ...options, csrfToken })
}
function authLock(work) {
  // Web Locks serialize refresh/login/logout across tabs on the same origin.
  if (navigator.locks) return navigator.locks.request('life-rpg-session', work)
  const current = localLock.then(work, work)
  localLock = current.catch(() => {})
  return current
}
async function refreshSession() {
  if (!refreshInFlight) {
    refreshInFlight = authLock(() => send(`${authPath}/refresh`, { method: 'POST' })).finally(
      () => {
        refreshInFlight = undefined
      },
    )
  }
  return refreshInFlight
}
async function apiRequest(path, options) {
  try {
    return await send(path, options)
  } catch (error) {
    if (error.code === 'CSRF_INVALID' && !options.signal?.aborted) return send(path, options)
    if (error.code !== 'AUTH_REQUIRED' || options.signal?.aborted) throw error
    try {
      await refreshSession()
    } catch (refreshError) {
      if (refreshError.code !== 'REFRESH_RETRY') throw refreshError
    }
    // AUTH_REQUIRED is returned before a protected handler writes anything.
    return send(path, options)
  }
}
export const apiGet = (path, signal) => apiRequest(path, { method: 'GET', signal })
export const apiSend = (path, body, method = 'POST', options = {}) =>
  apiRequest(path, { method, body, ...options })
export const authAction = (action, body) =>
  authLock(async () => {
    try {
      return await send(`${authPath}/${action}`, { method: 'POST', body })
    } catch (error) {
      if (error.code === 'CSRF_INVALID')
        return send(`${authPath}/${action}`, { method: 'POST', body })
      throw error
    }
  })
