import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import {
  ATTRIBUTES,
  signupSchema,
  loginSchema,
  onboardingSchema,
  profileSettingsSchema,
  changePasswordSchema,
} from '@life-rpg/shared'
import { createAuthentication } from './middleware.js'
import { AppError, validate } from '../lib/errors.js'
import {
  createSecurity,
  hashPassword,
  verifyPassword,
  hashToken,
  newRefreshToken,
  refreshSessionId,
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
  equipment: {
    select: {
      slot: true,
      inventoryItem: {
        select: {
          id: true,
          shopItem: {
            select: { id: true, name: true, type: true, rarity: true, assetKey: true },
          },
        },
      },
    },
    orderBy: { slot: 'asc' },
  },
}
const unauthorized = () => new AppError(401, 'AUTH_REQUIRED', 'Please sign in to continue.')
const sessionIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function cleanUserAgent(value) {
  if (typeof value !== 'string') return null
  const withoutControlCharacters = Array.from(value, (character) => {
    const codePoint = character.codePointAt(0)
    return codePoint <= 0x1f || codePoint === 0x7f ? ' ' : character
  }).join('')
  const cleaned = withoutControlCharacters.replace(/\s+/g, ' ').trim()
  return cleaned ? cleaned.slice(0, 300) : null
}

function sessionDevice(userAgent) {
  if (!userAgent) return 'Existing browser session'
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /Firefox\//.test(userAgent)
      ? 'Firefox'
      : /Chrome\//.test(userAgent)
        ? 'Chrome'
        : /Safari\//.test(userAgent)
          ? 'Safari'
          : 'Browser'
  const platform = /iPhone|iPad|iPod/.test(userAgent)
    ? 'iOS'
    : /Android/.test(userAgent)
      ? 'Android'
      : /Windows/.test(userAgent)
        ? 'Windows'
        : /Macintosh|Mac OS X/.test(userAgent)
          ? 'macOS'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : 'device'
  return `${browser} on ${platform}`
}

function publicSession(session, currentSessionId) {
  return {
    id: session.id,
    device: sessionDevice(session.userAgent),
    createdAt: session.createdAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
    current: session.id === currentSessionId,
  }
}

export function createAccountRouter({ config, database }) {
  const router = Router()
  const security = createSecurity(config)
  const db = database.prisma
  const { requireConfigured, sessionFromAccess, requireAuth } = createAuthentication({
    config,
    database,
    security,
  })
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
  router.use(requireConfigured)
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
  const getUser = (id, transaction = db) =>
    transaction.user.findUnique({ where: { id }, select: publicSelect })
  function makeSession(userId, req) {
    const id = randomUUID()
    const refresh = newRefreshToken(id)
    return {
      refresh,
      session: {
        id,
        userId,
        tokenHash: hashToken(refresh),
        expiresAt: new Date(Date.now() + config.SESSION_DAYS * 86400000),
        userAgent: cleanUserAgent(req.get('User-Agent')),
      },
    }
  }
  router.get('/auth/csrf', (req, res) => {
    res.json({ data: { csrfToken: security.issueCsrf(req, res) } })
  })
  router.post('/auth/signup', security.requireCsrf, limiter(5), async (req, res) => {
    const input = validate(signupSchema, req.body)
    const passwordHash = await hashPassword(input.password)
    const { session, refresh } = makeSession(randomUUID(), req)
    let user
    try {
      const [createdUser] = await db.$transaction([
        db.user.create({
          data: {
            id: session.userId,
            email: input.email,
            displayName: input.displayName,
            passwordHash,
          },
          select: publicSelect,
        }),
        db.session.create({ data: session }),
      ])
      user = createdUser
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
    const { session, refresh } = makeSession(account.id, req)
    await db.$transaction([
      db.session.deleteMany({ where: { userId: account.id, expiresAt: { lte: new Date() } } }),
      db.session.create({ data: session }),
    ])
    const user = await getUser(account.id)
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

  router.put('/me/profile', security.requireCsrf, requireAuth, async (req, res) => {
    const input = validate(profileSettingsSchema, req.body)
    const user = await db.user.update({
      where: { id: req.auth.userId },
      data: { displayName: input.displayName, timezone: input.timezone },
      select: publicSelect,
    })
    // Daily quest schedule timezones remain immutable. A profile timezone change affects only
    // future account-local activity dates and display, so it cannot mint another daily reward.
    res.json({ data: { user } })
  })

  router.put(
    '/me/password',
    security.requireCsrf,
    limiter(5, true),
    requireAuth,
    async (req, res) => {
      const input = validate(changePasswordSchema, req.body)
      const account = await db.user.findUnique({
        where: { id: req.auth.userId },
        select: { passwordHash: true },
      })
      if (!account) throw unauthorized()
      const verified = await verifyPassword(account.passwordHash, input.currentPassword)
      if (!verified)
        throw new AppError(400, 'PASSWORD_INCORRECT', 'Your current password is incorrect.', {
          currentPassword: 'Current password is incorrect.',
        })
      const passwordHash = await hashPassword(input.newPassword)
      const result = await db.$transaction(async (tx) => {
        await tx.user.update({ where: { id: req.auth.userId }, data: { passwordHash } })
        const revoked = await tx.session.deleteMany({
          where: { userId: req.auth.userId, id: { not: req.auth.sessionId } },
        })
        return revoked.count
      })
      res.json({ data: { changed: true, revokedSessions: result } })
    },
  )

  router.get('/me/sessions', requireAuth, async (req, res) => {
    const sessions = await db.session.findMany({
      where: { userId: req.auth.userId, expiresAt: { gt: new Date() } },
      select: { id: true, createdAt: true, expiresAt: true, userAgent: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    res.json({ data: { sessions: sessions.map((item) => publicSession(item, req.auth.sessionId)) } })
  })

  router.delete('/me/sessions/:sessionId', security.requireCsrf, requireAuth, async (req, res) => {
    if (!sessionIdPattern.test(req.params.sessionId))
      throw new AppError(404, 'SESSION_NOT_FOUND', 'That session is no longer active.')
    const removed = await db.session.deleteMany({
      where: { id: req.params.sessionId, userId: req.auth.userId },
    })
    if (!removed.count)
      throw new AppError(404, 'SESSION_NOT_FOUND', 'That session is no longer active.')
    const currentRevoked = req.params.sessionId === req.auth.sessionId
    if (currentRevoked) security.clearSession(res)
    res.json({ data: { revoked: true, currentRevoked } })
  })

  router.post('/me/sessions/revoke-others', security.requireCsrf, requireAuth, async (req, res) => {
    const revoked = await db.session.deleteMany({
      where: { userId: req.auth.userId, id: { not: req.auth.sessionId } },
    })
    res.json({ data: { revokedSessions: revoked.count } })
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
