import { after, before, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { parseEnv } from '../src/config/env.js'
import { testDatabase } from './helpers/database.js'
import { createTestMailer } from './helpers/email.js'

const origin = 'http://localhost:5173'
const config = parseEnv({ NODE_ENV: 'test', JWT_SECRET: 'journey-test-secret-'.repeat(5) })
const password = 'An excellent adventure awaits'
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

async function client() {
  const agent = request.agent(app)
  const csrf = (await agent.get('/api/v1/auth/csrf').expect(200)).body.data.csrfToken
  return { agent, csrf }
}

const mutate = (actor, method, path, body = {}) =>
  actor.agent[method](`/api/v1${path}`)
    .set('Origin', origin)
    .set('X-CSRF-Token', actor.csrf)
    .send(body)

async function signup(name) {
  const actor = await client()
  actor.email = `${name}@example.test`
  const started = await mutate(actor, 'post', '/auth/signup', {
    email: actor.email,
    displayName: name,
    password,
  }).expect(201)
  actor.user = started.body.data.user
  await mutate(actor, 'put', '/me/onboarding', {
    displayName: name,
    avatarKey: 'wanderer',
    timezone: 'Asia/Kolkata',
  }).expect(200)
  return actor
}

async function createQuest(actor, title, attribute) {
  return (
    await mutate(actor, 'post', '/quests', {
      requestId: randomUUID(),
      title,
      attribute,
      difficulty: 'HARD',
    }).expect(201)
  ).body.data.quest
}

test('complete production-like journey persists progression, economy and cosmetics across a fresh login', async () => {
  const hero = await signup('journey-hero')
  const quests = []
  for (const [title, attribute] of [
    ['Solve an algorithm problem', 'INTELLECT'],
    ['Finish a focused workout', 'STRENGTH'],
    ['Plan tomorrow before bed', 'DISCIPLINE'],
  ]) {
    const quest = await createQuest(hero, title, attribute)
    quests.push(quest)
    await mutate(hero, 'post', `/quests/${quest.id}/complete`, { revision: quest.revision }).expect(201)
  }

  const beforePurchase = (await hero.agent.get('/api/v1/dashboard').expect(200)).body.data
  assert.equal(beforePurchase.completedCount, 3)
  assert.equal(beforePurchase.character.totalXp, 360)
  assert.equal(beforePurchase.character.gold, 72)
  assert.equal(beforePurchase.streaks.todayCompletedCount, 3)
  assert.equal(beforePurchase.streaks.currentStreak, 1)

  const catalog = (
    await hero.agent.get('/api/v1/shop/catalog').query({ type: 'CHARACTER_TITLE' }).expect(200)
  ).body.data
  const title = catalog.items.find((item) => item.price <= catalog.balance)
  assert.ok(title, 'earned quest gold should afford at least one cosmetic title')

  const purchase = (
    await mutate(hero, 'post', `/shop/items/${title.id}/purchase`).expect(201)
  ).body.data
  assert.equal(purchase.purchased, true)
  assert.equal(purchase.balance, 72 - title.price)
  await mutate(hero, 'put', '/inventory/equipment/CHARACTER_TITLE', {
    inventoryItemId: purchase.inventoryItem.id,
  }).expect(200)

  const walletBeforeLogout = (await hero.agent.get('/api/v1/wallet').expect(200)).body.data
  assert.equal(walletBeforeLogout.transactions.length, 4)
  assert.equal(walletBeforeLogout.transactions.filter((row) => row.type === 'QUEST_REWARD').length, 3)
  assert.equal(walletBeforeLogout.transactions.filter((row) => row.type === 'SHOP_PURCHASE').length, 1)

  await mutate(hero, 'post', '/auth/logout').expect(200)
  await hero.agent.get('/api/v1/dashboard').expect(401)

  const returning = await client()
  await mutate(returning, 'post', '/auth/login', { email: hero.email, password }).expect(200)
  const [me, dashboard, inventory, wallet, activity] = await Promise.all([
    returning.agent.get('/api/v1/auth/me').expect(200).then((response) => response.body.data.user),
    returning.agent.get('/api/v1/dashboard').expect(200).then((response) => response.body.data),
    returning.agent.get('/api/v1/inventory').expect(200).then((response) => response.body.data),
    returning.agent.get('/api/v1/wallet').expect(200).then((response) => response.body.data),
    returning.agent.get('/api/v1/activity').expect(200).then((response) => response.body.data),
  ])

  assert.equal(dashboard.completedCount, 3)
  assert.equal(dashboard.character.totalXp, 360)
  assert.equal(dashboard.character.gold, 72 - title.price)
  assert.equal(dashboard.recentCompletions.length, 3)
  assert.equal(activity.streaks.currentStreak, 1)
  assert.equal(inventory.items.length, 1)
  assert.equal(inventory.items[0].item.id, title.id)
  assert.equal(inventory.items[0].equippedSlot, 'CHARACTER_TITLE')
  assert.equal(wallet.balance, 72 - title.price)
  assert.equal(wallet.transactions.length, 4)
  assert.equal(me.equipment[0].slot, 'CHARACTER_TITLE')
  assert.equal(me.equipment[0].inventoryItem.shopItem.id, title.id)

  // A lost response can be retried after a fresh login without another reward.
  const replay = await mutate(returning, 'post', `/quests/${quests[0].id}/complete`, {
    revision: quests[0].revision,
  }).expect(200)
  assert.equal(replay.body.data.newlyCompleted, false)
  assert.equal((await returning.agent.get('/api/v1/wallet').expect(200)).body.data.transactions.length, 4)

  // A second account receives a 404 rather than learning whether another user's quest exists.
  const stranger = await signup('journey-stranger')
  await stranger.agent.get(`/api/v1/quests/${quests[0].id}`).expect(404)
  await mutate(stranger, 'post', `/quests/${quests[0].id}/complete`, {
    revision: quests[0].revision,
  }).expect(404)
})
