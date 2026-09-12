import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../lib/api.js'

export const sessionsKey = ['account', 'sessions']

export function useSessions() {
  return useQuery({
    queryKey: sessionsKey,
    queryFn: ({ signal }) => apiGet('/api/v1/me/sessions', signal),
    staleTime: 15000,
  })
}
