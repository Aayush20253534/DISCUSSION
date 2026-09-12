const baseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const authPath = '/api/v1/auth'
let refreshInFlight
let localLock = Promise.resolve()

export class ApiError extends Error {
  constructor(message, status, code, fields) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields || {}
  }
}

async function request(path, { method = 'GET', body, signal, csrfToken } = {}) {
  let response
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(method !== 'GET' && { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }),
      },
      ...(method !== 'GET' && { body: JSON.stringify(body || {}) }),
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
        : AbortSignal.timeout(15000),
    })
  } catch (error) {
    if (signal?.aborted) throw error
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
    )
  }
  if (!response.ok)
    throw new ApiError(
      data.error?.message || 'The request failed.',
      response.status,
      data.error?.code,
      data.error?.fields,
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
export const apiSend = (path, body, method = 'POST') => apiRequest(path, { method, body })
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
