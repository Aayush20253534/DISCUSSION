import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

function option(name) {
  const exact = `--${name}`
  const prefix = `${exact}=`
  const index = process.argv.findIndex((value) => value === exact || value.startsWith(prefix))
  if (index === -1) return undefined
  const value = process.argv[index]
  if (value.startsWith(prefix)) return value.slice(prefix.length)
  return process.argv[index + 1]
}

function exactOrigin(value) {
  const url = new URL(value)
  assert.ok(['https:'].includes(url.protocol), 'Live deployment URL must use HTTPS.')
  assert.equal(url.pathname, '/', 'Live deployment URL must be an origin without a path.')
  assert.equal(url.search, '', 'Live deployment URL must not include a query string.')
  assert.equal(url.hash, '', 'Live deployment URL must not include a fragment.')
  return url.origin
}

async function fetchChecked(url, options = {}) {
  const { headers, ...rest } = options
  return fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(20_000),
    ...rest,
    headers: { 'user-agent': 'life-rpg-release-check/1.0', ...(headers || {}) },
  })
}

function metaContent(html, property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const expression = new RegExp(`<meta[^>]+${escaped}[^>]+content="([^"]+)"`, 'i')
  return html.match(expression)?.[1]
}

function canonicalHref(html) {
  return html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i)?.[1]
}

export async function runLiveSmoke(value) {
  const origin = exactOrigin(value)

  const health = await fetchChecked(`${origin}/health`)
  assert.equal(health.status, 200, '/health must return 200.')
  assert.ok(health.headers.get('x-request-id'), '/health must expose X-Request-ID.')
  assert.match(health.headers.get('content-security-policy') || '', /script-src 'self'/)
  assert.ok(health.headers.get('strict-transport-security'), 'Production must send HSTS.')
  assert.equal((await health.json()).data.status, 'ok')

  const ready = await fetchChecked(`${origin}/health/ready`)
  assert.equal(ready.status, 200, '/health/ready must return 200 with the live database connected.')
  assert.equal((await ready.json()).data.database, 'connected')

  let homeHtml = ''
  for (const pathname of ['/', '/how-it-works']) {
    const response = await fetchChecked(`${origin}${pathname}`, {
      headers: { Accept: 'text/html' },
    })
    assert.equal(response.status, 200, `${pathname} must be directly reachable.`)
    assert.match(response.headers.get('content-type') || '', /text\/html/)
    assert.equal(response.headers.get('x-robots-tag'), null, `${pathname} must remain indexable.`)
    const html = await response.text()
    if (pathname === '/') homeHtml = html
    const expectedCanonical = new URL(pathname, `${origin}/`).href
    assert.equal(canonicalHref(html), expectedCanonical, `${pathname} canonical URL must match deployment.`)
    assert.equal(metaContent(html, 'property="og:url"'), expectedCanonical)
    assert.doesNotMatch(html, /life-rpg\.invalid|\/src\/main\.jsx/i)
    assert.match(html, /<main[\s>]/i)
    assert.match(html, /<h1[\s>]/i)
  }

  const privateRoute = await fetchChecked(`${origin}/quests`, {
    headers: { Accept: 'text/html' },
  })
  assert.equal(privateRoute.status, 200, 'Direct SPA routes must survive page refreshes.')
  assert.match(privateRoute.headers.get('x-robots-tag') || '', /noindex/)

  const unknownApi = await fetchChecked(`${origin}/api/v1/does-not-exist`, {
    headers: { Accept: 'application/json' },
  })
  assert.equal(unknownApi.status, 404)
  assert.match(unknownApi.headers.get('cache-control') || '', /no-store/)
  assert.equal((await unknownApi.json()).error.code, 'NOT_FOUND')

  const robots = await fetchChecked(`${origin}/robots.txt`)
  assert.equal(robots.status, 200)
  assert.match(await robots.text(), new RegExp(`Sitemap: ${origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/sitemap\\.xml`))

  const sitemap = await fetchChecked(`${origin}/sitemap.xml`)
  assert.equal(sitemap.status, 200)
  const sitemapText = await sitemap.text()
  assert.ok(sitemapText.includes(`<loc>${origin}/</loc>`))
  assert.ok(sitemapText.includes(`<loc>${origin}/how-it-works</loc>`))

  const asset = homeHtml.match(/(?:src|href)="(\/assets\/[^"]+)"/)?.[1]
  assert.ok(asset, 'Home page must reference a fingerprinted production asset.')
  const assetResponse = await fetchChecked(`${origin}${asset}`)
  assert.equal(assetResponse.status, 200, 'Referenced production asset must exist.')
  assert.match(assetResponse.headers.get('cache-control') || '', /immutable/)

  console.log(
    JSON.stringify({
      event: 'live.smoke_passed',
      origin,
      database: 'connected',
      publicRoutes: 2,
      directPrivateRoute: '/quests',
    }),
  )
}

const liveUrl = option('url') || process.env.LIVE_URL
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!liveUrl) throw new Error('Provide --url https://your-app.example or set LIVE_URL.')
  await runLiveSmoke(liveUrl)
}
