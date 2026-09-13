import { Suspense, useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Compass, Settings } from 'lucide-react'
import { useQuestSync } from '../quests/hooks.js'
import { useEconomySync } from '../economy/hooks.js'
import { equippedItem } from '../economy/equipment.js'
import AdventureSidebar from './AdventureSidebar.jsx'
import AdventureTopbar from './AdventureTopbar.jsx'
import { adventureNavigation } from './adventure-navigation.js'
import './adventure-shell.css'
import { useAuth } from '../auth/useAuth.js'
import { Modal, PageSkeleton } from './ui.jsx'
import PublicShell from '../public/PublicShell.jsx'
import { applyPageMeta } from '../lib/meta.js'

export default function AppShell({ gentleMotion, setGentleMotion, soundEnabled, setSoundEnabled }) {
  const auth = useAuth()
  const { user } = auth
  useQuestSync()
  useEconomySync()
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
  const adventureShell = Boolean(user)
  const dashboardWorld = Boolean(user && pathname === '/')
  const questWorld = Boolean(user && pathname === '/quests')
  const activityWorld = Boolean(user && pathname === '/activity')
  const characterWorld = Boolean(user && pathname === '/character')
  const marketplaceWorld = Boolean(user && pathname === '/marketplace')
  const inventoryWorld = Boolean(user && pathname === '/inventory')
  const settingsWorld = Boolean(user && pathname === '/settings')
  const marketWorld = marketplaceWorld || inventoryWorld
  const immersiveWorld = dashboardWorld || questWorld || activityWorld || characterWorld || marketWorld || settingsWorld
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
        adventureNavigation.find(({ to }) => to === pathname)?.label ||
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
    <div className={`app-shell ${adventureShell ? 'adventure-shell' : ''} ${collapsed ? 'sidebar-collapsed' : ''} ${dashboardWorld || settingsWorld ? 'dashboard-world' : ''} ${questWorld ? 'quest-world' : ''} ${activityWorld ? 'activity-world' : ''} ${characterWorld ? 'character-world' : ''} ${marketWorld ? 'marketplace-world' : ''} ${inventoryWorld ? 'inventory-world' : ''} ${settingsWorld ? 'settings-world' : ''} ${mobileMenuOpen ? 'mobile-sidebar-open' : ''}`}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <AdventureSidebar
        collapsed={collapsed}
        user={user}
        signingOut={signingOut}
        signOutError={signOutError}
        onSignOut={signOut}
        onNavigate={() => setMobileMenuOpen(false)}
      />
      {adventureShell && (
        <button
          type="button"
          className="mobile-sidebar-scrim"
          aria-label="Close navigation"
          tabIndex={mobileMenuOpen ? 0 : -1}
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <div className="workspace">
        <AdventureTopbar
          user={user}
          adventureShell={adventureShell}
          collapsed={collapsed}
          mobileMenuOpen={mobileMenuOpen}
          onToggleMobileMenu={() => setMobileMenuOpen((open) => !open)}
          onToggleSidebar={() => setCollapsed((value) => !value)}
          onOpenGuide={(event) => {
            guideReturnFocusRef.current = event.currentTarget
            setGuideOpen(true)
          }}
        />
        {immersiveWorld && (
          <div className="dashboard-ambience" aria-hidden="true">
            <span className="dashboard-lightning-flash" />
            <span className="dashboard-mist dashboard-mist-one" />
            <span className="dashboard-mist dashboard-mist-two" />
            <span className="dashboard-lantern-glow" />
          </div>
        )}
        <main id="main-content" tabIndex={-1} ref={mainRef}>
          <div className="route-stage" key={pathname}>
            <Suspense fallback={<PageSkeleton />}>
              <Outlet context={{ gentleMotion, setGentleMotion, soundEnabled, setSoundEnabled }} />
            </Suspense>
          </div>
        </main>
        <footer className="app-footer">
          <span>Life is the adventure. You are the hero.</span>
          <span>
            LIFE RPG <span className="footer-star">✦</span> A LITTLE BETTER, EVERY DAY
          </span>
        </footer>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {[...adventureNavigation, { to: '/settings', label: 'Preferences', icon: Settings }].map(
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
