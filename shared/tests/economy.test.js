import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  catalogQuerySchema,
  equipSchema,
  equipmentSlotSchema,
  inventoryQuerySchema,
  purchaseSchema,
  itemTypeToSlot,
  walletHistorySchema,
} from '../src/economy.js'

test('economy contracts accept bounded catalog, inventory, equipment and wallet inputs', () => {
  assert.deepEqual(catalogQuerySchema.parse({}), { type: 'ALL' })
  assert.deepEqual(inventoryQuerySchema.parse({ type: 'THEME' }), { type: 'THEME' })
  assert.equal(equipmentSlotSchema.parse('CHARACTER_TITLE'), 'CHARACTER_TITLE')
  assert.equal(equipmentSlotSchema.parse('COMPANION'), 'COMPANION')
  assert.deepEqual(purchaseSchema.parse({}), {})
  assert.equal(itemTypeToSlot('PROFILE_BADGE'), 'PROFILE_BADGE')
  assert.deepEqual(walletHistorySchema.parse({ page: '2', limit: '20' }), { page: 2, limit: 20 })
  assert.equal(
    equipSchema.parse({ inventoryItemId: '10000000-0000-4000-8000-000000000001' }).inventoryItemId,
    '10000000-0000-4000-8000-000000000001',
  )
})

test('economy contracts reject invented slots, fields and unbounded pages', () => {
  assert.equal(catalogQuerySchema.safeParse({ type: 'POWER_UP' }).success, false)
  assert.equal(inventoryQuerySchema.safeParse({ ownerId: 'someone' }).success, false)
  assert.equal(equipmentSlotSchema.safeParse('WEAPON').success, false)
  assert.equal(purchaseSchema.safeParse({ price: 0 }).success, false)
  assert.equal(walletHistorySchema.safeParse({ limit: 500 }).success, false)
  assert.equal(equipSchema.safeParse({ inventoryItemId: 'not-a-uuid' }).success, false)
})
