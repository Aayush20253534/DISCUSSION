import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { characterProgress, questMasterRequestSchema, todayInTimezone } from '@life-rpg/shared'
import { createAuthentication } from '../auth/middleware.js'
import { createSecurity } from '../auth/security.js'
import { AppError, validate } from '../lib/errors.js'
import { generateQuestPlan, questMasterAvailability } from './quest-master.js'

function compactActiveQuest(quest) {
  return {
    title: quest.title,
    attribute: quest.attribute,
    difficulty: quest.difficulty,
    dueDate: quest.dueDate?.toISOString().slice(0, 10) || null,
  }
}

export function createAiRouter({
  config,
  database,
  clock = () => new Date(),
  logger = () => {},
  questMaster = generateQuestPlan,
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

  return router
}
