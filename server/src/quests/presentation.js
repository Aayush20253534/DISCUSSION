import { todayInTimezone } from '@atlasborn/shared'
import {
  completionSelect,
  serializeCompletion,
  calendarString,
} from '../progression/presentation.js'

export const questSelect = {
  id: true,
  title: true,
  description: true,
  attribute: true,
  difficulty: true,
  recurrence: true,
  status: true,
  estimatedMinutes: true,
  dueDate: true,
  scheduleStartDate: true,
  scheduleTimezone: true,
  revision: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  completions: {
    select: completionSelect,
    orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
    take: 1,
  },
}

export const serializeQuest = (quest, now = new Date()) => {
  if (!quest) return null
  const { completions = [], ...record } = quest
  const lastCompletion = serializeCompletion(completions[0] || null)
  const scheduleStartDate = calendarString(record.scheduleStartDate)
  const scheduledDate =
    record.recurrence === 'DAILY' && record.scheduleTimezone
      ? todayInTimezone(record.scheduleTimezone, now)
      : null
  const completion =
    record.recurrence === 'DAILY'
      ? lastCompletion?.scheduledDate === scheduledDate
        ? lastCompletion
        : null
      : lastCompletion
  const scheduleOpen = !scheduleStartDate || !scheduledDate || scheduledDate >= scheduleStartDate
  return {
    ...record,
    dueDate: calendarString(record.dueDate),
    scheduleStartDate,
    scheduledDate,
    completion,
    lastCompletion,
    completedToday: record.recurrence === 'DAILY' && Boolean(completion),
    eligibleToday: record.status === 'ACTIVE' && scheduleOpen && !completion,
  }
}
