import { ArrowRight, BookOpen, Diamond, Gift, Sparkles, Swords, Trophy } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePageMeta } from '../lib/meta.js'

const progression = [
  {
    icon: Swords,
    title: 'Quests',
    copy: 'Turn goals into adventures',
  },
  {
    icon: Sparkles,
    title: 'Level Up',
    copy: 'Grow through consistency',
  },
  {
    icon: Diamond,
    title: 'Attributes',
    copy: 'Build your real life character',
  },
  {
    icon: Gift,
    title: 'Rewards',
    copy: 'Earn gold and collect relics',
  },
]

const systems = [
  {
    icon: BookOpen,
    title: 'Turn plans into quests',
    copy: 'Create one-time or daily quests, choose the part of yourself they train, and give today a clear next step.',
  },
  {
    icon: Swords,
    title: 'Grow a real character',
    copy: 'Completing quests earns server-calculated XP and develops Intellect, Strength, Discipline, Creativity, or Vitality.',
  },
  {
    icon: Trophy,
    title: 'Make progress tangible',
    copy: 'Keep streaks alive, earn gold, unlock cosmetics, and build a history that survives refreshes and devices.',
  },
]

export default function Landing() {
  const heroRef = useRef(null)
  const [lightning, setLightning] = useState(false)

  usePageMeta({
    title: 'Life RPG · The Adventurer’s Atlas',
    description:
      'Turn goals into quests, build your attributes, earn XP, collect rewards, and turn everyday progress into your own adventure.',
    path: '/',
  })

  useEffect(() => {
    const hero = heroRef.current
    if (!hero) return undefined

    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)')
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0

    const resetPointer = () => {
      hero.style.setProperty('--hero-copy-x', '0px')
      hero.style.setProperty('--hero-copy-y', '0px')
      hero.style.setProperty('--hero-atmos-x', '0px')
      hero.style.setProperty('--hero-atmos-y', '0px')
      hero.style.setProperty('--hero-light-x', '0px')
      hero.style.setProperty('--hero-light-y', '0px')
    }

    const handlePointerMove = (event) => {
      if (!finePointer.matches || reducedMotion.matches) return
      const bounds = hero.getBoundingClientRect()
      const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2
      const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2

      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        hero.style.setProperty('--hero-copy-x', `${x * 3}px`)
        hero.style.setProperty('--hero-copy-y', `${y * 2}px`)
        hero.style.setProperty('--hero-atmos-x', `${x * 7}px`)
        hero.style.setProperty('--hero-atmos-y', `${y * 4}px`)
        hero.style.setProperty('--hero-light-x', `${x * -5}px`)
        hero.style.setProperty('--hero-light-y', `${y * -3}px`)
      })
    }

    const handleScroll = () => {
      if (reducedMotion.matches) return
      const progress = Math.min(window.scrollY / Math.max(hero.offsetHeight, 1), 1)
      hero.style.setProperty('--world-scale', String(1 + progress * 0.04))
      hero.style.setProperty('--hero-scroll-y', `${progress * -22}px`)
      hero.style.setProperty('--mist-scroll-y', `${progress * -14}px`)
    }

    hero.addEventListener('pointermove', handlePointerMove)
    hero.addEventListener('pointerleave', resetPointer)
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return () => {
      cancelAnimationFrame(frame)
      hero.removeEventListener('pointermove', handlePointerMove)
      hero.removeEventListener('pointerleave', resetPointer)
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (reducedMotion.matches) return undefined

    let nextFlash
    let flashEnd
    let stopped = false

    const scheduleFlash = () => {
      const mobile = window.matchMedia('(max-width: 720px)').matches
      const minimum = mobile ? 9000 : 8000
      const delay = minimum + Math.random() * 7000
      nextFlash = window.setTimeout(() => {
        if (stopped) return
        setLightning(true)
        flashEnd = window.setTimeout(() => {
          setLightning(false)
          if (!stopped) scheduleFlash()
        }, 430)
      }, delay)
    }

    scheduleFlash()
    return () => {
      stopped = true
      window.clearTimeout(nextFlash)
      window.clearTimeout(flashEnd)
    }
  }, [])

  return (
    <div className="marketing-page landing-page">
      <section
        ref={heroRef}
        id="top"
        className={`landing-cinematic-hero ${lightning ? 'is-lightning' : ''}`}
        aria-labelledby="landing-title"
      >
        <div className="landing-world" aria-hidden="true">
          <picture>
            <source media="(max-width: 720px)" srcSet="/landing-1.png" />
            <img src="/Landing.png" alt="" fetchPriority="high" />
          </picture>
        </div>

        <div className="landing-scene-shade" aria-hidden="true" />
        <div className="landing-light-field" aria-hidden="true" />
        <div className="landing-lightning-flash" aria-hidden="true" />
        <div className="landing-rain" aria-hidden="true" />
        <div className="landing-mist landing-mist-one" aria-hidden="true" />
        <div className="landing-mist landing-mist-two" aria-hidden="true" />
        <div className="landing-embers" aria-hidden="true">
          {Array.from({ length: 8 }, (_, index) => <i key={index} />)}
        </div>

        <div className="landing-copy-shell">
          <span className="landing-eyebrow">
            <i aria-hidden="true" />
            <span>✦ YOUR STORY BEGINS HERE ✦</span>
            <i aria-hidden="true" />
          </span>

          <h1 id="landing-title">
            <span>Your everyday life,</span>
            <strong><span>turned into an</span> <span>adventure.</span></strong>
          </h1>

          <p className="landing-description">
            <span className="landing-description-desktop">
              Turn goals into quests. Build your attributes. Earn XP, collect rewards, and discover how far consistent
              effort can take you.
            </span>
            <span className="landing-description-mobile">
              Turn goals into quests, earn XP, build your attributes, and turn everyday progress into your own story.
            </span>
          </p>

          <div className="landing-actions">
            <Link className="landing-button landing-button-primary" to="/signup">
              <span>Begin Your Journey</span>
              <span className="landing-button-arrow" aria-hidden="true">→</span>
            </Link>
            <a className="landing-button landing-button-secondary" href="#journey">
              Explore the Atlas
            </a>
          </div>

          <p className="landing-quote">“Small steps become legendary journeys.”</p>
        </div>

        <div className="landing-progression" aria-label="Life RPG progression systems">
          {progression.map(({ icon: Icon, title, copy }) => (
            <div className="landing-progression-item" key={title}>
              <Icon size={17} strokeWidth={1.45} aria-hidden="true" />
              <div>
                <strong>{title}</strong>
                <span>{copy}</span>
              </div>
            </div>
          ))}
        </div>

        <a className="landing-scroll-cue" href="#journey">
          <span>DISCOVER YOUR JOURNEY</span>
          <i aria-hidden="true">↓</i>
        </a>
      </section>

      <section id="journey" className="marketing-section marketing-intro" aria-labelledby="why-life-rpg">
        <span className="eyebrow">THE CORE LOOP</span>
        <h2 id="why-life-rpg">Do the thing. See yourself grow.</h2>
        <p>
          Productivity apps usually stop at the checkbox. Life RPG turns the checkbox into the start of a progression loop.
        </p>
        <div className="system-grid">
          {systems.map(({ icon: Icon, title, copy }, index) => (
            <article className="system-card" key={title}>
              <span className="system-number">0{index + 1}</span>
              <Icon size={24} />
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-section loop-section" aria-labelledby="daily-loop">
        <div>
          <span className="eyebrow">A LOOP WORTH RETURNING TO</span>
          <h2 id="daily-loop">One meaningful action becomes visible progress.</h2>
          <p>
            Rewards are calculated on the server, completion history is preserved, and daily quests have one valid reward window per scheduled day.
          </p>
          <Link className="text-link" to="/how-it-works">Explore the full loop <ArrowRight size={15} /></Link>
        </div>
        <ol className="loop-steps">
          <li><span>01</span><strong>Create a quest</strong><p>Choose what you want to do and what attribute it trains.</p></li>
          <li><span>02</span><strong>Complete it in real life</strong><p>Mark it complete only when the work is actually done.</p></li>
          <li><span>03</span><strong>Earn XP and gold</strong><p>Secure server logic records one immutable reward receipt.</p></li>
          <li><span>04</span><strong>Return stronger</strong><p>Build attributes, streaks, cosmetics, and a long-term history.</p></li>
        </ol>
      </section>

      <section id="about" className="marketing-cta">
        <span className="eyebrow">YOUR FIRST QUEST IS SMALL ON PURPOSE</span>
        <h2>Start with one thing you already want to do.</h2>
        <p>No leaderboard. No fake urgency. Just a clearer reason to show up for yourself.</p>
        <Link className="button button-gold" to="/signup">Create your character <ArrowRight size={17} /></Link>
      </section>
    </div>
  )
}
