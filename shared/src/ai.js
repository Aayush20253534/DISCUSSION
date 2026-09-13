import { z } from 'zod'
import { calendarDateSchema } from './quests.js'

const attributeSchema = z.enum(['INTELLECT', 'STRENGTH', 'DISCIPLINE', 'CREATIVITY', 'VITALITY'])

export const QUEST_MASTER_PACES = Object.freeze([
  { key: 'GENTLE', label: 'Gentle', description: 'Smaller steps with more breathing room.' },
  { key: 'BALANCED', label: 'Balanced', description: 'A practical mix of momentum and recovery.' },
  { key: 'AMBITIOUS', label: 'Ambitious', description: 'Faster progress with tougher milestones.' },
])

export const questMasterRequestSchema = z
  .object({
    goal: z
      .string()
      .trim()
      .min(10, 'Describe the goal in a little more detail.')
      .max(800, 'Keep the goal within 800 characters.'),
    questCount: z.number().int().min(3).max(8).default(5),
    horizonDays: z.number().int().min(3).max(60).default(14),
    pace: z.enum(QUEST_MASTER_PACES.map(({ key }) => key)).default('BALANCED'),
  })
  .strict()

export const questMasterDraftSchema = z
  .object({
    requestId: z.string().uuid(),
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().max(2000),
    attribute: attributeSchema,
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
    recurrence: z.literal('ONCE'),
    estimatedMinutes: z.number().int().min(1).max(1440).nullable(),
    dueDate: calendarDateSchema.nullable(),
    rationale: z.string().trim().min(1).max(240),
  })
  .strict()

export const questMasterPlanSchema = z
  .object({
    campaignTitle: z.string().trim().min(3).max(80),
    summary: z.string().trim().min(1).max(320),
    provider: z.enum(['groq', 'gemini']),
    model: z.string().trim().min(1).max(120),
    quests: z.array(questMasterDraftSchema).min(3).max(8),
  })
  .strict()

export const QUEST_VERIFICATION_MIME_TYPES = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/webp',
])

export const questVerificationRequestSchema = z
  .object({
    revision: z.number().int().min(1).max(2147483646),
    image: z
      .object({
        mimeType: z.enum(QUEST_VERIFICATION_MIME_TYPES),
        data: z
          .string()
          .min(100, 'Choose a valid evidence image.')
          .max(3_750_000, 'Evidence image is too large.')
          .regex(/^[A-Za-z0-9+/]+={0,2}$/, 'Choose a valid evidence image.')
          .refine((value) => value.length % 4 === 0, 'Choose a valid evidence image.'),
      })
      .strict(),
  })
  .strict()

export const questVerificationResultSchema = z
  .object({
    verdict: z.enum(['VERIFIED', 'UNCLEAR', 'REJECTED']),
    confidence: z.number().int().min(0).max(100),
    summary: z.string().trim().min(1).max(320),
    evidence: z.array(z.string().trim().min(1).max(180)).max(4),
    concerns: z.array(z.string().trim().min(1).max(180)).max(4),
  })
  .strict()
