const CACHE_PREFIX = 'life-rpg:data-cache:v2'
const MIN_HASH_TTL_SECONDS = 600
const CIRCUIT_BREAKER_MS = 20_000

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '')
}

function cacheField(namespace, key) {
  return `${namespace}:${key}`
}

function localBypass(load) {
  return Promise.resolve().then(load).then((value) => ({ value, status: 'BYPASS' }))
}

export function createRedisCache(config, logger = () => {}, fetchImpl = fetch) {
  const endpoint = config.UPSTASH_REDIS_REST_URL
  const token = config.UPSTASH_REDIS_REST_TOKEN
  const enabled = Boolean(endpoint && token)
  const requestTimeoutMs = config.REDIS_CACHE_TIMEOUT_MS || 300
  const defaultTtlSeconds = config.REDIS_CACHE_TTL_SECONDS || 75
  const inflight = new Map()
  const generations = new Map()
  const pendingWrites = new Map()
  const dirtyUsers = new Set()
  let unavailableUntil = 0

  async function request(pathname, body, operation) {
    if (!enabled || Date.now() < unavailableUntil) return { available: false }
    try {
      const response = await fetchImpl(`${trimTrailingSlash(endpoint)}${pathname}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(requestTimeoutMs),
      })
      if (!response.ok) throw new Error(`Redis REST responded with ${response.status}`)
      const payload = await response.json()
      if (payload?.error) throw new Error(String(payload.error))
      return { available: true, payload }
    } catch (error) {
      unavailableUntil = Date.now() + CIRCUIT_BREAKER_MS
      logger('warn', 'cache.redis_unavailable', { operation, error })
      return { available: false }
    }
  }

  async function command(parts) {
    const result = await request('', parts, String(parts[0] || 'UNKNOWN'))
    return result.available
      ? { available: true, value: result.payload?.result }
      : { available: false, value: undefined }
  }

  async function pipeline(commands) {
    const result = await request('/pipeline', commands, 'PIPELINE')
    if (!result.available || !Array.isArray(result.payload)) return { available: false }
    const failed = result.payload.find((entry) => entry?.error)
    if (failed) {
      logger('warn', 'cache.redis_pipeline_error', { error: String(failed.error) })
      return { available: false }
    }
    return { available: true, values: result.payload.map((entry) => entry?.result) }
  }

  const hashKeyForUser = (userId) => `${CACHE_PREFIX}:user:${userId}`

  async function flushDirtyUser(userId) {
    if (!dirtyUsers.has(userId)) return true
    const removed = await command(['DEL', hashKeyForUser(userId)])
    if (!removed.available) return false
    dirtyUsers.delete(userId)
    return true
  }

  async function get(userId, namespace, key) {
    if (!(await flushDirtyUser(userId))) return { available: false, hit: false }
    const field = cacheField(namespace, key)
    const result = await command(['HGET', hashKeyForUser(userId), field])
    if (!result.available) return { available: false, hit: false }
    if (typeof result.value !== 'string') return { available: true, hit: false }
    try {
      const envelope = JSON.parse(result.value)
      if (!envelope || envelope.expiresAt <= Date.now()) return { available: true, hit: false }
      return { available: true, hit: true, value: envelope.value }
    } catch {
      return { available: true, hit: false }
    }
  }

  async function set(userId, namespace, key, value, ttlSeconds = defaultTtlSeconds) {
    if (!enabled) return false
    const normalizedTtl = Math.max(1, Number(ttlSeconds) || defaultTtlSeconds)
    const redisKey = hashKeyForUser(userId)
    const field = cacheField(namespace, key)
    const envelope = JSON.stringify({
      expiresAt: Date.now() + normalizedTtl * 1000,
      value,
    })
    const hashTtl = Math.max(MIN_HASH_TTL_SECONDS, normalizedTtl * 4)
    const result = await pipeline([
      ['HSET', redisKey, field, envelope],
      ['EXPIRE', redisKey, hashTtl],
    ])
    return result.available
  }

  function trackWrite(userId, promise) {
    if (!pendingWrites.has(userId)) pendingWrites.set(userId, new Set())
    const writes = pendingWrites.get(userId)
    writes.add(promise)
    void promise.finally(() => {
      writes.delete(promise)
      if (!writes.size) pendingWrites.delete(userId)
    })
  }

  async function getOrSet({ userId, namespace, key, ttlSeconds = defaultTtlSeconds, load }) {
    if (!enabled) return localBypass(load)

    const cached = await get(userId, namespace, key)
    if (!cached.available) return localBypass(load)
    if (cached.hit) return { value: cached.value, status: 'HIT' }

    const flightKey = `${userId}:${namespace}:${key}`
    if (inflight.has(flightKey)) {
      return { value: await inflight.get(flightKey), status: 'COALESCED' }
    }

    const generation = generations.get(userId) || 0
    const pending = Promise.resolve().then(load)
    inflight.set(flightKey, pending)
    try {
      const value = await pending
      if ((generations.get(userId) || 0) === generation) {
        const write = set(userId, namespace, key, value, ttlSeconds)
        trackWrite(userId, write)
      }
      return { value, status: 'MISS' }
    } finally {
      if (inflight.get(flightKey) === pending) inflight.delete(flightKey)
    }
  }

  async function invalidateUser(userId) {
    if (!userId) return false
    generations.set(userId, (generations.get(userId) || 0) + 1)
    if (!enabled) return false

    const writes = [...(pendingWrites.get(userId) || [])]
    if (writes.length) await Promise.allSettled(writes)

    const removed = await command(['DEL', hashKeyForUser(userId)])
    if (!removed.available) {
      dirtyUsers.add(userId)
      return false
    }
    dirtyUsers.delete(userId)
    return true
  }

  return {
    enabled,
    defaultTtlSeconds,
    getOrSet,
    invalidateUser,
  }
}

export function routeCacheKey(req, suffix = '') {
  const query = new URLSearchParams()
  for (const key of Object.keys(req.query || {}).sort()) {
    const value = req.query[key]
    if (Array.isArray(value)) value.forEach((item) => query.append(key, String(item)))
    else if (value !== undefined) query.set(key, String(value))
  }
  const serialized = query.toString()
  return `${req.path}${serialized ? `?${serialized}` : ''}${suffix ? `:${suffix}` : ''}`
}

export function setCacheStatus(res, status) {
  if (status) res.set('X-Data-Cache', status)
}
