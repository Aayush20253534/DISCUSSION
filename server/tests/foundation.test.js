import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { parseEnv } from '../src/config/env.js'
import { worldSchema } from '@life-rpg/shared'

const config = parseEnv({ NODE_ENV: 'test' })
const logger = () => {}
const makeApp = (database = { ping: async () => false }) => createApp({ config, database, logger })

test('development starts without credentials, production rejects incomplete configuration', () => {
  assert.equal(config.PORT, 4000)
  assert.equal(parseEnv({ DATABASE_URL: '', DIRECT_URL: '' }).DATABASE_URL, undefined)
  assert.throws(() => parseEnv({ NODE_ENV: 'production' }), /DATABASE_URL/)
  assert.throws(
    () =>
      parseEnv({ NODE_ENV: 'production', DATABASE_URL: 'postgresql://user:secret@localhost/db' }),
    /CLIENT_ORIGIN/,
  )
  assert.throws(() => parseEnv({ PORT: 'abc' }), /PORT/)
  assert.throws(() => parseEnv({ CLIENT_ORIGIN: 'https://example.com/' }), /CLIENT_ORIGIN/)
  assert.throws(() => parseEnv({ CLIENT_ORIGIN: '*' }), /CLIENT_ORIGIN/)
  assert.throws(() => parseEnv({ PUBLIC_APP_URL: 'https://example.com/path' }), /PUBLIC_APP_URL/)
  assert.throws(() => parseEnv({ TRUST_PROXY_HOPS: '-1' }), /TRUST_PROXY_HOPS/)
})

test('environment errors never repeat database credentials', () => {
  assert.throws(
    () => parseEnv({ DATABASE_URL: 'https://user:super-secret@example.test/db' }),
    (error) => {
      assert.equal(error.message.includes('super-secret'), false)
      return true
    },
  )
})

test('liveness and database readiness have different meanings', async () => {
  const app = makeApp()
  const live = await request(app).get('/health').expect(200)
  assert.equal(live.body.data.status, 'ok')
  assert.equal(live.headers['x-powered-by'], undefined)
  assert.ok(live.headers['x-request-id'])
  const unconfigured = await request(app).get('/health/ready').expect(503)
  assert.equal(unconfigured.body.error.code, 'DATABASE_NOT_CONFIGURED')
  const ready = await request(makeApp({ ping: async () => true }))
    .get('/health/ready')
    .expect(200)
  assert.equal(ready.body.data.database, 'connected')
})

test('database failure is recoverable and does not expose connection information', async () => {
  const app = makeApp({
    ping: async () => {
      throw new Error('postgresql://user:secret@private-host/db')
    },
  })
  const response = await request(app).get('/health/ready').expect(503)
  assert.equal(response.body.error.code, 'DATABASE_UNAVAILABLE')
  assert.equal(JSON.stringify(response.body).includes('secret'), false)
  assert.match(response.headers['cache-control'], /no-store/)
})

test('public world configuration uses the shared contract and exposes no user progress', async () => {
  const response = await request(makeApp()).get('/api/v1/world').expect(200)
  assert.equal(worldSchema.parse(response.body.data).accountsAvailable, false)
  assert.equal(response.body.data.attributes.length, 5)
  assert.equal(response.body.data.gold, undefined)
})

test('CORS accepts only configured origins and rejects an unrelated website', async () => {
  const app = makeApp()
  const allowed = await request(app)
    .get('/api/v1/world')
    .set('Origin', 'http://localhost:5173')
    .expect(200)
  assert.equal(allowed.headers['access-control-allow-origin'], 'http://localhost:5173')
  const blocked = await request(app)
    .get('/api/v1/world')
    .set('Origin', 'https://unrelated.example')
    .expect(403)
  assert.equal(blocked.body.error.code, 'ORIGIN_NOT_ALLOWED')
  await request(app)
    .options('/api/v1/world')
    .set('Origin', 'http://localhost:5173')
    .set('Access-Control-Request-Method', 'GET')
    .expect(204)
})

test('malformed and oversized JSON produce consistent errors', async () => {
  const app = makeApp()
  const invalid = await request(app)
    .post('/api/v1/quests')
    .set('Content-Type', 'application/json')
    .send('{invalid')
    .expect(400)
  assert.equal(invalid.body.error.code, 'INVALID_JSON')
  const large = await request(app)
    .post('/api/v1/quests')
    .send({ title: 'x'.repeat(40000) })
    .expect(413)
  assert.equal(large.body.error.code, 'PAYLOAD_TOO_LARGE')
})

test('production serves nested SPA links but does not disguise missing API routes or assets', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'life-rpg-spa-'))
  try {
    await writeFile(path.join(dir, 'index.html'), '<!doctype html><title>Life RPG</title>')
    await writeFile(path.join(dir, 'how-it-works.html'), '<!doctype html><title>How it works</title><h1>Prerendered guide</h1>')
    const app = createApp({
      config,
      database: { ping: async () => true },
      staticDirectory: dir,
      logger,
    })
    const page = await request(app).get('/character').set('Accept', 'text/html').expect(200)
    assert.match(page.text, /Life RPG/)
    assert.match(page.headers['x-robots-tag'], /noindex/)
    const publicPage = await request(app).get('/how-it-works').set('Accept', 'text/html').expect(200)
    assert.match(publicPage.text, /Prerendered guide/)
    assert.equal(publicPage.headers.location, undefined)
    assert.equal(publicPage.headers['x-robots-tag'], undefined)
    const missing = await request(app).get('/api/v1/unknown').set('Accept', 'text/html').expect(404)
    assert.equal(missing.body.error.code, 'NOT_FOUND')
    await request(app).get('/missing.js').expect(404)
    await request(app).get('/health/unknown').set('Accept', 'text/html').expect(404)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('production sets a restrictive content security policy', async () => {
  const production = parseEnv({
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://test:test@localhost/db',
    CLIENT_ORIGIN: 'https://example.test',
    JWT_SECRET: 'test-only-secret-'.repeat(5),
  })
  const app = createApp({ config: production, database: { ping: async () => true }, logger })
  const response = await request(app).get('/health').expect(200)
  assert.match(response.headers['content-security-policy'], /script-src 'self'/)
  assert.ok(response.headers['strict-transport-security'])
})

test('robots and sitemap expose only public marketing routes', async () => {
  const seoConfig = parseEnv({ NODE_ENV: 'test', PUBLIC_APP_URL: 'https://life.example' })
  const app = createApp({ config: seoConfig, database: { ping: async () => true }, logger })
  const robots = await request(app).get('/robots.txt').expect(200)
  assert.match(robots.text, /Sitemap: https:\/\/life\.example\/sitemap\.xml/)
  assert.match(robots.text, /Disallow: \/api\//)
  assert.equal(robots.text.includes('Disallow: /settings'), false)
  const sitemap = await request(app).get('/sitemap.xml').expect(200)
  assert.match(sitemap.text, /https:\/\/life\.example\/<\/loc>/)
  assert.match(sitemap.text, /https:\/\/life\.example\/how-it-works<\/loc>/)
  assert.equal(sitemap.text.includes('/settings'), false)
  assert.equal(sitemap.text.includes('/quests'), false)
})
