import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import argon2 from 'argon2'
import jwt from 'jsonwebtoken'
import { AppError } from '../lib/errors.js'

const ISSUER = 'atlasborn-api'
const AUDIENCE = 'atlasborn-web'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const options = { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 }
// A hash of random, discarded bytes. Unknown emails still perform a real Argon2 verification.
const dummyHash =
  '$argon2id$v=19$m=65536,p=1,t=3$BxBIJBQ+qyj5kDGnLaBfbQ$Mx0XcJqr8r02Tu39hEwZh3XA5L93QREjvnWYCKHFgNA'
let activeHashes = 0
async function passwordWork(work) {
  if (activeHashes >= 2)
    throw new AppError(503, 'AUTH_BUSY', 'Sign-in is busy. Please try again shortly.')
  activeHashes++
  try {
    return await work()
  } finally {
    activeHashes--
  }
}
export const hashPassword = (password) => passwordWork(() => argon2.hash(password, options))
export const verifyPassword = (hash, password) =>
  passwordWork(() => argon2.verify(hash || dummyHash, password))
export const hashToken = (token) => createHash('sha256').update(token).digest('hex')
export const newRefreshToken = (id) => `${id}.${randomBytes(32).toString('base64url')}`
export function refreshSessionId(token) {
  if (typeof token !== 'string' || token.length > 100) return null
  const [id, secret, extra] = token.split('.')
  return uuid.test(id) && /^[A-Za-z0-9_-]{43}$/.test(secret || '') && !extra ? id : null
}
export function signAccess(config, session) {
  return jwt.sign({ sid: session.id, type: 'access' }, config.JWT_SECRET, {
    algorithm: 'HS256',
    issuer: ISSUER,
    audience: AUDIENCE,
    subject: session.userId,
    expiresIn: config.ACCESS_TOKEN_MINUTES * 60,
  })
}
export function verifyAccess(config, token) {
  try {
    const payload = jwt.verify(token, config.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
      maxAge: config.ACCESS_TOKEN_MINUTES * 60,
    })
    if (payload.type !== 'access' || !uuid.test(payload.sub) || !uuid.test(payload.sid)) return null
    return payload
  } catch {
    return null
  }
}
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}
export function createSecurity(config) {
  const secure = config.NODE_ENV === 'production'
  const prefix = secure ? '__Host-life_' : 'life_'
  const names = { access: `${prefix}access`, refresh: `${prefix}refresh`, csrf: `${prefix}csrf` }
  // SameSite=Lax is preferable when the browser and API share one origin. When the API is
  // intentionally hosted on a different HTTPS origin (for example Vercel -> Render), Lax cookies
  // are withheld from fetch/XHR requests and the double-submit CSRF cookie can never match the
  // header token. Keep the strict Origin + signed double-submit checks, but opt into SameSite=None
  // only for that explicitly configured cross-origin topology.
  const crossOriginBrowser =
    secure &&
    config.API_ORIGIN &&
    config.CLIENT_ORIGIN.some((origin) => origin !== config.API_ORIGIN)
  const cookie = {
    httpOnly: true,
    secure,
    sameSite: crossOriginBrowser ? 'none' : 'lax',
    path: '/',
  }
  const csrfSignature = (nonce) =>
    createHmac('sha256', config.JWT_SECRET).update(`csrf.${nonce}`).digest('base64url')
  function validCsrf(token) {
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{43}$/.test(token))
      return false
    const [nonce, signature] = token.split('.')
    return safeEqual(signature, csrfSignature(nonce))
  }
  return {
    names,
    setSession(res, session, refresh) {
      const remaining = Math.max(0, session.expiresAt.getTime() - Date.now())
      res.cookie(names.access, signAccess(config, session), {
        ...cookie,
        maxAge: Math.min(config.ACCESS_TOKEN_MINUTES * 60000, remaining),
      })
      res.cookie(names.refresh, refresh, { ...cookie, maxAge: remaining })
    },
    clearSession(res) {
      res.clearCookie(names.access, cookie)
      res.clearCookie(names.refresh, cookie)
    },
    issueCsrf(req, res) {
      let token = req.cookies[names.csrf]
      if (!validCsrf(token)) {
        const nonce = randomBytes(32).toString('base64url')
        token = `${nonce}.${csrfSignature(nonce)}`
      }
      res.cookie(names.csrf, token, { ...cookie, maxAge: config.SESSION_DAYS * 86400000 })
      return token
    },
    requireCsrf(req, _res, next) {
      if (!config.CLIENT_ORIGIN.includes(req.get('Origin'))) {
        throw new AppError(403, 'ORIGIN_NOT_ALLOWED', 'Open the app from its configured address.')
      }
      if (!req.is('application/json'))
        throw new AppError(415, 'JSON_REQUIRED', 'Send a JSON request.')
      const token = req.cookies[names.csrf]
      if (!validCsrf(token) || !safeEqual(token, req.get('X-CSRF-Token'))) {
        throw new AppError(403, 'CSRF_INVALID', 'Your form expired. Please try again.')
      }
      next()
    },
  }
}
