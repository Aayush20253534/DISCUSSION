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

test('account settings contracts keep profile fields bounded and require a genuinely new password', async () => {
  const { profileSettingsSchema, changePasswordSchema } = await import('../src/index.js')
  assert.equal(
    profileSettingsSchema.parse({ displayName: '  Explorer  ', timezone: 'Asia/Kathmandu' }).displayName,
    'Explorer',
  )
  assert.equal(
    profileSettingsSchema.safeParse({ displayName: 'Explorer', timezone: 'Moon/Base' }).success,
    false,
  )
  assert.equal(
    changePasswordSchema.safeParse({
      currentPassword: 'A sufficiently long password',
      newPassword: 'A sufficiently long password',
    }).success,
    false,
  )
  assert.equal(
    changePasswordSchema.safeParse({
      currentPassword: 'old password',
      newPassword: 'A different and long password',
      role: 'ADMIN',
    }).success,
    false,
  )
})

test('AI quest verification contracts bound image input and verdict output', async () => {
  const { questVerificationRequestSchema, questVerificationResultSchema } = await import('../src/index.js')
  const image = { mimeType: 'image/webp', data: 'a'.repeat(100) }
  assert.equal(
    questVerificationRequestSchema.parse({ revision: 2, image }).image.mimeType,
    'image/webp',
  )
  assert.equal(
    questVerificationRequestSchema.safeParse({ revision: 2, image: { ...image, mimeType: 'image/svg+xml' } }).success,
    false,
  )
  assert.equal(
    questVerificationRequestSchema.safeParse({ revision: 2, image: { ...image, data: 'not base64' } }).success,
    false,
  )
  assert.equal(
    questVerificationResultSchema.parse({
      verdict: 'VERIFIED',
      confidence: 94,
      summary: 'The screenshot shows the finished work.',
      evidence: ['Visible finished output'],
      concerns: [],
    }).verdict,
    'VERIFIED',
  )
})
