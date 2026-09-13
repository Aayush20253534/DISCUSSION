import { NavLink } from 'react-router-dom'
import {
  ChevronDown,
  Compass,
  HelpCircle,
  Map,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  X,
} from 'lucide-react'

/**
 * One compact authenticated topbar for every private route.
 *
 * This intentionally mirrors the Overview header. Keeping it here prevents
 * route-specific pages from growing their own slightly different nav bars
 * (and, more importantly, prevents decorative portraits from changing the
 * header height).
 */
export default function AdventureTopbar({
  user,
  adventureShell,
  collapsed,
  mobileMenuOpen,
  onToggleMobileMenu,
  onToggleSidebar,
  onOpenGuide,
}) {
  const userInitial = user?.displayName?.trim()?.charAt(0)?.toUpperCase() || 'A'

  return (
    <header className="topbar adventure-topbar">
      <div className="topbar-left">
        {adventureShell && (
          <button
            className="icon-button mobile-menu-button"
            aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={mobileMenuOpen}
            onClick={onToggleMobileMenu}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        )}
        <button
          className="icon-button collapse-button"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          onClick={onToggleSidebar}
        >
          {adventureShell ? (
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
          onClick={onOpenGuide}
        >
          <HelpCircle size={19} />
        </button>
        {user && adventureShell && (
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
  )
}
