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
const config = parseEnv({ NODE_ENV: 'test', JWT_SECRET: 'economy-test-secret-'.repeat(4) })
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

const mutate = (client, method, path, body = {}) =>
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
  }).expect(201)
  client.user = started.body.data.user
  if (onboard)
    await mutate(client, 'put', '/me/onboarding', {
      displayName: name,
      avatarKey: 'wanderer',
      timezone: 'Asia/Kolkata',
    }).expect(200)
  return client
}

async function earn(client, count = 3) {
  for (let index = 0; index < count; index += 1) {
    const quest = (
      await mutate(client, 'post', '/quests', {
        requestId: randomUUID(),
        title: `Hard quest ${index}`,
        attribute: 'DISCIPLINE',
        difficulty: 'HARD',
      }).expect(201)
    ).body.data.quest
    await mutate(
      client,
      'post',
      `/quests/${quest.id}/complete`,
      verifiedCompletionBody(config, client.user.id, quest),
    ).expect(201)
  }
}

const catalog = (client, query = {}) => client.agent.get('/api/v1/shop/catalog').query(query)
const inventory = (client, query = {}) => client.agent.get('/api/v1/inventory').query(query)
const wallet = (client, query = {}) => client.agent.get('/api/v1/wallet').query(query)

test('catalog is seeded, cosmetic-only and reports ownership without leaking storage fields', async () => {
  const client = await actor()
  const response = await catalog(client).expect(200)
  assert.match(response.headers['cache-control'], /no-store/)
  assert.equal(response.body.data.balance, 0)
  assert.equal(response.body.data.items.length, 25)
  assert.deepEqual(
    [...new Set(response.body.data.items.map((item) => item.type))].sort(),
    ['AVATAR_FRAME', 'AURA', 'CHARACTER_TITLE', 'COMPANION', 'OUTFIT', 'PROFILE_BADGE', 'THEME'].sort(),
  )
  assert.ok(response.body.data.items.every((item) => item.price > 0 && !item.owned && !item.equipped))
  for (const item of response.body.data.items)
    for (const hidden of ['active', 'sortOrder', 'createdAt', 'updatedAt']) assert.equal(item[hidden], undefined)

  const themes = await catalog(client, { type: 'THEME' }).expect(200)
  assert.equal(themes.body.data.items.length, 3)
  await catalog(client, { type: 'POWER_UP' }).expect(422)
})

test('quest gold writes the wallet ledger in the same progression transaction', async () => {
  const client = await actor()
  await earn(client, 1)
  const data = (await wallet(client).expect(200)).body.data
  assert.equal(data.balance, 24)
  assert.equal(data.transactions.length, 1)
  assert.equal(data.transactions[0].type, 'QUEST_REWARD')
  assert.equal(data.transactions[0].amount, 24)
  assert.equal(data.transactions[0].balanceAfter, 24)
  assert.equal(data.transactions[0].source.kind, 'QUEST')
})

test('purchase rejects insufficient gold without partial ownership or a negative balance', async () => {
  const client = await actor()
  const item = (await catalog(client, { type: 'CHARACTER_TITLE' })).body.data.items[0]
  const response = await mutate(client, 'post', `/shop/items/${item.id}/purchase`).expect(409)
  assert.equal(response.body.error.code, 'INSUFFICIENT_GOLD')
  await mutate(client, 'post', `/shop/items/${item.id}/purchase`, { price: 0 }).expect(422)
  assert.equal(await database.prisma.inventoryItem.count(), 0)
  assert.equal((await inventory(client).expect(200)).body.data.balance, 0)
  assert.equal(await database.prisma.currencyTransaction.count(), 0)
})

test('purchase is atomic and replay-safe, including simultaneous retries', async () => {
  const client = await actor()
  await earn(client, 3) // 72 gold
  const item = (await catalog(client, { type: 'CHARACTER_TITLE' }).expect(200)).body.data.items[0]
  assert.equal(item.price, 60)

  const responses = await Promise.all([
    mutate(client, 'post', `/shop/items/${item.id}/purchase`),
    mutate(client, 'post', `/shop/items/${item.id}/purchase`),
  ])
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 201])
  assert.equal(await database.prisma.inventoryItem.count(), 1)
  assert.equal((await inventory(client).expect(200)).body.data.balance, 12)
  assert.equal(
    await database.prisma.currencyTransaction.count({ where: { type: 'SHOP_PURCHASE' } }),
    1,
  )

  const retry = await mutate(client, 'post', `/shop/items/${item.id}/purchase`).expect(200)
  assert.equal(retry.body.data.purchased, false)
  assert.equal(retry.body.data.balance, 12)
  const refreshed = await catalog(client, { type: 'CHARACTER_TITLE' }).expect(200)
  const owned = refreshed.body.data.items.find((candidate) => candidate.id === item.id)
  assert.equal(owned.owned, true)
})

test('character wallet lock prevents concurrent purchases from overspending the same gold', async () => {
  const client = await actor()
  await database.prisma.character.update({ where: { userId: client.user.id }, data: { gold: 170 } })
  const rows = (await catalog(client).expect(200)).body.data.items.filter((item) => item.price >= 100)
  const a = rows.find((item) => item.price === 120)
  const b = rows.find((item) => item.price === 110)
  const responses = await Promise.all([
    mutate(client, 'post', `/shop/items/${a.id}/purchase`),
    mutate(client, 'post', `/shop/items/${b.id}/purchase`),
  ])
  assert.equal(responses.filter((response) => response.status === 201).length, 1)
  assert.equal(responses.filter((response) => response.status === 409).length, 1)
  const character = await database.prisma.character.findUnique({ where: { userId: client.user.id } })
  assert.ok(character.gold >= 0)
  assert.equal(await database.prisma.inventoryItem.count(), 1)
})

test('owned cosmetics equip by matching slot, surface through auth, and can be unequipped', async () => {
  const client = await actor()
  await database.prisma.character.update({ where: { userId: client.user.id }, data: { gold: 500 } })
  const frame = (await catalog(client, { type: 'AVATAR_FRAME' }).expect(200)).body.data.items[0]
  const bought = (await mutate(client, 'post', `/shop/items/${frame.id}/purchase`).expect(201)).body.data
  const inventoryItemId = bought.inventoryItem.id

  await mutate(client, 'put', '/inventory/equipment/CHARACTER_TITLE', { inventoryItemId }).expect(422)
  const equipped = await mutate(client, 'put', '/inventory/equipment/AVATAR_FRAME', { inventoryItemId }).expect(200)
  assert.equal(equipped.body.data.equipment.item.id, frame.id)
  const me = (await client.agent.get('/api/v1/auth/me').expect(200)).body.data.user
  assert.equal(me.equipment[0].slot, 'AVATAR_FRAME')
  assert.equal(me.equipment[0].inventoryItem.shopItem.assetKey, frame.assetKey)

  const owned = (await inventory(client).expect(200)).body.data
  assert.equal(owned.items[0].equippedSlot, 'AVATAR_FRAME')
  assert.equal(owned.equipment[0].item.id, frame.id)
  await mutate(client, 'delete', '/inventory/equipment/AVATAR_FRAME').expect(200)
  assert.equal((await inventory(client).expect(200)).body.data.equipment.length, 0)
})

test('inventory ownership is isolated per account and protected endpoints require onboarding and csrf', async () => {
  const owner = await actor('owner')
  const stranger = await actor('stranger')
  const unfinished = await actor('unfinished', false)
  await database.prisma.character.update({ where: { userId: owner.user.id }, data: { gold: 500 } })
  const item = (await catalog(owner).expect(200)).body.data.items[0]
  const purchased = (await mutate(owner, 'post', `/shop/items/${item.id}/purchase`).expect(201)).body.data.inventoryItem

  assert.equal((await inventory(stranger).expect(200)).body.data.items.length, 0)
  await mutate(stranger, 'put', '/inventory/equipment/AVATAR_FRAME', { inventoryItemId: purchased.id }).expect(404)
  await assert.rejects(
    database.prisma.characterEquipment.create({
      data: { userId: stranger.user.id, slot: 'AVATAR_FRAME', inventoryItemId: purchased.id },
    }),
    (error) => error.code === 'P2003',
  )
  await unfinished.agent.get('/api/v1/shop/catalog').expect(403)

  await request(app).get('/api/v1/shop/catalog').expect(401)
  await owner.agent.post(`/api/v1/shop/items/${item.id}/purchase`).set('Origin', origin).send({}).expect(403)
})

test('deleting the owner cascades private inventory, equipment and ledger but preserves shop catalog', async () => {
  const client = await actor()
  await database.prisma.character.update({ where: { userId: client.user.id }, data: { gold: 500 } })
  const item = (await catalog(client).expect(200)).body.data.items[0]
  const bought = (await mutate(client, 'post', `/shop/items/${item.id}/purchase`).expect(201)).body.data.inventoryItem
  await mutate(client, 'put', `/inventory/equipment/${item.type}`, { inventoryItemId: bought.id }).expect(200)
  await database.prisma.user.delete({ where: { id: client.user.id } })
  assert.equal(await database.prisma.inventoryItem.count(), 0)
  assert.equal(await database.prisma.characterEquipment.count(), 0)
  assert.equal(await database.prisma.currencyTransaction.count(), 0)
  assert.equal(await database.prisma.shopItem.count(), 25)
})
