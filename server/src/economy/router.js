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
  todayInTimezone,
} from '@atlasborn/shared'
import { createAuthentication } from '../auth/middleware.js'
import { createSecurity } from '../auth/security.js'
import { AppError, validate } from '../lib/errors.js'
import { routeCacheKey, setCacheStatus } from '../lib/cache.js'
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
import { buildMarketplaceContext } from './marketplace.js'

const notFound = () => new AppError(404, 'SHOP_ITEM_NOT_FOUND', 'This reward is no longer available.')
const inventoryNotFound = () =>
  new AppError(404, 'INVENTORY_ITEM_NOT_FOUND', 'That reward is not in your inventory.')

export function createEconomyRouter({ config, database, cache }) {
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
    const cached = await cache.getOrSet({
      userId: req.auth.userId,
      namespace: 'account-context',
      key: 'economy',
      ttlSeconds: Math.min(config.REDIS_CACHE_TTL_SECONDS * 4, 300),
      load: () =>
        db.user.findUnique({
          where: { id: req.auth.userId },
          select: { timezone: true, character: { select: { id: true } } },
        }),
    })
    const account = cached.value
    if (!account?.character)
      throw new AppError(403, 'ONBOARDING_REQUIRED', 'Create your character before opening the market.')
    req.characterId = account.character.id
    req.marketTimezone = account.timezone
    next()
  })

  router.get('/shop/catalog', async (req, res) => {
    const query = validate(catalogQuerySchema, req.query)
    const today = todayInTimezone(req.marketTimezone)
    const cached = await cache.getOrSet({
      userId: req.auth.userId,
      namespace: 'shop-catalog',
      key: `all:${today}`,
      ttlSeconds: config.REDIS_CACHE_TTL_SECONDS,
      load: async () => {
        const [account, items, owned, equipment, completedQuests, activeDates] =
          await db.$transaction(
            [
              db.user.findUnique({
                where: { id: req.auth.userId },
                select: { timezone: true, character: { select: { gold: true, totalXp: true } } },
              }),
              db.shopItem.findMany({
                where: { active: true },
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
              db.questCompletion.count({ where: { userId: req.auth.userId } }),
              db.questCompletion.findMany({
                where: { userId: req.auth.userId },
                distinct: ['completedDate'],
                select: { completedDate: true },
                orderBy: { completedDate: 'asc' },
              }),
            ],
            { isolationLevel: 'RepeatableRead' },
          )
        const ownedIds = new Set(owned.map((row) => row.shopItemId))
        const equippedIds = new Set(equipment.map((row) => row.inventoryItem.shopItemId))
        const context = buildMarketplaceContext({
          items,
          ownedIds,
          totalXp: account.character.totalXp,
          completedQuests,
          activeDates: activeDates.map((row) => row.completedDate.toISOString().slice(0, 10)),
          today,
        })
        const decorate = (item) => ({
          ...serializeShopItem(item, {
            owned: ownedIds.has(item.id),
            equipped: equippedIds.has(item.id),
          }),
          ...context.byId.get(item.id),
        })
        const itemById = new Map(items.map((item) => [item.id, item]))
        const featuredIds = new Set([
          ...context.dailyIds,
          ...(context.weeklyLegendId ? [context.weeklyLegendId] : []),
          ...context.wanderingMerchant.itemIds,
        ])
        return {
          balance: account.character.gold,
          items: items.map(decorate),
          marketplace: {
            today,
            profile: context.profile,
            collections: context.collections,
            dailyDeals: context.dailyIds.map((id) => decorate(itemById.get(id))),
            weeklyLegend: context.weeklyLegendId
              ? decorate(itemById.get(context.weeklyLegendId))
              : null,
            wanderingMerchant: {
              active: context.wanderingMerchant.active,
              items: context.wanderingMerchant.itemIds.map((id) => decorate(itemById.get(id))),
            },
            featuredItems: [...featuredIds].map((id) => decorate(itemById.get(id))).filter(Boolean),
          },
        }
      },
    })
    setCacheStatus(res, cached.status)
    const data = cached.value
    res.json({
      data: {
        ...data,
        items: query.type === 'ALL' ? data.items : data.items.filter((item) => item.type === query.type),
      },
    })
  })

  router.post('/shop/items/:id/purchase', security.requireCsrf, async (req, res) => {
    const itemId = validate(shopItemIdSchema, req.params.id)
    validate(purchaseSchema, req.body)
    const data = await db.$transaction(async (tx) => {
      const locked = await tx.$queryRaw`
        SELECT id FROM characters WHERE id = ${req.characterId}::uuid AND user_id = ${req.auth.userId}::uuid FOR UPDATE
      `
      if (!locked.length)
        throw new AppError(403, 'ONBOARDING_REQUIRED', 'Create your character before opening the market.')

      const [account, allItems, ownedRows, completedQuests, activeDates] = await Promise.all([
        tx.user.findUnique({
          where: { id: req.auth.userId },
          select: { timezone: true, character: { select: { gold: true, totalXp: true } } },
        }),
        tx.shopItem.findMany({ where: { active: true }, select: shopItemSelect }),
        tx.inventoryItem.findMany({ where: { userId: req.auth.userId }, select: { id: true, shopItemId: true } }),
        tx.questCompletion.count({ where: { userId: req.auth.userId } }),
        tx.questCompletion.findMany({
          where: { userId: req.auth.userId },
          distinct: ['completedDate'],
          select: { completedDate: true },
          orderBy: { completedDate: 'asc' },
        }),
      ])
      const item = allItems.find((candidate) => candidate.id === itemId)
      if (!item) throw notFound()
      const existing = await tx.inventoryItem.findUnique({
        where: { userId_shopItemId: { userId: req.auth.userId, shopItemId: item.id } },
        select: inventoryItemSelect,
      })
      if (existing)
        return {
          purchased: false,
          balance: account.character.gold,
          inventoryItem: serializeInventoryItem(existing),
          item: serializeShopItem(item, { owned: true }),
        }

      const ownedIds = new Set(ownedRows.map((row) => row.shopItemId))
      const context = buildMarketplaceContext({
        items: allItems,
        ownedIds,
        totalXp: account.character.totalXp,
        completedQuests,
        activeDates: activeDates.map((row) => row.completedDate.toISOString().slice(0, 10)),
        today: todayInTimezone(account.timezone),
      })
      const marketState = context.byId.get(item.id)
      if (!marketState.available)
        throw new AppError(409, 'MERCHANT_AWAY', 'This treasure is only sold while the wandering merchant is in camp.')
      if (marketState.locked)
        throw new AppError(409, 'ITEM_LOCKED', 'Your journey has not unlocked this treasure yet.', {
          requirements: marketState.requirements.filter((requirement) => !requirement.met).map((requirement) => requirement.label),
        })
      if (account.character.gold < marketState.price)
        throw new AppError(
          409,
          'INSUFFICIENT_GOLD',
          `You need ${marketState.price - account.character.gold} more gold for this reward.`,
          { balance: String(account.character.gold), price: String(marketState.price) },
        )

      const updated = await tx.character.update({
        where: { id: req.characterId },
        data: { gold: { decrement: marketState.price } },
        select: { gold: true },
      })
      const inventoryItem = await tx.inventoryItem.create({
        data: { userId: req.auth.userId, shopItemId: item.id, pricePaid: marketState.price },
        select: inventoryItemSelect,
      })
      await tx.currencyTransaction.create({
        data: {
          userId: req.auth.userId,
          type: 'SHOP_PURCHASE',
          amount: -marketState.price,
          balanceAfter: updated.gold,
          inventoryItemId: inventoryItem.id,
        },
      })
      return {
        purchased: true,
        balance: updated.gold,
        inventoryItem: serializeInventoryItem(inventoryItem),
        item: { ...serializeShopItem(item, { owned: true }), ...marketState },
      }
    })
    if (data.purchased) await cache.invalidateUser(req.auth.userId)
    res.status(data.purchased ? 201 : 200).json({ data })
  })

  router.get('/inventory', async (req, res) => {
    const query = validate(inventoryQuerySchema, req.query)
    const cached = await cache.getOrSet({
      userId: req.auth.userId,
      namespace: 'inventory',
      key: 'all',
      ttlSeconds: config.REDIS_CACHE_TTL_SECONDS,
      load: async () => {
        const [character, items, equipment] = await db.$transaction(
          [
            db.character.findUnique({ where: { id: req.characterId }, select: { gold: true } }),
            db.inventoryItem.findMany({
              where: { userId: req.auth.userId },
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
        const slotByInventoryId = new Map(
          equipment.map((row) => [row.inventoryItem.id, row.slot]),
        )
        return {
          balance: character.gold,
          items: items.map((row) =>
            serializeInventoryItem(row, slotByInventoryId.get(row.id) || null),
          ),
          equipment: equipment.map(serializeEquipment),
        }
      },
    })
    setCacheStatus(res, cached.status)
    const data = cached.value
    res.json({
      data: {
        ...data,
        items:
          query.type === 'ALL'
            ? data.items
            : data.items.filter((row) => row.item.type === query.type),
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
    await cache.invalidateUser(req.auth.userId)
    res.json({ data })
  })

  router.delete('/inventory/equipment/:slot', security.requireCsrf, async (req, res) => {
    const slot = validate(equipmentSlotSchema, req.params.slot)
    await db.characterEquipment.deleteMany({ where: { userId: req.auth.userId, slot } })
    await cache.invalidateUser(req.auth.userId)
    res.json({ data: { unequipped: true, slot } })
  })

  router.get('/wallet', async (req, res) => {
    const query = validate(walletHistorySchema, req.query)
    const where = { userId: req.auth.userId }
    const cached = await cache.getOrSet({
      userId: req.auth.userId,
      namespace: 'wallet',
      key: routeCacheKey(req),
      ttlSeconds: Math.min(config.REDIS_CACHE_TTL_SECONDS * 2, 300),
      load: () =>
        db.$transaction(
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
        ),
    })
    setCacheStatus(res, cached.status)
    res.json({ data: cached.value })
  })

  return router
}
