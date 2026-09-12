import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Coins,
  Compass,
  Crown,
  Diamond,
  Dumbbell,
  Flame,
  Gem,
  Gift,
  HeartPulse,
  Palette,
  ScrollText,
  Shield,
  Sparkles,
  Swords,
  Trophy,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { usePageMeta } from '../lib/meta.js'
import '../public/landing.css'

const progression = [
  { icon: Swords, title: 'Quests', copy: 'Turn goals into adventures' },
  { icon: Sparkles, title: 'Level Up', copy: 'Grow through consistency' },
  { icon: Diamond, title: 'Attributes', copy: 'Build your real life character' },
  { icon: Gift, title: 'Rewards', copy: 'Earn gold and collect relics' },
]

const coreLoop = [
  {
    icon: ScrollText,
    number: '01',
    title: 'Accept a Quest',
    copy: 'Turn plans, habits, and goals into meaningful quests with clear difficulty and rewards.',
    detail: 'Choose a realm · Set the challenge · Begin',
  },
  {
    icon: Sparkles,
    number: '02',
    title: 'Gain XP & Attributes',
    copy: 'Every completed quest grows your real-life character through XP, streaks, and stat progression.',
    detail: '+ XP · + Attribute growth · + Momentum',
  },
  {
    icon: Trophy,
    number: '03',
    title: 'Unlock Rewards',
    copy: 'Earn gold, collect relics, unlock themes, and watch your journey become visible over time.',
    detail: 'Gold · Relics · Titles · Milestones',
  },
]

const realms = [
  {
    icon: BookOpen,
    stat: 'INTELLECT',
    realm: 'Arcane Archives',
    copy: 'Reading, coding, studying, and learning sharpen your mind.',
    position: 'realm-north-west',
    glyph: 'I',
  },
  {
    icon: Dumbbell,
    stat: 'STRENGTH',
    realm: 'Iron Peaks',
    copy: 'Training, exercise, and endurance quests forge resilience.',
    position: 'realm-north-east',
    glyph: 'S',
  },
  {
    icon: Shield,
    stat: 'DISCIPLINE',
    realm: 'Citadel of Resolve',
    copy: 'Consistency, routines, and follow-through strengthen your foundation.',
    position: 'realm-center',
    glyph: 'D',
  },
  {
    icon: Palette,
    stat: 'CREATIVITY',
    realm: 'Emberwild',
    copy: 'Writing, design, music, and imagination expand your spark.',
    position: 'realm-south-west',
    glyph: 'C',
  },
  {
    icon: HeartPulse,
    stat: 'VITALITY',
    realm: 'Verdant Reach',
    copy: 'Rest, balance, and self-care help your journey stay sustainable.',
    position: 'realm-south-east',
    glyph: 'V',
  },
]

const marketplaceItems = [
  { icon: Gem, name: 'Moonlit Crest', category: 'CREST', price: 420, rarity: 'Rare' },
  { icon: Compass, name: 'Wayfinder Sigil', category: 'RELIC', price: 680, rarity: 'Epic' },
  { icon: Crown, name: 'Warden of Dawn', category: 'TITLE', price: 510, rarity: 'Rare' },
  { icon: Sparkles, name: 'Astral Atlas', category: 'THEME', price: 900, rarity: 'Legendary' },
]

const chronicleEntries = [
  { icon: Crown, title: 'Reached Level 7', time: 'Today', copy: 'Your consistency carried you beyond the Wayfarer rank.' },
  { icon: Flame, title: '7-Day Streak Achieved', time: 'Yesterday', copy: 'Seven consecutive days of showing up became part of the record.' },
  { icon: Swords, title: '50 Quests Completed', time: '4 days ago', copy: 'Fifty pieces of real effort are now written into your chronicle.' },
  { icon: Diamond, title: 'Unlocked Focus Ring', time: '1 week ago', copy: 'A new relic entered your collection through disciplined progress.' },
]

const streakDays = Array.from({ length: 35 }, (_, index) => ({
  active: [1, 2, 4, 5, 8, 9, 10, 12, 14, 15, 16, 17, 19, 21, 22, 23, 24, 25, 28, 29, 30, 31, 32, 33].includes(index),
  strong: [10, 16, 17, 24, 31, 32].includes(index),
}))

const differences = [
  {
    number: 'I',
    title: 'Immediate feedback',
    copy: 'Completing a task should feel satisfying, not invisible. Every quest answers back with progress.',
  },
  {
    number: 'II',
    title: 'Character identity',
    copy: 'Your habits shape a version of yourself you can actually see, train, equip, and understand.',
  },
  {
    number: 'III',
    title: 'Long-term progression',
    copy: 'Daily consistency becomes a visible path instead of disappearing into a forgotten checklist.',
  },
]

const questContracts = [
  {
    icon: BookOpen,
    title: 'Solve 3 coding problems',
    realm: 'Arcane Archives',
    difficulty: 'HARD',
    xp: 120,
    gold: 24,
    stat: 'INTELLECT',
  },
  {
    icon: Dumbbell,
    title: 'Train for 40 minutes',
    realm: 'Iron Peaks',
    difficulty: 'MEDIUM',
    xp: 85,
    gold: 16,
    stat: 'STRENGTH',
  },
  {
    icon: Shield,
    title: 'Deep work for 60 minutes',
    realm: 'Citadel of Resolve',
    difficulty: 'EPIC',
    xp: 150,
    gold: 30,
    stat: 'DISCIPLINE',
  },
]

const journeyChapters = [
  { id: 'top', label: 'The Call' },
  { id: 'how-it-works', label: 'How It Works' },
  { id: 'atlas', label: 'Atlas' },
  { id: 'quest-log', label: 'Quest Log' },
  { id: 'chronicle', label: 'Chronicle' },
  { id: 'begin', label: 'Begin' },
]

export default function Landing() {
  const heroRef = useRef(null)
  const atlasHomeRef = useRef(null)
  const [lightning, setLightning] = useState(false)
  const [stormPattern, setStormPattern] = useState(1)
  const [loaderPhase, setLoaderPhase] = useState('loading')
  const [activeChapter, setActiveChapter] = useState('top')
  const [questComplete, setQuestComplete] = useState(false)

  usePageMeta({
    title: 'Life RPG · The Adventurer’s Atlas',
    description:
      'Turn goals into quests, build your attributes, earn XP, collect rewards, and turn everyday progress into your own adventure.',
    path: '/',
  })

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const mobile = window.matchMedia('(max-width: 720px)').matches
    const source = mobile ? '/landing-1.png' : '/Landing.png'
    const previousOverflow = document.body.style.overflow
    let cancelled = false
    let finishing = false
    let leaveTimer
    let fallbackTimer

    document.body.style.overflow = 'hidden'

    const image = new Image()
    image.decoding = 'async'
    image.fetchPriority = 'high'
    image.src = source

    const imageReady = typeof image.decode === 'function'
      ? image.decode().catch(() => undefined)
      : new Promise((resolve) => {
          if (image.complete) {
            resolve()
            return
          }
          image.onload = resolve
          image.onerror = resolve
        })

    const fontsReady = document.fonts?.ready
      ? Promise.resolve(document.fonts.ready).catch(() => undefined)
      : Promise.resolve()

    const minimumHold = new Promise((resolve) => {
      window.setTimeout(resolve, reducedMotion ? 80 : 320)
    })

    const finishLoading = () => {
      if (cancelled || finishing) return
      finishing = true
      setLoaderPhase('leaving')
      leaveTimer = window.setTimeout(() => {
        if (cancelled) return
        setLoaderPhase('done')
        document.body.style.overflow = previousOverflow
      }, reducedMotion ? 90 : 360)
    }

    Promise.all([imageReady, fontsReady, minimumHold]).then(finishLoading)
    fallbackTimer = window.setTimeout(finishLoading, reducedMotion ? 400 : 2000)

    return () => {
      cancelled = true
      window.clearTimeout(leaveTimer)
      window.clearTimeout(fallbackTimer)
      document.body.style.overflow = previousOverflow
    }
  }, [])

  useEffect(() => {
    const hero = heroRef.current
    if (!hero) return undefined

    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)')
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let pointerFrame = 0
    let scrollFrame = 0
    let heroHeight = Math.max(hero.offsetHeight, 1)

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

      cancelAnimationFrame(pointerFrame)
      pointerFrame = requestAnimationFrame(() => {
        hero.style.setProperty('--hero-copy-x', `${x * 3}px`)
        hero.style.setProperty('--hero-copy-y', `${y * 2}px`)
        hero.style.setProperty('--hero-atmos-x', `${x * 7}px`)
        hero.style.setProperty('--hero-atmos-y', `${y * 4}px`)
        hero.style.setProperty('--hero-light-x', `${x * -5}px`)
        hero.style.setProperty('--hero-light-y', `${y * -3}px`)
      })
    }

    const paintScroll = () => {
      scrollFrame = 0
      if (reducedMotion.matches) return
      const progress = Math.min(window.scrollY / heroHeight, 1)
      hero.style.setProperty('--world-scale', String(1 + progress * 0.025))
      hero.style.setProperty('--hero-scroll-y', `${progress * -14}px`)
      hero.style.setProperty('--mist-scroll-y', `${progress * -8}px`)
    }

    const handleScroll = () => {
      if (!scrollFrame) scrollFrame = requestAnimationFrame(paintScroll)
    }

    const handleResize = () => {
      heroHeight = Math.max(hero.offsetHeight, 1)
      handleScroll()
    }

    hero.addEventListener('pointermove', handlePointerMove, { passive: true })
    hero.addEventListener('pointerleave', resetPointer)
    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleResize, { passive: true })
    paintScroll()

    return () => {
      cancelAnimationFrame(pointerFrame)
      cancelAnimationFrame(scrollFrame)
      hero.removeEventListener('pointermove', handlePointerMove)
      hero.removeEventListener('pointerleave', resetPointer)
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  useEffect(() => {
    const hero = heroRef.current
    if (!hero) return undefined

    if (!('IntersectionObserver' in window)) {
      hero.classList.add('is-hero-visible')
      return () => {
        hero.classList.remove('is-hero-visible')
      }
    }

    const observer = new IntersectionObserver(
      ([entry]) => hero.classList.toggle('is-hero-visible', Boolean(entry?.isIntersecting)),
      { rootMargin: '120px 0px', threshold: 0 },
    )
    observer.observe(hero)
    return () => {
      observer.disconnect()
      hero.classList.remove('is-hero-visible')
    }
  }, [])

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (reducedMotion.matches || loaderPhase !== 'done') return undefined

    let flashEnd
    let introFlash
    let stormInterval
    let stopped = false

    const fireStorm = (duration = 720) => {
      if (
        stopped ||
        document.hidden ||
        !heroRef.current?.classList.contains('is-hero-visible')
      )
        return
      setStormPattern((current) => (current % 3) + 1)
      setLightning(true)
      window.clearTimeout(flashEnd)
      flashEnd = window.setTimeout(() => {
        if (stopped) return
        setLightning(false)
      }, duration)
    }

    // A visible storm establishes the scene after loading, then a new strike
    // starts at a slower cadence so the effect does not monopolize the compositor.
    // The bolt geometry still rotates through three patterns without looking
    // like the same canned animation looping forever.
    introFlash = window.setTimeout(() => {
      fireStorm(780)
      stormInterval = window.setInterval(() => fireStorm(720), 8000)
    }, 420)

    return () => {
      stopped = true
      window.clearTimeout(introFlash)
      window.clearTimeout(flashEnd)
      window.clearInterval(stormInterval)
    }
  }, [loaderPhase])

  useEffect(() => {
    if (loaderPhase !== 'done') return undefined

    const nodes = Array.from(document.querySelectorAll('.atlas-reveal'))
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (reducedMotion || !('IntersectionObserver' in window)) {
      nodes.forEach((node) => node.classList.add('is-visible'))
      return undefined
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        })
      },
      { threshold: 0.13, rootMargin: '0px 0px -8% 0px' },
    )

    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [loaderPhase])

  useEffect(() => {
    if (loaderPhase !== 'done') return undefined

    const chapters = Array.from(document.querySelectorAll('[data-chapter]'))
    if (!chapters.length || !('IntersectionObserver' in window)) return undefined

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible?.target?.id) setActiveChapter(visible.target.id)
      },
      { rootMargin: '-28% 0px -48% 0px', threshold: [0.08, 0.2, 0.45] },
    )

    chapters.forEach((chapter) => observer.observe(chapter))
    return () => observer.disconnect()
  }, [loaderPhase])

  useEffect(() => {
    if (loaderPhase !== 'done') return undefined
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const questLog = document.getElementById('quest-log')
    const timers = []
    const observers = []

    // Reduced-motion styles hide the completion animation entirely, so there is
    // no state transition to perform here. Keeping this branch state-free also
    // avoids an unnecessary render when the effect starts.
    if (reducedMotion) return undefined

    if (questLog && 'IntersectionObserver' in window) {
      let played = false
      const observer = new IntersectionObserver(([entry]) => {
        if (!entry?.isIntersecting || played) return
        played = true
        timers.push(window.setTimeout(() => setQuestComplete(true), 850))
        observer.disconnect()
      }, { threshold: 0.42 })
      observer.observe(questLog)
      observers.push(observer)
    }

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
      observers.forEach((observer) => observer.disconnect())
    }
  }, [loaderPhase])


  useEffect(() => {
    if (loaderPhase !== 'done') return undefined
    const atlas = atlasHomeRef.current
    if (!atlas) return undefined

    let frame = 0
    const updateJourneyProgress = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const rect = atlas.getBoundingClientRect()
        const distance = Math.max(atlas.scrollHeight - window.innerHeight, 1)
        const travelled = Math.min(Math.max(-rect.top, 0), distance)
        atlas.style.setProperty('--atlas-scroll-progress', `${(travelled / distance) * 100}%`)
      })
    }

    updateJourneyProgress()
    window.addEventListener('scroll', updateJourneyProgress, { passive: true })
    window.addEventListener('resize', updateJourneyProgress)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', updateJourneyProgress)
      window.removeEventListener('resize', updateJourneyProgress)
    }
  }, [loaderPhase])

  useEffect(() => {
    if (loaderPhase !== 'done') return undefined
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)')
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!finePointer.matches || reducedMotion.matches) return undefined

    const targets = Array.from(document.querySelectorAll('[data-atlas-tilt]'))
    const cleanups = targets.map((target) => {
      let frame = 0
      const move = (event) => {
        const bounds = target.getBoundingClientRect()
        const x = ((event.clientX - bounds.left) / Math.max(bounds.width, 1) - 0.5) * 2
        const y = ((event.clientY - bounds.top) / Math.max(bounds.height, 1) - 0.5) * 2
        cancelAnimationFrame(frame)
        frame = requestAnimationFrame(() => {
          target.style.setProperty('--atlas-tilt-x', `${y * -2.4}deg`)
          target.style.setProperty('--atlas-tilt-y', `${x * 3.2}deg`)
          target.style.setProperty('--atlas-glow-x', `${50 + x * 18}%`)
          target.style.setProperty('--atlas-glow-y', `${44 + y * 14}%`)
        })
      }
      const reset = () => {
        cancelAnimationFrame(frame)
        target.style.setProperty('--atlas-tilt-x', '0deg')
        target.style.setProperty('--atlas-tilt-y', '0deg')
        target.style.setProperty('--atlas-glow-x', '50%')
        target.style.setProperty('--atlas-glow-y', '44%')
      }
      target.addEventListener('pointermove', move)
      target.addEventListener('pointerleave', reset)
      return () => {
        cancelAnimationFrame(frame)
        target.removeEventListener('pointermove', move)
        target.removeEventListener('pointerleave', reset)
      }
    })

    return () => cleanups.forEach((cleanup) => cleanup())
  }, [loaderPhase])

  const loader = loaderPhase !== 'done' && typeof document !== 'undefined'
    ? createPortal(
        <div
          className={`landing-loader ${loaderPhase === 'leaving' ? 'is-leaving' : ''}`}
          role="status"
          aria-live="polite"
          aria-label="Loading Life RPG"
        >
          <div className="landing-loader-clouds" aria-hidden="true" />
          <div className="landing-loader-rain" aria-hidden="true" />
          <div className="landing-loader-flash" aria-hidden="true" />
          <div className="landing-loader-flash landing-loader-flash-secondary" aria-hidden="true" />
          <div className="landing-loader-shockwave" aria-hidden="true" />

          <svg className="landing-loader-bolt landing-loader-bolt-primary" viewBox="0 0 640 820" aria-hidden="true">
            <defs>
              <filter id="landing-loader-electric-glow" x="-80%" y="-30%" width="260%" height="180%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <path className="landing-loader-bolt-glow" d="M420 -20 L390 118 L430 152 L363 268 L400 304 L320 432 L353 465 L277 586 L301 615 L240 780" />
            <path className="landing-loader-bolt-core" d="M420 -20 L390 118 L430 152 L363 268 L400 304 L320 432 L353 465 L277 586 L301 615 L240 780" />
            <path className="landing-loader-bolt-branch branch-one" d="M363 268 L300 322 L259 403" />
            <path className="landing-loader-bolt-branch branch-two" d="M320 432 L404 493 L448 566" />
            <path className="landing-loader-bolt-branch branch-three" d="M277 586 L205 626 L168 702" />
          </svg>

          <svg className="landing-loader-bolt landing-loader-bolt-secondary" viewBox="0 0 640 820" aria-hidden="true">
            <path className="landing-loader-bolt-core" d="M355 -30 L324 96 L352 130 L300 214 L324 248 L266 337 L286 372 L229 468" />
            <path className="landing-loader-bolt-branch" d="M300 214 L242 247 L207 308" />
            <path className="landing-loader-bolt-branch" d="M266 337 L329 390 L359 446" />
          </svg>

          <svg className="landing-loader-bolt landing-loader-bolt-tertiary" viewBox="0 0 640 820" aria-hidden="true">
            <path className="landing-loader-bolt-core" d="M402 -10 L380 73 L405 108 L363 168 L386 198 L343 263 L357 291 L318 349" />
            <path className="landing-loader-bolt-branch" d="M363 168 L322 188 L287 236" />
          </svg>

          <div className="landing-loader-center">
            <span className="landing-loader-compass" aria-hidden="true">
              <Compass size={34} strokeWidth={1.15} />
            </span>
            <strong>LIFE RPG</strong>
            <small>THE ADVENTURER'S ATLAS</small>
            <span className="landing-loader-rule" aria-hidden="true" />
            <span className="landing-loader-status">ENTERING THE ATLAS</span>
            <span className="landing-loader-progress" aria-hidden="true"><i /></span>
          </div>
        </div>,
        document.body,
      )
    : null

  return (
    <>
      {loader}
      <div className="marketing-page landing-page">
        <nav className="atlas-chapter-progress" aria-label="Journey chapters">
          {journeyChapters.map((chapter, index) => (
            <a
              className={activeChapter === chapter.id ? 'is-active' : ''}
              href={`#${chapter.id}`}
              key={chapter.id}
              aria-label={`Chapter ${index + 1}: ${chapter.label}`}
            >
              <span>{chapter.label}</span><i />
            </a>
          ))}
        </nav>
        <section
          ref={heroRef}
          id="top"
          data-chapter
          className={`landing-cinematic-hero storm-pattern-${stormPattern} ${lightning ? 'is-lightning' : ''} ${loaderPhase !== 'loading' ? 'is-revealed' : ''}`}
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
          <div className="landing-storm-strikes" aria-hidden="true">
            <span className="landing-cloud-flare flare-one" />
            <span className="landing-cloud-flare flare-two" />
            <span className="landing-cloud-flare flare-three" />

            <svg className="landing-sky-bolt bolt-one" viewBox="0 0 260 520" preserveAspectRatio="none">
              <path className="landing-sky-bolt-glow" d="M172 -8 L151 72 L174 96 L142 154 L159 182 L116 252 L133 277 L91 342 L105 367 L67 448 L77 524" />
              <path className="landing-sky-bolt-core" d="M172 -8 L151 72 L174 96 L142 154 L159 182 L116 252 L133 277 L91 342 L105 367 L67 448 L77 524" />
              <path className="landing-sky-bolt-branch" d="M142 154 L99 183 L72 231" />
              <path className="landing-sky-bolt-branch" d="M116 252 L166 293 L194 340" />
              <path className="landing-sky-bolt-branch" d="M91 342 L50 371 L28 414" />
            </svg>

            <svg className="landing-sky-bolt bolt-two" viewBox="0 0 220 430" preserveAspectRatio="none">
              <path className="landing-sky-bolt-glow" d="M130 -8 L117 53 L137 75 L109 124 L124 145 L92 198 L106 219 L79 272 L88 295 L63 347 L69 432" />
              <path className="landing-sky-bolt-core" d="M130 -8 L117 53 L137 75 L109 124 L124 145 L92 198 L106 219 L79 272 L88 295 L63 347 L69 432" />
              <path className="landing-sky-bolt-branch" d="M109 124 L72 148 L51 184" />
              <path className="landing-sky-bolt-branch" d="M92 198 L137 228 L159 264" />
            </svg>

            <svg className="landing-sky-bolt bolt-three" viewBox="0 0 190 360" preserveAspectRatio="none">
              <path className="landing-sky-bolt-glow" d="M106 -6 L95 43 L111 61 L89 98 L103 118 L76 160 L88 179 L64 224 L73 242 L50 291 L56 362" />
              <path className="landing-sky-bolt-core" d="M106 -6 L95 43 L111 61 L89 98 L103 118 L76 160 L88 179 L64 224 L73 242 L50 291 L56 362" />
              <path className="landing-sky-bolt-branch" d="M89 98 L57 119 L38 151" />
              <path className="landing-sky-bolt-branch" d="M76 160 L112 184 L132 213" />
            </svg>
          </div>
          <div className="landing-rain landing-rain-far" aria-hidden="true" />
          <div className="landing-rain landing-rain-mid" aria-hidden="true" />
          <div className="landing-rain landing-rain-near" aria-hidden="true" />
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

        <div className="atlas-home" ref={atlasHomeRef}>
          <div className="atlas-global-atmosphere" aria-hidden="true">
            <span className="atlas-world-dust" />
            <span className="atlas-world-stars" />
            <span className="atlas-journey-spine"><b className="atlas-journey-tracker" /><i /><i /><i /><i /><i /><i /></span>
          </div>
          <section id="journey" className="atlas-section atlas-descent atlas-reveal" aria-labelledby="atlas-descent-title">
            <div className="atlas-atmosphere atlas-atmosphere-mist" aria-hidden="true" />
            <div className="atlas-stars" aria-hidden="true" />
            <div className="atlas-section-inner atlas-narrow">
              <span className="atlas-eyebrow">THE WORLD AWAITS</span>
              <h2 id="atlas-descent-title">Every journey begins with <em>one decision.</em></h2>
              <p>What if every goal you pursued became part of a world you could actually explore?</p>
              <span className="atlas-descent-caption">DESCEND FROM THE CLIFF · FOLLOW THE GOLDEN TRAIL</span>
              <div className="atlas-descent-route" aria-hidden="true">
                <i /><span /><i /><span /><i />
              </div>
            </div>
          </section>

          <section id="how-it-works" data-chapter className="atlas-section atlas-core atlas-reveal" aria-labelledby="atlas-core-title">
            <div className="atlas-contours" aria-hidden="true" />
            <div className="atlas-section-inner">
              <header className="atlas-section-heading atlas-heading-wide">
                <span className="atlas-eyebrow">HOW IT WORKS · THE HERO’S LOOP</span>
                <h2 id="atlas-core-title">Accept the quest. Earn the experience. <em>Become stronger.</em></h2>
                <p>Choose a real goal, turn it into a quest, complete it, and watch that effort become XP, attributes, streaks, and rewards. The whole loop lives here on the journey, not on another marketing page.</p>
              </header>

              <div className="atlas-quest-route">
                <svg className="atlas-quest-route-line" viewBox="0 0 1200 300" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M32 92 C180 22 320 78 448 194 S706 246 858 82 S1040 34 1170 92" />
                </svg>
                {coreLoop.map(({ icon: Icon, number, title, copy, detail }, index) => (
                  <article className={`atlas-quest-step atlas-quest-step-${index + 1}`} key={title}>
                    <span className="atlas-step-number">{number}</span>
                    <span className="atlas-quest-crest" aria-hidden="true"><Icon size={26} strokeWidth={1.35} /></span>
                    <div>
                      <h3>{title}</h3>
                      <p>{copy}</p>
                      <small>{detail}</small>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section id="atlas" data-chapter className="atlas-section atlas-realms atlas-reveal" aria-labelledby="atlas-realms-title">
            <div className="atlas-map-fog atlas-map-fog-one" aria-hidden="true" />
            <div className="atlas-map-fog atlas-map-fog-two" aria-hidden="true" />
            <div className="atlas-section-inner">
              <header className="atlas-section-heading atlas-heading-centered">
                <span className="atlas-eyebrow">THE ADVENTURER’S ATLAS</span>
                <h2 id="atlas-realms-title">Your growth becomes a world <em>worth exploring.</em></h2>
                <p>Five realms. Five dimensions of growth. Every quest leaves a visible mark on the map.</p>
              </header>

              <div className="atlas-world-map" aria-label="The five realms of character growth">
                <div className="atlas-map-orbit orbit-one" aria-hidden="true" />
                <div className="atlas-map-orbit orbit-two" aria-hidden="true" />
                <svg className="atlas-map-routes" viewBox="0 0 1000 650" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M170 182 C330 202 361 303 503 326 S740 219 842 165" />
                  <path d="M154 492 C282 409 381 391 503 326 S710 395 857 486" />
                  <path d="M503 326 C486 244 492 182 503 102" />
                </svg>

                <div className="atlas-map-center" aria-hidden="true">
                  <Compass size={36} strokeWidth={1.05} />
                  <span>YOU ARE HERE</span>
                </div>

                {realms.map(({ icon: Icon, stat, realm, copy, position, glyph }) => (
                  <article className={`atlas-realm ${position}`} key={realm} tabIndex={0}>
                    {position === 'realm-center' && (
                      <>
                        <span className="atlas-citadel-aura" aria-hidden="true" />
                        <span className="atlas-citadel-fortress" aria-hidden="true">
                          <i className="atlas-citadel-tower atlas-citadel-tower-left" />
                          <i className="atlas-citadel-tower atlas-citadel-tower-center" />
                          <i className="atlas-citadel-tower atlas-citadel-tower-right" />
                          <b className="atlas-citadel-gate" />
                          <em className="atlas-citadel-beacon" />
                        </span>
                      </>
                    )}
                    <span className="atlas-realm-marker" aria-hidden="true"><span>{glyph}</span></span>
                    <div className="atlas-realm-copy">
                      <small>{stat}</small>
                      <h3>{realm}</h3>
                      <p>{copy}</p>
                      {position === 'realm-center' && <b className="atlas-citadel-oath">STREAKS · ROUTINES · RESOLVE</b>}
                      <span className="atlas-realm-icon" aria-hidden="true"><Icon size={16} strokeWidth={1.4} /></span>
                    </div>
                  </article>
                ))}

                <span className="atlas-map-coordinate coordinate-one" aria-hidden="true">41° 17′ N</span>
                <span className="atlas-map-coordinate coordinate-two" aria-hidden="true">WAYPOINT 05</span>
                <span className="atlas-map-coordinate coordinate-three" aria-hidden="true">ATLAS · I</span>
              </div>
            </div>
          </section>

          <section id="quest-log" data-chapter className={`atlas-section atlas-contracts atlas-reveal ${questComplete ? 'is-quest-complete' : ''}`} aria-labelledby="atlas-contracts-title">
            <div className="atlas-contracts-ink" aria-hidden="true" />
            <div className="atlas-section-inner">
              <header className="atlas-section-heading">
                <span className="atlas-eyebrow">THE QUEST LOG</span>
                <h2 id="atlas-contracts-title">Ordinary tasks. <em>Extraordinary progress.</em></h2>
                <p>Plans become guild contracts with difficulty, realm alignment, experience, and rewards. One contract below completes itself as the section enters view.</p>
              </header>
              <div className="atlas-contract-stack">
                {questContracts.map(({ icon: Icon, title, realm, difficulty, xp, gold, stat }, index) => (
                  <article className={`atlas-quest-contract atlas-contract-${index + 1}`} key={title}>
                    <span className="atlas-contract-seal" aria-hidden="true"><Icon size={24} strokeWidth={1.2} /></span>
                    <div className="atlas-contract-head"><small>GUILD CONTRACT · {String(index + 1).padStart(2, '0')}</small><span>{difficulty}</span></div>
                    <h3>{title}</h3>
                    <p>{realm}</p>
                    <div className="atlas-contract-rule" />
                    <div className="atlas-contract-rewards">
                      <span><Sparkles size={14} /> +{xp} XP</span>
                      <span><Coins size={14} /> +{gold} GOLD</span>
                      <span>+ {stat}</span>
                    </div>
                    {index === 0 && (
                      <div className="atlas-contract-demo" aria-hidden="true">
                        <span className="atlas-contract-check"><CheckCircle2 size={19} /></span>
                        <b>QUEST COMPLETE</b>
                        <em>+120 XP</em>
                        <i>+24</i>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="atlas-section atlas-market atlas-reveal" aria-labelledby="atlas-market-title">
            <div className="atlas-market-canopy" aria-hidden="true" />
            <div className="atlas-section-inner">
              <div className="atlas-market-heading-row">
                <header className="atlas-section-heading">
                  <span className="atlas-eyebrow">THE WANDERING EMPORIUM</span>
                  <h2 id="atlas-market-title">Spend what your effort <em>earned.</em></h2>
                  <p>Unlock themes, cosmetics, badges, and relics that make your journey feel personal.</p>
                </header>
                <Link className="atlas-market-link" to="/marketplace">Enter the Emporium <ArrowRight size={15} /></Link>
              </div>

              <div className="atlas-market-tabs" aria-label="Marketplace preview categories">
                <span className="is-active">Featured</span><span>Relics</span><span>Titles</span><span>Themes</span>
              </div>
              <div className="atlas-market-track">
                {marketplaceItems.map(({ icon: Icon, name, category, price, rarity }) => (
                  <article className="atlas-market-item" data-atlas-tilt key={name}>
                    <div className="atlas-market-item-art" aria-hidden="true"><Icon size={40} strokeWidth={1.05} /></div>
                    <span>{category} · {rarity}</span>
                    <h3>{name}</h3>
                    <div><strong><Coins size={14} /> {price}</strong><i>VIEW ITEM</i></div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section id="chronicle" data-chapter className="atlas-section atlas-chronicle atlas-reveal" aria-labelledby="atlas-chronicle-title">
            <div className="atlas-constellation-field" aria-hidden="true" />
            <div className="atlas-section-inner">
              <header className="atlas-section-heading atlas-heading-centered">
                <span className="atlas-eyebrow">YOUR CHRONICLE</span>
                <h2 id="atlas-chronicle-title">Every day <em>leaves a mark.</em></h2>
                <p>Your activity history becomes a visible trail: streaks, milestones, and a record of how far you’ve come.</p>
              </header>

              <div className="atlas-chronicle-layout">
                <div className="atlas-streak-map">
                  <div className="atlas-streak-map-head">
                    <div><CalendarDays size={18} /><span>SEPTEMBER · JOURNEY TRAIL</span></div>
                    <strong><Flame size={17} /> 7 DAY STREAK</strong>
                  </div>
                  <div className="atlas-weekdays" aria-hidden="true">
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
                  </div>
                  <div className="atlas-streak-grid" aria-label="Example activity calendar">
                    {streakDays.map((day, index) => (
                      <i className={`${day.active ? 'is-active' : ''} ${day.strong ? 'is-strong' : ''}`} key={index} aria-hidden="true" />
                    ))}
                  </div>
                  <div className="atlas-streak-legend"><span>QUIET</span><i /><i /><i className="is-bright" /><span>LEGENDARY</span></div>
                </div>

                <div className="atlas-chronicle-feed">
                  <div className="atlas-chronicle-feed-title"><ScrollText size={18} /><span>RECENT CHRONICLE ENTRIES</span></div>
                  {chronicleEntries.map(({ icon: Icon, title, time, copy }) => (
                    <article key={title}>
                      <span><Icon size={17} strokeWidth={1.35} /></span>
                      <div><small>{time}</small><h3>{title}</h3><p>{copy}</p></div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="atlas-section atlas-world-evolution atlas-reveal" aria-labelledby="atlas-world-title">
            <div className="atlas-world-evolution-sky" aria-hidden="true" />
            <div className="atlas-section-inner">
              <header className="atlas-section-heading atlas-heading-centered">
                <span className="atlas-eyebrow">THE WORLD REMEMBERS</span>
                <h2 id="atlas-world-title">The more you grow, the more your world <em>comes alive.</em></h2>
                <p>Your progress is not only a number. The metaphorical world around your character becomes warmer, brighter, and more connected.</p>
              </header>
              <div className="atlas-evolution-stage" aria-label="Early journey changing into a progressed world">
                <div className="atlas-evolution-half atlas-evolution-before">
                  <span>EARLY JOURNEY</span><strong>Unlit road</strong><i className="atlas-evolution-tower" />
                </div>
                <div className="atlas-evolution-rift" aria-hidden="true"><i /></div>
                <div className="atlas-evolution-half atlas-evolution-after">
                  <span>WORLD AWAKENED</span><strong>Road restored</strong><i className="atlas-evolution-tower" />
                  <b className="atlas-evolution-beacon" />
                </div>
                <svg className="atlas-evolution-road" viewBox="0 0 1000 300" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M-20 272 C220 236 341 206 492 155 S738 78 1020 32" />
                </svg>
              </div>
            </div>
          </section>

          <section id="about" className="atlas-section atlas-difference atlas-reveal" aria-labelledby="atlas-difference-title">
            <div className="atlas-section-inner">
              <header className="atlas-section-heading atlas-heading-centered">
                <span className="atlas-eyebrow">WHY LIFE RPG FEELS DIFFERENT</span>
                <h2 id="atlas-difference-title">Because real growth deserves to feel rewarding.</h2>
                <p>Most tools track what you did. Life RPG helps you feel what it means.</p>
              </header>

              <div className="atlas-difference-panels">
                {differences.map(({ number, title, copy }, index) => (
                  <article className={`atlas-difference-panel atlas-difference-${index + 1}`} key={title}>
                    <span>{number}</span>
                    <h3>{title}</h3>
                    <p>{copy}</p>
                    <i aria-hidden="true" />
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section id="begin" data-chapter className="atlas-final atlas-reveal" aria-labelledby="atlas-final-title">
            <div className="atlas-final-mountains" aria-hidden="true" />
            <div className="atlas-final-mist" aria-hidden="true" />
            <div className="atlas-final-road" aria-hidden="true"><i /></div>
            <div className="atlas-final-castle" aria-hidden="true"><span /><i /><b /></div>
            <div className="atlas-final-content">
              <span className="atlas-eyebrow">YOUR JOURNEY IS WAITING</span>
              <h2 id="atlas-final-title">Every great story begins before<br /><em>anyone knows how it will end.</em></h2>
              <p>Start with one quest. Build one streak. Take one step forward.</p>
              <div className="atlas-final-actions">
                <Link className="landing-button landing-button-primary" to="/signup">
                  <span>Begin Your Journey</span><span className="landing-button-arrow" aria-hidden="true">→</span>
                </Link>
                <a className="landing-button landing-button-secondary" href="#journey">Explore the Atlas</a>
              </div>
              <span className="atlas-final-mark"><Compass size={15} /> EVERY JOURNEY BEGINS WITH A SINGLE STEP</span>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
