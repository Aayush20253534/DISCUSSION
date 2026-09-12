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
  status: true,
  estimatedMinutes: true,
  dueDate: true,
  revision: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  completion: { select: completionSelect },
}
export const serializeQuest = (quest) =>
  quest && {
    ...quest,
    dueDate: calendarString(quest.dueDate),
    completion: serializeCompletion(quest.completion),
  }
