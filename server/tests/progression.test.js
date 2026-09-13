import { after, before, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { MAX_STORED_POINTS, todayInTimezone } from '@life-rpg/shared'
import { createApp } from '../src/app.js'
import { parseEnv } from '../src/config/env.js'
import { testDatabase } from './helpers/database.js'
import { completeEmailVerification, createTestMailer } from './helpers/email.js'

const origin = 'http://localhost:5173'
const config = parseEnv({ NODE_ENV: 'test', JWT_SECRET: 'progression-test-secret-'.repeat(4) })
let database, app, mailer
before(async () => {
  database = await testDatabase()
})
after(async () => {
  await database?.close()
})
beforeEach(async () => {
  await database.prisma.emailVerification.deleteMany()
  await database.prisma.user.deleteMany()
  mailer = createTestMailer()
  app = createApp({ config, database, logger: () => {}, mailer })
})
const mutate = (client, method, path, body) =>
  client.agent[method](`/api/v1${path}`)
    .set('Origin', origin)
    .set('X-CSRF-Token', client.csrf)
    .send(body)
async function actor(name = 'hero', onboard = true) {
  const agent = request.agent(app)
  const csrf = (await agent.get('/api/v1/auth/csrf').expect(200)).body.data.csrfToken
  const client = { agent, csrf }
  const started = await mutate(client, 'post', '/auth/signup', {
    email: `${name}@example.test`,
    displayName: name,
    password: 'An excellent adventure awaits',
  }).expect(202)
  client.user = (await completeEmailVerification(client, mutate, started, mailer)).body.data.user
  if (onboard)
    await mutate(client, 'put', '/me/onboarding', {
      displayName: name,
      avatarKey: 'wanderer',
      timezone: 'Asia/Kathmandu',
    }).expect(200)
  return client
}
async function quest(client, overrides = {}) {
  return (
    await mutate(client, 'post', '/quests', {
      requestId: randomUUID(),
      title: 'Read a chapter',
      attribute: 'INTELLECT',
      ...overrides,
    }).expect(201)
  ).body.data.quest
}
const complete = (client, item, body = { revision: item.revision }) =>
  mutate(client, 'post', `/quests/${item.id}/complete`, body)
const progress = async (client) =>
  (await client.agent.get('/api/v1/progress').expect(200)).body.data
const history = (client, query = {}) => client.agent.get('/api/v1/progress/history').query(query)

test('completion persists server-calculated rewards, the selected attribute and a public receipt', async () => {
  const client = await actor()
  for (const [difficulty, xp, gold] of [
    ['EASY', 25, 5],
    ['MEDIUM', 60, 12],
    ['HARD', 120, 24],
  ]) {
    const item = await quest(client, {
      difficulty,
      dueDate: '2028-02-29',
      description: 'Keep this note.',
      estimatedMinutes: 1,
    })
    const response = await complete(client, item).expect(201)
    const data = response.body.data
    assert.match(response.headers['cache-control'], /no-store/)
    assert.equal(data.newlyCompleted, true)
    assert.equal(data.quest.status, 'COMPLETED')
    assert.equal(data.quest.revision, 2)
    assert.deepEqual(
      [data.completion.xpAwarded, data.completion.goldAwarded, data.completion.attributeXpAwarded],
      [xp, gold, xp],
    )
    assert.equal(
      data.completion.completedDate,
      todayInTimezone('Asia/Kathmandu', new Date(data.completion.completedAt)),
    )
    assert.equal(data.completion.dueDate, '2028-02-29')
    assert.equal(data.completion.rulesVersion, 1)
    assert.equal(data.completion.description, 'Keep this note.')
    for (const key of ['userId', 'sourceRevision', 'passwordHash', 'requestHash'])
      assert.equal(data.completion[key], undefined)
  }
  const data = await progress(client)
  assert.deepEqual([data.character.totalXp, data.character.gold, data.completedCount], [205, 41, 3])
  assert.equal(data.character.progression.level, 2)
  assert.equal(data.character.attributes.find((a) => a.key === 'INTELLECT').progression.level, 3)
  assert.ok(data.character.attributes.filter((a) => a.key !== 'INTELLECT').every((a) => a.xp === 0))
  assert.equal(
    (await client.agent.get('/api/v1/auth/me').expect(200)).body.data.user.character.totalXp,
    205,
  )
})

test('double clicks, concurrent requests, and replay award a quest exactly once', async () => {
  const client = await actor(),
    item = await quest(client, { difficulty: 'HARD' })
  const responses = await Promise.all([
    complete(client, item),
    complete(client, item),
    complete(client, item),
  ])
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 200, 201])
  assert.equal(new Set(responses.map((r) => r.body.data.completion.id)).size, 1)
  const retry = (await complete(client, item).expect(200)).body.data
  assert.equal(retry.newlyCompleted, false)
  assert.equal(retry.character.totalXp, 120)
  assert.equal(await database.prisma.questCompletion.count(), 1)
  assert.equal((await progress(client)).character.gold, 24)
})

test('different quests completed concurrently retain every increment and serialize receipt totals', async () => {
  const client = await actor()
  const one = await quest(client, { difficulty: 'HARD' })
  const two = await quest(client, { difficulty: 'HARD', attribute: 'STRENGTH' })
  const result = await Promise.all([complete(client, one), complete(client, two)])
  assert.ok(result.every((r) => r.status === 201))
  assert.deepEqual(
    result.map((r) => r.body.data.completion.totalXpAfter).sort((a, b) => a - b),
    [120, 240],
  )
  const data = await progress(client)
  assert.deepEqual([data.character.totalXp, data.character.gold, data.completedCount], [240, 48, 2])
  assert.equal(data.character.attributes.filter((a) => a.xp === 120).length, 2)
})

test('exact level thresholds and existing progress are preserved when earning new rewards', async () => {
  const client = await actor()
  await database.prisma.character.update({
    where: { userId: client.user.id },
    data: { totalXp: 75, gold: 9 },
  })
  const one = (await complete(client, await quest(client)).expect(201)).body.data
  assert.deepEqual(
    [
      one.completion.levelBefore,
      one.completion.levelAfter,
      one.character.totalXp,
      one.character.gold,
    ],
    [1, 2, 100, 14],
  )
  assert.equal(one.character.progression.xpIntoLevel, 0)
  assert.equal(one.character.progression.xpForNextLevel, 200)
  const two = (await complete(client, await quest(client, { difficulty: 'HARD' })).expect(201)).body
    .data
  assert.deepEqual([two.completion.levelBefore, two.completion.levelAfter], [2, 2])
  assert.equal(two.character.progression.xpRemaining, 80)
})

test('stale, archived and completed quests cannot change the reward after confirmation', async () => {
  const client = await actor(),
    item = await quest(client)
  await mutate(client, 'patch', `/quests/${item.id}`, { revision: 1, difficulty: 'HARD' }).expect(
    200,
  )
  assert.equal((await complete(client, item).expect(409)).body.error.code, 'QUEST_CHANGED')
  await mutate(client, 'patch', `/quests/${item.id}`, { revision: 2, status: 'ARCHIVED' }).expect(
    200,
  )
  assert.equal(
    (await complete(client, item, { revision: 3 }).expect(409)).body.error.code,
    'QUEST_ARCHIVED',
  )
  assert.equal((await progress(client)).character.totalXp, 0)
  await mutate(client, 'patch', `/quests/${item.id}`, { revision: 3, status: 'ACTIVE' }).expect(200)
  const done = (await complete(client, item, { revision: 4 }).expect(201)).body.data
  assert.equal(done.completion.xpAwarded, 120)
  for (const changes of [
    { title: 'Changed history' },
    { status: 'ACTIVE' },
    { status: 'ARCHIVED' },
    { difficulty: 'EASY' },
  ]) {
    const result = await mutate(client, 'patch', `/quests/${item.id}`, {
      revision: 5,
      ...changes,
    }).expect(409)
    assert.equal(result.body.error.code, 'QUEST_COMPLETED')
  }
  assert.equal((await history(client).expect(200)).body.data.completions[0].title, 'Read a chapter')
})

test('deleting a completed journal entry preserves history, rewards and retry protection', async () => {
  const client = await actor(),
    item = await quest(client, { difficulty: 'HARD' })
  const done = (await complete(client, item).expect(201)).body.data
  await mutate(client, 'delete', `/quests/${item.id}`, { revision: 1 }).expect(409)
  await mutate(client, 'delete', `/quests/${item.id}`, { revision: done.quest.revision }).expect(
    200,
  )
  await client.agent.get(`/api/v1/quests/${item.id}`).expect(404)
  const recorded = (await history(client).expect(200)).body.data.completions[0]
  assert.equal(recorded.questId, null)
  assert.equal(recorded.title, item.title)
  const retry = (await complete(client, item).expect(200)).body.data
  assert.equal(retry.quest, null)
  assert.equal(retry.newlyCompleted, false)
  assert.equal(retry.completion.id, done.completion.id)
  assert.equal((await progress(client)).character.totalXp, 120)
  assert.equal(
    (await client.agent.get('/api/v1/quests/summary').expect(200)).body.data.completed,
    0,
  )
  assert.equal((await progress(client)).completedCount, 1)
})

test('completion and history enforce authentication, onboarding, ownership, origin and CSRF', async () => {
  const owner = await actor('owner'),
    other = await actor('other'),
    unfinished = await actor('unfinished', false)
  const item = await quest(owner)
  await request(app).post(`/api/v1/quests/${item.id}/complete`).send({ revision: 1 }).expect(401)
  await complete(unfinished, item).expect(403)
  await complete(other, item).expect(404)
  for (const path of ['/progress', '/progress/history']) {
    await request(app).get(`/api/v1${path}`).expect(401)
    await unfinished.agent.get(`/api/v1${path}`).expect(403)
  }
  await owner.agent
    .post(`/api/v1/quests/${item.id}/complete`)
    .set('Origin', origin)
    .send({ revision: 1 })
    .expect(403)
  await owner.agent
    .post(`/api/v1/quests/${item.id}/complete`)
    .set('Origin', 'https://evil.example')
    .set('X-CSRF-Token', owner.csrf)
    .send({ revision: 1 })
    .expect(403)
  await complete(owner, item).expect(201)
  await complete(other, item).expect(404)
  assert.equal((await history(other).expect(200)).body.data.pagination.total, 0)
  assert.equal((await progress(other)).character.totalXp, 0)
  await mutate(owner, 'post', '/auth/logout-all', {}).expect(200)
  await complete(owner, item).expect(401)
})

test('clients cannot submit reward amounts, completion timestamps or a completed status', async () => {
  const client = await actor(),
    item = await quest(client)
  for (const body of [
    {},
    { revision: 0 },
    { revision: '1' },
    { revision: 1, xp: 9000 },
    { revision: 1, gold: 9000 },
    { revision: 1, difficulty: 'HARD' },
    { revision: 1, completedAt: '2020-01-01' },
    { revision: 1, userId: client.user.id },
  ])
    await complete(client, item, body).expect(422)
  await mutate(client, 'patch', `/quests/${item.id}`, { revision: 1, status: 'COMPLETED' }).expect(
    422,
  )
  await mutate(client, 'post', '/quests/not-a-uuid/complete', { revision: 1 }).expect(422)
  assert.equal((await progress(client)).completedCount, 0)
})

test('a receipt insert failure rolls back quest status, character XP, gold and attribute XP', async () => {
  const client = await actor(),
    item = await quest(client, { difficulty: 'HARD' })
  await database.prisma.$executeRawUnsafe(
    `CREATE FUNCTION reject_test_completion() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test receipt failure'; END $$`,
  )
  await database.prisma.$executeRawUnsafe(
    `CREATE TRIGGER reject_test_completion BEFORE INSERT ON quest_completions FOR EACH ROW EXECUTE FUNCTION reject_test_completion()`,
  )
  try {
    await complete(client, item).expect(500)
    const stored = await database.prisma.quest.findUnique({ where: { id: item.id } })
    assert.deepEqual([stored.status, stored.revision, stored.completedAt], ['ACTIVE', 1, null])
    const data = await progress(client)
    assert.deepEqual([data.character.totalXp, data.character.gold, data.completedCount], [0, 0, 0])
    assert.ok(data.character.attributes.every((a) => a.xp === 0))
  } finally {
    await database.prisma.$executeRawUnsafe(
      'DROP TRIGGER reject_test_completion ON quest_completions',
    )
    await database.prisma.$executeRawUnsafe('DROP FUNCTION reject_test_completion()')
  }
  await complete(client, item).expect(201)
})

test('storage ceilings and missing attribute rows reject without partial progress', async () => {
  const client = await actor(),
    item = await quest(client)
  const char = await database.prisma.character.findUnique({ where: { userId: client.user.id } })
  for (const field of ['totalXp', 'gold']) {
    await database.prisma.character.update({
      where: { id: char.id },
      data: { [field]: MAX_STORED_POINTS },
    })
    assert.equal((await complete(client, item).expect(409)).body.error.code, 'PROGRESS_LIMIT')
    await database.prisma.character.update({ where: { id: char.id }, data: { [field]: 0 } })
  }
  await database.prisma.characterAttribute.update({
    where: { characterId_key: { characterId: char.id, key: 'INTELLECT' } },
    data: { xp: MAX_STORED_POINTS },
  })
  await complete(client, item).expect(409)
  await database.prisma.characterAttribute.deleteMany({
    where: { characterId: char.id, key: 'INTELLECT' },
  })
  assert.equal(
    (await complete(client, item).expect(503)).body.error.code,
    'PROGRESSION_UNAVAILABLE',
  )
  assert.equal(await database.prisma.questCompletion.count(), 0)
  assert.equal(
    (await database.prisma.quest.findUnique({ where: { id: item.id } })).status,
    'ACTIVE',
  )
})

test('completed filters, summaries, sorting and history pagination read saved records', async () => {
  const client = await actor()
  for (let i = 0; i < 5; i++)
    await complete(
      client,
      await quest(client, {
        title: `Quest number ${i}`,
        attribute: i % 2 ? 'STRENGTH' : 'INTELLECT',
      }),
    ).expect(201)
  await quest(client)
  const summary = (await client.agent.get('/api/v1/quests/summary').expect(200)).body.data
  assert.deepEqual([summary.active, summary.completed, summary.archived], [1, 5, 0])
  const list = (
    await client.agent
      .get('/api/v1/quests')
      .query({ status: 'COMPLETED', sort: 'COMPLETED' })
      .expect(200)
  ).body.data
  assert.equal(list.pagination.total, 5)
  assert.equal(list.quests[0].title, 'Quest number 4')
  const one = (await history(client, { limit: '2' }).expect(200)).body.data
  const two = (await history(client, { limit: '2', page: '2' }).expect(200)).body.data
  assert.equal(one.pagination.pages, 3)
  assert.equal(new Set([...one.completions, ...two.completions].map((c) => c.id)).size, 4)
  assert.equal(
    (await history(client, { attribute: 'STRENGTH' }).expect(200)).body.data.pagination.total,
    2,
  )
  assert.equal((await history(client, { page: '900' }).expect(200)).body.data.pagination.page, 1)
  for (const query of [{ limit: '51' }, { page: '0' }, { userId: client.user.id }])
    await history(client, query).expect(422)
})

test('a unique receipt constraint backs replay protection and owner deletion removes private history', async () => {
  const client = await actor(),
    item = await quest(client)
  await complete(client, item).expect(201)
  const saved = await database.prisma.questCompletion.findFirst()
  await assert.rejects(
    database.prisma.questCompletion.create({ data: { ...saved, id: randomUUID(), questId: null } }),
    (error) => error.code === 'P2002',
  )
  await database.prisma.user.delete({ where: { id: client.user.id } })
  assert.equal(await database.prisma.questCompletion.count(), 0)
  assert.equal(await database.prisma.quest.count(), 0)
})
