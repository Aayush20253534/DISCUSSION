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
export const displayNameSchema = z
  .string()
  .trim()
  .min(2, 'Use at least 2 characters for your name.')
  .max(40, 'Keep your name within 40 characters.')
export const timezoneSchema = z
  .string()
  .min(1)
  .max(80)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: value }).format()
      return true
    } catch {
      return false
    }
  }, 'Choose a valid IANA timezone')

export const worldSchema = z.object({
  name: z.literal(APP_NAME),
  stage: z.literal('progression'),
  accountsAvailable: z.boolean(),
  attributes: z.array(
    z.object({ key: attributeSchema, name: z.string(), description: z.string() }),
  ),
})

export const AVATARS = Object.freeze([
  { key: 'wanderer', name: 'Wanderer', description: 'Follow your curiosity.' },
  { key: 'scholar', name: 'Scholar', description: 'Find wonder in learning.' },
  { key: 'guardian', name: 'Guardian', description: 'Grow with quiet strength.' },
])
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .email('Enter a valid email address.')
export const passwordSchema = z
  .string()
  .min(12, 'Use at least 12 characters.')
  .max(128, 'Use no more than 128 characters.')
export const signupSchema = z
  .object({
    displayName: displayNameSchema,
    email: emailSchema,
    password: passwordSchema,
  })
  .strict()
export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1, 'Enter your password.').max(128),
  })
  .strict()
export const onboardingSchema = z
  .object({
    displayName: displayNameSchema,
    timezone: timezoneSchema,
    avatarKey: z.enum(AVATARS.map(({ key }) => key)),
  })
  .strict()

export * from './quests.js'

export * from './progression.js'

export * from './activity.js'
