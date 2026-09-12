import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'

// Resolve paths relative to this file so the script also works from another directory.
const file = fileURLToPath(new URL('../server/.env', import.meta.url))
if (!existsSync(file)) copyFileSync(new URL('../server/.env.example', import.meta.url), file)
const original = readFileSync(file, 'utf8')
const configured = parseEnv(original).JWT_SECRET
if (configured) {
  if (configured.length < 64) {
    console.error(
      'JWT_SECRET is too short. Clear only its value in server/.env and run this command again.',
    )
    process.exitCode = 1
  } else {
    console.log('JWT_SECRET is already configured; your existing secret was preserved.')
  }
} else {
  const newline = original.includes('\r\n') ? '\r\n' : '\n'
  const entry = `JWT_SECRET=${randomBytes(64).toString('hex')}`
  const pattern = /^[ \t]*(?:export[ \t]+)?JWT_SECRET[ \t]*=.*$/gm
  const updated = pattern.test(original)
    ? original.replace(pattern, entry)
    : `${original}${original.endsWith('\n') ? '' : newline}${entry}${newline}`
  writeFileSync(file, updated, { mode: 0o600 })
  console.log(
    'Created a private JWT secret in server/.env. Existing database settings were preserved.',
  )
}
