import test from 'node:test'
import assert from 'node:assert/strict'
import {
  levelProgress,
  QUEST_REWARDS,
  MAX_STORED_POINTS,
  questCompleteSchema,
  completionHistorySchema,
} from '../src/index.js'

test('character levels use cumulative nonlinear thresholds, including exact boundaries', () => {
  for (const [xp, level, into, needed] of [
    [0, 1, 0, 100],
    [99, 1, 99, 100],
    [100, 2, 0, 200],
    [299, 2, 199, 200],
    [300, 3, 0, 300],
    [600, 4, 0, 400],
  ]) {
    const progress = levelProgress(xp)
    assert.deepEqual(
      [progress.level, progress.xpIntoLevel, progress.xpForNextLevel],
      [level, into, needed],
    )
    assert.equal(progress.xpRemaining, needed - into)
    assert.ok(progress.percent >= 0 && progress.percent < 100)
  }
  for (let level = 1; level < 1000; level++) {
    const threshold = 50 * level * (level - 1)
    assert.equal(levelProgress(threshold).level, level)
    if (level > 1) assert.equal(levelProgress(threshold - 1).level, level - 1)
    assert.equal(levelProgress(threshold).xpForNextLevel, 100 * level)
  }
  const ceiling = levelProgress(MAX_STORED_POINTS)
  assert.ok(ceiling.levelStartXp <= MAX_STORED_POINTS && ceiling.nextLevelXp > MAX_STORED_POINTS)
  for (const value of [-1, 0.5, NaN, Infinity, '25', MAX_STORED_POINTS + 1])
    assert.throws(() => levelProgress(value), RangeError)
})

test('attributes level independently with increasing costs and rewards have a fixed versioned shape', () => {
  assert.equal(levelProgress(49, 50).level, 1)
  assert.equal(levelProgress(50, 50).level, 2)
  assert.equal(levelProgress(150, 50).level, 3)
  assert.equal(levelProgress(120, 50).xpRemaining, 30)
  assert.deepEqual(QUEST_REWARDS.HARD, { xp: 120, gold: 24, attributeXp: 120 })
  assert.ok(Object.isFrozen(QUEST_REWARDS.HARD))
})

test('completion accepts only a revision; history pagination and filters are bounded', () => {
  assert.equal(questCompleteSchema.safeParse({ revision: 1 }).success, true)
  for (const value of [
    {},
    { revision: 0 },
    { revision: '1' },
    { revision: 1, xp: 900 },
    { revision: 1, completedAt: '2026-01-01' },
    { revision: 1, userId: 'someone' },
  ])
    assert.equal(questCompleteSchema.safeParse(value).success, false)
  assert.deepEqual(completionHistorySchema.parse({}), { attribute: 'ALL', page: 1, limit: 8 })
  for (const value of [
    { page: '-1' },
    { limit: '51' },
    { attribute: 'ADMIN' },
    { userId: 'another' },
  ])
    assert.equal(completionHistorySchema.safeParse(value).success, false)
})
