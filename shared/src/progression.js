import { z } from 'zod'

export const REWARD_RULES_VERSION = 1
export const MAX_STORED_POINTS = 2147483647
export const QUEST_REWARDS = Object.freeze({
  EASY: Object.freeze({ xp: 25, gold: 5, attributeXp: 25 }),
  MEDIUM: Object.freeze({ xp: 60, gold: 12, attributeXp: 60 }),
  HARD: Object.freeze({ xp: 120, gold: 24, attributeXp: 120 }),
})

// Level L costs base * L XP to leave. Cumulative XP to enter L is base * L * (L - 1) / 2.
// Levels are derived from saved XP; there is no independently editable level column.
export function levelProgress(totalXp, base = 100) {
  if (!Number.isSafeInteger(totalXp) || totalXp < 0 || totalXp > MAX_STORED_POINTS)
    throw new RangeError('XP must be a nonnegative PostgreSQL integer.')
  if (![50, 100].includes(base)) throw new RangeError('Use the character or attribute level curve.')
  const threshold = (level) => (base * level * (level - 1)) / 2
  let level = Math.floor((1 + Math.sqrt(1 + (8 * totalXp) / base)) / 2)
  // Guard floating-point rounding at exact thresholds.
  while (threshold(level + 1) <= totalXp) level++
  while (threshold(level) > totalXp) level--
  const levelStartXp = threshold(level)
  const nextLevelXp = threshold(level + 1)
  const xpIntoLevel = totalXp - levelStartXp
  const xpForNextLevel = nextLevelXp - levelStartXp
  return {
    level,
    totalXp,
    levelStartXp,
    nextLevelXp,
    xpIntoLevel,
    xpForNextLevel,
    xpRemaining: nextLevelXp - totalXp,
    percent: (xpIntoLevel / xpForNextLevel) * 100,
  }
}

export function characterProgress(character) {
  return {
    ...character,
    progression: levelProgress(character.totalXp),
    attributes: character.attributes.map((attribute) => ({
      ...attribute,
      progression: levelProgress(attribute.xp, 50),
    })),
  }
}

export const questCompleteSchema = z
  .object({
    revision: z
      .number()
      .int()
      .min(1)
      .max(MAX_STORED_POINTS - 1),
  })
  .strict()
const integerParam = (fallback, max) =>
  z
    .string()
    .regex(/^[1-9]\d*$/)
    .transform(Number)
    .pipe(z.number().int().min(1).max(max))
    .default(fallback)
export const completionHistorySchema = z
  .object({
    attribute: z
      .enum(['ALL', 'INTELLECT', 'STRENGTH', 'DISCIPLINE', 'CREATIVITY', 'VITALITY'])
      .default('ALL'),
    page: integerParam(1, 10000),
    limit: integerParam(8, 50),
  })
  .strict()

export function formatCompletionDate(value, timezone) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  }).format(new Date(value))
}
