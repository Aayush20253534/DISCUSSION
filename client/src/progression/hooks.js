import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth/useAuth.js'
import { apiGet } from '../lib/api.js'
import { useAccountError } from '../quests/hooks.js'

export function useProgress() {
  const { user } = useAuth()
  const query = useQuery({
    queryKey: ['progress', user?.id, 'summary'],
    queryFn: ({ signal }) => apiGet('/api/v1/progress', signal),
    enabled: Boolean(user?.character),
    staleTime: 45000,
    refetchInterval: 120000,
    retry: false,
  })
  useAccountError(query.error)
  return query
}
export function useCompletionHistory(filters) {
  const { user } = useAuth()
  const query = useQuery({
    queryKey: ['progress', user?.id, 'history', filters],
    queryFn: ({ signal }) =>
      apiGet(`/api/v1/progress/history?${new URLSearchParams(filters)}`, signal),
    enabled: Boolean(user?.character),
    staleTime: 45000,
    refetchInterval: 120000,
    retry: false,
  })
  useAccountError(query.error)
  return query
}
