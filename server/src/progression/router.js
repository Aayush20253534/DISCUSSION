import { Router } from 'express'
import {
  characterProgress,
  completionHistorySchema,
  QUEST_REWARDS,
  REWARD_RULES_VERSION,
} from '@life-rpg/shared'
import { createAuthentication } from '../auth/middleware.js'
import { AppError, validate } from '../lib/errors.js'
import { characterSelect, completionSelect, serializeCompletion } from './presentation.js'

export function createProgressionRouter({ config, database }) {
  const router = Router()
  const db = database.prisma
  const { requireConfigured, requireAuth } = createAuthentication({ config, database })
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })
  router.use(requireConfigured, requireAuth)
  async function characterFor(tx, userId) {
    const character = await tx.character.findUnique({ where: { userId }, select: characterSelect })
    if (!character) throw new AppError(403, 'ONBOARDING_REQUIRED', 'Create your character first.')
    return character
  }
  router.get('/', async (req, res) => {
    const data = await db.$transaction(
      async (tx) => {
        const character = await characterFor(tx, req.auth.userId)
        const completedCount = await tx.questCompletion.count({
          where: { userId: req.auth.userId },
        })
        return {
          character: characterProgress(character),
          completedCount,
          rewards: QUEST_REWARDS,
          rulesVersion: REWARD_RULES_VERSION,
        }
      },
      { isolationLevel: 'RepeatableRead' },
    )
    res.json({ data })
  })
  router.get('/history', async (req, res) => {
    const query = validate(completionHistorySchema, req.query)
    const where = {
      userId: req.auth.userId,
      ...(query.attribute !== 'ALL' && { attribute: query.attribute }),
    }
    const data = await db.$transaction(
      async (tx) => {
        await characterFor(tx, req.auth.userId)
        const total = await tx.questCompletion.count({ where })
        const pages = Math.max(1, Math.ceil(total / query.limit))
        const page = Math.min(query.page, pages)
        const completions = await tx.questCompletion.findMany({
          where,
          select: completionSelect,
          orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
          take: query.limit,
          skip: (page - 1) * query.limit,
        })
        return {
          completions: completions.map(serializeCompletion),
          pagination: { page, limit: query.limit, total, pages },
        }
      },
      { isolationLevel: 'RepeatableRead' },
    )
    res.json({ data })
  })
  return router
}
