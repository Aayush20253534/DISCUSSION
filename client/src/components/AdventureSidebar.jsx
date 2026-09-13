import { Compass, LogOut, PackageCheck, Settings } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { adventureNavigation } from './adventure-navigation.js'

export default function AdventureSidebar({
  collapsed,
  user,
  signingOut,
  signOutError,
  onSignOut,
  onNavigate,
}) {
  return (
    <aside className="sidebar adventure-sidebar">
      <NavLink to="/" className="brand" aria-label="AtlasBorn home" onClick={onNavigate}>
        <span className="brand-mark" aria-hidden="true">
          <Compass size={34} strokeWidth={1.25} />
        </span>
        <span className="brand-word">
          <strong>ATLASBORN</strong>
          <small>THE ADVENTURER&apos;S ATLAS</small>
        </span>
      </NavLink>

      <div className="sidebar-section-label">YOUR ADVENTURE</div>
      <nav className="primary-nav" aria-label="Main navigation">
        {adventureNavigation.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            aria-label={label}
            title={collapsed ? label : undefined}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            onClick={onNavigate}
          >
            <Icon size={20} strokeWidth={1.6} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <nav className="mobile-sidebar-support-nav" aria-label="Account navigation">
        <NavLink
          to="/inventory"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          onClick={onNavigate}
        >
          <PackageCheck size={20} strokeWidth={1.6} />
          <span>Inventory</span>
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          onClick={onNavigate}
        >
          <Settings size={20} strokeWidth={1.6} />
          <span>Preferences</span>
        </NavLink>
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
            onClick={onSignOut}
            disabled={signingOut}
            aria-label={signingOut ? 'Signing out' : 'Sign out'}
            title={collapsed ? (signingOut ? 'Signing out…' : 'Sign out') : undefined}
          >
            <LogOut size={18} strokeWidth={1.6} />
            <span>{signingOut ? 'Signing out…' : 'Sign out'}</span>
          </button>
        )}

        {signOutError && user && (
          <p className="sidebar-signout-error" role="alert">
            {signOutError}
          </p>
        )}
      </div>
    </aside>
  )
}
