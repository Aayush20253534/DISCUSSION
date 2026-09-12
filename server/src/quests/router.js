import { createHash } from 'node:crypto'
import { Router } from 'express'
import {
  questCreateSchema,
  questUpdateSchema,
  questDeleteSchema,
  questIdSchema,
  questListSchema,
  todayInTimezone,
} from '@life-rpg/shared'
import { createAuthentication } from '../auth/middleware.js'
import { createSecurity } from '../auth/security.js'
import { AppError, validate } from '../lib/errors.js'

const select = {
  id: true,
  title: true,
  description: true,
  attribute: true,
  difficulty: true,
  status: true,
  estimatedMinutes: true,
  dueDate: true,
  revision: true,
  createdAt: true,
  updatedAt: true,
}
const notFound = () => new AppError(404, 'QUEST_NOT_FOUND', 'This quest is no longer available.')
const stale = () =>
  new AppError(
    409,
    'QUEST_CHANGED',
    'This quest changed in another tab. Load the latest version before saving again.',
  )
const dateValue = (value) => (value ? new Date(`${value}T00:00:00.000Z`) : null)
const serialize = (quest) => ({
  ...quest,
  dueDate: quest.dueDate?.toISOString().slice(0, 10) || null,
})
const escapeLike = (value) => value.replace(/[\\%_]/g, '\\$&')

export function createQuestRouter({ config, database }) {
  const router = Router()
  const db = database.prisma
  const security = createSecurity(config)
  const { requireConfigured, requireAuth } = createAuthentication({ config, database, security })
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })
  router.use(requireConfigured, requireAuth)
  router.use(async (req, _res, next) => {
    const user = await db.user.findUnique({
      where: { id: req.auth.userId },
      select: { timezone: true, character: { select: { id: true } } },
    })
    if (!user?.character)
      throw new AppError(
        403,
        'ONBOARDING_REQUIRED',
        'Finish creating your character to open the journal.',
      )
    req.questToday = todayInTimezone(user.timezone)
    req.questTimezone = user.timezone
    next()
  })
  router.get('/summary', async (req, res) => {
    const owned = { userId: req.auth.userId }
    const active = { ...owned, status: 'ACTIVE' }
    const today = dateValue(req.questToday)
    const [activeCount, archivedCount, dueToday, overdue, byAttribute] = await db.$transaction(
      [
        db.quest.count({ where: active }),
        db.quest.count({ where: { ...owned, status: 'ARCHIVED' } }),
        db.quest.count({ where: { ...active, dueDate: today } }),
        db.quest.count({ where: { ...active, dueDate: { lt: today } } }),
        db.quest.groupBy({ by: ['attribute'], where: active, _count: { _all: true } }),
      ],
      { isolationLevel: 'RepeatableRead' },
    )
    res.json({
      data: {
        active: activeCount,
        archived: archivedCount,
        dueToday,
        overdue,
        byAttribute: Object.fromEntries(byAttribute.map((row) => [row.attribute, row._count._all])),
        today: req.questToday,
        timezone: req.questTimezone,
      },
    })
  })
  router.get('/', async (req, res) => {
    const query = validate(questListSchema, req.query)
    const where = { userId: req.auth.userId }
    for (const key of ['attribute', 'difficulty', 'status'])
      if (query[key] !== 'ALL') where[key] = query[key]
    if (query.q)
      where.OR = ['title', 'description'].map((key) => ({
        [key]: { contains: escapeLike(query.q), mode: 'insensitive' },
      }))
    const today = dateValue(req.questToday)
    if (query.due === 'TODAY') where.dueDate = today
    if (query.due === 'OVERDUE') where.dueDate = { lt: today }
    if (query.due === 'UPCOMING') where.dueDate = { gt: today }
    if (query.due === 'UNSCHEDULED') where.dueDate = null
    const orderBy = {
      NEWEST: [{ createdAt: 'desc' }, { id: 'desc' }],
      OLDEST: [{ createdAt: 'asc' }, { id: 'asc' }],
      DUE: [{ dueDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }, { id: 'desc' }],
      TITLE: [{ title: 'asc' }, { id: 'asc' }],
    }[query.sort]
    const result = await db.$transaction(
      async (tx) => {
        const total = await tx.quest.count({ where })
        const pages = Math.max(1, Math.ceil(total / query.limit))
        const page = Math.min(query.page, pages)
        const quests = await tx.quest.findMany({
          where,
          select,
          orderBy,
          take: query.limit,
          skip: (page - 1) * query.limit,
        })
        return {
          quests: quests.map(serialize),
          pagination: { page, limit: query.limit, total, pages },
          today: req.questToday,
          timezone: req.questTimezone,
        }
      },
      { isolationLevel: 'RepeatableRead' },
    )
    res.json({ data: result })
  })
  router.get('/:id', async (req, res) => {
    const id = validate(questIdSchema, req.params.id)
    const quest = await db.quest.findFirst({ where: { id, userId: req.auth.userId }, select })
    if (!quest) throw notFound()
    res.json({ data: { quest: serialize(quest) } })
  })
  router.post('/', security.requireCsrf, async (req, res) => {
    const { requestId, ...input } = validate(questCreateSchema, req.body)
    const requestHash = createHash('sha256').update(JSON.stringify(input)).digest('hex')
    let quest
    let created = true
    try {
      quest = await db.quest.create({
        data: {
          ...input,
          dueDate: dateValue(input.dueDate),
          userId: req.auth.userId,
          requestId,
          requestHash,
        },
        select,
      })
    } catch (error) {
      if (error.code !== 'P2002') throw error
      const existing = await db.quest.findUnique({
        where: { userId_requestId: { userId: req.auth.userId, requestId } },
        select: { ...select, requestHash: true },
      })
      if (!existing) throw error
      if (existing.requestHash !== requestHash)
        throw new AppError(
          409,
          'QUEST_CREATE_CONFLICT',
          'A quest was already saved from this draft. Reopen the journal before creating another.',
        )
      delete existing.requestHash
      quest = existing
      created = false
    }
    res.status(created ? 201 : 200).json({ data: { quest: serialize(quest) } })
  })
  router.patch('/:id', security.requireCsrf, async (req, res) => {
    const id = validate(questIdSchema, req.params.id)
    const { revision, ...input } = validate(questUpdateSchema, req.body)
    if ('dueDate' in input) input.dueDate = dateValue(input.dueDate)
    const owned = { id, userId: req.auth.userId }
    const quest = await db.$transaction(async (tx) => {
      const result = await tx.quest.updateMany({
        where: { ...owned, revision },
        data: { ...input, revision: { increment: 1 } },
      })
      if (result.count !== 1) {
        if (!(await tx.quest.findFirst({ where: owned, select: { id: true } }))) throw notFound()
        throw stale()
      }
      return tx.quest.findFirst({ where: owned, select })
    })
    res.json({ data: { quest: serialize(quest) } })
  })
  router.delete('/:id', security.requireCsrf, async (req, res) => {
    const id = validate(questIdSchema, req.params.id)
    const { revision } = validate(questDeleteSchema, req.body)
    const owned = { id, userId: req.auth.userId }
    await db.$transaction(async (tx) => {
      const result = await tx.quest.deleteMany({ where: { ...owned, revision } })
      if (result.count !== 1) {
        if (!(await tx.quest.findFirst({ where: owned, select: { id: true } }))) throw notFound()
        throw stale()
      }
    })
    res.json({ data: { deleted: true, id } })
  })
  return router
}
