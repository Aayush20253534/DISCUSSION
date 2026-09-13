import { Router } from 'express'
import {
  activityQuerySchema,
  activityDaySchema,
  monthDates,
  shiftCalendarDate,
  todayInTimezone,
} from '@life-rpg/shared'
import { createAuthentication } from '../auth/middleware.js'
import { AppError, validate } from '../lib/errors.js'
import { routeCacheKey, setCacheStatus } from '../lib/cache.js'
import {
  calendarString,
  completionSelect,
  serializeCompletion,
} from '../progression/presentation.js'

export function createActivityRouter({ config, database, clock = () => new Date(), cache }) {
  const router = Router()
  const db = database.prisma
  const { requireConfigured, requireAuth } = createAuthentication({ config, database })
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })
  router.use(requireConfigured, requireAuth)
  async function accountFor(tx, userId) {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { timezone: true, character: { select: { id: true } } },
    })
    if (!user?.character)
      throw new AppError(403, 'ONBOARDING_REQUIRED', 'Create your character first.')
    return { timezone: user.timezone, today: todayInTimezone(user.timezone, clock()) }
  }
  const rejectFuture = () => {
    throw new AppError(400, 'FUTURE_ACTIVITY', 'Choose today or an earlier date.')
  }
  router.get('/', async (req, res) => {
    const query = validate(activityQuerySchema, req.query)
    const userId = req.auth.userId
    const cached = await cache.getOrSet({
      userId,
      namespace: 'activity',
      key: routeCacheKey(req),
      ttlSeconds: Math.min(config.REDIS_CACHE_TTL_SECONDS * 2, 240),
      load: () =>
        db.$transaction(
          async (tx) => {
        const { timezone, today } = await accountFor(tx, userId)
        const month = query.month || today.slice(0, 7)
        if (month > today.slice(0, 7)) rejectFuture()
        const yesterday = shiftCalendarDate(today, -1)
        // Distinct date islands keep all-time streak work in PostgreSQL, with one small result.
        // Reading this data never changes rewards or rewrites the original completion date.
        const [streaks] = await tx.$queryRaw`
        WITH days AS (
          SELECT DISTINCT completed_date AS day FROM quest_completions
          WHERE user_id = ${userId}::uuid AND completed_date <= ${today}::date
        ), numbered AS (
          SELECT day, day - (row_number() OVER (ORDER BY day))::integer AS island FROM days
        ), runs AS (
          SELECT min(day) AS first, max(day) AS last, count(*)::integer AS length
          FROM numbered GROUP BY island
        )
        SELECT coalesce(max(length) FILTER (WHERE last >= ${yesterday}::date), 0)::integer AS "currentStreak",
          coalesce(max(length), 0)::integer AS "longestStreak",
          coalesce(sum(length), 0)::integer AS "totalActiveDays",
          min(first)::text AS "firstActiveDate", max(last)::text AS "lastActiveDate"
        FROM runs`
        const dates = monthDates(month)
        const weekStart = shiftCalendarDate(today, -6)
        const groups = await tx.questCompletion.groupBy({
          by: ['completedDate'],
          where: {
            userId,
            OR: [
              {
                completedDate: {
                  gte: new Date(`${dates[0]}T00:00:00Z`),
                  lte: new Date(`${dates.at(-1) > today ? today : dates.at(-1)}T00:00:00Z`),
                },
              },
              {
                completedDate: {
                  gte: new Date(`${weekStart}T00:00:00Z`),
                  lte: new Date(`${today}T00:00:00Z`),
                },
              },
            ],
          },
          _count: { _all: true },
          _sum: { xpAwarded: true, goldAwarded: true },
        })
        const byDate = new Map(groups.map((group) => [calendarString(group.completedDate), group]))
        const dayData = (date) => ({
          date,
          count: byDate.get(date)?._count._all || 0,
          xp: byDate.get(date)?._sum.xpAwarded || 0,
          gold: byDate.get(date)?._sum.goldAwarded || 0,
        })
        const days = dates.map(dayData)
        const week = Array.from({ length: 7 }, (_, index) =>
          dayData(shiftCalendarDate(weekStart, index)),
        )
        return {
          timezone,
          today,
          month,
          streaks: { ...streaks, todayCompletedCount: dayData(today).count },
          week,
          days,
          totals: days.reduce(
            (total, day) => ({
              activeDays: total.activeDays + Number(day.count > 0),
              completions: total.completions + day.count,
              xp: total.xp + day.xp,
              gold: total.gold + day.gold,
            }),
            { activeDays: 0, completions: 0, xp: 0, gold: 0 },
          ),
        }
          },
          { isolationLevel: 'RepeatableRead' },
        ),
    })
    setCacheStatus(res, cached.status)
    res.json({ data: cached.value })
  })
  router.get('/day', async (req, res) => {
    const query = validate(activityDaySchema, req.query)
    const userId = req.auth.userId
    const cached = await cache.getOrSet({
      userId,
      namespace: 'activity',
      key: routeCacheKey(req),
      ttlSeconds: Math.min(config.REDIS_CACHE_TTL_SECONDS * 2, 240),
      load: () =>
        db.$transaction(
          async (tx) => {
        const { timezone, today } = await accountFor(tx, userId)
        if (query.date > today) rejectFuture()
        const where = {
          userId,
          completedDate: new Date(`${query.date}T00:00:00Z`),
        }
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
          date: query.date,
          today,
          timezone,
          completions: completions.map(serializeCompletion),
          pagination: { total, page, pages, limit: query.limit },
        }
          },
          { isolationLevel: 'RepeatableRead' },
        ),
    })
    setCacheStatus(res, cached.status)
    res.json({ data: cached.value })
  })
  return router
}
