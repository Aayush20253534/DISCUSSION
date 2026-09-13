import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const indexPath = path.join(dist, 'index.html')
const template = await readFile(indexPath, 'utf8')

function publicOrigin() {
  const value = process.env.PUBLIC_APP_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5173'
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== value) {
    throw new Error('PUBLIC_APP_URL/RENDER_EXTERNAL_URL must be an exact HTTP(S) origin without a path.')
  }
  return url.origin
}

const origin = publicOrigin()
const pages = [
  {
    path: '/',
    title: 'AtlasBorn · The Adventurer’s Atlas',
    description:
      'Turn goals into quests, build your attributes, earn XP, collect rewards, and turn everyday progress into your own adventure.',
    body: `<main><p>YOUR STORY BEGINS HERE</p><h1>Your everyday life, turned into an adventure.</h1><p>Turn goals into quests. Build your attributes. Earn XP, collect rewards, and discover how far consistent effort can take you.</p><p><a href="/signup">Begin Your Journey</a> · <a href="/#journey">Explore the Atlas</a></p></main>`,
  },
]

function escapePattern(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function replaceMeta(html, selector, value) {
  const escaped = escapePattern(selector)
  const expression = new RegExp(`(<meta[^>]+${escaped}[^>]+content=")[^"]*(")`, 'i')
  return html.replace(expression, `$1${value}$2`)
}

function absolute(pathname) {
  return new URL(pathname, `${origin}/`).href
}

function render(page) {
  const canonical = absolute(page.path)
  const socialImage = absolute('/social-card.png')
  let html = template.replace(/<title>[^<]*<\/title>/i, `<title>${page.title}</title>`)
  html = replaceMeta(html, 'name="description"', page.description)
  html = replaceMeta(html, 'property="og:title"', page.title)
  html = replaceMeta(html, 'property="og:description"', page.description)
  html = replaceMeta(html, 'property="og:url"', canonical)
  html = replaceMeta(html, 'property="og:image"', socialImage)
  html = replaceMeta(html, 'name="twitter:title"', page.title)
  html = replaceMeta(html, 'name="twitter:description"', page.description)
  html = replaceMeta(html, 'name="twitter:image"', socialImage)
  html = html.replace(
    /<link rel="canonical" href="[^"]*" \/>/i,
    `<link rel="canonical" href="${canonical}" />`,
  )
  html = html.replace('<div id="root"></div>', `<div id="root">${page.body}</div>`)
  return html
}

for (const page of pages) {
  if (page.path === '/') {
    await writeFile(indexPath, render(page))
    continue
  }
  await writeFile(path.join(dist, `${page.path.slice(1)}.html`), render(page))
}
