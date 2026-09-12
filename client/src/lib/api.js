const baseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export async function apiGet(path, signal) {
  let response
  try {
    response = await fetch(`${baseUrl}${path}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(10000)])
        : AbortSignal.timeout(10000),
    })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new ApiError('We could not reach the server. Please try again.', 0, 'NETWORK_ERROR')
  }
  let body
  try {
    body = await response.json()
  } catch {
    throw new ApiError(
      'The server returned an unexpected response.',
      response.status,
      'INVALID_RESPONSE',
    )
  }
  if (!response.ok)
    throw new ApiError(
      body.error?.message || 'The request failed.',
      response.status,
      body.error?.code,
    )
  return body.data
}
