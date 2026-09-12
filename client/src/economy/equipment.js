export function equippedItem(user, slot) {
  const row = user?.equipment?.find((entry) => entry.slot === slot)
  return row?.inventoryItem?.shopItem || row?.item || null
}
