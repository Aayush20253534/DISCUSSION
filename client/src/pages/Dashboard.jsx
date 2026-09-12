import { useAuth } from '../auth/useAuth.js'
import PersonalDashboard from '../components/PersonalDashboard.jsx'
import Landing from './Landing.jsx'

export default function Dashboard() {
  const { user } = useAuth()
  return user ? <PersonalDashboard /> : <Landing />
}
