import { before, after, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import request from 'supertest'
import argon2 from 'argon2'
import { createApp } from '../src/app.js'
import { parseEnv } from '../src/config/env.js'
import { testDatabase } from './helpers/database.js'

const prefix = '/api/v1'
const origin = 'http://localhost:5173'
const config = parseEnv({ NODE_ENV: 'test', JWT_SECRET: 'settings-test-secret-'.repeat(5) })
const account = {
  displayName: 'Aayush',
  email: 'settings@example.test',
  password: 'A long original adventure password',
}
const onboarding = { displayName: 'Aayush', avatarKey: 'wanderer', timezone: 'Asia/Kolkata' }
let database, app

before(async () => {
  database = await testDatabase()
})
after(async () => {
  await database?.close()
})
beforeEach(async () => {
  await database.prisma.user.deleteMany()
  app = createApp({ config, database, logger: () => {} })
})

async function browser() {
  const agent = request.agent(app)
  const response = await agent.get(`${prefix}/auth/csrf`).expect(200)
  return { agent, csrf: response.body.data.csrfToken }
}
function mutate(client, method, path, body = {}) {
  return client.agent[method](`${prefix}${path}`)
    .set('Origin', origin)
    .set('X-CSRF-Token', client.csrf)
    .send(body)
}
async function signup(input = account) {
  const client = await browser()
  const response = await mutate(client, 'post', '/auth/signup', input).expect(201)
  return { ...client, user: response.body.data.user }
}
async function onboarded() {
  const client = await signup()
  await mutate(client, 'put', '/me/onboarding', onboarding).expect(200)
  return client
}
async function login(password = account.password) {
  const client = await browser()
  await mutate(client, 'post', '/auth/login', { email: account.email, password }).expect(200)
  return client
}

test('profile settings update only the owned profile and do not rewrite daily quest schedule timezones', async () => {
  const client = await onboarded()
  const quest = await database.prisma.quest.create({
    data: {
      userId: client.user.id,
      requestId: randomUUID(),
      requestHash: 'a'.repeat(64),
      title: 'Daily coding practice',
      description: '',
      attribute: 'INTELLECT',
      difficulty: 'MEDIUM',
      recurrence: 'DAILY',
      status: 'ACTIVE',
      scheduleStartDate: new Date('2026-09-13T00:00:00.000Z'),
      scheduleTimezone: 'Asia/Kolkata',
    },
  })
  const response = await mutate(client, 'put', '/me/profile', {
    displayName: 'Aayush the Builder',
    timezone: 'Asia/Kathmandu',
  }).expect(200)
  assert.equal(response.body.data.user.displayName, 'Aayush the Builder')
  assert.equal(response.body.data.user.timezone, 'Asia/Kathmandu')
  const stored = await database.prisma.quest.findUnique({ where: { id: quest.id } })
  assert.equal(stored.scheduleTimezone, 'Asia/Kolkata')

  await mutate(client, 'put', '/me/profile', {
    displayName: 'x',
    timezone: 'Moon/Base',
  }).expect(422)
  const afterInvalid = await database.prisma.user.findUnique({ where: { id: client.user.id } })
  assert.equal(afterInvalid.displayName, 'Aayush the Builder')
  assert.equal(afterInvalid.timezone, 'Asia/Kathmandu')
  await request(app).put(`${prefix}/me/profile`).send({ displayName: 'Nope', timezone: 'UTC' }).expect(403)
})

test('changing password verifies the old secret, keeps the current session and revokes every other session', async () => {
  const first = await onboarded()
  const second = await login()
  assert.equal(await database.prisma.session.count(), 2)

  const wrong = await mutate(first, 'put', '/me/password', {
    currentPassword: 'This is not the current password',
    newPassword: 'A completely new woodland password',
  }).expect(400)
  assert.equal(wrong.body.error.code, 'PASSWORD_INCORRECT')
  assert.equal(await database.prisma.session.count(), 2)

  const changed = await mutate(first, 'put', '/me/password', {
    currentPassword: account.password,
    newPassword: 'A completely new woodland password',
  }).expect(200)
  assert.equal(changed.body.data.changed, true)
  assert.equal(changed.body.data.revokedSessions, 1)
  assert.equal(await database.prisma.session.count(), 1)
  const stored = await database.prisma.user.findUnique({ where: { id: first.user.id } })
  assert.equal(await argon2.verify(stored.passwordHash, 'A completely new woodland password'), true)

  await first.agent.get(`${prefix}/auth/me`).expect(200)
  await second.agent.get(`${prefix}/auth/me`).expect(401)
  const oldLogin = await browser()
  await mutate(oldLogin, 'post', '/auth/login', {
    email: account.email,
    password: account.password,
  }).expect(401)
  const newLogin = await browser()
  await mutate(newLogin, 'post', '/auth/login', {
    email: account.email,
    password: 'A completely new woodland password',
  }).expect(200)
})

test('session management lists only safe owned sessions and can revoke other or current sessions', async () => {
  const first = await onboarded()
  const second = await login()
  const outsider = await signup({
    displayName: 'Other',
    email: 'other-session@example.test',
    password: 'Another memorable adventure password',
  })

  const listed = await first.agent.get(`${prefix}/me/sessions`).expect(200)
  assert.equal(listed.body.data.sessions.length, 2)
  assert.equal(listed.body.data.sessions.filter((session) => session.current).length, 1)
  assert.equal(JSON.stringify(listed.body).includes('tokenHash'), false)
  assert.equal(JSON.stringify(listed.body).includes('userAgent'), false)
  assert.ok(listed.body.data.sessions.every((session) => session.device && session.expiresAt))

  const outsiderSession = await database.prisma.session.findFirst({ where: { userId: outsider.user.id } })
  await mutate(first, 'delete', '/me/sessions/not-a-uuid').expect(404)
  await mutate(first, 'delete', `/me/sessions/${outsiderSession.id}`).expect(404)
  const other = listed.body.data.sessions.find((session) => !session.current)
  await mutate(first, 'delete', `/me/sessions/${other.id}`).expect(200)
  await second.agent.get(`${prefix}/auth/me`).expect(401)
  assert.equal((await first.agent.get(`${prefix}/me/sessions`).expect(200)).body.data.sessions.length, 1)

  const current = (await first.agent.get(`${prefix}/me/sessions`).expect(200)).body.data.sessions[0]
  const revoked = await mutate(first, 'delete', `/me/sessions/${current.id}`).expect(200)
  assert.equal(revoked.body.data.currentRevoked, true)
  await first.agent.get(`${prefix}/auth/me`).expect(200, { data: { user: null } })
})

test('revoke-others preserves the current session and settings endpoints require csrf plus authentication', async () => {
  const first = await onboarded()
  await login()
  await login()
  const result = await mutate(first, 'post', '/me/sessions/revoke-others').expect(200)
  assert.equal(result.body.data.revokedSessions, 2)
  assert.equal(await database.prisma.session.count(), 1)
  await first.agent.get(`${prefix}/auth/me`).expect(200)

  await first.agent.put(`${prefix}/me/profile`).send({ displayName: 'Unsafe', timezone: 'UTC' }).expect(403)
  await request(app).get(`${prefix}/me/sessions`).expect(401)
  await request(app)
    .put(`${prefix}/me/password`)
    .set('Origin', origin)
    .send({ currentPassword: account.password, newPassword: 'Another long password value' })
    .expect(403)
})
