import { test } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { parseEnv } from '../src/config/env.js'
import { sanitizeLogDetails } from '../src/lib/logger.js'

const config = parseEnv({ NODE_ENV: 'test' })

test('structured log sanitization redacts credentials, auth material and unsafe nested values', () => {
  const sanitized = sanitizeLogDetails({
    password: 'never-log-me',
    nested: {
      refreshToken: 'also-secret',
      message: 'database postgresql://user:db-password@private.example/app unavailable',
      authorization: 'Bearer abc.def.ghi',
    },
    error: Object.assign(new Error('request to https://api:private-key@example.test failed'), {
      code: 'ECONNRESET',
    }),
    count: 12n,
  })
  const serialized = JSON.stringify(sanitized)
  assert.equal(serialized.includes('never-log-me'), false)
  assert.equal(serialized.includes('also-secret'), false)
  assert.equal(serialized.includes('db-password'), false)
  assert.equal(serialized.includes('private-key'), false)
  assert.equal(serialized.includes('abc.def.ghi'), false)
  assert.match(serialized, /\[redacted\]/)
  assert.match(serialized, /\[redacted-url\]/)
  assert.match(serialized, /ECONNRESET/)
  assert.match(serialized, /"12"/)
})

test('request logs are structured, omit query text and every API response is non-cacheable', async () => {
  const entries = []
  const app = createApp({
    config,
    database: { configured: false, ping: async () => false },
    logger: (level, event, details) => entries.push({ level, event, ...details }),
  })
  const response = await request(app).get('/api/v1/world?token=this-must-not-enter-logs').expect(200)
  assert.match(response.headers['cache-control'], /no-store/)
  const requestLog = entries.find((entry) => entry.event === 'http.request')
  assert.ok(requestLog)
  assert.equal(requestLog.method, 'GET')
  assert.equal(requestLog.path, '/api/v1/world')
  assert.equal(requestLog.status, 200)
  assert.ok(Number.isInteger(requestLog.durationMs))
  assert.equal(JSON.stringify(entries).includes('this-must-not-enter-logs'), false)
  assert.equal(requestLog.requestId, response.headers['x-request-id'])
})

test('request IDs are server-generated and unique even when a client supplies its own header', async () => {
  const app = createApp({
    config,
    database: { configured: false, ping: async () => false },
    logger: () => {},
  })
  const first = await request(app).get('/health').set('X-Request-Id', 'attacker-controlled').expect(200)
  const second = await request(app).get('/health').expect(200)
  assert.notEqual(first.headers['x-request-id'], 'attacker-controlled')
  assert.notEqual(first.headers['x-request-id'], second.headers['x-request-id'])
  assert.match(first.headers['x-request-id'], /^[0-9a-f-]{36}$/i)
})
