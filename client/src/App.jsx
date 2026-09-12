import { lazy, Suspense, useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'motion/react'
import AppShell from './components/AppShell.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { PageSkeleton } from './components/ui.jsx'
import { readMotionPreference, saveMotionPreference } from './lib/preferences.js'

const Dashboard = lazy(() => import('./pages/Dashboard.jsx'))
const Quests = lazy(() => import('./pages/Quests.jsx'))
const Character = lazy(() => import('./pages/Character.jsx'))
const Marketplace = lazy(() => import('./pages/Marketplace.jsx'))
const Settings = lazy(() => import('./pages/Settings.jsx'))
const NotFound = lazy(() => import('./pages/NotFound.jsx'))
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60000, refetchOnWindowFocus: true, retry: 1 } },
})

export default function App() {
  const [gentleMotion, updateGentleMotion] = useState(readMotionPreference)
  const setGentleMotion = (value) => {
    updateGentleMotion(value)
    saveMotionPreference(value)
  }
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <MotionConfig reducedMotion={gentleMotion ? 'user' : 'always'}>
          <div data-motion={gentleMotion ? 'on' : 'off'}>
            <BrowserRouter>
              <Suspense fallback={<PageSkeleton />}>
                <Routes>
                  <Route
                    element={
                      <AppShell gentleMotion={gentleMotion} setGentleMotion={setGentleMotion} />
                    }
                  >
                    <Route index element={<Dashboard />} />
                    <Route path="quests" element={<Quests />} />
                    <Route path="character" element={<Character />} />
                    <Route path="marketplace" element={<Marketplace />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="*" element={<NotFound />} />
                  </Route>
                </Routes>
              </Suspense>
            </BrowserRouter>
          </div>
        </MotionConfig>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
