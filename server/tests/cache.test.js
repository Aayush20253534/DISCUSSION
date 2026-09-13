import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRedisCache, routeCacheKey } from '../src/lib/cache.js'

function fakeRedisFetch({ delaySetMs = 0 } = {}) {
  const hashes = new Map()
  const execute = async ([command, key, field, value]) => {
    if (command === 'HGET') return hashes.get(key)?.get(field) ?? null
    if (command === 'HSET') {
      if (delaySetMs) await new Promise((resolve) => setTimeout(resolve, delaySetMs))
      if (!hashes.has(key)) hashes.set(key, new Map())
      const hash = hashes.get(key)
      const result = hash.has(field) ? 0 : 1
      hash.set(field, value)
      return result
    }
    if (command === 'EXPIRE') return hashes.has(key) ? 1 : 0
    if (command === 'DEL') return hashes.delete(key) ? 1 : 0
    throw new Error(`Unexpected fake Redis command: ${command}`)
  }
  return async (url, options) => {
    const body = JSON.parse(options.body)
    if (url.endsWith('/pipeline')) {
      const results = []
      for (const parts of body) results.push({ result: await execute(parts) })
      return { ok: true, json: async () => results }
    }
    return { ok: true, json: async () => ({ result: await execute(body) }) }
  }
}

const config = {
  UPSTASH_REDIS_REST_URL: 'https://redis.example.test',
  UPSTASH_REDIS_REST_TOKEN: 'test-token',
  REDIS_CACHE_TTL_SECONDS: 75,
  REDIS_CACHE_TIMEOUT_MS: 300,
}

test('Redis cache reuses a per-user value and invalidates it after a write', async () => {
  const cache = createRedisCache(config, () => {}, fakeRedisFetch())
  let loads = 0
  const load = async () => ({ version: ++loads })

  const first = await cache.getOrSet({ userId: 'user-1', namespace: 'dashboard', key: 'overview', load })
  assert.equal(first.status, 'MISS')
  assert.deepEqual(first.value, { version: 1 })

  await new Promise((resolve) => setTimeout(resolve, 0))
  const second = await cache.getOrSet({ userId: 'user-1', namespace: 'dashboard', key: 'overview', load })
  assert.equal(second.status, 'HIT')
  assert.deepEqual(second.value, { version: 1 })
  assert.equal(loads, 1)

  await cache.invalidateUser('user-1')
  const third = await cache.getOrSet({ userId: 'user-1', namespace: 'dashboard', key: 'overview', load })
  assert.equal(third.status, 'MISS')
  assert.deepEqual(third.value, { version: 2 })
})

test('cache invalidation waits for an in-flight Redis write before deleting the user hash', async () => {
  const cache = createRedisCache(config, () => {}, fakeRedisFetch({ delaySetMs: 20 }))
  await cache.getOrSet({
    userId: 'user-race',
    namespace: 'dashboard',
    key: 'overview',
    load: async () => ({ version: 1 }),
  })
  await cache.invalidateUser('user-race')
  const result = await cache.getOrSet({
    userId: 'user-race',
    namespace: 'dashboard',
    key: 'overview',
    load: async () => ({ version: 2 }),
  })
  assert.equal(result.status, 'MISS')
  assert.deepEqual(result.value, { version: 2 })
})

test('cache is a fail-open optimization when Redis is not configured', async () => {
  const cache = createRedisCache({}, () => {}, fakeRedisFetch())
  let loads = 0
  const result = await cache.getOrSet({
    userId: 'user-1',
    namespace: 'dashboard',
    key: 'overview',
    load: async () => ++loads,
  })
  assert.equal(result.status, 'BYPASS')
  assert.equal(result.value, 1)
  assert.equal(loads, 1)
})

test('route cache keys are stable regardless of query parameter order', () => {
  const left = routeCacheKey({ path: '/quests', query: { page: '2', q: 'read' } }, '2026-09-13')
  const right = routeCacheKey({ path: '/quests', query: { q: 'read', page: '2' } }, '2026-09-13')
  assert.equal(left, right)
})
