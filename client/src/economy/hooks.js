import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/useAuth.js'
import { apiGet, apiSend } from '../lib/api.js'
import { useAccountError } from '../quests/hooks.js'

function useEconomyQuery(kind, path, enabled = true) {
  const { user } = useAuth()
  const query = useQuery({
    queryKey: ['economy', user?.id, kind, path],
    queryFn: ({ signal }) => apiGet(path, signal),
    enabled: Boolean(user?.character) && enabled,
    staleTime: 45000,
    refetchInterval: 120000,
    retry: false,
  })
  useAccountError(query.error)
  return query
}

export const useCatalog = (type = 'ALL') =>
  useEconomyQuery('catalog', `/api/v1/shop/catalog?${new URLSearchParams({ type })}`)
export const useInventory = (type = 'ALL') =>
  useEconomyQuery('inventory', `/api/v1/inventory?${new URLSearchParams({ type })}`)
export const useWallet = (page = 1, limit = 8) =>
  useEconomyQuery('wallet', `/api/v1/wallet?${new URLSearchParams({ page, limit })}`)

function refreshEconomy(client, userId) {
  void client.invalidateQueries({ queryKey: ['economy', userId] })
  void client.invalidateQueries({ queryKey: ['progress', userId] })
  void client.invalidateQueries({ queryKey: ['dashboard', userId] })
  void client.invalidateQueries({ queryKey: ['auth', 'me'] })
  if ('BroadcastChannel' in window) {
    const channel = new BroadcastChannel('life-rpg-economy')
    channel.postMessage({ userId })
    channel.close()
  }
}

export function usePurchase() {
  const { user } = useAuth()
  const client = useQueryClient()
  const mutation = useMutation({
    retry: false,
    mutationFn: (itemId) => apiSend(`/api/v1/shop/items/${itemId}/purchase`, {}),
    onSuccess: () => user?.id && refreshEconomy(client, user.id),
  })
  useAccountError(mutation.error)
  return mutation
}

export function useEquipmentMutation() {
  const { user } = useAuth()
  const client = useQueryClient()
  const mutation = useMutation({
    retry: false,
    mutationFn: ({ slot, inventoryItemId }) =>
      inventoryItemId
        ? apiSend(`/api/v1/inventory/equipment/${slot}`, { inventoryItemId }, 'PUT')
        : apiSend(`/api/v1/inventory/equipment/${slot}`, {}, 'DELETE'),
    onSuccess: () => user?.id && refreshEconomy(client, user.id),
  })
  useAccountError(mutation.error)
  return mutation
}

export function useEconomySync() {
  const { user } = useAuth()
  const client = useQueryClient()
  useEffect(() => {
    if (!user || !('BroadcastChannel' in window)) return
    const channel = new BroadcastChannel('life-rpg-economy')
    channel.onmessage = ({ data }) => {
      if (data?.userId !== user.id) return
      void client.invalidateQueries({ queryKey: ['economy', user.id] })
      void client.invalidateQueries({ queryKey: ['progress', user.id] })
      void client.invalidateQueries({ queryKey: ['dashboard', user.id] })
      void client.invalidateQueries({ queryKey: ['auth', 'me'] })
    }
    return () => channel.close()
  }, [client, user])
}
