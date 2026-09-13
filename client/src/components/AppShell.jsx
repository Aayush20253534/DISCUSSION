import { Suspense, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Compass,
  HelpCircle,
  LogOut,
  Map,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShoppingBag,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react'
import { useQuestSync } from '../quests/hooks.js'
import { useEconomySync } from '../economy/hooks.js'
import { equippedItem } from '../economy/equipment.js'
import Portrait from './Portrait.jsx'
import { useAuth } from '../auth/useAuth.js'
import { Modal, PageSkeleton } from './ui.jsx'
import PublicShell from '../public/PublicShell.jsx'
import { applyPageMeta } from '../lib/meta.js'
import { useInteractionFeedback } from '../interactions/interaction-context.js'

const navigation = [
  { to: '/', label: 'Overview', icon: Map },
  { to: '/quests', label: 'Quest journal', icon: BookOpen },
  { to: '/activity', label: 'Activity', icon: CalendarDays },
  { to: '/character', label: 'Character', icon: UserRound },
  { to: '/marketplace', label: 'Marketplace', icon: ShoppingBag },
]

export default function AppShell({ gentleMotion, setGentleMotion, soundEnabled, setSoundEnabled }) {
  const auth = useAuth()
  const { user } = auth
  const { moving } = useInteractionFeedback()
  useQuestSync()
  useEconomySync()
  const equippedFrame = equippedItem(user, 'AVATAR_FRAME')
  const equippedTitle = equippedItem(user, 'CHARACTER_TITLE')
  const equippedTheme = equippedItem(user, 'THEME')
  const equippedThemeKey = equippedTheme?.assetKey
  const [collapsed, setCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState('')
  const { pathname } = useLocation()
  const mainRef = useRef(null)
  const guideReturnFocusRef = useRef(null)
  const previousPath = useRef(pathname)
  const dashboardWorld = Boolean(user && pathname === '/')
  const userInitial = user?.displayName?.trim()?.charAt(0)?.toUpperCase() || 'A'
  useEffect(() => {
    const key = equippedThemeKey
    if (key) document.documentElement.dataset.rewardTheme = key
    else delete document.documentElement.dataset.rewardTheme
    return () => delete document.documentElement.dataset.rewardTheme
  }, [equippedThemeKey])
  useEffect(() => {
    const publicMarketing = !user && (pathname === '/' || pathname === '/how-it-works')
    if (!publicMarketing) {
      const title =
        navigation.find(({ to }) => to === pathname)?.label ||
        (pathname === '/inventory'
          ? 'Inventory'
          : pathname === '/settings'
            ? 'Preferences'
            : 'Lost in the woods')
      applyPageMeta({
        title: `${title} · Life RPG`,
        description: 'Private Life RPG account area.',
        path: pathname,
        noindex: true,
      })
    }
    if (previousPath.current !== pathname) {
      mainRef.current?.focus({ preventScroll: true })
      window.scrollTo({ top: 0, behavior: 'instant' })
      previousPath.current = pathname
      setMobileMenuOpen(false)
    }
  }, [pathname, user])

  async function signOut() {
    if (signingOut) return
    setSigningOut(true)
    setSignOutError('')
    try {
      await auth.logout()
    } catch (error) {
      setSignOutError(error?.message || 'Could not sign out. Please try again.')
      setSigningOut(false)
    }
  }

  const privatePath = ['/quests', '/activity', '/character', '/marketplace', '/inventory', '/settings'].some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  )
  if (!user && !privatePath) {
    return (
      <PublicShell
        gentleMotion={gentleMotion}
        setGentleMotion={setGentleMotion}
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
      />
    )
  }

  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''} ${dashboardWorld ? 'dashboard-world' : ''} ${mobileMenuOpen ? 'mobile-sidebar-open' : ''}`}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">
        <NavLink to="/" className="brand" aria-label="Life RPG home" onClick={() => setMobileMenuOpen(false)}>
          <span className="brand-mark">
            <Compass size={34} strokeWidth={1.25} />
          </span>
          <span className="brand-word">
            <strong>LIFE RPG</strong>
            <small>THE ADVENTURER&apos;S ATLAS</small>
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
              onClick={() => setMobileMenuOpen(false)}
            >
              <Icon size={20} strokeWidth={1.6} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="journey-note">
            <span className="journey-divider" aria-hidden="true">◇</span>
            <p>
              Every great story
              <br />
              starts with a
              <br />
              small step.
            </p>
          </div>
          {user && (
            <button
              type="button"
              className="nav-link sidebar-signout dashboard-sidebar-signout"
              onClick={signOut}
              disabled={signingOut}
              aria-label={signingOut ? 'Signing out' : 'Sign out'}
              title={collapsed ? (signingOut ? 'Signing out…' : 'Sign out') : undefined}
            >
              <LogOut size={18} strokeWidth={1.6} />
              <span>{signingOut ? 'Signing out…' : 'Sign out'}</span>
            </button>
          )}
          {signOutError && user && (
            <p className="sidebar-signout-error" role="alert">{signOutError}</p>
          )}
          <nav className="sidebar-support-nav" aria-label="Support navigation">
            <NavLink
              to="/settings"
              title={collapsed ? 'Preferences' : undefined}
              aria-label="Preferences"
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              <Settings size={19} />
              <span>Preferences</span>
            </NavLink>
            <button
              className="nav-link"
              onClick={(event) => { guideReturnFocusRef.current = event.currentTarget; setGuideOpen(true) }}
              aria-label="Open field guide"
            >
              <HelpCircle size={19} />
              <span>Field guide</span>
            </button>
          </nav>
          <NavLink
            to="/character"
            className="sidebar-profile"
            onClick={() => setMobileMenuOpen(false)}
            aria-label={user ? 'View your character' : 'Sign in to create a character'}
          >
            <Portrait avatarKey={user?.character?.avatarKey} frameKey={equippedFrame?.assetKey} />
            <span>
              <strong>{user?.displayName || 'Your story starts here'}</strong>
              <small>{user ? equippedTitle?.name || 'Your adventurer' : 'Create your character'}</small>
            </span>
            <ChevronRight size={15} />
          </NavLink>
        </div>
      </aside>
      {dashboardWorld && (
        <button
          type="button"
          className="mobile-sidebar-scrim"
          aria-label="Close navigation"
          tabIndex={mobileMenuOpen ? 0 : -1}
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <div className="workspace">
        <header className="topbar">
          <div className="topbar-left">
            {dashboardWorld && (
              <button
                className="icon-button mobile-menu-button"
                aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'}
                aria-expanded={mobileMenuOpen}
                onClick={() => setMobileMenuOpen((open) => !open)}
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            )}
            <button
              className="icon-button collapse-button"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!collapsed}
              onClick={() => setCollapsed(!collapsed)}
            >
              {dashboardWorld ? (
                <Map className="topbar-map-icon" size={18} strokeWidth={1.5} />
              ) : collapsed ? (
                <PanelLeftOpen size={19} />
              ) : (
                <PanelLeftClose size={19} />
              )}
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
              onClick={(event) => { guideReturnFocusRef.current = event.currentTarget; setGuideOpen(true) }}
            >
              <HelpCircle size={19} />
            </button>
            {user && dashboardWorld && (
              <>
                <NavLink to="/settings" className="icon-button topbar-settings" aria-label="Open settings">
                  <Settings size={19} />
                </NavLink>
                <NavLink to="/character" className="topbar-profile-link" aria-label="Open your character">
                  <span className="topbar-avatar-initial">{userInitial}</span>
                  <ChevronDown size={15} />
                </NavLink>
              </>
            )}
          </div>
        </header>
        {dashboardWorld && (
          <div className="dashboard-ambience" aria-hidden="true">
            <span className="dashboard-lightning-flash" />
            <span className="dashboard-mist dashboard-mist-one" />
            <span className="dashboard-mist dashboard-mist-two" />
            <span className="dashboard-lantern-glow" />
          </div>
        )}
        <main id="main-content" tabIndex={-1} ref={mainRef}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              className="route-stage"
              key={pathname}
              initial={moving ? { opacity: 0, y: 8 } : false}
              animate={{ opacity: 1, y: 0 }}
              exit={moving ? { opacity: 0, y: -5 } : { opacity: 1 }}
              transition={{ duration: moving ? 0.18 : 0 }}
            >
              <Suspense fallback={<PageSkeleton />}>
                <Outlet context={{ gentleMotion, setGentleMotion, soundEnabled, setSoundEnabled }} />
              </Suspense>
            </motion.div>
          </AnimatePresence>
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
        returnFocusRef={guideReturnFocusRef}
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
          Complete saved quests to earn XP and gold, keep your streak alive in Activity, then spend
          gold on cosmetic rewards in the Marketplace. Owned rewards can be equipped from Inventory
          without changing your XP or gameplay power.
        </div>
        <button className="button button-gold full-width" onClick={() => setGuideOpen(false)}>
          Let’s explore <Compass size={16} />
        </button>
      </Modal>
    </div>
  )
}
