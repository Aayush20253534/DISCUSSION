export const shopItemSelect = {
  id: true,
  sku: true,
  name: true,
  description: true,
  type: true,
  rarity: true,
  price: true,
  assetKey: true,
  sortOrder: true,
}

export const inventoryItemSelect = {
  id: true,
  pricePaid: true,
  purchasedAt: true,
  shopItem: { select: shopItemSelect },
}

export const equipmentSelect = {
  slot: true,
  equippedAt: true,
  inventoryItem: {
    select: {
      id: true,
      shopItem: { select: shopItemSelect },
    },
  },
}

export const currencyTransactionSelect = {
  id: true,
  type: true,
  amount: true,
  balanceAfter: true,
  createdAt: true,
  questCompletion: { select: { id: true, title: true } },
  inventoryItem: {
    select: {
      id: true,
      shopItem: { select: { id: true, name: true, type: true, assetKey: true } },
    },
  },
}

export const serializeShopItem = (item, { owned = false, equipped = false } = {}) => ({
  id: item.id,
  sku: item.sku,
  name: item.name,
  description: item.description,
  type: item.type,
  rarity: item.rarity,
  price: item.price,
  assetKey: item.assetKey,
  owned,
  equipped,
})

export const serializeInventoryItem = (row, equippedSlot = null) => ({
  id: row.id,
  pricePaid: row.pricePaid,
  purchasedAt: row.purchasedAt.toISOString(),
  equippedSlot,
  item: serializeShopItem(row.shopItem, { owned: true, equipped: Boolean(equippedSlot) }),
})

export const serializeEquipment = (row) => ({
  slot: row.slot,
  equippedAt: row.equippedAt.toISOString(),
  inventoryItemId: row.inventoryItem.id,
  item: serializeShopItem(row.inventoryItem.shopItem, { owned: true, equipped: true }),
})

export const serializeCurrencyTransaction = (row) => ({
  id: row.id,
  type: row.type,
  amount: row.amount,
  balanceAfter: row.balanceAfter,
  createdAt: row.createdAt.toISOString(),
  source:
    row.type === 'QUEST_REWARD'
      ? { kind: 'QUEST', id: row.questCompletion?.id || null, label: row.questCompletion?.title || 'Quest reward' }
      : {
          kind: 'SHOP_ITEM',
          id: row.inventoryItem?.shopItem?.id || null,
          label: row.inventoryItem?.shopItem?.name || 'Marketplace purchase',
          type: row.inventoryItem?.shopItem?.type || null,
          assetKey: row.inventoryItem?.shopItem?.assetKey || null,
        },
})
