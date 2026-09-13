import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readdir, readFile, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createApp } from '../src/app.js'
import { parseEnv } from '../src/config/env.js'

const dist = fileURLToPath(new URL('../../client/dist/', import.meta.url))
const assetsDirectory = path.join(dist, 'assets')

if (!existsSync(path.join(dist, 'index.html'))) {
  throw new Error('Production smoke test requires client/dist. Run npm run build first.')
}

const config = parseEnv({
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://smoke:smoke@localhost/atlasborn',
  CLIENT_ORIGIN: 'https://atlasborn.example',
  PUBLIC_APP_URL: 'https://atlasborn.example',
  JWT_SECRET: 'production-smoke-secret-'.repeat(4),
})
const database = {
  configured: true,
  prisma: {},
  ping: async () => true,
}
const logger = () => {}
const app = createApp({ config, database, staticDirectory: dist, logger })
const server = app.listen(0, '127.0.0.1')
await new Promise((resolve, reject) => {
  server.once('listening', resolve)
  server.once('error', reject)
})

const address = server.address()
const origin = `http://127.0.0.1:${address.port}`
const get = (pathname, options) => fetch(`${origin}${pathname}`, { redirect: 'manual', ...options })

try {
  const health = await get('/health')
  assert.equal(health.status, 200)
  assert.ok(health.headers.get('x-request-id'))
  assert.equal(health.headers.get('x-powered-by'), null)
  assert.match(health.headers.get('content-security-policy') || '', /script-src 'self'/)
  assert.ok(health.headers.get('strict-transport-security'))

  const ready = await get('/health/ready')
  assert.equal(ready.status, 200)
  assert.equal((await ready.json()).data.database, 'connected')

  const home = await get('/', { headers: { Accept: 'text/html' } })
  assert.equal(home.status, 200, '/ must render in production')
  assert.match(home.headers.get('content-type') || '', /text\/html/)
  assert.match(home.headers.get('cache-control') || '', /no-cache/)
  assert.equal(home.headers.get('x-robots-tag'), null)
  const homeHtml = await home.text()
  assert.match(homeHtml, /<html lang="en">/i)
  assert.match(homeHtml, /<meta\b[^>]*\bname="viewport"[^>]*>/i)
  assert.match(homeHtml, /<meta\b[^>]*\bname="description"[^>]*>/i)
  assert.match(homeHtml, /<main[\s>]/i)
  assert.match(homeHtml, /<h1[\s>]/i)
  assert.match(homeHtml, /<link\b[^>]*\brel="canonical"[^>]*\bhref="https?:\/\/[^"]+"[^>]*>/i)
  assert.match(homeHtml, /<meta[^>]+property="og:url"[^>]+content="https?:\/\/[^"]+"/i)
  assert.match(homeHtml, /<meta[^>]+property="og:image"[^>]+content="https?:\/\/[^"]+"/i)
  assert.doesNotMatch(homeHtml, /atlasborn\.invalid/i)
  assert.doesNotMatch(homeHtml, /\/src\/main\.jsx/i)

  const legacyHow = await get('/how-it-works', { headers: { Accept: 'text/html' } })
  assert.equal(legacyHow.status, 302)
  assert.equal(legacyHow.headers.get('location'), '/#how-it-works')

  const privateRoute = await get('/quests', { headers: { Accept: 'text/html' } })
  assert.equal(privateRoute.status, 200)
  assert.match(privateRoute.headers.get('x-robots-tag') || '', /noindex/)
  assert.match(privateRoute.headers.get('cache-control') || '', /no-cache/)

  const unknownApi = await get('/api/v1/does-not-exist', { headers: { Accept: 'application/json' } })
  assert.equal(unknownApi.status, 404)
  assert.match(unknownApi.headers.get('cache-control') || '', /no-store/)
  assert.equal((await unknownApi.json()).error.code, 'NOT_FOUND')

  const missingAsset = await get('/assets/not-a-real-bundle.js')
  assert.equal(missingAsset.status, 404)

  const assetEntries = (await readdir(assetsDirectory, { withFileTypes: true })).filter((entry) =>
    entry.isFile(),
  )
  const javascript = assetEntries.filter((entry) => entry.name.endsWith('.js'))
  const stylesheets = assetEntries.filter((entry) => entry.name.endsWith('.css'))
  assert.ok(javascript.length > 0, 'Vite build must emit JavaScript assets')
  assert.ok(stylesheets.length > 0, 'Vite build must emit CSS assets')

  let totalJavascriptBytes = 0
  for (const entry of javascript) {
    const size = (await stat(path.join(assetsDirectory, entry.name))).size
    totalJavascriptBytes += size
    assert.ok(size <= 450_000, `${entry.name} exceeds the 450 kB per-chunk production budget`)
  }
  assert.ok(totalJavascriptBytes <= 1_500_000, 'Total JavaScript exceeds the 1.5 MB production budget')
  for (const entry of stylesheets) {
    const size = (await stat(path.join(assetsDirectory, entry.name))).size
    assert.ok(size <= 180_000, `${entry.name} exceeds the 180 kB stylesheet budget`)
  }

  for (const entry of [javascript[0], stylesheets[0]]) {
    const response = await get(`/assets/${entry.name}`)
    assert.equal(response.status, 200)
    assert.match(response.headers.get('cache-control') || '', /immutable/)
  }

  const index = await readFile(path.join(dist, 'index.html'), 'utf8')
  const referencedAssets = [...index.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(
    (match) => match[1],
  )
  assert.ok(referencedAssets.length >= 2, 'Built HTML should reference fingerprinted JS and CSS')
  for (const asset of referencedAssets) {
    assert.ok(existsSync(path.join(dist, asset)), `Built HTML references missing asset ${asset}`)
  }

  console.log(
    JSON.stringify({
      event: 'production.smoke_passed',
      publicRoutes: 1,
      javascriptChunks: javascript.length,
      totalJavascriptBytes,
    }),
  )
} finally {
  await new Promise((resolve) => server.close(resolve))
}
