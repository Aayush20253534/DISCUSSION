import './config/load-env.js'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseEnv } from './config/env.js'
import { createDatabase } from './lib/database.js'
import { createApp } from './app.js'
import { log } from './lib/logger.js'

let database
try {
  const config = parseEnv(process.env)
  database = createDatabase(config.DATABASE_URL)
  const dist = fileURLToPath(new URL('../../client/dist/', import.meta.url))
  if (config.NODE_ENV === 'production') {
    if (!existsSync(`${dist}index.html`))
      throw new Error('Build the client before starting production')
    await database.ping()
  }
  const app = createApp({
    config,
    database,
    staticDirectory: config.NODE_ENV === 'production' ? dist : undefined,
  })
  const server = app.listen(config.PORT, () => {
    log('info', 'server.started', { port: config.PORT, databaseConfigured: database.configured })
  })
  server.on('error', async () => {
    log('error', 'server.listen_failed', {
      hint: 'Check PORT and whether another process is using it.',
    })
    await database.close()
    process.exit(1)
  })
  let stopping = false
  const shutdown = () => {
    if (stopping) return
    stopping = true
    const deadline = setTimeout(() => process.exit(1), 10000).unref()
    server.close(async () => {
      await database.close()
      clearTimeout(deadline)
      process.exit(0)
    })
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
} catch {
  log('error', 'server.startup_failed', {
    hint: 'Check server/.env, database availability, and npm run build. Credentials are not logged.',
  })
  await database?.close()
  process.exitCode = 1
}
