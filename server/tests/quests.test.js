import { after, before, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { todayInTimezone } from '@life-rpg/shared'
import { createApp } from '../src/app.js'
import { parseEnv } from '../src/config/env.js'
import { testDatabase } from './helpers/database.js'

const origin = 'http://localhost:5173'
const config = parseEnv({ NODE_ENV: 'test', JWT_SECRET: 'quest-test-only-secret-'.repeat(4) })
const baseQuest = {
  title: 'Read a chapter',
  description: 'Find a quiet corner.',
  attribute: 'INTELLECT',
  difficulty: 'EASY',
  estimatedMinutes: 20,
  dueDate: null,
}
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
async function actor(name = 'hero', onboard = true) {
  const agent = request.agent(app)
  const csrf = (await agent.get('/api/v1/auth/csrf').expect(200)).body.data.csrfToken
  const client = { agent, csrf }
  const response = await change(client, 'post', '/auth/signup', {
    email: `${name}@example.test`,
    displayName: name,
    password: 'A long enough quest passphrase',
  }).expect(201)
  client.user = response.body.data.user
  if (onboard)
    await change(client, 'put', '/me/onboarding', {
      displayName: name,
      timezone: 'Asia/Kathmandu',
      avatarKey: 'wanderer',
    }).expect(200)
  return client
}
function change(client, method, path, body) {
  return client.agent[method](`/api/v1${path}`)
    .set('Origin', origin)
    .set('X-CSRF-Token', client.csrf)
    .send(body)
}
async function create(client, overrides = {}) {
  const response = await change(client, 'post', '/quests', {
    ...baseQuest,
    requestId: randomUUID(),
    ...overrides,
  }).expect(201)
  return response.body.data.quest
}
const list = (client, query = {}) => client.agent.get('/api/v1/quests').query(query)

test('creates a saved quest and retrieves it without ownership or idempotency internals', async () => {
  const client = await actor()
  const quest = await create(client, { title: '  Read a chapter  ', dueDate: '2028-02-29' })
  assert.equal(quest.title, 'Read a chapter')
  assert.equal(quest.status, 'ACTIVE')
  assert.equal(quest.revision, 1)
  assert.equal(quest.dueDate, '2028-02-29')
  for (const field of ['userId', 'requestHash', 'requestId', 'passwordHash'])
    assert.equal(quest[field], undefined)
  assert.equal(
    (await client.agent.get(`/api/v1/quests/${quest.id}`).expect(200)).body.data.quest.id,
    quest.id,
  )
  const response = await list(client).expect(200)
  assert.equal(response.body.data.pagination.limit, 12)
  assert.equal(response.body.data.pagination.total, 1)
  assert.match(response.headers['cache-control'], /no-store/)
  const row = await database.prisma.quest.findUnique({ where: { id: quest.id } })
  assert.equal(row.userId, client.user.id)
  assert.equal(row.dueDate.toISOString(), '2028-02-29T00:00:00.000Z')
})

test('retrying a creation request is idempotent, including concurrent retries', async () => {
  const client = await actor()
  const input = { ...baseQuest, requestId: randomUUID() }
  const responses = await Promise.all([0, 1].map(() => change(client, 'post', '/quests', input)))
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 201])
  assert.equal(responses[0].body.data.quest.id, responses[1].body.data.quest.id)
  const replay = await change(client, 'post', '/quests', input).expect(200)
  assert.equal(replay.body.data.quest.requestHash, undefined)
  await change(client, 'post', '/quests', { ...input, title: 'A different intention' }).expect(409)
  assert.equal(await database.prisma.quest.count(), 1)
})

test('edits fields and optional values, archives and restores, then permanently deletes', async () => {
  const client = await actor()
  const quest = await create(client)
  const edited = (
    await change(client, 'patch', `/quests/${quest.id}`, {
      revision: 1,
      title: 'Sketch a tree',
      description: '',
      attribute: 'CREATIVITY',
      difficulty: 'HARD',
      estimatedMinutes: null,
      dueDate: '2030-12-31',
    }).expect(200)
  ).body.data.quest
  assert.equal(edited.revision, 2)
  assert.equal(edited.estimatedMinutes, null)
  assert.equal(edited.description, '')
  const archived = (
    await change(client, 'patch', `/quests/${quest.id}`, {
      revision: 2,
      status: 'ARCHIVED',
      dueDate: null,
    }).expect(200)
  ).body.data.quest
  assert.equal(archived.dueDate, null)
  assert.equal((await list(client).expect(200)).body.data.pagination.total, 0)
  assert.equal(
    (await list(client, { status: 'ARCHIVED' }).expect(200)).body.data.quests[0].id,
    quest.id,
  )
  const restored = (
    await change(client, 'patch', `/quests/${quest.id}`, { revision: 3, status: 'ACTIVE' }).expect(
      200,
    )
  ).body.data.quest
  assert.equal(restored.title, 'Sketch a tree')
  await change(client, 'delete', `/quests/${quest.id}`, { revision: 4 }).expect(200)
  await client.agent.get(`/api/v1/quests/${quest.id}`).expect(404)
  assert.equal(await database.prisma.quest.count(), 0)
})

test('two editors cannot silently overwrite each other or delete a newer revision', async () => {
  const client = await actor()
  const quest = await create(client)
  const responses = await Promise.all(
    ['Read chapter two', 'Read chapter three'].map((title) =>
      change(client, 'patch', `/quests/${quest.id}`, { title, revision: 1 }),
    ),
  )
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409])
  const winner = responses.find((r) => r.status === 200).body.data.quest
  const conflict = await change(client, 'delete', `/quests/${quest.id}`, { revision: 1 }).expect(
    409,
  )
  assert.equal(conflict.body.error.code, 'QUEST_CHANGED')
  const stored = await database.prisma.quest.findUnique({ where: { id: quest.id } })
  assert.equal(stored.title, winner.title)
  assert.equal(stored.revision, 2)
})

test('all quest paths enforce session, onboarding, CSRF and ownership', async () => {
  const one = await actor('owner')
  const two = await actor('other')
  const unfinished = await actor('unfinished', false)
  const quest = await create(one)
  for (const path of ['/quests', '/quests/summary', `/quests/${quest.id}`]) {
    await request(app).get(`/api/v1${path}`).expect(401)
    await unfinished.agent.get(`/api/v1${path}`).expect(403)
  }
  await request(app)
    .post('/api/v1/quests')
    .send({ ...baseQuest, requestId: randomUUID() })
    .expect(401)
  assert.equal((await list(two).expect(200)).body.data.pagination.total, 0)
  assert.equal((await two.agent.get('/api/v1/quests/summary').expect(200)).body.data.active, 0)
  await two.agent.get(`/api/v1/quests/${quest.id}`).expect(404)
  await change(two, 'patch', `/quests/${quest.id}`, { title: 'Stolen', revision: 1 }).expect(404)
  await change(two, 'delete', `/quests/${quest.id}`, { revision: 1 }).expect(404)
  for (const method of ['patch', 'delete'])
    await one.agent[method](`/api/v1/quests/${quest.id}`)
      .set('Origin', origin)
      .send({ revision: 1, ...(method === 'patch' && { title: 'Unsafe update' }) })
      .expect(403)
  await change(two, 'post', '/quests', {
    ...baseQuest,
    requestId: randomUUID(),
    userId: one.user.id,
  }).expect(422)
  await change(one, 'post', '/auth/logout-all', {}).expect(200)
  await list(one).expect(401)
  assert.equal(
    (await database.prisma.quest.findUnique({ where: { id: quest.id } })).title,
    baseQuest.title,
  )
})

test('validation rejects invalid dates, unsupported fields, fake rewards and malformed filters', async () => {
  const client = await actor()
  for (const overrides of [
    { title: '   ' },
    { title: 'a'.repeat(121) },
    { description: 'x'.repeat(2001) },
    { attribute: 'ADMIN' },
    { dueDate: '2027-02-29' },
    { dueDate: '2028-02-30' },
    { dueDate: '2028-02-29T00:00:00Z' },
    { dueDate: '2101-01-01' },
    { estimatedMinutes: 0 },
    { estimatedMinutes: 1441 },
    { estimatedMinutes: 2.5 },
    { estimatedMinutes: '15' },
    { status: 'COMPLETED' },
    { xp: 1000 },
    { gold: 1000 },
    { requestId: 'unsafe' },
  ])
    await change(client, 'post', '/quests', {
      ...baseQuest,
      requestId: randomUUID(),
      ...overrides,
    }).expect(422)
  const quest = await create(client)
  for (const body of [
    { title: 'No revision' },
    { revision: 1 },
    { revision: 0, title: 'Bad revision' },
    { revision: 1, totalXp: 100 },
    { revision: 1, status: 'COMPLETED' },
  ])
    await change(client, 'patch', `/quests/${quest.id}`, body).expect(422)
  for (const query of [
    { limit: '0' },
    { limit: '51' },
    { page: '-1' },
    { page: '1.5' },
    { limit: '1e2' },
    { due: 'YESTERDAY' },
    { status: 'INVALID_STATUS' },
    { userId: client.user.id },
    { q: ['a', 'b'] },
  ])
    await list(client, query).expect(422)
  await client.agent.get('/api/v1/quests/not-a-uuid').expect(422)
  assert.equal(await database.prisma.quest.count(), 1)
})

test('search is case insensitive and treats SQL wildcards as literal text; filters combine', async () => {
  const client = await actor()
  const a = await create(client, {
    title: 'Save 100% of notes',
    description: 'A_1 notes',
    difficulty: 'HARD',
  })
  await create(client, {
    title: 'Save 1000 notes',
    attribute: 'CREATIVITY',
    description: 'Ab1 notes',
  })
  await create(client, { title: 'Walk through the woods', attribute: 'VITALITY' })
  for (const q of ['100%', 'a_1', 'SAVE 100%']) {
    const result = (await list(client, { q }).expect(200)).body.data
    assert.equal(result.pagination.total, 1)
    assert.equal(result.quests[0].id, a.id)
  }
  assert.equal((await list(client, { q: "' OR 1=1 --" }).expect(200)).body.data.pagination.total, 0)
  assert.equal(
    (await list(client, { q: 'notes', attribute: 'INTELLECT', difficulty: 'HARD' }).expect(200))
      .body.data.pagination.total,
    1,
  )
  assert.equal(
    (await list(client, { attribute: 'STRENGTH' }).expect(200)).body.data.pagination.total,
    0,
  )
})

test('date filters and summaries use the account timezone and count active quests accurately', async () => {
  const client = await actor()
  const today = todayInTimezone('Asia/Kathmandu')
  const yesterday = new Date(`${today}T00:00:00Z`)
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  const tomorrow = new Date(`${today}T00:00:00Z`)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  const todays = await create(client, { dueDate: today })
  await create(client, {
    title: 'Yesterday intention',
    dueDate: yesterday.toISOString().slice(0, 10),
  })
  await create(client, {
    title: 'Tomorrow intention',
    dueDate: tomorrow.toISOString().slice(0, 10),
    attribute: 'VITALITY',
  })
  await create(client, { title: 'At any time', dueDate: null })
  const archived = await create(client, { dueDate: today })
  await change(client, 'patch', `/quests/${archived.id}`, {
    revision: 1,
    status: 'ARCHIVED',
  }).expect(200)
  const summary = (await client.agent.get('/api/v1/quests/summary').expect(200)).body.data
  assert.equal(summary.today, today)
  assert.equal(summary.timezone, 'Asia/Kathmandu')
  assert.deepEqual(
    [summary.active, summary.archived, summary.dueToday, summary.overdue],
    [4, 1, 1, 1],
  )
  assert.equal(summary.byAttribute.INTELLECT, 3)
  for (const due of ['TODAY', 'OVERDUE', 'UPCOMING', 'UNSCHEDULED'])
    assert.equal((await list(client, { due }).expect(200)).body.data.pagination.total, 1)
  assert.equal((await list(client, { due: 'TODAY' }).expect(200)).body.data.quests[0].id, todays.id)
  const ordered = (await list(client, { sort: 'DUE' }).expect(200)).body.data.quests
  assert.equal(ordered.at(-1).dueDate, null)
  assert.equal(ordered[0].title, 'Yesterday intention')
})

test('pagination is stable and out-of-range pages clamp after deletion', async () => {
  const client = await actor()
  for (const title of ['Alpha quest', 'Bravo quest', 'Charlie quest', 'Delta quest', 'Echo quest'])
    await create(client, { title })
  const one = (await list(client, { sort: 'TITLE', limit: 2 }).expect(200)).body.data
  const two = (await list(client, { sort: 'TITLE', limit: 2, page: 2 }).expect(200)).body.data
  const last = (await list(client, { sort: 'TITLE', limit: 2, page: 9999 }).expect(200)).body.data
  assert.deepEqual(
    one.quests.map((q) => q.title),
    ['Alpha quest', 'Bravo quest'],
  )
  assert.deepEqual(
    two.quests.map((q) => q.title),
    ['Charlie quest', 'Delta quest'],
  )
  assert.deepEqual(last.pagination, { page: 3, pages: 3, limit: 2, total: 5 })
  await change(client, 'delete', `/quests/${last.quests[0].id}`, { revision: 1 }).expect(200)
  const clamped = (await list(client, { sort: 'TITLE', limit: 2, page: 3 }).expect(200)).body.data
  assert.equal(clamped.pagination.page, 2)
  assert.equal(clamped.quests.length, 2)
})

test('planning operations preserve XP, gold and attributes, and deleting the owner cascades quests', async () => {
  const client = await actor()
  const before = await database.prisma.character.findUnique({
    where: { userId: client.user.id },
    include: { attributes: true },
  })
  const quest = await create(client, { difficulty: 'HARD' })
  await change(client, 'patch', `/quests/${quest.id}`, { revision: 1, status: 'ARCHIVED' }).expect(
    200,
  )
  const after = await database.prisma.character.findUnique({
    where: { userId: client.user.id },
    include: { attributes: true },
  })
  assert.deepEqual(after, before)
  await database.prisma.user.delete({ where: { id: client.user.id } })
  assert.equal(await database.prisma.quest.count(), 0)
})
