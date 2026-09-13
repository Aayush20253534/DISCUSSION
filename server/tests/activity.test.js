import { after, before, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { shiftCalendarDate, todayInTimezone } from '@atlasborn/shared'
import { createApp } from '../src/app.js'
import { parseEnv } from '../src/config/env.js'
import { completeQuest } from '../src/progression/complete.js'
import { testDatabase } from './helpers/database.js'
import { createTestMailer } from './helpers/email.js'
import { verifiedCompletionBody } from './helpers/verification.js'

const origin = 'http://localhost:5173'
const config = parseEnv({ NODE_ENV: 'test', JWT_SECRET: 'activity-test-secret-'.repeat(5) })
let database, app, now, mailer
before(async () => {
  database = await testDatabase()
})
after(async () => {
  await database?.close()
})
beforeEach(async () => {
  await database.prisma.user.deleteMany()
  now = new Date('2028-03-01T12:00:00Z')
  mailer = createTestMailer()
  app = createApp({ config, database, logger: () => {}, clock: () => now, mailer })
})
const mutate = (client, method, path, body) =>
  client.agent[method](`/api/v1${path}`)
    .set('Origin', origin)
    .set('X-CSRF-Token', client.csrf)
    .send(body)
async function actor(name = 'hero', timezone = 'UTC', onboard = true) {
  const agent = request.agent(app)
  const csrf = (await agent.get('/api/v1/auth/csrf').expect(200)).body.data.csrfToken
  const client = { agent, csrf, timezone }
  const started = await mutate(client, 'post', '/auth/signup', {
    email: `${name}@example.test`,
    displayName: name,
    password: 'An excellent adventure awaits',
  }).expect(201)
  client.user = started.body.data.user
  if (onboard)
    await mutate(client, 'put', '/me/onboarding', {
      displayName: name,
      avatarKey: 'wanderer',
      timezone,
    }).expect(200)
  return client
}
async function recorded(client, date, title = 'A small effort', instant) {
  const quest = await database.prisma.quest.create({
    data: {
      userId: client.user.id,
      requestId: randomUUID(),
      requestHash: 'a'.repeat(64),
      title,
      attribute: 'INTELLECT',
    },
  })
  const result = await completeQuest(database.prisma, {
    userId: client.user.id,
    questId: quest.id,
    revision: 1,
    timezone: client.timezone,
  })
  // Historical fixtures only: production completion never accepts a client date or timestamp.
  await database.prisma.questCompletion.update({
    where: { id: result.completion.id },
    data: {
      completedDate: new Date(`${date}T00:00:00Z`),
      completedAt: new Date(instant || `${date}T12:00:00Z`),
    },
  })
  return quest
}
const activity = async (client, query = {}) =>
  (await client.agent.get('/api/v1/activity').query(query).expect(200)).body.data
const history = (client, query) => client.agent.get('/api/v1/activity/day').query(query)

test('new accounts return zero streaks, full leap-month calendar, and no-store empty daily history', async () => {
  const client = await actor()
  const response = await client.agent.get('/api/v1/activity').expect(200)
  assert.match(response.headers['cache-control'], /no-store/)
  const data = response.body.data
  assert.equal(data.today, '2028-03-01')
  assert.equal(data.month, '2028-03')
  assert.equal(data.days.length, 31)
  assert.equal(data.week.length, 7)
  assert.deepEqual(data.streaks, {
    currentStreak: 0,
    longestStreak: 0,
    totalActiveDays: 0,
    firstActiveDate: null,
    lastActiveDate: null,
    todayCompletedCount: 0,
  })
  assert.ok(data.days.every((day) => day.count === 0 && day.xp === 0 && day.gold === 0))
  assert.equal((await activity(client, { month: '2028-02' })).days.length, 29)
  const empty = await history(client, { date: '2028-02-29', page: 20 }).expect(200)
  assert.match(empty.headers['cache-control'], /no-store/)
  assert.deepEqual(empty.body.data.completions, [])
  assert.deepEqual(empty.body.data.pagination, { total: 0, page: 1, pages: 1, limit: 8 })
})

test('multiple completions count once per day across leap day and month boundary, with correct totals', async () => {
  const client = await actor()
  for (const day of ['2028-02-28', '2028-02-29', '2028-03-01', '2028-03-01', '2028-03-01'])
    await recorded(client, day)
  const data = await activity(client)
  assert.deepEqual(data.streaks, {
    currentStreak: 3,
    longestStreak: 3,
    totalActiveDays: 3,
    firstActiveDate: '2028-02-28',
    lastActiveDate: '2028-03-01',
    todayCompletedCount: 3,
  })
  assert.deepEqual(data.totals, { activeDays: 1, completions: 3, xp: 75, gold: 15 })
  assert.deepEqual(data.days[0], { date: '2028-03-01', count: 3, xp: 75, gold: 15 })
  assert.equal(data.week.filter((day) => day.count).length, 3)
  const previous = await activity(client, { month: '2028-02' })
  assert.deepEqual(previous.streaks, data.streaks)
  assert.deepEqual(previous.totals, { activeDays: 2, completions: 2, xp: 50, gold: 10 })
  const day = (await history(client, { date: '2028-03-01' }).expect(200)).body.data
  assert.equal(day.completions.length, 3)
  for (const receipt of day.completions) {
    assert.equal(receipt.completedDate, '2028-03-01')
    for (const field of ['userId', 'sourceRevision', 'passwordHash', 'requestHash'])
      assert.equal(receipt[field], undefined)
  }
})

test('yesterday keeps a streak alive; missing a day resets current but keeps longest and rewards', async () => {
  const client = await actor()
  for (const day of [
    '2028-01-01',
    '2028-01-02',
    '2028-01-03',
    '2028-01-04',
    '2028-02-28',
    '2028-02-29',
  ])
    await recorded(client, day)
  const before = await database.prisma.character.findUnique({ where: { userId: client.user.id } })
  let data = await activity(client)
  assert.equal(data.streaks.currentStreak, 2)
  assert.equal(data.streaks.longestStreak, 4)
  assert.equal(data.streaks.todayCompletedCount, 0)
  now = new Date('2028-03-01T23:59:59.999Z')
  assert.equal((await activity(client)).streaks.currentStreak, 2)
  now = new Date('2028-03-02T00:00:00Z')
  data = await activity(client)
  assert.equal(data.streaks.currentStreak, 0)
  assert.equal(data.streaks.longestStreak, 4)
  assert.equal(data.streaks.totalActiveDays, 6)
  assert.deepEqual(
    await database.prisma.character.findUnique({ where: { userId: client.user.id } }),
    before,
  )
  await recorded(client, '2028-03-02')
  data = await activity(client)
  assert.equal(data.streaks.currentStreak, 1)
  assert.equal(data.streaks.longestStreak, 4)
})

test('server clock and account timezone determine today across date lines, DST and year boundaries', async () => {
  now = new Date('2028-03-01T00:30:00Z')
  const west = await actor('west', 'America/Los_Angeles')
  const east = await actor('east', 'Asia/Kathmandu')
  for (const day of ['2028-02-28', '2028-02-29']) await recorded(west, day)
  for (const day of ['2028-02-29', '2028-03-01']) await recorded(east, day)
  assert.equal((await activity(west)).today, '2028-02-29')
  assert.equal((await activity(west)).streaks.currentStreak, 2)
  assert.equal((await activity(east)).today, '2028-03-01')
  assert.equal((await activity(east)).streaks.currentStreak, 2)
  now = new Date('2028-03-13T06:59:59Z') // still March 12 after US daylight saving begins
  for (const day of ['2028-03-11', '2028-03-12']) await recorded(west, day)
  assert.equal((await activity(west)).today, '2028-03-12')
  assert.equal((await activity(west)).streaks.currentStreak, 2)
  now = new Date('2028-03-13T07:00:00Z')
  assert.equal((await activity(west)).today, '2028-03-13')
  assert.equal((await activity(west)).streaks.currentStreak, 2)
  now = new Date('2029-01-01T12:00:00Z')
  for (const day of ['2028-12-31', '2029-01-01']) await recorded(east, day)
  assert.equal((await activity(east)).streaks.currentStreak, 2)
})

test('historical dates retain their recorded timezone and dates ahead of today cannot grow a streak', async () => {
  const client = await actor('traveler', 'Pacific/Kiritimati')
  now = new Date('2028-03-01T11:00:00Z')
  await recorded(client, '2028-03-02', 'Across the date line', '2028-03-01T10:30:00Z')
  assert.equal((await activity(client)).streaks.currentStreak, 1)
  // Simulate an administrative timezone change. There is no user profile edit API yet.
  await database.prisma.user.update({
    where: { id: client.user.id },
    data: { timezone: 'Pacific/Honolulu' },
  })
  const data = await activity(client)
  assert.equal(data.today, '2028-03-01')
  assert.equal(data.streaks.currentStreak, 0)
  assert.equal(data.totals.completions, 0)
  await history(client, { date: '2028-03-02' }).expect(400)
  now = new Date('2028-03-02T10:00:00Z')
  const historyData = (await history(client, { date: '2028-03-02' }).expect(200)).body.data
  assert.equal(historyData.completions[0].timezone, 'Pacific/Kiritimati')
  assert.equal(historyData.completions[0].completedDate, '2028-03-02')
  assert.equal((await activity(client)).streaks.currentStreak, 1)
})

test('activity endpoints enforce authentication, onboarding, ownership and revoked sessions', async () => {
  const hero = await actor(),
    other = await actor('other'),
    newcomer = await actor('newcomer', 'UTC', false)
  await recorded(hero, '2028-03-01', 'Private accomplishment')
  for (const path of ['/api/v1/activity', '/api/v1/activity/day?date=2028-03-01']) {
    await request(app).get(path).expect(401)
    await newcomer.agent.get(path).expect(403)
    const safe = (await other.agent.get(path).expect(200)).body.data
    assert.ok(!JSON.stringify(safe).includes('Private accomplishment'))
  }
  assert.equal((await activity(other)).streaks.totalActiveDays, 0)
  await database.prisma.session.deleteMany({ where: { userId: hero.user.id } })
  await hero.agent.get('/api/v1/activity').expect(401)
  await history(hero, { date: '2028-03-01' }).expect(401)
})

test('calendar and day queries reject invalid, future, unbounded and client-controlled fields', async () => {
  const client = await actor()
  for (const query of [
    { month: '2028-13' },
    { month: '2028-2' },
    { month: '1899-12' },
    { month: ['2028-01', '2028-02'] },
    { month: '2028-04' },
    { userId: client.user.id },
    { timezone: 'UTC' },
    { today: '2028-01-01' },
  ])
    await client.agent
      .get('/api/v1/activity')
      .query(query)
      .expect(query.month === '2028-04' ? 400 : 422)
  for (const query of [
    {},
    { date: '2027-02-29' },
    { date: '2028-02-30' },
    { date: '2028-03-02' },
    { date: '2028-02-29T00:00:00Z' },
    { date: '2028-02-29', limit: 51 },
    { date: '2028-02-29', page: 10001 },
    { date: '2028-02-29', page: 0 },
    { date: '2028-02-29', userId: client.user.id },
  ])
    await history(client, query).expect(query.date === '2028-03-02' ? 400 : 422)
})

test('daily pagination is stable at tied timestamps; removing quests preserves history and deleting owner cascades it', async () => {
  const client = await actor()
  const quests = []
  for (let index = 0; index < 10; index++)
    quests.push(await recorded(client, '2028-03-01', `Step ${index}`))
  const first = (await history(client, { date: '2028-03-01', limit: 6 }).expect(200)).body.data
  const second = (await history(client, { date: '2028-03-01', limit: 6, page: 99 }).expect(200))
    .body.data
  assert.deepEqual(second.pagination, { page: 2, pages: 2, total: 10, limit: 6 })
  assert.equal(
    new Set([...first.completions, ...second.completions].map((receipt) => receipt.id)).size,
    10,
  )
  assert.deepEqual(
    (await history(client, { date: '2028-03-01', limit: 6 }).expect(200)).body.data,
    first,
  )
  await mutate(client, 'delete', `/quests/${quests[0].id}`, { revision: 2 }).expect(200)
  const removed = (await history(client, { date: '2028-03-01', limit: 50 }).expect(200)).body.data
  assert.equal(
    removed.completions.find((receipt) => receipt.originalQuestId === quests[0].id).questId,
    null,
  )
  assert.equal((await activity(client)).streaks.todayCompletedCount, 10)
  assert.equal((await activity(client)).streaks.currentStreak, 1)
  await database.prisma.user.delete({ where: { id: client.user.id } })
  assert.equal(await database.prisma.questCompletion.count(), 0)
})

test('live completion and concurrent retries refresh activity without duplicate days or additional rewards', async () => {
  const client = await actor('live', 'Asia/Kathmandu')
  now = new Date()
  const quest = (
    await mutate(client, 'post', '/quests', {
      requestId: randomUUID(),
      title: 'Show up today',
      attribute: 'VITALITY',
    }).expect(201)
  ).body.data.quest
  const completionBody = verifiedCompletionBody(config, client.user.id, quest, 1)
  const results = await Promise.all([
    mutate(client, 'post', `/quests/${quest.id}/complete`, completionBody),
    mutate(client, 'post', `/quests/${quest.id}/complete`, completionBody),
  ])
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 201])
  const data = await activity(client)
  assert.equal(data.today, todayInTimezone(client.timezone, now))
  assert.equal(data.streaks.todayCompletedCount, 1)
  assert.equal(data.streaks.currentStreak, 1)
  assert.equal(data.totals.xp, 25)
  const stored = await database.prisma.character.findUnique({ where: { userId: client.user.id } })
  assert.equal(stored.gold, 5)
  const previous = shiftCalendarDate(data.today, -1)
  assert.equal(
    (await history(client, { date: previous }).expect(200)).body.data.pagination.total,
    0,
  )
})
