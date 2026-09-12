import { z } from 'zod'

export const APP_NAME = 'Life RPG'
export const API_PREFIX = '/api/v1'
export const ATTRIBUTES = Object.freeze([
  { key: 'INTELLECT', name: 'Intellect', description: 'Learn something. See a little further.' },
  { key: 'STRENGTH', name: 'Strength', description: 'Build the strength to go the distance.' },
  { key: 'DISCIPLINE', name: 'Discipline', description: 'Small promises, kept every day.' },
  { key: 'CREATIVITY', name: 'Creativity', description: 'Make something only you could make.' },
  { key: 'VITALITY', name: 'Vitality', description: 'Look after the adventurer within.' },
])

export const attributeSchema = z.enum(ATTRIBUTES.map(({ key }) => key))
export const displayNameSchema = z.string().trim().min(2).max(40)
export const timezoneSchema = z.string().refine((value) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format()
    return true
  } catch {
    return false
  }
}, 'Choose a valid IANA timezone')

export const worldSchema = z.object({
  name: z.literal(APP_NAME),
  stage: z.literal('foundation'),
  accountsAvailable: z.literal(false),
  attributes: z.array(
    z.object({ key: attributeSchema, name: z.string(), description: z.string() }),
  ),
})
