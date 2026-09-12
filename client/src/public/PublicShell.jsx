import { Compass, LogIn, Menu, X } from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useInteractionFeedback } from '../interactions/interaction-context.js'
import './public.css'

export default function PublicShell({ gentleMotion, setGentleMotion, soundEnabled, setSoundEnabled }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { moving } = useInteractionFeedback()
  const { pathname } = useLocation()
  const mainRef = useRef(null)
  const previousPath = useRef(pathname)
  useEffect(() => {
    if (previousPath.current !== pathname) {
      mainRef.current?.focus({ preventScroll: true })
      window.scrollTo({ top: 0, behavior: 'instant' })
      previousPath.current = pathname
    }
  }, [pathname])
  useEffect(() => {
    if (!menuOpen) return
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [menuOpen])
  return (
    <div className="public-site">
      <a className="skip-link" href="#public-main">
        Skip to content
      </a>
      <header className="public-header">
        <NavLink className="public-brand" to="/" aria-label="Life RPG home" onClick={() => setMenuOpen(false)}>
          <Compass size={27} strokeWidth={1.5} />
          <span>
            life<em>rpg</em>
            <small>MAKE EVERY DAY A QUEST</small>
          </span>
        </NavLink>
        <button
          className="public-menu-button"
          aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={menuOpen}
          aria-controls="public-navigation"
          onClick={() => setMenuOpen((value) => !value)}
        >
          {menuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
        <nav
          id="public-navigation"
          className={`public-nav ${menuOpen ? 'open' : ''}`}
          aria-label="Public navigation"
        >
          <NavLink to="/" end onClick={() => setMenuOpen(false)}>
            Home
          </NavLink>
          <NavLink to="/how-it-works" onClick={() => setMenuOpen(false)}>
            How it works
          </NavLink>
          <NavLink className="public-login" to="/login" onClick={() => setMenuOpen(false)}>
            <LogIn size={15} /> Sign in
          </NavLink>
          <NavLink className="button button-gold public-start" to="/signup" onClick={() => setMenuOpen(false)}>
            Start your adventure
          </NavLink>
        </nav>
      </header>
      <main id="public-main" tabIndex={-1} ref={mainRef}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            className="route-stage"
            key={pathname}
            initial={moving ? { opacity: 0, y: 8 } : false}
            animate={{ opacity: 1, y: 0 }}
            exit={moving ? { opacity: 0, y: -5 } : { opacity: 1 }}
            transition={{ duration: moving ? 0.18 : 0 }}
          >
            <Outlet context={{ gentleMotion, setGentleMotion, soundEnabled, setSoundEnabled }} />
          </motion.div>
        </AnimatePresence>
      </main>
      <footer className="public-footer">
        <div>
          <span className="public-footer-brand"><Compass size={18} /> Life RPG</span>
          <p>Turn ordinary effort into visible progress.</p>
        </div>
        <nav aria-label="Footer navigation">
          <NavLink to="/how-it-works">How it works</NavLink>
          <NavLink to="/login">Sign in</NavLink>
          <NavLink to="/signup">Create account</NavLink>
        </nav>
        <small>Life is the adventure. You are the hero.</small>
      </footer>
    </div>
  )
}
