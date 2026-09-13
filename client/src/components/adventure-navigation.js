import {
  BookOpen,
  CalendarDays,
  Map,
  ShoppingBag,
  UserRound,
} from 'lucide-react'

export const adventureNavigation = [
  { to: '/', label: 'Overview', icon: Map },
  { to: '/quests', label: 'Quest journal', icon: BookOpen },
  { to: '/activity', label: 'Activity', icon: CalendarDays },
  { to: '/character', label: 'Character', icon: UserRound },
  { to: '/marketplace', label: 'Marketplace', icon: ShoppingBag },
]
