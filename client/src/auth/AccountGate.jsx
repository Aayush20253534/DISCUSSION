import { Navigate, Outlet, useLocation, useOutletContext } from 'react-router-dom'
import { PageSkeleton } from '../components/ui.jsx'
import { safeDestination, useAuth } from './useAuth.js'

export default function AccountGate({ mode = 'member' }) {
  const { user, loading, error, retry } = useAuth()
  const location = useLocation()
  const outletContext = useOutletContext()
  if (loading) return <PageSkeleton />
  if (error)
    return (
      <main className="account-error panel">
        <h1>Your adventure is out of reach.</h1>
        <p role="alert">{error.message}</p>
        <button className="button button-gold" onClick={() => retry()}>
          Try again
        </button>
      </main>
    )
  if (mode === 'guest') {
    if (user)
      return (
        <Navigate
          replace
          to={user.character ? safeDestination(location.state?.from) : '/onboarding'}
          state={location.state}
        />
      )
  } else if (mode === 'member' || mode === 'onboarding') {
    if (!user)
      return <Navigate replace to="/login" state={{ from: safeDestination(location.pathname) }} />
    if (mode === 'onboarding' && user.character)
      return <Navigate replace to={safeDestination(location.state?.from)} />
    if (mode === 'member' && !user.character)
      return (
        <Navigate replace to="/onboarding" state={{ from: safeDestination(location.pathname) }} />
      )
  } else if (user && !user.character) {
    return <Navigate replace to="/onboarding" />
  }
  return <Outlet context={outletContext} />
}
