import { Suspense, useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  Compass,
  HelpCircle,
  Map,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShoppingBag,
  Sparkles,
  UserRound,
} from 'lucide-react'
import { useQuestSync } from '../quests/hooks.js'
import Portrait from './Portrait.jsx'
import { useAuth } from '../auth/useAuth.js'
import { Modal, PageSkeleton } from './ui.jsx'

const navigation = [
  { to: '/', label: 'Overview', icon: Map },
  { to: '/quests', label: 'Quest journal', icon: BookOpen },
  { to: '/activity', label: 'Activity', icon: CalendarDays },
  { to: '/character', label: 'Character', icon: UserRound },
  { to: '/marketplace', label: 'Marketplace', icon: ShoppingBag },
]

export default function AppShell({ gentleMotion, setGentleMotion }) {
  const { user } = useAuth()
  useQuestSync()
  const [collapsed, setCollapsed] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const { pathname } = useLocation()
  const mainRef = useRef(null)
  const previousPath = useRef(pathname)
  useEffect(() => {
    const title =
      navigation.find(({ to }) => to === pathname)?.label ||
      (pathname === '/settings' ? 'Preferences' : 'Lost in the woods')
    document.title = `${title} · Life RPG`
    if (previousPath.current !== pathname) {
      mainRef.current?.focus({ preventScroll: true })
      window.scrollTo({ top: 0, behavior: 'instant' })
      previousPath.current = pathname
    }
  }, [pathname])

  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">
        <NavLink to="/" className="brand" aria-label="Life RPG home">
          <span className="brand-mark">
            <Compass size={29} strokeWidth={1.4} />
          </span>
          <span className="brand-word">
            life<span>rpg</span>
            <small>MAKE EVERY DAY A QUEST</small>
          </span>
        </NavLink>
        <div className="sidebar-section-label">YOUR ADVENTURE</div>
        <nav className="primary-nav" aria-label="Main navigation">
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              aria-label={label}
              title={collapsed ? label : undefined}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <Icon size={20} strokeWidth={1.6} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="journey-note">
            <Sparkles size={20} />
            <p>
              Every great story
              <br />
              starts with a small step.
            </p>
            <span>YOURS INCLUDED.</span>
          </div>
          <nav aria-label="Support navigation">
            <NavLink
              to="/settings"
              title={collapsed ? 'Preferences' : undefined}
              aria-label="Preferences"
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <Settings size={19} />
              <span>Preferences</span>
            </NavLink>
            <button
              className="nav-link"
              onClick={() => setGuideOpen(true)}
              aria-label="Open field guide"
            >
              <HelpCircle size={19} />
              <span>Field guide</span>
            </button>
          </nav>
          <NavLink
            to="/character"
            className="sidebar-profile"
            aria-label={user ? 'View your character' : 'Sign in to create a character'}
          >
            <Portrait avatarKey={user?.character?.avatarKey} />
            <span>
              <strong>{user?.displayName || 'Your story starts here'}</strong>
              <small>{user ? 'Your adventurer' : 'Create your character'}</small>
            </span>
            <ChevronRight size={15} />
          </NavLink>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button collapse-button"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!collapsed}
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
            </button>
            <Compass className="mobile-brand" size={22} />
            <span>THE EVERYDAY ADVENTURE</span>
          </div>
          <div className="topbar-right">
            {!user && (
              <NavLink to="/login" className="text-link">
                Sign in
              </NavLink>
            )}
            <span className="preview-pill">
              <span />
              {user ? 'Your adventure' : 'World preview'}
            </span>
            <button
              className="icon-button guide-button"
              aria-label="How Life RPG works"
              onClick={() => setGuideOpen(true)}
            >
              <HelpCircle size={19} />
            </button>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} ref={mainRef}>
          <Suspense fallback={<PageSkeleton />}>
            <Outlet context={{ gentleMotion, setGentleMotion }} />
          </Suspense>
        </main>
        <footer className="app-footer">
          <span>Life is the adventure. You are the hero.</span>
          <span>
            LIFE RPG <span className="footer-star">✦</span> A LITTLE BETTER, EVERY DAY
          </span>
        </footer>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {[...navigation, { to: '/settings', label: 'Preferences', icon: Settings }].map(
          ({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              aria-label={label}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              <Icon size={20} />
              <span>
                {label === 'Quest journal' ? 'Quests' : label === 'Marketplace' ? 'Market' : label}
              </span>
            </NavLink>
          ),
        )}
      </nav>
      <Modal
        open={guideOpen}
        onOpenChange={setGuideOpen}
        title="Real life. A little more magical."
        description="Turn the things you want to do into an adventure you want to return to."
      >
        <ol className="guide-steps">
          <li>
            <span>01</span>
            <div>
              <strong>Give your day a quest.</strong>
              <p>Reading, moving, making. Start with something that matters to you.</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <strong>Grow as you go.</strong>
              <p>Complete quests to earn experience and strengthen your character’s attributes.</p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <strong>Make it your adventure.</strong>
              <p>Keep your streak alive and spend earned gold on little treasures.</p>
            </div>
          </li>
        </ol>
        <div className="modal-note">
          Complete a saved quest to earn XP and gold, then watch your character and chosen attribute
          grow. Track your daily streak in Activity. Marketplace purchases arrive in a later
          chapter. Preview examples do not change your progress.
        </div>
        <button className="button button-gold full-width" onClick={() => setGuideOpen(false)}>
          Let’s explore <Compass size={16} />
        </button>
      </Modal>
    </div>
  )
}
