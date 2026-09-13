export const characterSelect = {
  id: true,
  avatarKey: true,
  totalXp: true,
  gold: true,
  attributes: { select: { key: true, xp: true }, orderBy: { key: 'asc' } },
}
export const completionSelect = {
  id: true,
  originalQuestId: true,
  questId: true,
  title: true,
  description: true,
  attribute: true,
  difficulty: true,
  recurrence: true,
  dueDate: true,
  scheduledDate: true,
  scheduleTimezone: true,
  estimatedMinutes: true,
  xpAwarded: true,
  goldAwarded: true,
  attributeXpAwarded: true,
  aiVerified: true,
  rulesVersion: true,
  completedAt: true,
  completedDate: true,
  timezone: true,
  levelBefore: true,
  levelAfter: true,
  attributeLevelBefore: true,
  attributeLevelAfter: true,
  totalXpAfter: true,
  goldAfter: true,
  attributeXpAfter: true,
}
export const calendarString = (date) => date?.toISOString().slice(0, 10) || null
export const serializeCompletion = (receipt) =>
  receipt && {
    ...receipt,
    dueDate: calendarString(receipt.dueDate),
    scheduledDate: calendarString(receipt.scheduledDate),
    completedDate: calendarString(receipt.completedDate),
  }
