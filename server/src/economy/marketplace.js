import { levelProgress, shiftCalendarDate } from '@life-rpg/shared'

const REQUIREMENTS = Object.freeze({
  'frame-ember': [{ kind: 'LEVEL', target: 2 }, { kind: 'QUESTS', target: 5 }],
  'badge-unbroken': [{ kind: 'STREAK', target: 3 }],
  'title-quietly': [{ kind: 'LEVEL', target: 3 }, { kind: 'QUESTS', target: 10 }],
  'outfit-arcane-robes': [{ kind: 'LEVEL', target: 3 }, { kind: 'QUESTS', target: 8 }],
  'outfit-ember-cloak': [{ kind: 'LEVEL', target: 4 }, { kind: 'QUESTS', target: 12 }],
  'outfit-celestial': [{ kind: 'LEVEL', target: 6 }, { kind: 'QUESTS', target: 25 }],
  'companion-moon-wolf': [{ kind: 'LEVEL', target: 3 }],
  'companion-arcane-owl': [{ kind: 'QUESTS', target: 12 }],
  'companion-ember-drake': [{ kind: 'LEVEL', target: 6 }, { kind: 'STREAK', target: 5 }],
  'companion-celestial-raven': [{ kind: 'LEVEL', target: 5 }, { kind: 'QUESTS', target: 20 }],
  'aura-ember': [{ kind: 'LEVEL', target: 3 }],
  'aura-starlight': [{ kind: 'LEVEL', target: 6 }, { kind: 'QUESTS', target: 25 }],
  'aura-resolve': [{ kind: 'LEVEL', target: 8 }, { kind: 'QUESTS', target: 40 }, { kind: 'STREAK', target: 7 }],
  'title-celestial-wanderer': [{ kind: 'LEVEL', target: 7 }, { kind: 'QUESTS', target: 30 }, { kind: 'STREAK', target: 7 }],
  'title-flame-endures': [{ kind: 'COLLECTION', key: 'emberbound' }],
})

const MERCHANT_ONLY = new Set(['companion-celestial-raven', 'aura-resolve'])

const COLLECTIONS = Object.freeze([
  {
    key: 'emberbound',
    name: 'Emberbound Collection',
    description: 'A set for adventurers who keep one stubborn spark alive.',
    skus: ['frame-ember', 'theme-ember', 'outfit-ember-cloak', 'companion-ember-drake', 'aura-ember'],
    reward: 'Reveals the Mythic title “The Flame That Endures”',
  },
  {
    key: 'moonlit',
    name: 'Moonlit Collection',
    description: 'Quiet treasures for the hours when the road belongs to you alone.',
    skus: ['frame-moonlit', 'theme-moonlit', 'companion-moon-wolf', 'aura-starlight'],
    reward: 'Completing the set marks you as a collector of the night road',
  },
])

function stableHash(value) {
  let hash = 2166136261
  for (const char of value) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function chooseRotating(items, key, count) {
  return [...items]
    .sort((a, b) => stableHash(`${key}:${a.sku}`) - stableHash(`${key}:${b.sku}`))
    .slice(0, Math.min(count, items.length))
}

function currentStreak(activeDates, today) {
  const set = new Set(activeDates)
  let cursor = set.has(today) ? today : shiftCalendarDate(today, -1)
  if (!set.has(cursor)) return 0
  let length = 0
  while (set.has(cursor)) {
    length += 1
    cursor = shiftCalendarDate(cursor, -1)
  }
  return length
}

function requirementState(requirement, profile, collections) {
  if (requirement.kind === 'LEVEL') {
    return { key: `level-${requirement.target}`, label: `Level ${requirement.target}`, met: profile.level >= requirement.target, current: profile.level, target: requirement.target }
  }
  if (requirement.kind === 'QUESTS') {
    return { key: `quests-${requirement.target}`, label: `${requirement.target} quests completed`, met: profile.completedQuests >= requirement.target, current: profile.completedQuests, target: requirement.target }
  }
  if (requirement.kind === 'STREAK') {
    return { key: `streak-${requirement.target}`, label: `${requirement.target}-day streak`, met: profile.currentStreak >= requirement.target, current: profile.currentStreak, target: requirement.target }
  }
  const collection = collections.find(({ key }) => key === requirement.key)
  return {
    key: `collection-${requirement.key}`,
    label: `${collection?.name || 'Collection'} complete`,
    met: Boolean(collection?.complete),
    current: collection?.owned || 0,
    target: collection?.total || 1,
  }
}

export function buildMarketplaceContext({ items, ownedIds, totalXp, completedQuests, activeDates, today }) {
  const ownedSkus = new Set(items.filter((item) => ownedIds.has(item.id)).map((item) => item.sku))
  const profile = {
    level: levelProgress(totalXp).level,
    completedQuests,
    currentStreak: currentStreak(activeDates, today),
  }
  const collections = COLLECTIONS.map((collection) => {
    const owned = collection.skus.filter((sku) => ownedSkus.has(sku)).length
    return {
      ...collection,
      owned,
      total: collection.skus.length,
      percent: Math.round((owned / collection.skus.length) * 100),
      complete: owned === collection.skus.length,
    }
  })

  const permanent = items.filter((item) => !MERCHANT_ONLY.has(item.sku))
  // Daily discounts only rotate through the V2 catalog so legacy prices remain stable for
  // existing clients/tests while the new marketplace still gains a daily reason to return.
  const dailyPool = permanent.filter((item) => item.sortOrder >= 130)
  const daily = chooseRotating(dailyPool, `daily:${today}`, 3)
  const dailyIds = new Set(daily.map((item) => item.id))
  const weeklyPool = permanent.filter((item) => item.rarity === 'LEGENDARY')
  const weekKey = `${today.slice(0, 4)}:${Math.ceil(Number(today.slice(5, 7)) * 4.35)}:${Math.ceil(Number(today.slice(8, 10)) / 7)}`
  const weeklyLegend = chooseRotating(weeklyPool, `weekly:${weekKey}`, 1)[0] || null
  const merchantActive = Number(today.replaceAll('-', '')) % 4 !== 0
  const merchantItems = items.filter((item) => MERCHANT_ONLY.has(item.sku))

  const byId = new Map()
  for (const item of items) {
    const requirements = (REQUIREMENTS[item.sku] || []).map((requirement) => requirementState(requirement, profile, collections))
    const merchantOnly = MERCHANT_ONLY.has(item.sku)
    const available = !merchantOnly || merchantActive
    const discountPercent = dailyIds.has(item.id) ? 15 : 0
    const price = discountPercent ? Math.max(1, Math.floor(item.price * (100 - discountPercent) / 100)) : item.price
    byId.set(item.id, {
      requirements,
      locked: requirements.some((requirement) => !requirement.met),
      merchantOnly,
      available,
      discountPercent,
      basePrice: item.price,
      price,
      marketTag: merchantOnly ? 'MERCHANT' : weeklyLegend?.id === item.id ? 'WEEKLY' : dailyIds.has(item.id) ? 'DAILY' : null,
      marketLabel: merchantOnly ? 'Wandering merchant' : weeklyLegend?.id === item.id ? 'Weekly legend' : dailyIds.has(item.id) ? '15% daily deal' : null,
    })
  }

  return {
    today,
    profile,
    collections,
    byId,
    dailyIds: daily.map((item) => item.id),
    weeklyLegendId: weeklyLegend?.id || null,
    wanderingMerchant: { active: merchantActive, itemIds: merchantItems.map((item) => item.id) },
  }
}
