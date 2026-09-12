import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const indexPath = path.join(dist, 'index.html')
const template = await readFile(indexPath, 'utf8')

const pages = [
  {
    path: '/',
    title: 'Life RPG · Turn everyday progress into an adventure',
    description:
      'Life RPG turns real-world tasks into quests with XP, attributes, streaks, gold, and cosmetic rewards.',
    body: `<main><h1>Your everyday life, turned into an adventure.</h1><p>Turn real-world tasks into quests, earn XP and gold, strengthen five attributes, build streaks, and unlock cosmetic rewards.</p><p><a href="/signup">Start your adventure</a> · <a href="/how-it-works">See how it works</a></p></main>`,
  },
  {
    path: '/how-it-works',
    title: 'How Life RPG works · Quests, XP, streaks and rewards',
    description:
      'See how Life RPG turns real-world tasks into quests, secure XP, attributes, streaks, gold, and cosmetic rewards.',
    body: `<main><h1>How Life RPG works</h1><ol><li>Create a real-world quest.</li><li>Choose the attribute it trains.</li><li>Complete it to earn server-calculated XP and gold.</li><li>Build streaks, progression, inventory, and a persistent history.</li></ol><p><a href="/signup">Create an account</a></p></main>`,
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

function render(page) {
  let html = template.replace(/<title>[^<]*<\/title>/i, `<title>${page.title}</title>`)
  html = replaceMeta(html, 'name="description"', page.description)
  html = replaceMeta(html, 'property="og:title"', page.title)
  html = replaceMeta(html, 'property="og:description"', page.description)
  html = replaceMeta(html, 'property="og:url"', page.path)
  html = replaceMeta(html, 'name="twitter:title"', page.title)
  html = replaceMeta(html, 'name="twitter:description"', page.description)
  html = html.replace(/<link rel="canonical" href="[^"]*" \/>/i, `<link rel="canonical" href="${page.path}" />`)
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
