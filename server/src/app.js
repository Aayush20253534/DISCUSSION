import { randomUUID } from 'node:crypto'
import path from 'node:path'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import { rateLimit } from 'express-rate-limit'
import { APP_NAME, API_PREFIX, ATTRIBUTES, worldSchema } from '@life-rpg/shared'
import { log } from './lib/logger.js'
import { AppError } from './lib/errors.js'
import { createActivityRouter } from './activity/router.js'
import { createProgressionRouter } from './progression/router.js'
import { createQuestRouter } from './quests/router.js'
import { createAccountRouter } from './auth/router.js'
import { createEconomyRouter } from './economy/router.js'
import { createDashboardRouter } from './dashboard/router.js'

export function createApp({ config, database, staticDirectory, logger = log, clock }) {
  const app = express()
  app.disable('x-powered-by')
  if (config.TRUST_PROXY_HOPS) app.set('trust proxy', config.TRUST_PROXY_HOPS)
  app.use((req, res, next) => {
    req.requestId = randomUUID()
    res.set('X-Request-Id', req.requestId)
    const start = Date.now()
    res.on('finish', () => {
      const durationMs = Date.now() - start
      const details = {
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs,
        responseBytes: Number(res.getHeader('Content-Length')) || undefined,
      }
      if (durationMs >= 1500) logger('warn', 'http.slow_request', details)
      else logger('info', 'http.request', details)
    })
    next()
  })
  app.use(
    helmet({
      // Development is served by Vite over HTTP. Production keeps Helmet defaults.
      strictTransportSecurity: config.NODE_ENV === 'production' ? undefined : false,
      contentSecurityPolicy: config.NODE_ENV === 'production' ? undefined : false,
    }),
  )
  app.use(
    cors({
      credentials: true,
      origin(origin, callback) {
        if (!origin || config.CLIENT_ORIGIN.includes(origin)) return callback(null, true)
        const error = new Error('Origin not allowed')
        error.status = 403
        error.code = 'ORIGIN_NOT_ALLOWED'
        callback(error)
      },
    }),
  )
  app.use(express.json({ limit: '32kb' }))
  app.use(cookieParser())
  // API responses can contain account state. Keep browser/proxy caches out of the equation even
  // for error responses and routes that are added later.
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })
  const publicOrigin = config.PUBLIC_APP_URL || config.CLIENT_ORIGIN[0]
  app.get('/robots.txt', (_req, res) => {
    res
      .type('text/plain')
      .set('Cache-Control', 'public, max-age=3600')
      .send(
        [
          'User-agent: *',
          'Allow: /',
          'Disallow: /api/',
          'Disallow: /health',
          `Sitemap: ${publicOrigin}/sitemap.xml`,
          '',
        ].join('\n'),
      )
  })
  app.get('/sitemap.xml', (_req, res) => {
    const pages = ['/', '/how-it-works']
    const urls = pages
      .map((route) => `  <url><loc>${publicOrigin}${route}</loc></url>`)
      .join('\n')
    res
      .type('application/xml')
      .set('Cache-Control', 'public, max-age=3600')
      .send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`)
  })

  app.get('/health', (_req, res) => {
    res.set('Cache-Control', 'no-store').json({ data: { status: 'ok', service: 'life-rpg-api' } })
  })
  app.get('/health/ready', async (req, res) => {
    res.set('Cache-Control', 'no-store')
    try {
      const ready = await database.ping()
      if (!ready)
        return res.status(503).json({
          error: {
            code: 'DATABASE_NOT_CONFIGURED',
            message: 'Database is not configured.',
            requestId: req.requestId,
          },
        })
      res.json({ data: { status: 'ready', database: 'connected' } })
    } catch {
      res.status(503).json({
        error: {
          code: 'DATABASE_UNAVAILABLE',
          message: 'Database is temporarily unavailable.',
          requestId: req.requestId,
        },
      })
    }
  })
  app.use(
    API_PREFIX,
    rateLimit({
      windowMs: 60000,
      limit: 120,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: (req, res) =>
        res.status(429).json({
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests. Try again shortly.',
            requestId: req.requestId,
          },
        }),
    }),
  )
  app.get(`${API_PREFIX}/world`, (_req, res) => {
    res.json({
      data: worldSchema.parse({
        name: APP_NAME,
        stage: 'progression',
        accountsAvailable: Boolean(config.JWT_SECRET && database.configured),
        attributes: ATTRIBUTES,
      }),
    })
  })
  app.use(API_PREFIX, createAccountRouter({ config, database }))
  app.use(`${API_PREFIX}/quests`, createQuestRouter({ config, database, clock }))
  app.use(`${API_PREFIX}/activity`, createActivityRouter({ config, database, clock }))
  app.use(`${API_PREFIX}/progress`, createProgressionRouter({ config, database }))
  app.use(`${API_PREFIX}/dashboard`, createDashboardRouter({ config, database, clock }))
  app.use(API_PREFIX, createEconomyRouter({ config, database }))
  // Unknown API routes must never return the SPA's HTML.
  app.use('/api', (req, res) =>
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'API route not found.', requestId: req.requestId },
    }),
  )
  if (staticDirectory) {
    // Vite fingerprints files under /assets, so they are safe to cache for a year. HTML stays
    // revalidated so a deployment never strands clients on stale chunk references.
    app.use(
      '/assets',
      express.static(path.join(staticDirectory, 'assets'), {
        index: false,
        maxAge: '1y',
        immutable: true,
        redirect: false,
      }),
    )
    app.get(['/', '/how-it-works'], (req, res) => {
      const file = req.path === '/' ? 'index.html' : 'how-it-works.html'
      res.set('Cache-Control', 'no-cache').sendFile(path.join(staticDirectory, file))
    })
    app.use(
      express.static(staticDirectory, {
        index: false,
        maxAge: '1h',
        redirect: false,
      }),
    )
    app.get('/{*path}', (req, res, next) => {
      if (!req.accepts('html') || path.extname(req.path) || req.path.startsWith('/health/'))
        return next()
      if (req.path !== '/' && req.path !== '/how-it-works') {
        res.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
      }
      res.set('Cache-Control', 'no-cache').sendFile(path.join(staticDirectory, 'index.html'))
    })
  }
  app.use((req, res) =>
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Route not found.', requestId: req.requestId },
    }),
  )
  app.use((error, req, res, _next) => {
    if (error.name?.startsWith('Prisma')) {
      if (config.NODE_ENV !== 'production') {
        logger('error', 'database.error', {
          requestId: req.requestId,
          name: error.name,
          code: error.code,
          message: error.message,
        })
      }

      error = new AppError(
        503,
        'DATABASE_UNAVAILABLE',
        'Your adventure could not be loaded. Please try again shortly.',
      )
    }
    if (error instanceof AppError) {
      logger('error', 'http.error', {
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        status: error.status,
        code: error.code,
      })
      return res.status(error.status).json({
        error: {
          code: error.code,
          message: error.message,
          fields: error.fields,
          requestId: req.requestId,
        },
      })
    }
    const status = error.status >= 400 && error.status < 600 ? error.status : 500
    const code =
      error.type === 'entity.parse.failed'
        ? 'INVALID_JSON'
        : error.type === 'entity.too.large'
          ? 'PAYLOAD_TOO_LARGE'
          : error.code === 'ORIGIN_NOT_ALLOWED'
            ? error.code
            : 'REQUEST_FAILED'
    const message =
      status === 500
        ? 'Something went wrong. Please try again.'
        : code === 'INVALID_JSON'
          ? 'Send valid JSON.'
          : code === 'PAYLOAD_TOO_LARGE'
            ? 'Request body is too large.'
            : code === 'ORIGIN_NOT_ALLOWED'
              ? 'Origin not allowed.'
              : 'Request could not be processed.'
    logger('error', 'http.error', {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      status,
      code,
    })
    res.status(status).json({ error: { code, message, requestId: req.requestId } })
  })
  return app
}
