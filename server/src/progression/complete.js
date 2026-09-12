import {
  QUEST_REWARDS,
  REWARD_RULES_VERSION,
  MAX_STORED_POINTS,
  characterProgress,
  levelProgress,
  todayInTimezone,
} from '@life-rpg/shared'
import { AppError } from '../lib/errors.js'
import { questSelect, serializeQuest } from '../quests/presentation.js'
import { characterSelect, completionSelect, serializeCompletion } from './presentation.js'

export async function completeQuest(db, { userId, questId, revision, timezone }) {
  return db.$transaction(
    async (tx) => {
      // Serialize completions for the same character, including DIFFERENT quests. Atomic increments
      // and the unique original_quest_id are additional guards. No locks or flags live in JS memory.
      const locked =
        await tx.$queryRaw`SELECT id FROM characters WHERE user_id = ${userId}::uuid FOR UPDATE`
      if (!locked.length)
        throw new AppError(403, 'ONBOARDING_REQUIRED', 'Create your character first.')
      const owned = { id: questId, userId }
      const character = await tx.character.findUnique({
        where: { userId },
        select: characterSelect,
      })
      const previous = await tx.questCompletion.findFirst({
        where: { originalQuestId: questId, userId },
        select: completionSelect,
      })
      if (previous)
        return {
          newlyCompleted: false,
          quest: serializeQuest(await tx.quest.findFirst({ where: owned, select: questSelect })),
          completion: serializeCompletion(previous),
          character: characterProgress(character),
        }
      const quest = await tx.quest.findFirst({ where: owned, select: questSelect })
      if (!quest) throw new AppError(404, 'QUEST_NOT_FOUND', 'This quest is no longer available.')
      if (quest.status === 'ARCHIVED')
        throw new AppError(409, 'QUEST_ARCHIVED', 'Restore this quest before marking it complete.')
      if (quest.status !== 'ACTIVE')
        throw new AppError(409, 'QUEST_COMPLETED', 'This quest has already been completed.')
      if (quest.revision !== revision)
        throw new AppError(
          409,
          'QUEST_CHANGED',
          'This quest changed. Load the latest version before completing it.',
        )
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
      const completedAt = new Date()
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
          dueDate: quest.dueDate,
          estimatedMinutes: quest.estimatedMinutes,
          xpAwarded: reward.xp,
          goldAwarded: reward.gold,
          attributeXpAwarded: reward.attributeXp,
          rulesVersion: REWARD_RULES_VERSION,
          completedAt,
          timezone,
          completedDate: new Date(`${todayInTimezone(timezone, completedAt)}T00:00:00Z`),
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
      return {
        newlyCompleted: true,
        completion: serializeCompletion(receipt),
        character: characterProgress(updated),
        quest: serializeQuest(await tx.quest.findFirst({ where: owned, select: questSelect })),
      }
    },
    { maxWait: 10000, timeout: 10000 },
  )
}
