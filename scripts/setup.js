import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Preserve every existing ignore rule. Only add missing foundation entries.
const ignorePath = fileURLToPath(new URL('../.gitignore', import.meta.url))
const original = existsSync(ignorePath) ? readFileSync(ignorePath, 'utf8') : ''
const existing = new Set(original.split(/\r?\n/).map((line) => line.trim()))
const required = [
  'node_modules/',
  'dist/',
  'coverage/',
  'playwright-report/',
  'test-results/',
  '.env',
  '.env.*',
  '!.env.example',
  '*.log',
  '*.patch',
  '.DS_Store',
  'server/generated/',
]
const missing = required.filter((rule) => !existing.has(rule))
if (missing.length) {
  const newline = original.includes('\r\n') ? '\r\n' : '\n'
  const separator = original && !original.endsWith('\n') ? newline : ''
  appendFileSync(ignorePath, separator + newline + '# Life RPG foundation' + newline + missing.join(newline) + newline)
  console.log('Added missing foundation ignore rules; existing rules were preserved.')
} else {
  console.log('Foundation ignore rules are already present.')
}
