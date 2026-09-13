import { Router } from 'express'
import { characterProgress, shiftCalendarDate, todayInTimezone } from '@atlasborn/shared'
import { createAuthentication } from '../auth/middleware.js'
import { AppError } from '../lib/errors.js'
import { setCacheStatus } from '../lib/cache.js'
import {
  calendarString,
  characterSelect,
  completionSelect,
  serializeCompletion,
} from '../progression/presentation.js'
import { questSelect, serializeQuest } from '../quests/presentation.js'

const RECENT_COMPLETIONS = 5
const TODAY_QUESTS = 5

const dateValue = (date) => new Date(`${date}T00:00:00.000Z`)

function emptyStreaks() {
  return {
    currentStreak: 0,
    longestStreak: 0,
    totalActiveDays: 0,
    firstActiveDate: null,
    lastActiveDate: null,
    todayCompletedCount: 0,
  }
}

export function createDashboardRouter({ config, database, clock = () => new Date(), cache }) {
  const router = Router()
  const db = database.prisma
  const { requireConfigured, requireAuth } = createAuthentication({ config, database })

  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })
  router.use(requireConfigured, requireAuth)

  router.get('/', async (req, res) => {
    const userId = req.auth.userId
    const now = new Date(clock())
    const cached = await cache.getOrSet({
      userId,
      namespace: 'dashboard',
      key: 'overview',
      ttlSeconds: config.REDIS_CACHE_TTL_SECONDS,
      load: () =>
        db.$transaction(
          async (tx) => {
        const account = await tx.user.findUnique({
          where: { id: userId },
          select: { timezone: true, character: { select: characterSelect } },
        })
        if (!account?.character)
          throw new AppError(403, 'ONBOARDING_REQUIRED', 'Create your character first.')

        const timezone = account.timezone
        const today = todayInTimezone(timezone, now)
        const yesterday = shiftCalendarDate(today, -1)
        const weekStart = shiftCalendarDate(today, -6)
        const todayDate = dateValue(today)
        const weekStartDate = dateValue(weekStart)

        const [
          completedCount,
          activeCount,
          archivedCount,
          dueToday,
          overdue,
          dailyCount,
          readyRows,
          streakRows,
          weekGroups,
          recentCompletions,
          questRows,
        ] = await Promise.all([
          tx.questCompletion.count({ where: { userId } }),
          tx.quest.count({ where: { userId, status: 'ACTIVE' } }),
          tx.quest.count({ where: { userId, status: 'ARCHIVED' } }),
          tx.quest.count({
            where: { userId, status: 'ACTIVE', recurrence: 'ONCE', dueDate: todayDate },
          }),
          tx.quest.count({
            where: { userId, status: 'ACTIVE', recurrence: 'ONCE', dueDate: { lt: todayDate } },
          }),
          tx.quest.count({ where: { userId, status: 'ACTIVE', recurrence: 'DAILY' } }),
          tx.$queryRaw`
            SELECT count(*)::integer AS count
            FROM quests q
            WHERE q.user_id = ${userId}::uuid
              AND q.status = 'ACTIVE'
              AND q.recurrence = 'DAILY'
              AND q.schedule_start_date <= (${now}::timestamptz AT TIME ZONE q.schedule_timezone)::date
              AND NOT EXISTS (
                SELECT 1 FROM quest_completions c
                WHERE c.original_quest_id = q.id
                  AND c.recurrence = 'DAILY'
                  AND c.scheduled_date = (${now}::timestamptz AT TIME ZONE q.schedule_timezone)::date
              )`,
          tx.$queryRaw`
            WITH days AS (
              SELECT DISTINCT completed_date AS day
              FROM quest_completions
              WHERE user_id = ${userId}::uuid AND completed_date <= ${today}::date
            ), numbered AS (
              SELECT day, day - (row_number() OVER (ORDER BY day))::integer AS island FROM days
            ), runs AS (
              SELECT min(day) AS first, max(day) AS last, count(*)::integer AS length
              FROM numbered GROUP BY island
            )
            SELECT
              coalesce(max(length) FILTER (WHERE last >= ${yesterday}::date), 0)::integer AS "currentStreak",
              coalesce(max(length), 0)::integer AS "longestStreak",
              coalesce(sum(length), 0)::integer AS "totalActiveDays",
              min(first)::text AS "firstActiveDate",
              max(last)::text AS "lastActiveDate"
            FROM runs`,
          tx.questCompletion.groupBy({
            by: ['completedDate'],
            where: { userId, completedDate: { gte: weekStartDate, lte: todayDate } },
            _count: { _all: true },
            _sum: { xpAwarded: true, goldAwarded: true },
          }),
          tx.questCompletion.findMany({
            where: { userId },
            select: completionSelect,
            orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
            take: RECENT_COMPLETIONS,
          }),
          tx.$queryRaw`
            SELECT q.id::text AS id
            FROM quests q
            WHERE q.user_id = ${userId}::uuid
              AND q.status = 'ACTIVE'
              AND (
                q.recurrence = 'ONCE'
                OR (
                  q.recurrence = 'DAILY'
                  AND q.schedule_start_date <= (${now}::timestamptz AT TIME ZONE q.schedule_timezone)::date
                  AND NOT EXISTS (
                    SELECT 1 FROM quest_completions c
                    WHERE c.original_quest_id = q.id
                      AND c.recurrence = 'DAILY'
                      AND c.scheduled_date = (${now}::timestamptz AT TIME ZONE q.schedule_timezone)::date
                  )
                )
              )
            ORDER BY
              CASE
                WHEN q.recurrence = 'ONCE' AND q.due_date < ${today}::date THEN 0
                WHEN q.recurrence = 'ONCE' AND q.due_date = ${today}::date THEN 1
                WHEN q.recurrence = 'DAILY' THEN 2
                WHEN q.recurrence = 'ONCE' AND q.due_date IS NULL THEN 3
                ELSE 4
              END,
              q.due_date ASC NULLS LAST,
              q.created_at ASC,
              q.id ASC
            LIMIT ${TODAY_QUESTS}`,
        ])

        const questIds = questRows.map((row) => row.id)
        const questRecords = questIds.length
          ? await tx.quest.findMany({ where: { id: { in: questIds }, userId }, select: questSelect })
          : []
        const questById = new Map(questRecords.map((quest) => [quest.id, quest]))
        const todayQuests = questIds
          .map((id) => questById.get(id))
          .filter(Boolean)
          .map((quest) => serializeQuest(quest, now))

        const byDate = new Map(
          weekGroups.map((group) => [calendarString(group.completedDate), group]),
        )
        const week = Array.from({ length: 7 }, (_, index) => {
          const date = shiftCalendarDate(weekStart, index)
          const group = byDate.get(date)
          return {
            date,
            count: group?._count._all || 0,
            xp: group?._sum.xpAwarded || 0,
            gold: group?._sum.goldAwarded || 0,
          }
        })
        const weeklyTotals = week.reduce(
          (total, day) => ({
            activeDays: total.activeDays + Number(day.count > 0),
            completions: total.completions + day.count,
            xp: total.xp + day.xp,
            gold: total.gold + day.gold,
          }),
          { activeDays: 0, completions: 0, xp: 0, gold: 0 },
        )
        const streaks = streakRows[0] ? { ...streakRows[0] } : emptyStreaks()
        streaks.todayCompletedCount = byDate.get(today)?._count._all || 0

        return {
          generatedAt: now.toISOString(),
          timezone,
          today,
          character: characterProgress(account.character),
          completedCount,
          quests: {
            active: activeCount,
            archived: archivedCount,
            dueToday,
            overdue,
            daily: dailyCount,
            dailyReady: readyRows[0]?.count || 0,
          },
          todayQuests,
          streaks,
          week,
          weeklyTotals,
          recentCompletions: recentCompletions.map(serializeCompletion),
          firstUse: {
            active: completedCount === 0,
            step: activeCount === 0 ? 'CREATE_QUEST' : 'COMPLETE_QUEST',
          },
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
