import { Router } from 'express'
import {
  catalogQuerySchema,
  equipSchema,
  equipmentSlotSchema,
  inventoryQuerySchema,
  itemTypeToSlot,
  purchaseSchema,
  shopItemIdSchema,
  walletHistorySchema,
} from '@life-rpg/shared'
import { createAuthentication } from '../auth/middleware.js'
import { createSecurity } from '../auth/security.js'
import { AppError, validate } from '../lib/errors.js'
import {
  currencyTransactionSelect,
  equipmentSelect,
  inventoryItemSelect,
  serializeCurrencyTransaction,
  serializeEquipment,
  serializeInventoryItem,
  serializeShopItem,
  shopItemSelect,
} from './presentation.js'

const notFound = () => new AppError(404, 'SHOP_ITEM_NOT_FOUND', 'This reward is no longer available.')
const inventoryNotFound = () =>
  new AppError(404, 'INVENTORY_ITEM_NOT_FOUND', 'That reward is not in your inventory.')

export function createEconomyRouter({ config, database }) {
  const router = Router()
  const db = database.prisma
  const security = createSecurity(config)
  const { requireConfigured, requireAuth } = createAuthentication({ config, database, security })

  router.use((req, _res, next) => {
    if (!/^\/(shop|inventory|wallet)(\/|$)/.test(req.path)) return next('router')
    next()
  })
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })
  router.use(requireConfigured, requireAuth)
  router.use(async (req, _res, next) => {
    const character = await db.character.findUnique({
      where: { userId: req.auth.userId },
      select: { id: true },
    })
    if (!character)
      throw new AppError(403, 'ONBOARDING_REQUIRED', 'Create your character before opening the market.')
    req.characterId = character.id
    next()
  })

  router.get('/shop/catalog', async (req, res) => {
    const query = validate(catalogQuerySchema, req.query)
    const where = { active: true, ...(query.type !== 'ALL' && { type: query.type }) }
    const [character, items, owned, equipment] = await db.$transaction(
      [
        db.character.findUnique({ where: { id: req.characterId }, select: { gold: true } }),
        db.shopItem.findMany({
          where,
          select: shopItemSelect,
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        }),
        db.inventoryItem.findMany({
          where: { userId: req.auth.userId },
          select: { id: true, shopItemId: true },
        }),
        db.characterEquipment.findMany({
          where: { userId: req.auth.userId },
          select: { slot: true, inventoryItem: { select: { shopItemId: true } } },
        }),
      ],
      { isolationLevel: 'RepeatableRead' },
    )
    const ownedIds = new Set(owned.map((row) => row.shopItemId))
    const equippedIds = new Set(equipment.map((row) => row.inventoryItem.shopItemId))
    res.json({
      data: {
        balance: character.gold,
        items: items.map((item) =>
          serializeShopItem(item, { owned: ownedIds.has(item.id), equipped: equippedIds.has(item.id) }),
        ),
      },
    })
  })

  router.post('/shop/items/:id/purchase', security.requireCsrf, async (req, res) => {
    const itemId = validate(shopItemIdSchema, req.params.id)
    validate(purchaseSchema, req.body)
    const data = await db.$transaction(async (tx) => {
      // Gold is a single wallet. Lock the character row so purchases and quest rewards cannot
      // race each other into a stale balance or a double spend.
      const locked = await tx.$queryRaw`
        SELECT id FROM characters WHERE id = ${req.characterId}::uuid AND user_id = ${req.auth.userId}::uuid FOR UPDATE
      `
      if (!locked.length)
        throw new AppError(403, 'ONBOARDING_REQUIRED', 'Create your character before opening the market.')

      const item = await tx.shopItem.findFirst({ where: { id: itemId, active: true }, select: shopItemSelect })
      if (!item) throw notFound()
      const character = await tx.character.findUnique({ where: { id: req.characterId }, select: { gold: true } })
      const existing = await tx.inventoryItem.findUnique({
        where: { userId_shopItemId: { userId: req.auth.userId, shopItemId: item.id } },
        select: inventoryItemSelect,
      })
      if (existing)
        return {
          purchased: false,
          balance: character.gold,
          inventoryItem: serializeInventoryItem(existing),
          item: serializeShopItem(item, { owned: true }),
        }
      if (character.gold < item.price)
        throw new AppError(
          409,
          'INSUFFICIENT_GOLD',
          `You need ${item.price - character.gold} more gold for this reward.`,
          { balance: String(character.gold), price: String(item.price) },
        )

      const updated = await tx.character.update({
        where: { id: req.characterId },
        data: { gold: { decrement: item.price } },
        select: { gold: true },
      })
      const inventoryItem = await tx.inventoryItem.create({
        data: {
          userId: req.auth.userId,
          shopItemId: item.id,
          pricePaid: item.price,
        },
        select: inventoryItemSelect,
      })
      await tx.currencyTransaction.create({
        data: {
          userId: req.auth.userId,
          type: 'SHOP_PURCHASE',
          amount: -item.price,
          balanceAfter: updated.gold,
          inventoryItemId: inventoryItem.id,
        },
      })
      return {
        purchased: true,
        balance: updated.gold,
        inventoryItem: serializeInventoryItem(inventoryItem),
        item: serializeShopItem(item, { owned: true }),
      }
    })
    res.status(data.purchased ? 201 : 200).json({ data })
  })

  router.get('/inventory', async (req, res) => {
    const query = validate(inventoryQuerySchema, req.query)
    const [character, items, equipment] = await db.$transaction(
      [
        db.character.findUnique({ where: { id: req.characterId }, select: { gold: true } }),
        db.inventoryItem.findMany({
          where: {
            userId: req.auth.userId,
            ...(query.type !== 'ALL' && { shopItem: { type: query.type } }),
          },
          select: inventoryItemSelect,
          orderBy: [{ purchasedAt: 'desc' }, { id: 'desc' }],
        }),
        db.characterEquipment.findMany({
          where: { userId: req.auth.userId },
          select: equipmentSelect,
          orderBy: { slot: 'asc' },
        }),
      ],
      { isolationLevel: 'RepeatableRead' },
    )
    const slotByInventoryId = new Map(equipment.map((row) => [row.inventoryItem.id, row.slot]))
    res.json({
      data: {
        balance: character.gold,
        items: items.map((row) => serializeInventoryItem(row, slotByInventoryId.get(row.id) || null)),
        equipment: equipment.map(serializeEquipment),
      },
    })
  })

  router.put('/inventory/equipment/:slot', security.requireCsrf, async (req, res) => {
    const slot = validate(equipmentSlotSchema, req.params.slot)
    const { inventoryItemId } = validate(equipSchema, req.body)
    const data = await db.$transaction(async (tx) => {
      const inventoryItem = await tx.inventoryItem.findFirst({
        where: { id: inventoryItemId, userId: req.auth.userId },
        select: inventoryItemSelect,
      })
      if (!inventoryItem) throw inventoryNotFound()
      const expectedSlot = itemTypeToSlot(inventoryItem.shopItem.type)
      if (expectedSlot !== slot)
        throw new AppError(422, 'EQUIPMENT_SLOT_MISMATCH', 'That reward cannot be equipped in this slot.')
      const equipment = await tx.characterEquipment.upsert({
        where: { userId_slot: { userId: req.auth.userId, slot } },
        create: { userId: req.auth.userId, slot, inventoryItemId },
        update: { inventoryItemId, equippedAt: new Date() },
        select: equipmentSelect,
      })
      return { equipment: serializeEquipment(equipment) }
    })
    res.json({ data })
  })

  router.delete('/inventory/equipment/:slot', security.requireCsrf, async (req, res) => {
    const slot = validate(equipmentSlotSchema, req.params.slot)
    await db.characterEquipment.deleteMany({ where: { userId: req.auth.userId, slot } })
    res.json({ data: { unequipped: true, slot } })
  })

  router.get('/wallet', async (req, res) => {
    const query = validate(walletHistorySchema, req.query)
    const where = { userId: req.auth.userId }
    const data = await db.$transaction(
      async (tx) => {
        const character = await tx.character.findUnique({ where: { id: req.characterId }, select: { gold: true } })
        const total = await tx.currencyTransaction.count({ where })
        const pages = Math.max(1, Math.ceil(total / query.limit))
        const page = Math.min(query.page, pages)
        const rows = await tx.currencyTransaction.findMany({
          where,
          select: currencyTransactionSelect,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: query.limit,
          skip: (page - 1) * query.limit,
        })
        return {
          balance: character.gold,
          transactions: rows.map(serializeCurrencyTransaction),
          pagination: { page, limit: query.limit, total, pages },
        }
      },
      { isolationLevel: 'RepeatableRead' },
    )
    res.json({ data })
  })

  return router
}
