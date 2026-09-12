import { z } from 'zod'

export const QUEST_RECURRENCES = Object.freeze([
  { key: 'ONCE', label: 'One-time', description: 'Finish it once and keep the record.' },
  { key: 'DAILY', label: 'Daily', description: 'Available once on each scheduled local day.' },
])
export const QUEST_DIFFICULTIES = Object.freeze([
  { key: 'EASY', label: 'Easy', description: 'A small, approachable step.' },
  { key: 'MEDIUM', label: 'Medium', description: 'A little focus and effort.' },
  { key: 'HARD', label: 'Hard', description: 'A worthwhile challenge.' },
])
const attribute = z.enum(['INTELLECT', 'STRENGTH', 'DISCIPLINE', 'CREATIVITY', 'VITALITY'])
const difficulty = z.enum(QUEST_DIFFICULTIES.map(({ key }) => key))
const recurrence = z.enum(QUEST_RECURRENCES.map(({ key }) => key))
const status = z.enum(['ACTIVE', 'ARCHIVED'])
export const questIdSchema = z.string().uuid('Choose a valid quest.')
export const calendarDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a valid date.')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`)
    return (
      value >= '1900-01-01' &&
      value <= '2100-12-31' &&
      !Number.isNaN(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    )
  }, 'Choose a real date between 1900 and 2100.')
const fields = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Give your quest a title of at least 3 characters.')
    .max(120, 'Keep the title within 120 characters.'),
  description: z.string().trim().max(2000, 'Keep your notes within 2,000 characters.'),
  attribute,
  difficulty,
  recurrence,
  estimatedMinutes: z
    .number()
    .int('Use a whole number of minutes.')
    .min(1, 'Use at least 1 minute.')
    .max(1440, 'Use no more than 1,440 minutes.')
    .nullable(),
  dueDate: calendarDateSchema.nullable(),
})
export const questCreateSchema = fields
  .extend({
    description: fields.shape.description.default(''),
    difficulty: difficulty.default('EASY'),
    recurrence: recurrence.default('ONCE'),
    estimatedMinutes: fields.shape.estimatedMinutes.default(null),
    dueDate: fields.shape.dueDate.default(null),
    requestId: z.string().uuid('Reopen the form and try again.'),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.recurrence === 'DAILY' && value.dueDate)
      context.addIssue({
        code: 'custom',
        path: ['dueDate'],
        message: 'Daily quests repeat by schedule and cannot have a one-time due date.',
      })
  })
export const questUpdateSchema = fields
  .partial()
  .extend({
    status: status.optional(),
    revision: z.number().int().min(1).max(2147483647),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).some((key) => key !== 'revision'),
    'Include something to update.',
  )
  .superRefine((value, context) => {
    if (value.recurrence === 'DAILY' && value.dueDate)
      context.addIssue({
        code: 'custom',
        path: ['dueDate'],
        message: 'Daily quests repeat by schedule and cannot have a one-time due date.',
      })
  })
export const questDeleteSchema = z
  .object({ revision: z.number().int().min(1).max(2147483647) })
  .strict()
const integerParam = (fallback, max) =>
  z
    .string()
    .regex(/^[1-9]\d*$/, 'Use a positive whole number.')
    .transform(Number)
    .pipe(z.number().int().min(1).max(max))
    .default(fallback)
export const questListSchema = z
  .object({
    q: z.string().trim().max(120).default(''),
    attribute: z.enum(['ALL', ...attribute.options]).default('ALL'),
    difficulty: z.enum(['ALL', ...difficulty.options]).default('ALL'),
    recurrence: z.enum(['ALL', ...recurrence.options]).default('ALL'),
    status: z.enum(['ALL', 'COMPLETED', ...status.options]).default('ACTIVE'),
    due: z.enum(['ALL', 'TODAY', 'UPCOMING', 'OVERDUE', 'UNSCHEDULED']).default('ALL'),
    sort: z.enum(['NEWEST', 'OLDEST', 'DUE', 'TITLE', 'COMPLETED']).default('NEWEST'),
    page: integerParam(1, 10000),
    limit: integerParam(12, 50),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.recurrence === 'DAILY' && value.due !== 'ALL')
      context.addIssue({
        code: 'custom',
        path: ['due'],
        message: 'Daily quests do not use one-time due-date filters.',
      })
  })

// Date-only strings remain calendar dates. Never convert a due date to the browser's local instant.
export function todayInTimezone(timezone, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const get = (type) => parts.find((part) => part.type === type).value
  return `${get('year')}-${get('month')}-${get('day')}`
}
export function formatQuestDate(value) {
  if (!value) return 'No due date'
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`))
}
