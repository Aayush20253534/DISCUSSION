import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  activityDaySchema,
  activityQuerySchema,
  formatActivityDate,
  monthDates,
  shiftCalendarDate,
  shiftCalendarMonth,
  todayInTimezone,
} from '../src/index.js'

test('calendar arithmetic handles leap centuries, month and year boundaries without local DST shifts', () => {
  assert.equal(monthDates('2000-02').length, 29)
  assert.equal(monthDates('2100-02').length, 28)
  assert.equal(monthDates('2028-04').length, 30)
  assert.equal(shiftCalendarDate('2028-03-01', -1), '2028-02-29')
  assert.equal(shiftCalendarDate('2028-12-31', 1), '2029-01-01')
  assert.equal(shiftCalendarDate('2028-03-12', 1), '2028-03-13')
  assert.equal(shiftCalendarMonth('2028-01', -1), '2027-12')
  assert.equal(shiftCalendarMonth('2028-12', 1), '2029-01')
  assert.match(formatActivityDate('2028-02-29'), /29 February 2028/)
})
test('activity inputs use real calendar dates and bounded pagination', () => {
  assert.equal(activityQuerySchema.safeParse({ month: '2028-02' }).success, true)
  assert.equal(activityQuerySchema.safeParse({ month: '2028-02-01' }).success, false)
  assert.equal(activityDaySchema.safeParse({ date: '2028-02-29' }).success, true)
  assert.equal(activityDaySchema.safeParse({ date: '2027-02-29' }).success, false)
  assert.equal(activityDaySchema.safeParse({ date: '2028-02-29', limit: 1000 }).success, false)
  assert.equal(
    activityDaySchema.safeParse({ date: '2028-02-29', today: '2029-01-01' }).success,
    false,
  )
})
test('today follows timezone boundaries at both spring-forward and fall-back', () => {
  const zone = 'America/New_York'
  for (const instant of ['2028-03-12T06:59:59Z', '2028-03-12T07:00:00Z'])
    assert.equal(todayInTimezone(zone, new Date(instant)), '2028-03-12')
  for (const instant of ['2028-11-05T05:59:59Z', '2028-11-05T06:00:00Z'])
    assert.equal(todayInTimezone(zone, new Date(instant)), '2028-11-05')
  assert.equal(todayInTimezone(zone, new Date('2028-11-06T04:59:59Z')), '2028-11-05')
  assert.equal(todayInTimezone(zone, new Date('2028-11-06T05:00:00Z')), '2028-11-06')
})
