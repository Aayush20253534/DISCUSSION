// Explicit, read-only sample adventure. These are NOT logged-in user records.
export const sampleQuests = [
  {
    id: 'read',
    title: 'Read a chapter of a book',
    detail: 'Find a quiet corner and spend a little time with a good book.',
    attribute: 'INTELLECT',
    duration: '20 min',
    difficulty: 'Easy',
    xp: 20,
    gold: 5,
  },
  {
    id: 'move',
    title: 'Take the scenic route',
    detail: 'Step outside for a walk. Give your body and your thoughts some room.',
    attribute: 'STRENGTH',
    duration: '30 min',
    difficulty: 'Medium',
    xp: 50,
    gold: 12,
  },
  {
    id: 'make',
    title: 'Make time to create',
    detail: 'Sketch, write, build, or make music. A small beginning is enough.',
    attribute: 'CREATIVITY',
    duration: '25 min',
    difficulty: 'Medium',
    xp: 50,
    gold: 12,
  },
]

export const sampleAttributeLevels = {
  INTELLECT: 5,
  STRENGTH: 3,
  DISCIPLINE: 4,
  CREATIVITY: 2,
  VITALITY: 3,
}
export const sampleItems = [
  {
    id: 'moon',
    name: 'Moonlit wanderer',
    type: 'AVATAR FRAME',
    price: 120,
    icon: 'moon',
    tone: 'lilac',
    description: 'A quiet silver halo for the adventurer who finds their inspiration after dark.',
  },
  {
    id: 'forest',
    name: 'Keeper of the forest',
    type: 'PROFILE BADGE',
    price: 80,
    icon: 'leaf',
    tone: 'green',
    description: 'A small reminder that the most remarkable things grow a little every day.',
  },
  {
    id: 'sun',
    name: 'A golden beginning',
    type: 'CHARACTER TITLE',
    price: 60,
    icon: 'sun',
    tone: 'gold',
    description: 'Carry a little sunrise with you, wherever your next chapter takes you.',
  },
]
