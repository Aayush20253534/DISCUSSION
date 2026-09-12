import { lazy, Suspense, useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'motion/react'
import InteractionProvider from './interactions/InteractionProvider.jsx'
import AppShell from './components/AppShell.jsx'
import AuthProvider from './auth/AuthProvider.jsx'
import AccountGate from './auth/AccountGate.jsx'
import './auth.css'
import './economy/economy.css'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { PageSkeleton } from './components/ui.jsx'
import {
  readMotionPreference,
  readSoundPreference,
  saveMotionPreference,
  saveSoundPreference,
} from './lib/preferences.js'

const Authenticate = lazy(() => import('./pages/Authenticate.jsx'))
const Onboarding = lazy(() => import('./pages/Onboarding.jsx'))
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'))
const Quests = lazy(() => import('./pages/Quests.jsx'))
const Activity = lazy(() => import('./pages/Activity.jsx'))
const Character = lazy(() => import('./pages/Character.jsx'))
const Marketplace = lazy(() => import('./pages/Marketplace.jsx'))
const Inventory = lazy(() => import('./pages/Inventory.jsx'))
const Settings = lazy(() => import('./pages/Settings.jsx'))
const HowItWorks = lazy(() => import('./pages/HowItWorks.jsx'))
const NotFound = lazy(() => import('./pages/NotFound.jsx'))
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60000, refetchOnWindowFocus: true, retry: 1 } },
})

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
              <BrowserRouter>
                <AuthProvider>
                  <Suspense fallback={<PageSkeleton />}>
                    <Routes>
                    <Route element={<AccountGate mode="guest" />}>
                      <Route path="login" element={<Authenticate key="login" />} />
                      <Route path="signup" element={<Authenticate key="signup" signup />} />
                    </Route>
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
                        <Route path="how-it-works" element={<HowItWorks />} />
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
                </AuthProvider>
              </BrowserRouter>
            </div>
          </InteractionProvider>
        </MotionConfig>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
