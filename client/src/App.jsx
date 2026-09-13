import { lazy, Suspense, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'motion/react'
import InteractionProvider from './interactions/InteractionProvider.jsx'
import AppShell from './components/AppShell.jsx'
import AuthProvider from './auth/AuthProvider.jsx'
import AccountGate from './auth/AccountGate.jsx'
import './auth.css'
import './economy/economy.css'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import NetworkStatus from './components/NetworkStatus.jsx'
import { PageSkeleton } from './components/ui.jsx'
import {
  readMotionPreference,
  readSoundPreference,
  saveMotionPreference,
  saveSoundPreference,
} from './lib/preferences.js'

const Authenticate = lazy(() => import('./pages/Authenticate.jsx'))
const Onboarding = lazy(() => import('./pages/Onboarding.jsx'))
const PasswordRecovery = lazy(() => import('./pages/PasswordRecovery.jsx'))
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'))
const Quests = lazy(() => import('./pages/Quests.jsx'))
const Activity = lazy(() => import('./pages/Activity.jsx'))
const Character = lazy(() => import('./pages/Character.jsx'))
const Marketplace = lazy(() => import('./pages/Marketplace.jsx'))
const Inventory = lazy(() => import('./pages/Inventory.jsx'))
const Settings = lazy(() => import('./pages/Settings.jsx'))
const NotFound = lazy(() => import('./pages/NotFound.jsx'))

function retryQuery(failureCount, error) {
  if (failureCount >= 1) return false
  return !error?.status || error.status === 408 || error.status >= 500
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: retryQuery,
    },
    // Mutations are intentionally never retried by the client. Reward/purchase endpoints are
    // server-idempotent, but surfacing uncertainty is safer than silently repeating writes.
    mutations: { retry: false },
  },
})

function RoutedApplication({ gentleMotion, setGentleMotion, soundEnabled, setSoundEnabled }) {
  const { pathname } = useLocation()
  return (
    <ErrorBoundary resetKey={pathname}>
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          <Route element={<AccountGate mode="guest" />}>
            <Route path="login" element={<Authenticate key="login" />} />
            <Route path="signup" element={<Authenticate key="signup" signup />} />
            <Route path="forgot-password" element={<PasswordRecovery />} />
          </Route>
          <Route path="reset-password" element={<PasswordRecovery />} />
          <Route element={<AccountGate mode="onboarding" />}>
            <Route path="onboarding" element={<Onboarding />} />
          </Route>
          <Route element={<AccountGate mode="public" />}>
            <Route
              element={
                <AppShell
                  gentleMotion={gentleMotion}
                  setGentleMotion={setGentleMotion}
                  soundEnabled={soundEnabled}
                  setSoundEnabled={setSoundEnabled}
                />
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="how-it-works" element={<Navigate to="/#how-it-works" replace />} />
              <Route element={<AccountGate />}>
                <Route path="quests" element={<Quests />} />
                <Route path="activity" element={<Activity />} />
                <Route path="character" element={<Character />} />
                <Route path="marketplace" element={<Marketplace />} />
                <Route path="inventory" element={<Inventory />} />
                <Route path="settings" element={<Settings />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}

export default function App() {
  const [gentleMotion, updateGentleMotion] = useState(readMotionPreference)
  const [soundEnabled, updateSoundEnabled] = useState(readSoundPreference)
  const setGentleMotion = (value) => {
    updateGentleMotion(value)
    saveMotionPreference(value)
  }
  const setSoundEnabled = (value) => {
    updateSoundEnabled(value)
    saveSoundPreference(value)
  }
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <MotionConfig reducedMotion={gentleMotion ? 'user' : 'always'}>
          <InteractionProvider gentleMotion={gentleMotion} soundEnabled={soundEnabled}>
            <div data-motion={gentleMotion ? 'on' : 'off'}>
              <NetworkStatus />
              <BrowserRouter>
                <AuthProvider>
                  <RoutedApplication
                    gentleMotion={gentleMotion}
                    setGentleMotion={setGentleMotion}
                    soundEnabled={soundEnabled}
                    setSoundEnabled={setSoundEnabled}
                  />
                </AuthProvider>
              </BrowserRouter>
            </div>
          </InteractionProvider>
        </MotionConfig>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
