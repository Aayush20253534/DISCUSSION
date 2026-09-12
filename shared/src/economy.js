import { z } from 'zod'

export const SHOP_ITEM_TYPES = Object.freeze([
  { key: 'AVATAR_FRAME', name: 'Avatar frames', slot: 'AVATAR_FRAME' },
  { key: 'PROFILE_BADGE', name: 'Profile badges', slot: 'PROFILE_BADGE' },
  { key: 'CHARACTER_TITLE', name: 'Character titles', slot: 'CHARACTER_TITLE' },
  { key: 'THEME', name: 'Themes', slot: 'THEME' },
])

export const EQUIPMENT_SLOTS = Object.freeze(SHOP_ITEM_TYPES.map(({ slot }) => slot))
export const ITEM_RARITIES = Object.freeze(['COMMON', 'RARE', 'EPIC'])
export const shopItemTypeSchema = z.enum(SHOP_ITEM_TYPES.map(({ key }) => key))
export const equipmentSlotSchema = z.enum(EQUIPMENT_SLOTS)
export const shopItemIdSchema = z.string().uuid('Choose a valid reward.')
export const inventoryItemIdSchema = z.string().uuid('Choose an owned reward.')
export const purchaseSchema = z.object({}).strict()

export const catalogQuerySchema = z
  .object({
    type: z.enum(['ALL', ...SHOP_ITEM_TYPES.map(({ key }) => key)]).default('ALL'),
  })
  .strict()

export const inventoryQuerySchema = z
  .object({
    type: z.enum(['ALL', ...SHOP_ITEM_TYPES.map(({ key }) => key)]).default('ALL'),
  })
  .strict()

export const equipSchema = z
  .object({
    inventoryItemId: inventoryItemIdSchema,
  })
  .strict()

export const walletHistorySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12),
  })
  .strict()

export function itemTypeToSlot(type) {
  return SHOP_ITEM_TYPES.find(({ key }) => key === type)?.slot || null
}
