import { Compass, LogIn, Menu, X } from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useInteractionFeedback } from '../interactions/interaction-context.js'
import './public.css'

export default function PublicShell({ gentleMotion, setGentleMotion, soundEnabled, setSoundEnabled }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [headerScrolled, setHeaderScrolled] = useState(false)
  const { moving } = useInteractionFeedback()
  const { pathname } = useLocation()
  const mainRef = useRef(null)
  const previousPath = useRef(pathname)
  const isLanding = pathname === '/'

  useEffect(() => {
    if (previousPath.current !== pathname) {
      mainRef.current?.focus({ preventScroll: true })
      window.scrollTo({ top: 0, behavior: 'instant' })
      setMenuOpen(false)
      previousPath.current = pathname
    }
  }, [pathname])

  useEffect(() => {
    if (!isLanding) {
      setHeaderScrolled(false)
      return undefined
    }

    const handleScroll = () => setHeaderScrolled(window.scrollY > 24)
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [isLanding])

  useEffect(() => {
    if (!menuOpen) return undefined

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [menuOpen])

  const closeMenu = () => setMenuOpen(false)

  return (
    <div className={`public-site ${isLanding ? 'public-site-landing' : ''}`}>
      <a className="skip-link" href="#public-main">
        Skip to content
      </a>
      <header
        className={`public-header ${isLanding ? 'landing-header' : ''} ${headerScrolled ? 'is-scrolled' : ''} ${menuOpen ? 'menu-open' : ''}`}
      >
        <NavLink className="public-brand" to="/" aria-label="Life RPG home" onClick={closeMenu}>
          <span className="public-brand-compass" aria-hidden="true">
            <Compass size={28} strokeWidth={1.35} />
          </span>
          <span>
            {isLanding ? 'LIFE RPG' : <>life<em>rpg</em></>}
            <small>{isLanding ? "THE ADVENTURER'S ATLAS" : 'MAKE EVERY DAY A QUEST'}</small>
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
          className={`public-nav ${menuOpen ? 'open' : ''} ${isLanding ? 'landing-nav' : ''}`}
          aria-label="Public navigation"
        >
          {isLanding ? (
            <>
              <span className="landing-nav-center">
                <a className="landing-nav-link" href="#top" onClick={closeMenu}>Home</a>
                <a className="landing-nav-link" href="#journey" onClick={closeMenu}>The Journey</a>
                <NavLink className="landing-nav-link" to="/how-it-works" onClick={closeMenu}>How It Works</NavLink>
                <a className="landing-nav-link" href="#atlas" onClick={closeMenu}>The Atlas</a>
              </span>
              <span className="landing-nav-actions">
                <NavLink className="public-login landing-login" to="/login" onClick={closeMenu}>Login</NavLink>
                <NavLink className="landing-nav-cta" to="/signup" onClick={closeMenu}>Begin Your Journey</NavLink>
              </span>
            </>
          ) : (
            <>
              <NavLink to="/" end onClick={closeMenu}>Home</NavLink>
              <NavLink to="/how-it-works" onClick={closeMenu}>How it works</NavLink>
              <NavLink className="public-login" to="/login" onClick={closeMenu}>
                <LogIn size={15} /> Sign in
              </NavLink>
              <NavLink className="button button-gold public-start" to="/signup" onClick={closeMenu}>
                Start your adventure
              </NavLink>
            </>
          )}
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
      <footer className={`public-footer ${isLanding ? 'atlas-footer' : ''}`}>
        {isLanding ? (
          <>
            <div className="atlas-footer-brand">
              <span className="public-footer-brand"><Compass size={20} strokeWidth={1.25} /> LIFE RPG</span>
              <small>THE ADVENTURER’S ATLAS</small>
              <p>Every journey begins with a single step.</p>
            </div>
            <nav aria-label="Footer navigation">
              <a href="#journey">The Journey</a>
              <NavLink to="/how-it-works">How It Works</NavLink>
              <a href="#atlas">The Atlas</a>
              <NavLink to="/login">Login</NavLink>
            </nav>
            <div className="atlas-footer-cta">
              <span>YOUR NEXT QUEST AWAITS</span>
              <NavLink to="/signup">Begin Your Journey <span aria-hidden="true">→</span></NavLink>
            </div>
            <small className="atlas-footer-legal">© 2026 LIFE RPG · YOUR LIFE IS THE ADVENTURE.</small>
          </>
        ) : (
          <>
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
          </>
        )}
      </footer>
    </div>
  )
}
