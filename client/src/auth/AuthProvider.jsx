import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiSend, authAction } from '../lib/api.js'
import { AuthContext } from './useAuth.js'

const key = ['auth', 'me']
export default function AuthProvider({ children }) {
  const client = useQueryClient()
  const channel = useRef(null)
  const query = useQuery({
    queryKey: key,
    queryFn: async ({ signal }) => {
      try {
        return await apiGet('/api/v1/auth/me', signal)
      } catch (error) {
        if (error.code === 'AUTH_REQUIRED') return { user: null }
        throw error
      }
    },
    staleTime: 30000,
    retry: false,
    refetchInterval: 10 * 60000,
  })
  useEffect(() => {
    if (!('BroadcastChannel' in window)) return
    const current = new BroadcastChannel('atlasborn-account')
    channel.current = current
    current.onmessage = async ({ data }) => {
      if (data !== 'changed') return
      await client.cancelQueries()
      client.removeQueries({
        predicate: (q) => q.queryKey[0] !== 'auth' && q.queryKey[0] !== 'world',
      })
      await client.resetQueries({ queryKey: key })
    }
    return () => {
      current.close()
      channel.current = null
    }
  }, [client])
  async function accept(data) {
    await client.cancelQueries()
    client.removeQueries({
      predicate: (q) => q.queryKey[0] !== 'auth' && q.queryKey[0] !== 'world',
    })
    client.setQueryData(key, data)
    channel.current?.postMessage('changed')
    return data.user
  }
  const value = {
    user: query.data?.user || null,
    loading: query.isPending,
    error: query.error,
    retry: query.refetch,
    async signup(body) {
      await client.cancelQueries({ queryKey: key })
      return authAction('signup', body)
    },
    async verifyEmail(body) {
      await client.cancelQueries({ queryKey: key })
      return accept(await authAction('verify-email', body))
    },
    async resendVerification(body) {
      return authAction('resend-verification', body)
    },
    async login(body) {
      await client.cancelQueries({ queryKey: key })
      return accept(await authAction('login', body))
    },
    async requestPasswordReset(body) {
      return authAction('forgot-password', body)
    },
    async resetPassword(body) {
      return authAction('reset-password', body)
    },
    async onboard(body) {
      return accept(await apiSend('/api/v1/me/onboarding', body, 'PUT'))
    },
    async updateProfile(body) {
      return accept(await apiSend('/api/v1/me/profile', body, 'PUT'))
    },
    async changePassword(body) {
      return apiSend('/api/v1/me/password', body, 'PUT')
    },
    async revokeSession(sessionId) {
      const result = await apiSend(`/api/v1/me/sessions/${sessionId}`, {}, 'DELETE')
      if (result.currentRevoked) await accept({ user: null })
      return result
    },
    async revokeOtherSessions() {
      return apiSend('/api/v1/me/sessions/revoke-others', {}, 'POST')
    },
    async logout(all = false) {
      if (all) await apiGet('/api/v1/auth/me')
      await authAction(all ? 'logout-all' : 'logout')
      await accept({ user: null })
    },
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
