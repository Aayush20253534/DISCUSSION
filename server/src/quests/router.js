import { createHash } from 'node:crypto'
import { Router } from 'express'
import {
  questCompleteSchema,
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

import { questSelect as select, serializeQuest as serialize } from './presentation.js'
import { completeQuest } from '../progression/complete.js'

const notFound = () => new AppError(404, 'QUEST_NOT_FOUND', 'This quest is no longer available.')
const stale = () =>
  new AppError(
    409,
    'QUEST_CHANGED',
    'This quest changed in another tab. Load the latest version before saving again.',
  )
const dateValue = (value) => (value ? new Date(`${value}T00:00:00.000Z`) : null)
const escapeLike = (value) => value.replace(/[\\%_]/g, '\\$&')
const dailyDueError = () =>
  new AppError(
    422,
    'VALIDATION_ERROR',
    'Please check the highlighted fields.',
    { dueDate: 'Daily quests repeat by schedule and cannot have a one-time due date.' },
  )

export function createQuestRouter({ config, database, clock = () => new Date() }) {
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
    req.questNow = new Date(clock())
    req.questToday = todayInTimezone(user.timezone, req.questNow)
    req.questTimezone = user.timezone
    next()
  })
  router.get('/summary', async (req, res) => {
    const owned = { userId: req.auth.userId }
    const active = { ...owned, status: 'ACTIVE' }
    const today = dateValue(req.questToday)
    const [
      activeCount,
      archivedCount,
      dueToday,
      overdue,
      byAttribute,
      completedCount,
      dailyCount,
      readyRows,
    ] = await db.$transaction(
      [
        db.quest.count({ where: active }),
        db.quest.count({ where: { ...owned, status: 'ARCHIVED' } }),
        db.quest.count({ where: { ...active, recurrence: 'ONCE', dueDate: today } }),
        db.quest.count({ where: { ...active, recurrence: 'ONCE', dueDate: { lt: today } } }),
        db.quest.groupBy({ by: ['attribute'], where: active, _count: { _all: true } }),
        db.quest.count({ where: { ...owned, status: 'COMPLETED' } }),
        db.quest.count({ where: { ...active, recurrence: 'DAILY' } }),
        db.$queryRaw`
          SELECT count(*)::integer AS count
          FROM quests q
          WHERE q.user_id = ${req.auth.userId}::uuid
            AND q.status = 'ACTIVE'
            AND q.recurrence = 'DAILY'
            AND q.schedule_start_date <= (${req.questNow}::timestamptz AT TIME ZONE q.schedule_timezone)::date
            AND NOT EXISTS (
              SELECT 1 FROM quest_completions c
              WHERE c.original_quest_id = q.id
                AND c.recurrence = 'DAILY'
                AND c.scheduled_date = (${req.questNow}::timestamptz AT TIME ZONE q.schedule_timezone)::date
            )`,
      ],
      { isolationLevel: 'RepeatableRead' },
    )
    res.json({
      data: {
        completed: completedCount,
        active: activeCount,
        archived: archivedCount,
        dueToday,
        overdue,
        daily: dailyCount,
        dailyReady: readyRows[0]?.count || 0,
        byAttribute: Object.fromEntries(byAttribute.map((row) => [row.attribute, row._count._all])),
        today: req.questToday,
        timezone: req.questTimezone,
      },
    })
  })
  router.get('/', async (req, res) => {
    const query = validate(questListSchema, req.query)
    const where = { userId: req.auth.userId }
    for (const key of ['attribute', 'difficulty', 'recurrence', 'status'])
      if (query[key] !== 'ALL') where[key] = query[key]
    if (query.q)
      where.OR = ['title', 'description'].map((key) => ({
        [key]: { contains: escapeLike(query.q), mode: 'insensitive' },
      }))
    const today = dateValue(req.questToday)
    if (query.due === 'TODAY') Object.assign(where, { recurrence: 'ONCE', dueDate: today })
    if (query.due === 'OVERDUE')
      Object.assign(where, { recurrence: 'ONCE', dueDate: { lt: today } })
    if (query.due === 'UPCOMING')
      Object.assign(where, { recurrence: 'ONCE', dueDate: { gt: today } })
    if (query.due === 'UNSCHEDULED') Object.assign(where, { recurrence: 'ONCE', dueDate: null })
    const orderBy = {
      NEWEST: [{ createdAt: 'desc' }, { id: 'desc' }],
      OLDEST: [{ createdAt: 'asc' }, { id: 'asc' }],
      DUE: [{ dueDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }, { id: 'desc' }],
      TITLE: [{ title: 'asc' }, { id: 'asc' }],
      COMPLETED: [{ completedAt: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
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
          quests: quests.map((quest) => serialize(quest, req.questNow)),
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
    res.json({ data: { quest: serialize(quest, req.questNow) } })
  })
  router.post('/', security.requireCsrf, async (req, res) => {
    const { requestId, ...input } = validate(questCreateSchema, req.body)
    const requestHash = createHash('sha256').update(JSON.stringify(input)).digest('hex')
    const daily = input.recurrence === 'DAILY'
    let quest
    let created = true
    try {
      quest = await db.quest.create({
        data: {
          ...input,
          dueDate: dateValue(input.dueDate),
          scheduleStartDate: daily ? dateValue(req.questToday) : null,
          scheduleTimezone: daily ? req.questTimezone : null,
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
    res.status(created ? 201 : 200).json({ data: { quest: serialize(quest, req.questNow) } })
  })
  router.post('/:id/complete', security.requireCsrf, async (req, res) => {
    const questId = validate(questIdSchema, req.params.id)
    const { revision } = validate(questCompleteSchema, req.body)
    const data = await completeQuest(db, {
      userId: req.auth.userId,
      questId,
      revision,
      timezone: req.questTimezone,
      now: req.questNow,
    })
    res.status(data.newlyCompleted ? 201 : 200).json({ data })
  })
  router.patch('/:id', security.requireCsrf, async (req, res) => {
    const id = validate(questIdSchema, req.params.id)
    const { revision, ...input } = validate(questUpdateSchema, req.body)
    const owned = { id, userId: req.auth.userId }
    const quest = await db.$transaction(async (tx) => {
      const locked =
        await tx.$queryRaw`SELECT id FROM quests WHERE id = ${id}::uuid AND user_id = ${req.auth.userId}::uuid FOR UPDATE`
      if (!locked.length) throw notFound()
      const current = await tx.quest.findFirst({
        where: owned,
        select: { status: true, recurrence: true, dueDate: true, revision: true },
      })
      if (!current) throw notFound()
      if (current.status === 'COMPLETED')
        throw new AppError(
          409,
          'QUEST_COMPLETED',
          'Completed quests keep their original details. Create a new quest for another attempt.',
        )
      if (current.revision !== revision) throw stale()

      const nextRecurrence = input.recurrence || current.recurrence
      const nextDueDate = 'dueDate' in input ? input.dueDate : current.dueDate
      if (nextRecurrence === 'DAILY' && nextDueDate) throw dailyDueError()

      const changes = { ...input }
      if ('dueDate' in changes) changes.dueDate = dateValue(changes.dueDate)
      if (input.recurrence && input.recurrence !== current.recurrence) {
        const historyCount = await tx.questCompletion.count({
          where: { originalQuestId: id, userId: req.auth.userId },
        })
        if (historyCount)
          throw new AppError(
            409,
            'QUEST_RECURRENCE_LOCKED',
            'A quest with completion history keeps its schedule. Create a new quest to use a different recurrence.',
          )
        if (input.recurrence === 'DAILY') {
          changes.dueDate = null
          changes.scheduleStartDate = dateValue(req.questToday)
          changes.scheduleTimezone = req.questTimezone
        } else {
          changes.scheduleStartDate = null
          changes.scheduleTimezone = null
        }
      }
      const result = await tx.quest.updateMany({
        where: { ...owned, revision, status: { in: ['ACTIVE', 'ARCHIVED'] } },
        data: { ...changes, revision: { increment: 1 } },
      })
      if (result.count !== 1) throw stale()
      return tx.quest.findFirst({ where: owned, select })
    })
    res.json({ data: { quest: serialize(quest, req.questNow) } })
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
