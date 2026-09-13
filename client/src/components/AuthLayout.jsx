import { useContext } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Compass, Sparkles } from 'lucide-react'
import { motion, MotionConfigContext, useReducedMotion } from 'motion/react'
import Landscape from './Landscape.jsx'
import { usePageMeta } from '../lib/meta.js'

export default function AuthLayout({
  title,
  titleAccent,
  eyebrow,
  description,
  children,
  variant = 'default',
  cardClassName = '',
}) {
  const reducedMotion = useReducedMotion()
  const motionConfig = useContext(MotionConfigContext)
  const animate = !reducedMotion && motionConfig.reducedMotion !== 'always'
  const metaTitle = [title, titleAccent].filter(Boolean).join(' ')

  usePageMeta({
    title: `${metaTitle} · AtlasBorn`,
    description: 'Secure AtlasBorn account access.',
    noindex: true,
  })

  if (variant === 'login' || variant === 'signup') {
    const signupPortal = variant === 'signup'
    return (
      <main className={`auth-page login-auth-page ${signupPortal ? 'signup-auth-page' : ''}`}>
        <div className="login-page-vignette" aria-hidden="true" />

        <Link className="login-brand" to="/" aria-label="AtlasBorn home">
          <span className="login-brand-mark" aria-hidden="true">
            <Compass size={35} strokeWidth={1.35} />
          </span>
          <span className="login-brand-copy">
            <strong>ATLASBORN</strong>
            <small>THE ADVENTURER&apos;S ATLAS</small>
          </span>
        </Link>

        <Link className="login-back" to="/">
          <ArrowLeft size={18} />
          <span>Back to the world</span>
        </Link>

        <p className="login-world-quote" aria-hidden="true">
          {signupPortal ? (
            <>
              “Every legend starts,
              <br />
              with one deliberate step.”
            </>
          ) : (
            <>
              “The same you,
              <br />
              with a greater story ahead.”
            </>
          )}
        </p>

        <motion.section
          className={`auth-card login-portal-card ${signupPortal ? 'signup-portal-card' : ''} ${cardClassName}`.trim()}
          initial={animate ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ duration: animate ? 0.32 : 0, ease: 'easeOut' }}
          aria-label={signupPortal ? 'Create a AtlasBorn account' : 'Sign in to AtlasBorn'}
        >
          <div className="login-card-medallion" aria-hidden="true">
            <Compass size={42} strokeWidth={1.1} />
          </div>
          <p className="eyebrow login-eyebrow">{eyebrow}</p>
          <h1 className="login-title">
            <span>{title}</span>
            {titleAccent && <em>{titleAccent}</em>}
          </h1>
          <p className="auth-description login-description">{description}</p>
          {children}
        </motion.section>
      </main>
    )
  }

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
