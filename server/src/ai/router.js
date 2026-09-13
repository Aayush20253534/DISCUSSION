import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import {
  characterProgress,
  questIdSchema,
  questMasterRequestSchema,
  questVerificationRequestSchema,
  todayInTimezone,
} from '@life-rpg/shared'
import { createAuthentication } from '../auth/middleware.js'
import { createSecurity } from '../auth/security.js'
import { AppError, validate } from '../lib/errors.js'
import { generateQuestPlan, questMasterAvailability } from './quest-master.js'
import {
  createQuestVerificationToken,
  questVerificationAvailability,
  verifyQuestEvidence,
} from './quest-verification.js'

function compactActiveQuest(quest) {
  return {
    title: quest.title,
    attribute: quest.attribute,
    difficulty: quest.difficulty,
    dueDate: quest.dueDate?.toISOString().slice(0, 10) || null,
  }
}

const dateValue = (value) => new Date(`${value}T00:00:00.000Z`)

export function createAiRouter({
  config,
  database,
  clock = () => new Date(),
  logger = () => {},
  questMaster = generateQuestPlan,
  questVerifier = verifyQuestEvidence,
}) {
  const router = Router()
  const db = database.prisma
  const security = createSecurity(config)
  const { requireConfigured, requireAuth } = createAuthentication({ config, database, security })

  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })
  router.use(requireConfigured, requireAuth)

  router.get('/quest-master/status', (_req, res) => {
    const availability = questMasterAvailability(config)
    res.json({
      data: {
        available: availability.available,
        providers: availability.providers,
      },
    })
  })

  router.post(
    '/quest-master/generate',
    rateLimit({
      windowMs: 10 * 60 * 1000,
      limit: 10,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: (req, res) =>
        res.status(429).json({
          error: {
            code: 'AI_RATE_LIMITED',
            message: 'The Quest Master needs a short rest. Try again in a few minutes.',
            requestId: req.requestId,
          },
        }),
    }),
    security.requireCsrf,
    async (req, res) => {
      const input = validate(questMasterRequestSchema, req.body)
      const userId = req.auth.userId
      const now = new Date(clock())
      const account = await db.user.findUnique({
        where: { id: userId },
        select: {
          timezone: true,
          character: {
            select: {
              totalXp: true,
              attributes: { select: { key: true, xp: true } },
            },
          },
        },
      })
      if (!account?.character)
        throw new AppError(403, 'ONBOARDING_REQUIRED', 'Create your character first.')

      const [activeQuests, recentCompletions] = await Promise.all([
        db.quest.findMany({
          where: { userId, status: 'ACTIVE' },
          select: {
            title: true,
            attribute: true,
            difficulty: true,
            dueDate: true,
          },
          orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
          take: 12,
        }),
        db.questCompletion.findMany({
          where: { userId },
          select: { attribute: true },
          orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
          take: 12,
        }),
      ])

      const progress = characterProgress(account.character)
      const weakestAttributes = [...progress.attributes]
        .sort((a, b) => a.progression.level - b.progression.level || a.xp - b.xp)
        .slice(0, 2)
        .map((attribute) => attribute.key)
      const recentCompletedAttributes = recentCompletions.map((item) => item.attribute)
      const today = todayInTimezone(account.timezone, now)

      const plan = await questMaster({
        config,
        input,
        context: {
          today,
          characterLevel: progress.progression.level,
          weakestAttributes,
          recentCompletedAttributes,
          activeQuests: activeQuests.map(compactActiveQuest),
        },
        logger,
      })
      res.json({ data: plan })
    },
  )


  router.get('/quest-verification/status', (_req, res) => {
    res.json({ data: questVerificationAvailability(config) })
  })

  router.post(
    '/quest-verification/:id',
    rateLimit({
      windowMs: 10 * 60 * 1000,
      limit: 8,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: (req, res) =>
        res.status(429).json({
          error: {
            code: 'AI_RATE_LIMITED',
            message: 'Gemini has inspected enough evidence for the moment. Try again shortly.',
            requestId: req.requestId,
          },
        }),
    }),
    security.requireCsrf,
    async (req, res) => {
      const questId = validate(questIdSchema, req.params.id)
      const input = validate(questVerificationRequestSchema, req.body)
      const quest = await db.quest.findFirst({
        where: { id: questId, userId: req.auth.userId },
        select: {
          id: true,
          title: true,
          description: true,
          attribute: true,
          difficulty: true,
          recurrence: true,
          status: true,
          revision: true,
          estimatedMinutes: true,
          dueDate: true,
          scheduleStartDate: true,
          scheduleTimezone: true,
        },
      })
      if (!quest) throw new AppError(404, 'QUEST_NOT_FOUND', 'This quest is no longer available.')
      if (quest.status !== 'ACTIVE')
        throw new AppError(409, 'QUEST_UNAVAILABLE', 'Only an active quest can be verified.')
      if (quest.revision !== input.revision)
        throw new AppError(
          409,
          'QUEST_CHANGED',
          'This quest changed. Load the latest version before verifying evidence.',
        )
      if (quest.recurrence === 'DAILY') {
        const scheduledDateLabel = todayInTimezone(quest.scheduleTimezone, new Date(clock()))
        if (
          quest.scheduleStartDate &&
          scheduledDateLabel < quest.scheduleStartDate.toISOString().slice(0, 10)
        )
          throw new AppError(409, 'QUEST_NOT_SCHEDULED', 'This daily quest is not available yet.')
        const alreadyRecorded = await db.questCompletion.findFirst({
          where: {
            originalQuestId: questId,
            userId: req.auth.userId,
            recurrence: 'DAILY',
            scheduledDate: dateValue(scheduledDateLabel),
          },
          select: { id: true },
        })
        if (alreadyRecorded)
          throw new AppError(
            409,
            'QUEST_ALREADY_RECORDED',
            'This daily quest is already recorded for the current scheduled day.',
          )
      }

      const result = await questVerifier({
        config,
        quest,
        image: input.image,
        logger,
      })
      const verificationToken =
        result.verdict === 'VERIFIED'
          ? createQuestVerificationToken(config, {
              userId: req.auth.userId,
              questId,
              revision: quest.revision,
            })
          : null
      res.json({
        data: {
          ...result,
          verificationToken,
        },
      })
    },
  )

  return router
}
