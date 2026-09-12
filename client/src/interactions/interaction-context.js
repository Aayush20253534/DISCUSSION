import { createContext, useContext } from 'react'

export const InteractionContext = createContext(null)

export function useInteractionFeedback() {
  const context = useContext(InteractionContext)
  if (!context) {
    return {
      moving: false,
      announce: () => {},
      notify: () => false,
    }
  }
  return context
}
