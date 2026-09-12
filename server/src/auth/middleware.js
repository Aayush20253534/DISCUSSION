import { AppError } from '../lib/errors.js'
import { createSecurity, verifyAccess } from './security.js'

// Shared by account and resource routes: a valid JWT also needs a live database session.
export function createAuthentication({ config, database, security = createSecurity(config) }) {
  function requireConfigured(_req, _res, next) {
    if (!config.JWT_SECRET || !database.configured || !database.prisma) {
      throw new AppError(
        503,
        'AUTH_NOT_CONFIGURED',
        'Accounts are not configured yet. Please try again later.',
      )
    }
    next()
  }
  async function sessionFromAccess(req) {
    const payload = verifyAccess(config, req.cookies[security.names.access])
    if (!payload) return null
    return database.prisma.session.findFirst({
      where: {
        id: payload.sid,
        userId: payload.sub,
        expiresAt: { gt: new Date() },
      },
    })
  }
  async function requireAuth(req, _res, next) {
    const session = await sessionFromAccess(req)
    if (!session) throw new AppError(401, 'AUTH_REQUIRED', 'Please sign in to continue.')
    req.auth = { userId: session.userId, sessionId: session.id }
    next()
  }
  return { requireConfigured, sessionFromAccess, requireAuth }
}
