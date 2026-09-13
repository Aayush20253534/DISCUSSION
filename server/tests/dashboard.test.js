import { after, before, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { parseEnv } from '../src/config/env.js'
import { testDatabase } from './helpers/database.js'
import { createTestMailer } from './helpers/email.js'
import { verifiedCompletionBody } from './helpers/verification.js'

const origin = 'http://localhost:5173'
const config = parseEnv({ NODE_ENV: 'test', JWT_SECRET: 'dashboard-test-secret-'.repeat(5) })
let database, app, now, mailer

before(async () => {
  database = await testDatabase()
})
after(async () => {
  await database?.close()
})
beforeEach(async () => {
  await database.prisma.user.deleteMany()
  now = new Date('2028-03-01T12:00:00.000Z')
  mailer = createTestMailer()
  app = createApp({ config, database, logger: () => {}, clock: () => now, mailer })
})

const mutate = (client, method, path, body = {}) =>
  client.agent[method](`/api/v1${path}`)
    .set('Origin', origin)
    .set('X-CSRF-Token', client.csrf)
    .send(body)

async function actor(name = 'hero', timezone = 'UTC', onboard = true) {
  const agent = request.agent(app)
  const csrf = (await agent.get('/api/v1/auth/csrf').expect(200)).body.data.csrfToken
  const client = { agent, csrf }
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

async function createQuest(client, title, fields = {}) {
  return (
    await mutate(client, 'post', '/quests', {
      requestId: randomUUID(),
      title,
      attribute: 'INTELLECT',
      difficulty: 'EASY',
      ...fields,
    }).expect(201)
  ).body.data.quest
}

async function complete(client, quest) {
  return (
    await mutate(
      client,
      'post',
      `/quests/${quest.id}/complete`,
      verifiedCompletionBody(config, client.user.id, quest),
    ).expect(201)
  ).body.data
}

const dashboard = async (client) =>
  (await client.agent.get('/api/v1/dashboard').expect(200)).body.data

test('new characters receive a single coherent empty dashboard and first-use guidance', async () => {
  const client = await actor()
  const response = await client.agent.get('/api/v1/dashboard').expect(200)
  assert.match(response.headers['cache-control'], /no-store/)
  const data = response.body.data

  assert.equal(data.today, '2028-03-01')
  assert.equal(data.timezone, 'UTC')
  assert.equal(data.character.totalXp, 0)
  assert.equal(data.character.gold, 0)
  assert.equal(data.character.progression.level, 1)
  assert.equal(data.completedCount, 0)
  assert.deepEqual(data.quests, {
    active: 0,
    archived: 0,
    dueToday: 0,
    overdue: 0,
    daily: 0,
    dailyReady: 0,
  })
  assert.deepEqual(data.todayQuests, [])
  assert.deepEqual(data.recentCompletions, [])
  assert.deepEqual(data.weeklyTotals, { activeDays: 0, completions: 0, xp: 0, gold: 0 })
  assert.equal(data.week.length, 7)
  assert.ok(data.week.every((day) => day.count === 0 && day.xp === 0 && day.gold === 0))
  assert.deepEqual(data.firstUse, { active: true, step: 'CREATE_QUEST' })
  assert.equal(data.streaks.currentStreak, 0)
  assert.equal(data.streaks.longestStreak, 0)
  assert.equal(data.streaks.todayCompletedCount, 0)
})

test('dashboard aggregates agree with quest, activity, progression and wallet sources', async () => {
  const client = await actor('consistent')
  await createQuest(client, 'Overdue planning', { dueDate: '2028-02-29', attribute: 'DISCIPLINE' })
  await createQuest(client, 'Today focus', { dueDate: '2028-03-01', attribute: 'INTELLECT' })
  await createQuest(client, 'Daily walk', { recurrence: 'DAILY', attribute: 'VITALITY' })
  const yesterdayQuest = await createQuest(client, 'Yesterday effort', {
    difficulty: 'HARD',
    attribute: 'STRENGTH',
  })
  const todayQuest = await createQuest(client, 'Today effort', {
    difficulty: 'EASY',
    attribute: 'CREATIVITY',
  })

  const yesterday = await complete(client, yesterdayQuest)
  await complete(client, todayQuest)
  await database.prisma.questCompletion.update({
    where: { id: yesterday.completion.id },
    data: {
      completedDate: new Date('2028-02-29T00:00:00.000Z'),
      completedAt: new Date('2028-02-29T18:00:00.000Z'),
    },
  })

  const [data, progress, activity, wallet] = await Promise.all([
    dashboard(client),
    client.agent.get('/api/v1/progress').expect(200).then((response) => response.body.data),
    client.agent.get('/api/v1/activity').expect(200).then((response) => response.body.data),
    client.agent.get('/api/v1/wallet').expect(200).then((response) => response.body.data),
  ])

  assert.equal(data.character.totalXp, progress.character.totalXp)
  assert.equal(data.character.gold, progress.character.gold)
  assert.equal(data.character.gold, wallet.balance)
  assert.equal(data.completedCount, progress.completedCount)
  assert.equal(data.completedCount, 2)
  assert.equal(data.character.totalXp, 145)
  assert.equal(data.character.gold, 29)

  assert.equal(data.quests.active, 3)
  assert.equal(data.quests.dueToday, 1)
  assert.equal(data.quests.overdue, 1)
  assert.equal(data.quests.daily, 1)
  assert.equal(data.quests.dailyReady, 1)
  assert.deepEqual(
    data.todayQuests.slice(0, 3).map((quest) => quest.title),
    ['Overdue planning', 'Today focus', 'Daily walk'],
  )
  assert.ok(data.todayQuests.every((quest) => quest.status === 'ACTIVE' && quest.eligibleToday))

  assert.equal(data.streaks.currentStreak, activity.streaks.currentStreak)
  assert.equal(data.streaks.longestStreak, activity.streaks.longestStreak)
  assert.equal(data.streaks.todayCompletedCount, activity.streaks.todayCompletedCount)
  assert.equal(data.streaks.currentStreak, 2)
  assert.equal(data.weeklyTotals.completions, 2)
  assert.equal(data.weeklyTotals.xp, 145)
  assert.equal(data.weeklyTotals.gold, 29)
  assert.deepEqual(data.week, activity.week)

  assert.equal(data.recentCompletions.length, 2)
  assert.equal(data.recentCompletions[0].title, 'Today effort')
  assert.equal(data.recentCompletions[1].title, 'Yesterday effort')
  assert.equal(data.recentCompletions[0].goldAwarded, 5)
  assert.equal(data.recentCompletions[1].goldAwarded, 24)
  assert.deepEqual(data.firstUse, { active: false, step: 'COMPLETE_QUEST' })
})

test('first-use guidance advances after saving a quest without manufacturing progression', async () => {
  const client = await actor('starter')
  await createQuest(client, 'Read ten pages', { attribute: 'INTELLECT' })
  const data = await dashboard(client)

  assert.deepEqual(data.firstUse, { active: true, step: 'COMPLETE_QUEST' })
  assert.equal(data.completedCount, 0)
  assert.equal(data.character.totalXp, 0)
  assert.equal(data.character.gold, 0)
  assert.equal(data.todayQuests.length, 1)
  assert.equal(data.todayQuests[0].title, 'Read ten pages')
  assert.equal(await database.prisma.questCompletion.count(), 0)
  assert.equal(await database.prisma.currencyTransaction.count(), 0)
})

test('dashboard is account-scoped, requires onboarding, and preserves deleted completion history', async () => {
  const owner = await actor('owner')
  const stranger = await actor('stranger')
  const unfinished = await actor('unfinished', 'UTC', false)
  const quest = await createQuest(owner, 'Private victory', { difficulty: 'MEDIUM' })
  await complete(owner, quest)
  const current = await database.prisma.quest.findUnique({ where: { id: quest.id } })
  await mutate(owner, 'delete', `/quests/${quest.id}`, { revision: current.revision }).expect(200)

  const ownerData = await dashboard(owner)
  const strangerData = await dashboard(stranger)
  assert.equal(ownerData.completedCount, 1)
  assert.equal(ownerData.recentCompletions[0].title, 'Private victory')
  assert.equal(ownerData.recentCompletions[0].questId, null)
  assert.equal(strangerData.completedCount, 0)
  assert.deepEqual(strangerData.recentCompletions, [])

  await unfinished.agent.get('/api/v1/dashboard').expect(403)
  await request(app).get('/api/v1/dashboard').expect(401)
})
