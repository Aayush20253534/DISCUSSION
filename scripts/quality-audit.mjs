import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const clientSource = path.join(root, 'client', 'src')

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const result = []
  for (const entry of entries) {
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) result.push(...(await files(full)))
    else if (/\.(?:js|jsx)$/.test(entry.name)) result.push(full)
  }
  return result
}

const sourceFiles = await files(clientSource)
for (const file of sourceFiles) {
  const content = await readFile(file, 'utf8')
  const relative = path.relative(root, file).replaceAll('\\', '/')
  assert.equal(
    content.includes('dangerouslySetInnerHTML'),
    false,
    `${relative} must not bypass React escaping without a reviewed sanitizer`,
  )
  if (/\blocalStorage\s*\.(?:getItem|setItem|removeItem|clear|key)\b/.test(content)) {
    assert.equal(
      relative,
      'client/src/lib/preferences.js',
      `${relative} stores application data in localStorage; primary state must stay server-backed`,
    )
  }
}

const [appShell, publicShell, css, renderYaml, packageJsonText] = await Promise.all([
  readFile(path.join(clientSource, 'components', 'AppShell.jsx'), 'utf8'),
  readFile(path.join(clientSource, 'public', 'PublicShell.jsx'), 'utf8'),
  readFile(path.join(clientSource, 'index.css'), 'utf8'),
  readFile(path.join(root, 'render.yaml'), 'utf8'),
  readFile(path.join(root, 'package.json'), 'utf8'),
])
for (const [name, shell] of [
  ['authenticated shell', appShell],
  ['public shell', publicShell],
]) {
  assert.match(shell, /className="skip-link"/, `${name} must provide a keyboard skip link`)
  assert.match(shell, /<main[^>]+tabIndex=\{-1\}/, `${name} main region must be programmatically focusable`)
  assert.match(shell, /aria-label=/, `${name} navigation controls need accessible names`)
}
assert.match(css, /select:focus-visible/, 'select controls need a visible keyboard focus treatment')
assert.match(css, /textarea:focus-visible/, 'textarea controls need a visible keyboard focus treatment')
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/, 'reduced-motion CSS fallback must remain present')

const packageJson = JSON.parse(packageJsonText)
const renderBuild = packageJson.scripts?.['render:build'] || ''
assert.match(
  renderBuild,
  /^npm ci .*--include=dev.*&& npm run build && npm run db:deploy$/,
  'Render build must install workspace dev dependencies before Prisma/Vite and deploy committed migrations after a successful build',
)
assert.match(
  renderYaml,
  /^\s*buildCommand:\s*npm run render:build\s*$/m,
  'render.yaml must use the repository-owned render:build command instead of duplicating deployment steps in the dashboard',
)

console.log(JSON.stringify({ event: 'quality.audit_passed', clientSourceFiles: sourceFiles.length }))
