import { createContext, useContext } from 'react'
export const AuthContext = createContext(null)
export function useAuth() {
  const auth = useContext(AuthContext)
  if (!auth) throw new Error('AuthProvider is required')
  return auth
}
export function safeDestination(value) {
  // Accept only known app destinations; never follow a caller-supplied external URL.
  return ['/', '/character', '/quests', '/marketplace', '/settings'].includes(value) ? value : '/'
}
