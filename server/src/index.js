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

  // A request should fail clearly instead of occupying a server worker indefinitely. Database
  // queries have their own tighter timeout; these cover slow/malicious HTTP clients as well.
  server.requestTimeout = 20_000
  server.headersTimeout = 10_000
  server.keepAliveTimeout = 5_000

  server.on('error', async () => {
    log('error', 'server.listen_failed', {
      hint: 'Check PORT and whether another process is using it.',
    })
    await database.close()
    process.exit(1)
  })

  let stopping = false
  const shutdown = (exitCode = 0, reason = 'signal') => {
    if (stopping) return
    stopping = true
    log('info', 'server.stopping', { reason, exitCode })
    const deadline = setTimeout(() => {
      log('error', 'server.shutdown_timeout', { reason })
      server.closeAllConnections?.()
      process.exit(exitCode || 1)
    }, 10_000).unref()
    server.close(async () => {
      await database.close()
      clearTimeout(deadline)
      log('info', 'server.stopped', { reason, exitCode })
      process.exit(exitCode)
    })
    server.closeIdleConnections?.()
  }

  process.on('SIGTERM', () => shutdown(0, 'SIGTERM'))
  process.on('SIGINT', () => shutdown(0, 'SIGINT'))
  process.on('unhandledRejection', (reason) => {
    log('error', 'process.unhandled_rejection', { error: reason })
    shutdown(1, 'unhandledRejection')
  })
  process.on('uncaughtException', (error) => {
    log('error', 'process.uncaught_exception', { error })
    shutdown(1, 'uncaughtException')
  })
} catch {
  log('error', 'server.startup_failed', {
    hint: 'Check server/.env, database availability, and npm run build. Credentials are not logged.',
  })
  await database?.close()
  process.exitCode = 1
}
