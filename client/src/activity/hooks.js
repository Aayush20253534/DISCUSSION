import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth/useAuth.js'
import { apiGet } from '../lib/api.js'
import { useAccountError } from '../quests/hooks.js'

function useActivityQuery(key, path) {
  const { user } = useAuth()
  const query = useQuery({
    queryKey: ['progress', user?.id, 'activity', ...key],
    queryFn: ({ signal }) => apiGet(path, signal),
    enabled: Boolean(user?.character),
    staleTime: 15000,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    retry: false,
  })
  useAccountError(query.error)
  return query
}
export function useActivity(month = '') {
  return useActivityQuery(
    [month || 'current'],
    `/api/v1/activity${month ? `?${new URLSearchParams({ month })}` : ''}`,
  )
}
export function useActivityDay(date, page) {
  return useActivityQuery(
    ['day', date, page],
    `/api/v1/activity/day?${new URLSearchParams({ date, page, limit: 5 })}`,
  )
}
