import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { ATTRIBUTES, signupSchema, loginSchema, onboardingSchema } from '@life-rpg/shared'
import { AppError, validate } from '../lib/errors.js'
import {
  createSecurity,
  hashPassword,
  verifyPassword,
  hashToken,
  newRefreshToken,
  refreshSessionId,
  verifyAccess,
} from './security.js'

// An explicit allowlist prevents password hashes and refresh hashes entering responses.
const publicSelect = {
  id: true,
  email: true,
  displayName: true,
  timezone: true,
  createdAt: true,
  character: {
    select: {
      id: true,
      avatarKey: true,
      totalXp: true,
      gold: true,
      attributes: { select: { key: true, xp: true }, orderBy: { key: 'asc' } },
    },
  },
}
const unauthorized = () => new AppError(401, 'AUTH_REQUIRED', 'Please sign in to continue.')

export function createAccountRouter({ config, database }) {
  const router = Router()
  const security = createSecurity(config)
  const db = database.prisma
  router.use((req, _res, next) => {
    if (!/^\/(auth|me)(\/|$)/.test(req.path)) return next('router')
    next()
  })
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })
  // Guest preview remains available without any credentials or database.
  router.get('/auth/me', (req, res, next) => {
    if (!req.cookies[security.names.access] && !req.cookies[security.names.refresh]) {
      return res.json({ data: { user: null } })
    }
    next()
  })
  router.use((_req, _res, next) => {
    if (!config.JWT_SECRET || !database.configured || !db) {
      throw new AppError(
        503,
        'AUTH_NOT_CONFIGURED',
        'Accounts are not configured yet. Please try again later.',
      )
    }
    next()
  })
  function limiter(limit, skipSuccessfulRequests = false) {
    return rateLimit({
      windowMs: 15 * 60000,
      limit,
      skipSuccessfulRequests,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: (_req, _res, next) =>
        next(new AppError(429, 'AUTH_RATE_LIMITED', 'Too many attempts. Try again in 15 minutes.')),
    })
  }
  async function sessionFromAccess(req) {
    const payload = verifyAccess(config, req.cookies[security.names.access])
    if (!payload) return null
    return db.session.findFirst({
      where: {
        id: payload.sid,
        userId: payload.sub,
        expiresAt: { gt: new Date() },
      },
    })
  }
  async function requireAuth(req, _res, next) {
    const session = await sessionFromAccess(req)
    if (!session) throw unauthorized()
    req.auth = { userId: session.userId, sessionId: session.id }
    next()
  }
  const getUser = (id, transaction = db) =>
    transaction.user.findUnique({ where: { id }, select: publicSelect })
  function makeSession(userId) {
    const id = randomUUID()
    const refresh = newRefreshToken(id)
    return {
      refresh,
      session: {
        id,
        userId,
        tokenHash: hashToken(refresh),
        expiresAt: new Date(Date.now() + config.SESSION_DAYS * 86400000),
      },
    }
  }
  router.get('/auth/csrf', (req, res) => {
    res.json({ data: { csrfToken: security.issueCsrf(req, res) } })
  })
  router.post('/auth/signup', security.requireCsrf, limiter(5), async (req, res) => {
    const input = validate(signupSchema, req.body)
    const passwordHash = await hashPassword(input.password)
    const { session, refresh } = makeSession(randomUUID())
    let user
    try {
      user = await db.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            id: session.userId,
            email: input.email,
            displayName: input.displayName,
            passwordHash,
          },
          select: publicSelect,
        })
        await tx.session.create({ data: session })
        return created
      })
    } catch (error) {
      if (error.code === 'P2002')
        throw new AppError(
          409,
          'EMAIL_IN_USE',
          'An account with that email already exists. Try signing in.',
          { email: 'This email is already registered.' },
        )
      throw error
    }
    security.setSession(res, session, refresh)
    res.status(201).json({ data: { user } })
  })
  router.post('/auth/login', security.requireCsrf, limiter(10, true), async (req, res) => {
    const input = validate(loginSchema, req.body)
    const account = await db.user.findUnique({
      where: { email: input.email },
      select: { id: true, passwordHash: true },
    })
    const verified = await verifyPassword(account?.passwordHash, input.password)
    if (!account || !verified)
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.')
    const { session, refresh } = makeSession(account.id)
    const user = await db.$transaction(async (tx) => {
      await tx.session.deleteMany({ where: { userId: account.id, expiresAt: { lte: new Date() } } })
      await tx.session.create({ data: session })
      return getUser(account.id, tx)
    })
    security.setSession(res, session, refresh)
    res.json({ data: { user } })
  })
  router.post('/auth/refresh', security.requireCsrf, limiter(60), async (req, res) => {
    const token = req.cookies[security.names.refresh]
    const id = refreshSessionId(token)
    if (!id) throw unauthorized()
    const session = await db.session.findFirst({
      where: { id, tokenHash: hashToken(token), expiresAt: { gt: new Date() } },
    })
    if (!session) throw unauthorized()
    const refresh = newRefreshToken(id)
    // Compare-and-swap: a refresh token can be redeemed once, even with simultaneous requests.
    const rotated = await db.session.updateMany({
      where: { id, tokenHash: hashToken(token), expiresAt: { gt: new Date() } },
      data: { tokenHash: hashToken(refresh) },
    })
    if (rotated.count !== 1)
      throw new AppError(
        409,
        'REFRESH_RETRY',
        'Your session is refreshing in another tab. Please retry.',
      )
    security.setSession(res, session, refresh)
    res.json({ data: { refreshed: true } })
  })
  router.get('/auth/me', requireAuth, async (req, res) => {
    const user = await getUser(req.auth.userId)
    if (!user) throw unauthorized()
    res.json({ data: { user } })
  })
  router.get('/me/character', requireAuth, async (req, res) => {
    const user = await getUser(req.auth.userId)
    if (!user) throw unauthorized()
    res.json({ data: { character: user.character } })
  })
  router.put('/me/onboarding', security.requireCsrf, requireAuth, async (req, res) => {
    const input = validate(onboardingSchema, req.body)
    let user
    try {
      user = await db.$transaction(async (tx) => {
        const existing = await getUser(req.auth.userId, tx)
        if (!existing) throw unauthorized()
        if (existing.character) return existing // Replaying onboarding must never reset progress.
        await tx.character.create({
          data: {
            userId: req.auth.userId,
            avatarKey: input.avatarKey,
            attributes: { create: ATTRIBUTES.map(({ key }) => ({ key, xp: 0 })) },
          },
        })
        return tx.user.update({
          where: { id: req.auth.userId },
          data: { displayName: input.displayName, timezone: input.timezone },
          select: publicSelect,
        })
      })
    } catch (error) {
      if (error.code !== 'P2002') throw error
      user = await getUser(req.auth.userId)
      if (!user?.character) throw error
    }
    res.json({ data: { user } })
  })
  router.post('/auth/logout', security.requireCsrf, async (req, res) => {
    // Even an expired access token can log out through the current refresh token.
    const session = await sessionFromAccess(req)
    if (session) await db.session.deleteMany({ where: { id: session.id, userId: session.userId } })
    else {
      const token = req.cookies[security.names.refresh]
      const id = refreshSessionId(token)
      if (id) await db.session.deleteMany({ where: { id, tokenHash: hashToken(token) } })
    }
    security.clearSession(res)
    res.json({ data: { loggedOut: true } })
  })
  router.post('/auth/logout-all', security.requireCsrf, requireAuth, async (req, res) => {
    await db.session.deleteMany({ where: { userId: req.auth.userId } })
    security.clearSession(res)
    res.json({ data: { loggedOut: true } })
  })
  return router
}
