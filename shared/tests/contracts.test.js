import { test } from 'node:test'
import assert from 'node:assert/strict'
import { attributeSchema, displayNameSchema, timezoneSchema } from '../src/index.js'

test('shared validation rejects unsupported attributes and empty or oversized names', () => {
  assert.equal(attributeSchema.parse('INTELLECT'), 'INTELLECT')
  assert.equal(attributeSchema.safeParse('ADMIN').success, false)
  assert.equal(displayNameSchema.parse('  Wanderer  '), 'Wanderer')
  assert.equal(displayNameSchema.safeParse('   ').success, false)
  assert.equal(displayNameSchema.safeParse('a'.repeat(41)).success, false)
})

test('timezone validation accepts IANA identifiers rather than invented zones', () => {
  assert.equal(timezoneSchema.parse('Asia/Kolkata'), 'Asia/Kolkata')
  assert.equal(timezoneSchema.parse('Asia/Kathmandu'), 'Asia/Kathmandu')
  assert.equal(timezoneSchema.safeParse('Moon/Secret').success, false)
})
