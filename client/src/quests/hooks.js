import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/useAuth.js'
import { apiGet, apiSend } from '../lib/api.js'

function useAccountError(error) {
  const client = useQueryClient()
  useEffect(() => {
    if (['AUTH_REQUIRED', 'ONBOARDING_REQUIRED'].includes(error?.code)) {
      void client.resetQueries({ queryKey: ['auth', 'me'] })
    }
  }, [client, error])
}
export function useQuests(filters) {
  const { user } = useAuth()
  const query = useQuery({
    queryKey: ['quests', user?.id, 'list', filters],
    queryFn: ({ signal }) => apiGet(`/api/v1/quests?${new URLSearchParams(filters)}`, signal),
    enabled: Boolean(user?.character),
    staleTime: 15000,
    refetchInterval: 60000,
    retry: false,
  })
  useAccountError(query.error)
  return query
}
export function useQuestSummary() {
  const { user } = useAuth()
  const query = useQuery({
    queryKey: ['quests', user?.id, 'summary'],
    queryFn: ({ signal }) => apiGet('/api/v1/quests/summary', signal),
    enabled: Boolean(user?.character),
    staleTime: 15000,
    refetchInterval: 60000,
    retry: false,
  })
  useAccountError(query.error)
  return query
}
export function useQuestSync() {
  const { user } = useAuth()
  const client = useQueryClient()
  useEffect(() => {
    if (!user || !('BroadcastChannel' in window)) return
    const channel = new BroadcastChannel('life-rpg-quests')
    channel.onmessage = ({ data }) => {
      if (data?.userId === user.id) void client.invalidateQueries({ queryKey: ['quests', user.id] })
    }
    return () => channel.close()
  }, [user, client])
}
export function useQuestMutation() {
  const { user } = useAuth()
  const client = useQueryClient()
  const mutation = useMutation({
    retry: false,
    mutationFn: ({ action, id, body }) => {
      const method = { create: 'POST', update: 'PATCH', delete: 'DELETE' }[action]
      return apiSend(`/api/v1/quests${id ? `/${id}` : ''}`, body, method)
    },
    onMutate: () => ({ accountId: user?.id }),
    onSuccess: (_data, _variables, context) => {
      // A request finishing after an account switch must not repopulate the new user's cache.
      const accountId = context?.accountId
      if (accountId && accountId === client.getQueryData(['auth', 'me'])?.user?.id) {
        void client.invalidateQueries({ queryKey: ['quests', accountId] })
        if ('BroadcastChannel' in window) {
          const channel = new BroadcastChannel('life-rpg-quests')
          channel.postMessage({ userId: accountId })
          channel.close()
        }
      }
    },
    meta: { accountId: user?.id },
  })
  useAccountError(mutation.error)
  return mutation
}
