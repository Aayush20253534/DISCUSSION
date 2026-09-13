import {
  QUEST_REWARDS,
  REWARD_RULES_VERSION,
  MAX_STORED_POINTS,
  characterProgress,
  levelProgress,
  todayInTimezone,
} from '@atlasborn/shared'
import { AppError } from '../lib/errors.js'
import { questSelect, serializeQuest } from '../quests/presentation.js'
import {
  calendarString,
  characterSelect,
  completionSelect,
  serializeCompletion,
} from './presentation.js'

const dateValue = (value) => new Date(`${value}T00:00:00.000Z`)

export async function completeQuest(
  db,
  { userId, questId, revision, timezone, aiVerified = false, now = new Date() },
) {
  return db.$transaction(
    async (tx) => {
      // Every reward for a character is serialized in PostgreSQL. The quest row is locked too so
      // an edit/archive cannot race between eligibility checks and the receipt write.
      const lockedCharacter =
        await tx.$queryRaw`SELECT id FROM characters WHERE user_id = ${userId}::uuid FOR UPDATE`
      if (!lockedCharacter.length)
        throw new AppError(403, 'ONBOARDING_REQUIRED', 'Create your character first.')

      const character = await tx.character.findUnique({
        where: { userId },
        select: characterSelect,
      })
      const lockedQuest =
        await tx.$queryRaw`SELECT id FROM quests WHERE id = ${questId}::uuid AND user_id = ${userId}::uuid FOR UPDATE`

      // Retried one-time requests remain idempotent after the journal row is removed. A deleted
      // daily quest can only recover the receipt for the same immutable scheduled day.
      if (!lockedQuest.length) {
        const previous = await tx.questCompletion.findFirst({
          where: { originalQuestId: questId, userId },
          select: completionSelect,
          orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
        })
        const sameDailyOccurrence =
          previous?.recurrence === 'DAILY' &&
          previous.scheduleTimezone &&
          calendarString(previous.scheduledDate) === todayInTimezone(previous.scheduleTimezone, now)
        if (previous?.recurrence === 'ONCE' || sameDailyOccurrence)
          return {
            newlyCompleted: false,
            quest: null,
            completion: serializeCompletion(previous),
            character: characterProgress(character),
          }
        throw new AppError(404, 'QUEST_NOT_FOUND', 'This quest is no longer available.')
      }

      const owned = { id: questId, userId }
      const quest = await tx.quest.findFirst({ where: owned, select: questSelect })
      if (!quest) throw new AppError(404, 'QUEST_NOT_FOUND', 'This quest is no longer available.')

      const completedAt = new Date(now)
      const daily = quest.recurrence === 'DAILY'
      const scheduledDateLabel = daily ? todayInTimezone(quest.scheduleTimezone, completedAt) : null
      const scheduledDate = scheduledDateLabel ? dateValue(scheduledDateLabel) : null
      if (daily && scheduledDateLabel < calendarString(quest.scheduleStartDate))
        throw new AppError(
          409,
          'QUEST_NOT_SCHEDULED',
          'This daily quest has not reached its first scheduled day yet.',
        )

      const previous = await tx.questCompletion.findFirst({
        where: daily
          ? { originalQuestId: questId, userId, recurrence: 'DAILY', scheduledDate }
          : { originalQuestId: questId, userId, recurrence: 'ONCE' },
        select: completionSelect,
      })
      // Replays are resolved before mutable status/revision checks. Once this occurrence already
      // has a receipt, returning that immutable result is safe even if the journal definition was
      // edited or archived after the original response was lost. No reward path is re-entered.
      if (previous)
        return {
          newlyCompleted: false,
          quest: serializeQuest(quest, completedAt),
          completion: serializeCompletion(previous),
          character: characterProgress(character),
        }

      if (quest.status === 'ARCHIVED')
        throw new AppError(409, 'QUEST_ARCHIVED', 'Restore this quest before marking it complete.')
      if (quest.revision !== revision)
        throw new AppError(
          409,
          'QUEST_CHANGED',
          'This quest changed. Load the latest version before completing it.',
        )
      if (!daily && quest.status !== 'ACTIVE')
        throw new AppError(409, 'QUEST_COMPLETED', 'This quest has already been completed.')
      if (daily && quest.status !== 'ACTIVE')
        throw new AppError(409, 'QUEST_UNAVAILABLE', 'This daily quest is not active right now.')

      const reward = QUEST_REWARDS[quest.difficulty]
      const attribute = character.attributes.find((row) => row.key === quest.attribute)
      if (!attribute)
        throw new AppError(
          503,
          'PROGRESSION_UNAVAILABLE',
          'Your character attributes need attention. No reward was recorded.',
        )
      if (
        character.totalXp > MAX_STORED_POINTS - reward.xp ||
        character.gold > MAX_STORED_POINTS - reward.gold ||
        attribute.xp > MAX_STORED_POINTS - reward.attributeXp
      )
        throw new AppError(
          409,
          'PROGRESS_LIMIT',
          'Your progress has reached the current storage limit. No reward was recorded.',
        )

      // One-time quests close permanently. Daily quests remain active; the database's partial
      // unique index on (original_quest_id, scheduled_date) is the occurrence claim.
      if (!daily) {
        const claimed = await tx.quest.updateMany({
          where: { ...owned, status: 'ACTIVE', revision },
          data: { status: 'COMPLETED', completedAt, revision: { increment: 1 } },
        })
        if (claimed.count !== 1)
          throw new AppError(
            409,
            'QUEST_CHANGED',
            'This quest changed. Load the latest version before completing it.',
          )
      }

      await tx.character.update({
        where: { id: character.id },
        data: { totalXp: { increment: reward.xp }, gold: { increment: reward.gold } },
      })
      await tx.characterAttribute.update({
        where: { characterId_key: { characterId: character.id, key: quest.attribute } },
        data: { xp: { increment: reward.attributeXp } },
      })
      const updated = await tx.character.findUnique({
        where: { id: character.id },
        select: characterSelect,
      })
      const receipt = await tx.questCompletion.create({
        data: {
          originalQuestId: questId,
          questId,
          userId,
          sourceRevision: revision,
          title: quest.title,
          description: quest.description,
          attribute: quest.attribute,
          difficulty: quest.difficulty,
          recurrence: quest.recurrence,
          dueDate: quest.dueDate,
          scheduledDate,
          scheduleTimezone: daily ? quest.scheduleTimezone : null,
          estimatedMinutes: quest.estimatedMinutes,
          xpAwarded: reward.xp,
          goldAwarded: reward.gold,
          attributeXpAwarded: reward.attributeXp,
          aiVerified,
          rulesVersion: REWARD_RULES_VERSION,
          completedAt,
          timezone,
          completedDate: dateValue(todayInTimezone(timezone, completedAt)),
          levelBefore: levelProgress(character.totalXp).level,
          levelAfter: levelProgress(updated.totalXp).level,
          attributeLevelBefore: levelProgress(attribute.xp, 50).level,
          attributeLevelAfter: levelProgress(attribute.xp + reward.attributeXp, 50).level,
          totalXpAfter: updated.totalXp,
          goldAfter: updated.gold,
          attributeXpAfter: attribute.xp + reward.attributeXp,
        },
        select: completionSelect,
      })
      await tx.currencyTransaction.create({
        data: {
          userId,
          type: 'QUEST_REWARD',
          amount: reward.gold,
          balanceAfter: updated.gold,
          questCompletionId: receipt.id,
          createdAt: completedAt,
        },
      })
      const latestQuest = await tx.quest.findFirst({ where: owned, select: questSelect })
      return {
        newlyCompleted: true,
        completion: serializeCompletion(receipt),
        character: characterProgress(updated),
        quest: serializeQuest(latestQuest, completedAt),
      }
    },
    { maxWait: 10000, timeout: 10000 },
  )
}
