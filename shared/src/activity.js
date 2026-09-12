import { z } from 'zod'

export const activityDateSchema = z.iso
  .date()
  .refine((date) => date >= '1900-01-01', 'Choose a date from 1900 onward.')
export const activityQuerySchema = z
  .object({
    month: z
      .string()
      .regex(/^(?:19|[2-9]\d)\d{2}-(?:0[1-9]|1[0-2])$/, 'Use a month in YYYY-MM format.')
      .optional(),
  })
  .strict()
export const activityDaySchema = z
  .object({
    date: activityDateSchema,
    page: z.coerce.number().int().min(1).max(10000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(8),
  })
  .strict()

// UTC is used only for arithmetic on date labels, never to decide a user's active day.
export function shiftCalendarDate(date, days) {
  const value = new Date(`${date}T00:00:00.000Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}
export function monthDates(month) {
  const first = `${month}-01`
  const days = []
  let date = first
  do {
    days.push(date)
    date = shiftCalendarDate(date, 1)
  } while (date.startsWith(`${month}-`))
  return days
}
export function shiftCalendarMonth(month, offset) {
  const value = new Date(`${month}-01T00:00:00.000Z`)
  value.setUTCMonth(value.getUTCMonth() + offset)
  return value.toISOString().slice(0, 7)
}
export function formatActivityDate(
  date,
  options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
) {
  return new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' }).format(
    new Date(`${date}T00:00:00.000Z`),
  )
}
