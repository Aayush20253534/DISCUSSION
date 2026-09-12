import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  calendarDateSchema,
  questCreateSchema,
  questListSchema,
  todayInTimezone,
  formatQuestDate,
} from '../src/index.js'

test('quest defaults are typed, bounded, and reject client-controlled ownership or rewards', () => {
  const filters = questListSchema.parse({})
  assert.equal(filters.page, 1)
  assert.equal(filters.limit, 12)
  const minimal = {
    requestId: '1f42f0ed-ddb5-4793-8b43-580f096d41d1',
    title: 'Read a page',
    attribute: 'INTELLECT',
  }
  const quest = questCreateSchema.parse(minimal)
  assert.equal(quest.dueDate, null)
  assert.equal(quest.estimatedMinutes, null)
  assert.equal(quest.difficulty, 'EASY')
  assert.equal(questCreateSchema.safeParse({ ...minimal, userId: 'another-user' }).success, false)
  assert.equal(questCreateSchema.safeParse({ ...minimal, gold: 100 }).success, false)
})
test('due dates remain dates and calendar boundaries follow the stored timezone', () => {
  assert.equal(calendarDateSchema.safeParse('2028-02-29').success, true)
  assert.equal(calendarDateSchema.safeParse('2027-02-29').success, false)
  assert.equal(calendarDateSchema.safeParse('2026-04-31').success, false)
  const instant = new Date('2026-09-12T18:20:00Z')
  assert.equal(todayInTimezone('Asia/Kathmandu', instant), '2026-09-13')
  assert.equal(todayInTimezone('America/Los_Angeles', instant), '2026-09-12')
  assert.equal(todayInTimezone('America/New_York', new Date('2026-03-08T07:30:00Z')), '2026-03-08')
  assert.equal(formatQuestDate('2028-02-29'), '29 Feb 2028')
})
