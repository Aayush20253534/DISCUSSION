import { useContext, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Compass, ArrowLeft, Sparkles } from 'lucide-react'
import { motion, MotionConfigContext, useReducedMotion } from 'motion/react'
import Landscape from './Landscape.jsx'

export default function AuthLayout({ title, eyebrow, description, children }) {
  const reducedMotion = useReducedMotion()
  const motionConfig = useContext(MotionConfigContext)
  const animate = !reducedMotion && motionConfig.reducedMotion !== 'always'
  useEffect(() => {
    document.title = `${title} · Life RPG`
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [title])
  return (
    <main className="auth-page">
      <section className="auth-story" aria-label="Your everyday adventure">
        <Landscape />
        <Link className="auth-brand" to="/">
          <Compass size={28} /> life<span>rpg</span>
        </Link>
        <div className="auth-story-copy">
          <span className="eyebrow">A LITTLE BETTER, EVERY DAY</span>
          <h2>
            Every great story
            <br /> begins with <em>you.</em>
          </h2>
          <p>
            Make room for the things that matter.
            <br />
            Your next chapter is waiting.
          </p>
          <div className="auth-story-note">
            <Sparkles size={18} /> Small steps. Endless possibilities.
          </div>
        </div>
        <span className="auth-coordinate">THE EVERGREEN TRAIL &nbsp; · &nbsp; 02 / ∞</span>
      </section>
      <section className="auth-form-side">
        <Link className="text-link auth-back" to="/">
          <ArrowLeft size={16} /> Back to the world
        </Link>
        <motion.div
          className="auth-card"
          initial={animate ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ duration: animate ? 0.25 : 0 }}
        >
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="auth-description">{description}</p>
          {children}
        </motion.div>
        <p className="auth-footer">Life is the adventure. You are the hero.</p>
      </section>
    </main>
  )
}
