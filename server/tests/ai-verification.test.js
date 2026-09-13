import { after, before, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { verifyQuestEvidence } from '../src/ai/quest-verification.js'
import { parseEnv } from '../src/config/env.js'
import { testDatabase } from './helpers/database.js'
import { completeEmailVerification, createTestMailer } from './helpers/email.js'

const origin = 'http://localhost:5173'
const config = parseEnv({
  NODE_ENV: 'test',
  JWT_SECRET: 'ai-verification-test-secret-'.repeat(4),
  GEMINI_API_KEY: 'test-gemini-key',
})
let database, app, mailer, verificationResult

before(async () => {
  database = await testDatabase()
})

after(async () => {
  await database?.close()
})

beforeEach(async () => {
  await database.prisma.emailVerification.deleteMany()
  await database.prisma.user.deleteMany()
  mailer = createTestMailer()
  verificationResult = {
    verdict: 'VERIFIED',
    confidence: 96,
    summary: 'The image contains specific evidence matching the quest.',
    evidence: ['Relevant finished work is visible.'],
    concerns: [],
    provider: 'gemini',
    model: 'test-gemini',
  }
  app = createApp({
    config,
    database,
    logger: () => {},
    mailer,
    questVerifier: async ({ quest, image }) => {
      assert.equal(quest.title, 'Solve graph problems')
      assert.equal(image.mimeType, 'image/webp')
      assert.ok(image.data.length >= 100)
      return verificationResult
    },
  })
})

const mutate = (client, method, path, body) =>
  client.agent[method](`/api/v1${path}`)
    .set('Origin', origin)
    .set('X-CSRF-Token', client.csrf)
    .send(body)

async function actor(name = 'hero') {
  const agent = request.agent(app)
  const csrf = (await agent.get('/api/v1/auth/csrf').expect(200)).body.data.csrfToken
  const client = { agent, csrf }
  const started = await mutate(client, 'post', '/auth/signup', {
    email: `${name}@example.test`,
    displayName: name,
    password: 'An excellent adventure awaits',
  }).expect(202)
  client.user = (await completeEmailVerification(client, mutate, started, mailer)).body.data.user
  await mutate(client, 'put', '/me/onboarding', {
    displayName: name,
    avatarKey: 'wanderer',
    timezone: 'Asia/Kathmandu',
  }).expect(200)
  return client
}

async function quest(client) {
  return (
    await mutate(client, 'post', '/quests', {
      requestId: randomUUID(),
      title: 'Solve graph problems',
      description: 'Finish five graph problems and keep the final solutions visible.',
      attribute: 'INTELLECT',
      difficulty: 'HARD',
    }).expect(201)
  ).body.data.quest
}

const image = { mimeType: 'image/webp', data: 'a'.repeat(100) }

test('Gemini image verification has a longer timeout than text-only AI requests', () => {
  assert.equal(config.AI_REQUEST_TIMEOUT_MS, 12000)
  assert.equal(config.GEMINI_VERIFICATION_TIMEOUT_MS, 30000)
  assert.equal(config.GEMINI_VERIFICATION_FALLBACK_MODEL, 'gemini-2.5-flash')
  assert.ok(config.GEMINI_VERIFICATION_TIMEOUT_MS > config.AI_REQUEST_TIMEOUT_MS)
})

test('Gemini verification status is exposed only from server configuration', async () => {
  const client = await actor()
  const response = await client.agent.get('/api/v1/ai/quest-verification/status').expect(200)
  assert.equal(response.body.data.available, true)
  assert.equal(response.body.data.model, 'gemini-2.5-flash-lite')
  assert.equal(JSON.stringify(response.body).includes('test-gemini-key'), false)
})

test('verified evidence creates a short-lived completion token and persists an AI verified receipt', async () => {
  const client = await actor()
  const item = await quest(client)
  const verified = await mutate(client, 'post', `/ai/quest-verification/${item.id}`, {
    revision: item.revision,
    image,
  }).expect(200)

  assert.equal(verified.body.data.verdict, 'VERIFIED')
  assert.equal(verified.body.data.confidence, 96)
  assert.ok(verified.body.data.verificationToken)

  const completed = await mutate(client, 'post', `/quests/${item.id}/complete`, {
    revision: item.revision,
    verificationToken: verified.body.data.verificationToken,
  }).expect(201)
  assert.equal(completed.body.data.completion.aiVerified, true)

  const history = await client.agent.get('/api/v1/progress/history').expect(200)
  assert.equal(history.body.data.completions[0].aiVerified, true)
})

test('unclear or rejected evidence cannot mint a verified completion token', async () => {
  verificationResult = {
    ...verificationResult,
    verdict: 'UNCLEAR',
    confidence: 54,
    summary: 'The image is relevant but completion cannot be established.',
    evidence: ['Graph notes are visible.'],
    concerns: ['No finished solutions are visible.'],
  }
  const client = await actor()
  const item = await quest(client)
  const checked = await mutate(client, 'post', `/ai/quest-verification/${item.id}`, {
    revision: item.revision,
    image,
  }).expect(200)
  assert.equal(checked.body.data.verificationToken, null)

  const completed = await mutate(client, 'post', `/quests/${item.id}/complete`, {
    revision: item.revision,
  }).expect(201)
  assert.equal(completed.body.data.completion.aiVerified, false)
})

test('verification enforces ownership, current revision, image contract and CSRF', async () => {
  const owner = await actor('owner')
  const other = await actor('other')
  const item = await quest(owner)

  await mutate(other, 'post', `/ai/quest-verification/${item.id}`, {
    revision: item.revision,
    image,
  }).expect(404)

  const stale = await mutate(owner, 'post', `/ai/quest-verification/${item.id}`, {
    revision: item.revision + 1,
    image,
  }).expect(409)
  assert.equal(stale.body.error.code, 'QUEST_CHANGED')

  await mutate(owner, 'post', `/ai/quest-verification/${item.id}`, {
    revision: item.revision,
    image: { mimeType: 'image/svg+xml', data: 'a'.repeat(100) },
  }).expect(422)

  await owner.agent
    .post(`/api/v1/ai/quest-verification/${item.id}`)
    .set('Origin', origin)
    .send({ revision: item.revision, image })
    .expect(403)
})

test('tampered or mismatched verification tokens never mark a completion as verified', async () => {
  const client = await actor()
  const item = await quest(client)
  const checked = await mutate(client, 'post', `/ai/quest-verification/${item.id}`, {
    revision: item.revision,
    image,
  }).expect(200)

  const tokenParts = checked.body.data.verificationToken.split('.')
  tokenParts[2] = `${tokenParts[2][0] === 'a' ? 'b' : 'a'}${tokenParts[2].slice(1)}`
  const tampered = tokenParts.join('.')
  const invalid = await mutate(client, 'post', `/quests/${item.id}/complete`, {
    revision: item.revision,
    verificationToken: tampered,
  }).expect(409)
  assert.equal(invalid.body.error.code, 'QUEST_VERIFICATION_EXPIRED')

  const stored = await database.prisma.quest.findUnique({ where: { id: item.id } })
  assert.equal(stored.status, 'ACTIVE')
})


test('Gemini verifier sends inline image data and validates structured output conservatively', async () => {
  let requestBody
  const result = await verifyQuestEvidence({
    config,
    quest: {
      title: 'Solve graph problems',
      description: 'Finish five graph problems.',
      attribute: 'INTELLECT',
      difficulty: 'HARD',
      recurrence: 'ONCE',
      estimatedMinutes: 90,
      dueDate: null,
    },
    image,
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body)
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      verdict: 'VERIFIED',
                      confidence: 91,
                      summary: 'Finished graph solutions are clearly visible.',
                      evidence: ['Five completed graph solutions are visible.'],
                      concerns: [],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      }
    },
  })
  assert.equal(result.verdict, 'VERIFIED')
  assert.equal(requestBody.contents[0].parts[1].inlineData.mimeType, 'image/webp')
  assert.equal(requestBody.contents[0].parts[1].inlineData.data, image.data)
  assert.equal(requestBody.generationConfig.responseMimeType, 'application/json')
  assert.equal(requestBody.generationConfig.maxOutputTokens, 400)
  assert.equal(requestBody.generationConfig.thinkingConfig.thinkingBudget, 0)

  const cautious = await verifyQuestEvidence({
    config,
    quest: {
      title: 'Solve graph problems',
      description: '',
      attribute: 'INTELLECT',
      difficulty: 'HARD',
      recurrence: 'ONCE',
      estimatedMinutes: null,
      dueDate: null,
    },
    image,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    verdict: 'VERIFIED',
                    confidence: 61,
                    summary: 'The evidence is somewhat relevant.',
                    evidence: ['Some graph notes are visible.'],
                    concerns: [],
                  }),
                },
              ],
            },
          },
        ],
      }),
    }),
  })
  assert.equal(cautious.verdict, 'UNCLEAR')
  assert.match(cautious.concerns[0], /minimum confidence/i)
})

test('Gemini verification falls back from transient model overload without exceeding the request flow', async () => {
  const entries = []
  const urls = []
  let calls = 0

  const result = await verifyQuestEvidence({
    config,
    quest: {
      title: 'Solve graph problems',
      description: 'Finish five graph problems.',
      attribute: 'INTELLECT',
      difficulty: 'HARD',
      recurrence: 'ONCE',
      estimatedMinutes: 90,
      dueDate: null,
    },
    image,
    sleepImpl: async () => {},
    fetchImpl: async (url) => {
      urls.push(url)
      calls += 1
      if (calls === 1) {
        return {
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
          headers: { get: () => 'application/json; charset=UTF-8' },
          json: async () => ({
            error: {
              code: 503,
              status: 'UNAVAILABLE',
              message: 'This model is currently experiencing high demand.',
            },
          }),
        }
      }
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json; charset=UTF-8' },
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      verdict: 'VERIFIED',
                      confidence: 93,
                      summary: 'The fallback model found relevant completion evidence.',
                      evidence: ['Completed graph work is visible.'],
                      concerns: [],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      }
    },
    logger: (level, event, details) => entries.push({ level, event, ...details }),
  })

  assert.equal(calls, 2)
  assert.match(urls[0], /gemini-2\.5-flash-lite/)
  assert.match(urls[1], /gemini-2\.5-flash/)
  assert.equal(result.verdict, 'VERIFIED')
  assert.equal(result.model, 'gemini-2.5-flash')

  const retry = entries.find((entry) => entry.event === 'ai.quest_verification_provider_retry')
  assert.ok(retry)
  assert.equal(retry.status, 503)
  assert.equal(retry.providerStatus, 'UNAVAILABLE')
  assert.equal(retry.fallbackModel, 'gemini-2.5-flash')

  const recovered = entries.find((entry) => entry.event === 'ai.quest_verification_fallback_succeeded')
  assert.ok(recovered)
  assert.equal(recovered.model, 'gemini-2.5-flash')
})

test('Gemini provider failures log actionable error details without logging secrets or image data', async () => {
  const entries = []
  const secretApiKey = 'test-gemini-key-that-must-not-be-logged'
  const secretImageData = 'private-image-payload-'.repeat(20)
  const errorConfig = {
    ...config,
    GEMINI_API_KEY: secretApiKey,
  }

  await assert.rejects(
    () =>
      verifyQuestEvidence({
        config: errorConfig,
        quest: {
          title: 'Solve graph problems',
          description: 'Finish five graph problems.',
          attribute: 'INTELLECT',
          difficulty: 'HARD',
          recurrence: 'ONCE',
          estimatedMinutes: 90,
          dueDate: null,
        },
        image: { mimeType: 'image/webp', data: secretImageData },
        fetchImpl: async () => ({
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          headers: {
            get: (name) =>
              name.toLowerCase() === 'content-type' ? 'application/json; charset=UTF-8' : null,
          },
          json: async () => ({
            error: {
              code: 400,
              message: 'API key not valid. Please pass a valid API key.',
              status: 'INVALID_ARGUMENT',
              details: [
                {
                  '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
                  reason: 'API_KEY_INVALID',
                  domain: 'googleapis.com',
                  metadata: { service: 'generativelanguage.googleapis.com' },
                },
              ],
            },
          }),
        }),
        logger: (level, event, details) => entries.push({ level, event, ...details }),
      }),
    (error) => error?.code === 'AI_UNAVAILABLE' && error?.status === 503,
  )

  const failure = entries.find((entry) => entry.event === 'ai.quest_verification_provider_failed')
  assert.ok(failure)
  assert.equal(failure.provider, 'gemini')
  assert.equal(failure.model, 'gemini-2.5-flash-lite')
  assert.equal(failure.status, 400)
  assert.equal(failure.providerCode, 400)
  assert.equal(failure.providerStatus, 'INVALID_ARGUMENT')
  assert.equal(failure.providerReason, 'API_KEY_INVALID')
  assert.equal(failure.providerDomain, 'googleapis.com')
  assert.match(failure.message, /API key not valid/i)
  assert.equal(failure.imageMimeType, 'image/webp')
  assert.equal(failure.imageBase64Chars, secretImageData.length)

  const serialized = JSON.stringify(entries)
  assert.equal(serialized.includes(secretApiKey), false)
  assert.equal(serialized.includes(secretImageData), false)
})
