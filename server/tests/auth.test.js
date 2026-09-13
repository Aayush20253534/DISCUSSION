import { before, after, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import request from 'supertest'
import argon2 from 'argon2'
import jwt from 'jsonwebtoken'
import { createApp } from '../src/app.js'
import { parseEnv } from '../src/config/env.js'
import { hashToken, signAccess, verifyAccess } from '../src/auth/security.js'
import { testDatabase } from './helpers/database.js'
import { createTestMailer } from './helpers/email.js'

const secret = 'test-only-not-for-deployment-'.repeat(4)
const origin = 'http://localhost:5173'
const prefix = '/api/v1'
const input = {
  email: 'hero@example.test',
  displayName: 'Satya',
  password: 'A memorable woodland adventure',
}
const profile = { displayName: 'Satya the Scholar', avatarKey: 'scholar', timezone: 'Asia/Kolkata' }
const config = parseEnv({ NODE_ENV: 'test', JWT_SECRET: secret })
let database, app, mailer
before(async () => {
  database = await testDatabase()
})
after(async () => {
  await database?.close()
})
beforeEach(async () => {
  await database.prisma.user.deleteMany()
  mailer = createTestMailer()
  app = createApp({ config, database, logger: () => {}, mailer })
})
function cookie(response, name) {
  const entry = response.headers['set-cookie']?.find((value) => value.startsWith(`${name}=`))
  return entry?.split(';')[0]
}
function value(pair) {
  return decodeURIComponent(pair.slice(pair.indexOf('=') + 1))
}
async function browser() {
  const agent = request.agent(app)
  const response = await agent.get(`${prefix}/auth/csrf`).expect(200)
  return { agent, csrf: response.body.data.csrfToken, csrfCookie: cookie(response, 'life_csrf') }
}
function mutate(client, method, path, body = {}) {
  return client.agent[method](`${prefix}${path}`)
    .set('Origin', origin)
    .set('X-CSRF-Token', client.csrf)
    .send(body)
}
async function signedUp(data = input) {
  const client = await browser()
  const response = await mutate(client, 'post', '/auth/signup', data).expect(201)
  return { ...client, response, user: response.body.data.user }
}

test('signup immediately creates the account, normalizes email, stores Argon2id and a refresh hash, and returns only public fields', async () => {
  const client = await signedUp({ ...input, email: ' HERO@EXAMPLE.TEST ' })
  assert.equal(client.user.email, input.email)
  assert.equal(client.user.character, null)
  const row = await database.prisma.user.findUnique({ where: { id: client.user.id } })
  assert.match(row.passwordHash, /^\$argon2id\$/)
  assert.ok(await argon2.verify(row.passwordHash, input.password))
  const session = await database.prisma.session.findFirst()
  const refresh = value(cookie(client.response, 'life_refresh'))
  assert.equal(session.tokenHash, hashToken(refresh))
  assert.notEqual(session.tokenHash, refresh)
  assert.ok(!JSON.stringify(client.response.body).includes('Hash'))
  assert.ok(!JSON.stringify(client.response.body).includes(input.password))
  const access = value(cookie(client.response, 'life_access'))
  const payload = jwt.verify(access, secret, {
    algorithms: ['HS256'],
    issuer: 'atlasborn-api',
    audience: 'atlasborn-web',
  })
  assert.equal(payload.sub, client.user.id)
  assert.equal(payload.sid, session.id)
  assert.equal(payload.exp - payload.iat, 900)
  for (const header of client.response.headers['set-cookie']) {
    assert.match(header, /HttpOnly/)
    assert.match(header, /SameSite=Lax/)
    assert.match(header, /Path=\//)
  }
  const me = await client.agent.get(`${prefix}/auth/me`).expect(200)
  assert.equal(me.body.data.user.id, client.user.id)
  await mutate(client, 'post', '/auth/signup', input).expect(409)
  assert.equal(await database.prisma.user.count(), 1)
})

test('signup creates a user and session immediately without an email-verification round trip', async () => {
  const client = await browser()
  const registered = await mutate(client, 'post', '/auth/signup', {
    ...input,
    email: ' DIRECT-HERO@EXAMPLE.TEST ',
  }).expect(201)

  assert.equal(registered.body.data.user.email, 'direct-hero@example.test')
  assert.equal(await database.prisma.user.count(), 1)
  assert.equal(await database.prisma.session.count(), 1)

  await mutate(client, 'post', '/auth/verify-email', {
    verificationId: randomUUID(),
    otp: '000000',
  }).expect(404)
  await mutate(client, 'post', '/auth/resend-verification', {
    verificationId: randomUUID(),
  }).expect(404)
})

test('onboarding is atomic, initializes five attributes, and replay cannot reset progress or another account', async () => {
  const first = await signedUp()
  const second = await signedUp({ ...input, email: 'other@example.test' })
  await mutate(first, 'put', '/me/onboarding', { ...profile, userId: second.user.id }).expect(422)
  await mutate(first, 'put', '/me/onboarding', { ...profile, timezone: 'Moon/Base' }).expect(422)
  await mutate(first, 'put', '/me/onboarding', { ...profile, avatarKey: '../../admin' }).expect(422)
  assert.equal(await database.prisma.character.count(), 0)
  const response = await mutate(first, 'put', '/me/onboarding', profile).expect(200)
  const { user } = response.body.data
  assert.equal(user.timezone, profile.timezone)
  assert.equal(user.character.avatarKey, 'scholar')
  assert.equal(user.character.gold, 0)
  assert.equal(user.character.totalXp, 0)
  assert.equal(user.character.attributes.length, 5)
  assert.equal(new Set(user.character.attributes.map((a) => a.key)).size, 5)
  assert.ok(user.character.attributes.every((a) => a.xp === 0))
  await database.prisma.character.update({
    where: { id: user.character.id },
    data: { gold: 25, totalXp: 50 },
  })
  const replay = await mutate(first, 'put', '/me/onboarding', {
    ...profile,
    avatarKey: 'guardian',
  }).expect(200)
  assert.equal(replay.body.data.user.character.gold, 25)
  assert.equal(replay.body.data.user.character.totalXp, 50)
  assert.equal(replay.body.data.user.character.avatarKey, 'scholar')
  const other = await second.agent.get(`${prefix}/me/character?userId=${first.user.id}`).expect(200)
  assert.equal(other.body.data.character, null)
  await request(app).get(`${prefix}/me/character`).expect(401)
  await request(app)
    .get(`${prefix}/auth/me`)
    .expect(200, { data: { user: null } })
  await assert.rejects(
    database.prisma.character.update({ where: { id: user.character.id }, data: { gold: -1 } }),
  )
})

test('a database failure during onboarding rolls back the character and every attribute', async () => {
  const client = await signedUp()
  await database.prisma.$executeRawUnsafe(
    `ALTER TABLE users ADD CONSTRAINT test_reject_name CHECK (display_name <> 'Blocked Adventurer')`,
  )
  try {
    await mutate(client, 'put', '/me/onboarding', {
      ...profile,
      displayName: 'Blocked Adventurer',
    }).expect(500)
    assert.equal(await database.prisma.character.count(), 0)
    assert.equal(await database.prisma.characterAttribute.count(), 0)
    const saved = await database.prisma.user.findUnique({ where: { id: client.user.id } })
    assert.equal(saved.displayName, input.displayName)
  } finally {
    await database.prisma.$executeRawUnsafe('ALTER TABLE users DROP CONSTRAINT test_reject_name')
  }
})

test('known and unknown emails return the same credential error; login restores persisted onboarding', async () => {
  const first = await signedUp()
  await mutate(first, 'put', '/me/onboarding', profile).expect(200)
  await mutate(first, 'post', '/auth/logout').expect(200)
  const client = await browser()
  const badPassword = await mutate(client, 'post', '/auth/login', {
    ...input,
    displayName: undefined,
    password: 'incorrect password',
  }).expect(401)
  const unknown = await mutate(client, 'post', '/auth/login', {
    email: 'missing@example.test',
    password: 'incorrect password',
  }).expect(401)
  assert.equal(unknown.body.error.message, badPassword.body.error.message)
  assert.equal(unknown.body.error.code, 'INVALID_CREDENTIALS')
  const login = await mutate(client, 'post', '/auth/login', {
    email: 'HERO@EXAMPLE.TEST',
    password: input.password,
  }).expect(200)
  assert.equal(login.body.data.user.character.avatarKey, 'scholar')
  assert.equal(login.body.data.user.displayName, profile.displayName)
})

test('refresh rotates once, rejects replay, keeps an absolute expiry, and logout revokes old JWTs', async () => {
  const client = await signedUp()
  const originalAccess = cookie(client.response, 'life_access')
  const originalRefresh = cookie(client.response, 'life_refresh')
  const original = await database.prisma.session.findFirst()
  const renewed = await mutate(client, 'post', '/auth/refresh').expect(200)
  assert.notEqual(cookie(renewed, 'life_refresh'), originalRefresh)
  const updated = await database.prisma.session.findFirst()
  assert.equal(updated.expiresAt.getTime(), original.expiresAt.getTime())
  await request(app)
    .post(`${prefix}/auth/refresh`)
    .set('Origin', origin)
    .set('X-CSRF-Token', client.csrf)
    .set('Cookie', [client.csrfCookie, originalRefresh])
    .send({})
    .expect(401)
  await mutate(client, 'post', '/auth/logout').expect(200)
  assert.equal(await database.prisma.session.count(), 0)
  await request(app).get(`${prefix}/me/character`).set('Cookie', originalAccess).expect(401)
  await client.agent.get(`${prefix}/auth/me`).expect(200, { data: { user: null } })
})

test('simultaneous refreshes have one winner and cannot overwrite the winning token', async () => {
  const client = await signedUp()
  const headers = [client.csrfCookie, cookie(client.response, 'life_refresh')]
  const responses = await Promise.all(
    [0, 1].map(() =>
      request(app)
        .post(`${prefix}/auth/refresh`)
        .set('Origin', origin)
        .set('X-CSRF-Token', client.csrf)
        .set('Cookie', headers)
        .send({}),
    ),
  )
  assert.equal(responses.filter((r) => r.status === 200).length, 1)
  assert.ok(responses.some((r) => [401, 409].includes(r.status)))
  const winner = responses.find((r) => r.status === 200)
  const current = await database.prisma.session.findFirst()
  assert.equal(current.tokenHash, hashToken(value(cookie(winner, 'life_refresh'))))
})

test('expired JWTs require refresh; expired sessions and altered or wrong-algorithm JWTs are rejected', async () => {
  const client = await signedUp()
  const session = await database.prisma.session.findFirst()
  const payload = {
    sub: client.user.id,
    sid: session.id,
    type: 'access',
    iss: 'atlasborn-api',
    aud: 'atlasborn-web',
  }
  const expired = jwt.sign({ ...payload, iat: Math.floor(Date.now() / 1000) - 1000 }, secret, {
    algorithm: 'HS256',
    expiresIn: 900,
  })
  await request(app)
    .get(`${prefix}/me/character`)
    .set('Cookie', `life_access=${expired}`)
    .expect(401)
  await mutate(client, 'post', '/auth/refresh').expect(200)
  for (const token of [
    jwt.sign(payload, secret, { algorithm: 'HS384', expiresIn: 900 }),
    jwt.sign({ ...payload, aud: 'another-app' }, secret, { expiresIn: 900 }),
    jwt.sign({ ...payload, type: 'refresh' }, secret, { expiresIn: 900 }),
    jwt.sign({ ...payload, sub: randomUUID() }, secret, { expiresIn: 900 }),
    `${value(cookie(client.response, 'life_access'))}x`,
  ])
    await request(app)
      .get(`${prefix}/me/character`)
      .set('Cookie', `life_access=${token}`)
      .expect(401)
  await database.prisma.session.update({
    where: { id: session.id },
    data: { expiresAt: new Date(Date.now() - 1000) },
  })
  await client.agent.get(`${prefix}/me/character`).expect(401)
  await mutate(client, 'post', '/auth/refresh').expect(401)
  assert.equal(verifyAccess(config, expired), null)
  assert.equal(verifyAccess(config, signAccess(config, session)).sub, client.user.id)
})

test('logout-all revokes every session while preserving the account', async () => {
  const one = await signedUp()
  const two = await browser()
  const login = await mutate(two, 'post', '/auth/login', {
    email: input.email,
    password: input.password,
  }).expect(200)
  assert.equal(await database.prisma.session.count(), 2)
  await mutate(one, 'post', '/auth/logout-all').expect(200)
  await request(app)
    .get(`${prefix}/me/character`)
    .set('Cookie', cookie(login, 'life_access'))
    .expect(401)
  assert.equal(await database.prisma.session.count(), 0)
  assert.equal(await database.prisma.user.count(), 1)
})

test('state changes require exact Origin, signed CSRF token, and JSON; errors do not write accounts', async () => {
  const client = await browser()
  await client.agent.post(`${prefix}/auth/signup`).set('Origin', origin).send(input).expect(403)
  await client.agent
    .post(`${prefix}/auth/signup`)
    .set('X-CSRF-Token', client.csrf)
    .send(input)
    .expect(403)
  await client.agent
    .post(`${prefix}/auth/signup`)
    .set('Origin', 'https://attacker.example')
    .set('X-CSRF-Token', client.csrf)
    .send(input)
    .expect(403)
  await client.agent
    .post(`${prefix}/auth/signup`)
    .set('Origin', origin)
    .set('X-CSRF-Token', 'x'.repeat(client.csrf.length))
    .send(input)
    .expect(403)
  await client.agent
    .post(`${prefix}/auth/signup`)
    .set('Origin', origin)
    .set('X-CSRF-Token', client.csrf)
    .type('form')
    .send(input)
    .expect(415)
  await mutate(client, 'post', '/auth/signup', { ...input, password: 'short' }).expect(422)
  await mutate(client, 'post', '/auth/signup', { ...input, password: 'x'.repeat(129) }).expect(422)
  assert.equal(await database.prisma.user.count(), 0)
})

test('production uses Secure __Host cookies and no-store responses', async () => {
  const prod = parseEnv({
    NODE_ENV: 'production',
    JWT_SECRET: secret,
    DATABASE_URL: 'postgresql://test:test@localhost/test',
    CLIENT_ORIGIN: 'https://life.example',
  })
  const productionMailer = createTestMailer()
  const production = createApp({ config: prod, database, logger: () => {}, mailer: productionMailer })
  const csrf = await request(production).get(`${prefix}/auth/csrf`).expect(200)
  const registered = await request(production)
    .post(`${prefix}/auth/signup`)
    .set('Origin', 'https://life.example')
    .set('Cookie', cookie(csrf, '__Host-life_csrf'))
    .set('X-CSRF-Token', csrf.body.data.csrfToken)
    .send(input)
    .expect(201)
  assert.match(registered.headers['cache-control'], /no-store/)
  for (const header of registered.headers['set-cookie']) {
    assert.match(header, /^__Host-life_/)
    assert.match(header, /; Secure/)
    assert.match(header, /HttpOnly/)
    assert.match(header, /SameSite=Lax/)
    assert.ok(!header.includes('Domain='))
  }
})

test('cross-origin production auth uses SameSite=None while preserving signed CSRF and strict Origin', async () => {
  const browserOrigin = 'https://life-web.example'
  const prod = parseEnv({
    NODE_ENV: 'production',
    JWT_SECRET: secret,
    DATABASE_URL: 'postgresql://test:test@localhost/test',
    CLIENT_ORIGIN: browserOrigin,
    API_ORIGIN: 'https://life-api.example',
    PUBLIC_APP_URL: browserOrigin,
  })
  const productionMailer = createTestMailer()
  const production = createApp({ config: prod, database, logger: () => {}, mailer: productionMailer })
  const csrf = await request(production).get(`${prefix}/auth/csrf`).expect(200)
  const csrfCookie = cookie(csrf, '__Host-life_csrf')
  const csrfHeader = csrf.headers['set-cookie'].find((value) =>
    value.startsWith('__Host-life_csrf='),
  )
  assert.match(csrfHeader, /; Secure/)
  assert.match(csrfHeader, /SameSite=None/)
  assert.ok(!csrfHeader.includes('Domain='))

  const crossOriginInput = { ...input, email: 'cross-origin@example.test' }
  const registered = await request(production)
    .post(`${prefix}/auth/signup`)
    .set('Origin', browserOrigin)
    .set('Cookie', csrfCookie)
    .set('X-CSRF-Token', csrf.body.data.csrfToken)
    .send(crossOriginInput)
    .expect(201)

  for (const header of registered.headers['set-cookie']) {
    assert.match(header, /; Secure/)
    assert.match(header, /SameSite=None/)
    assert.ok(!header.includes('Domain='))
  }

  const login = await request(production)
    .post(`${prefix}/auth/login`)
    .set('Origin', browserOrigin)
    .set('Cookie', csrfCookie)
    .set('X-CSRF-Token', csrf.body.data.csrfToken)
    .send({ email: 'cross-origin@example.test', password: input.password })
    .expect(200)
  assert.equal(login.body.data.user.email, 'cross-origin@example.test')

  await request(production)
    .post(`${prefix}/auth/login`)
    .set('Origin', 'https://attacker.example')
    .set('Cookie', csrfCookie)
    .set('X-CSRF-Token', csrf.body.data.csrfToken)
    .send({ email: 'cross-origin@example.test', password: input.password })
    .expect(403)
})

test('failed login rate limit applies before more password work', async () => {
  const client = await browser()
  for (let i = 0; i < 10; i++)
    await mutate(client, 'post', '/auth/login', {
      email: input.email,
      password: 'not the right password',
    }).expect(401)
  const blocked = await mutate(client, 'post', '/auth/login', {
    email: input.email,
    password: 'not the right password',
  }).expect(429)
  assert.equal(blocked.body.error.code, 'AUTH_RATE_LIMITED')
  assert.ok(blocked.headers['retry-after'])
})

test('password recovery is non-enumerating, single-use, updates the password, and revokes sessions', async () => {
  const client = await signedUp()
  const known = await mutate(client, 'post', '/auth/forgot-password', { email: input.email }).expect(202)
  const unknown = await mutate(client, 'post', '/auth/forgot-password', { email: 'nobody@example.test' }).expect(202)
  assert.equal(known.body.data.message, unknown.body.data.message)

  const resetUrl = new URL(mailer.resetUrlFor(input.email))
  const token = resetUrl.searchParams.get('token')
  assert.ok(token)
  assert.equal(await database.prisma.passwordReset.count(), 1)

  const newPassword = 'A different memorable woodland path'
  await mutate(client, 'post', '/auth/reset-password', { token, newPassword }).expect(200)
  assert.equal(await database.prisma.passwordReset.count(), 0)
  assert.equal(await database.prisma.session.count(), 0)

  await mutate(client, 'post', '/auth/reset-password', { token, newPassword: 'Another valid password phrase' }).expect(410)

  const oldLogin = await browser()
  await mutate(oldLogin, 'post', '/auth/login', { email: input.email, password: input.password }).expect(401)
  const newLogin = await browser()
  await mutate(newLogin, 'post', '/auth/login', { email: input.email, password: newPassword }).expect(200)
})
