import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth/useAuth.js'
import { apiGet } from '../lib/api.js'
import { useAccountError } from '../quests/hooks.js'

export function useDashboard() {
  const { user } = useAuth()
  const query = useQuery({
    queryKey: ['dashboard', user?.id],
    queryFn: ({ signal }) => apiGet('/api/v1/dashboard', signal),
    enabled: Boolean(user?.character),
    staleTime: 15000,
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
    retry: false,
  })
  useAccountError(query.error)
  return query
}
