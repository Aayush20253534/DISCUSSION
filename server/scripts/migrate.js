import '../src/config/load-env.js'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { parseEnv } from '../src/config/env.js'

const require = createRequire(import.meta.url)
try {
  const config = parseEnv(process.env)
  if (!config.DIRECT_URL)
    throw new Error('Set DIRECT_URL in server/.env before running migrations.')
  const mode = process.argv[2]
  if (!['dev', 'deploy'].includes(mode)) throw new Error('Use dev or deploy.')
  const result = spawnSync(
    process.execPath,
    // Prisma's package root exports types; the published CLI entry runs migrations.
    [require.resolve('prisma/build/index.js'), 'migrate', mode, ...process.argv.slice(3)],
    { stdio: 'inherit' },
  )
  process.exitCode = result.status ?? 1
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
