import {
  ArrowRight,
  ArrowUpRight,
  Coins,
  Compass,
  Flame,
  Footprints,
  Sparkles,
  Target,
} from 'lucide-react'
import { Link, useOutletContext } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import { ATTRIBUTES } from '@life-rpg/shared'
import { useAuth } from '../auth/useAuth.js'
import PersonalDashboard from '../components/PersonalDashboard.jsx'
import Landscape from '../components/Landscape.jsx'
import Portrait from '../components/Portrait.jsx'
import QuestList from '../components/QuestList.jsx'
import { AttributeIcon, PageHeading, PreviewNotice, SectionLink } from '../components/ui.jsx'
import { sampleAttributeLevels, sampleQuests } from '../data/preview.js'

export default function Dashboard() {
  const { user } = useAuth()
  const { gentleMotion } = useOutletContext()
  const reducedMotion = useReducedMotion()
  const animate = gentleMotion && !reducedMotion
  if (user) return <PersonalDashboard />
  return (
    <div className="page dashboard-page">
      <PageHeading
        eyebrow="WELCOME TO YOUR NEXT CHAPTER"
        title={
          <>
            Small steps. <em>Great adventures.</em>
          </>
        }
        description="A little progress today. A stronger you tomorrow."
      >
        <span className="chapter-badge">
          <Compass size={16} />
          CHAPTER 01 <span>·</span> THE BEGINNING
        </span>
      </PageHeading>
      <PreviewNotice />
      <div className="hero-grid">
        <section className="adventure-hero">
          <Landscape />
          <div className="hero-content">
            <span className="hero-kicker">
              <span />
              THE PATH IS YOURS
            </span>
            <h2>
              There’s a hero
              <br />
              in your everyday.
            </h2>
            <p>
              Read one more page. Take that first step.
              <br className="desktop-break" /> Turn small intentions into a remarkable journey.
            </p>
            <Link className="button button-gold" to="/signup">
              Begin your adventure <ArrowRight size={17} />
            </Link>
          </div>
          <div className="hero-coordinate">
            <span>THE EVERGREEN TRAIL</span>
            <span>01 / ∞</span>
          </div>
        </section>
        <section className="character-card panel">
          <div className="card-kicker">
            YOUR ADVENTURER <span>SAMPLE</span>
          </div>
          <div className="portrait-ring">
            <Portrait />
            <span className="level-medallion">07</span>
          </div>
          <h2>The Wanderer</h2>
          <p className="character-subtitle">Curious soul. Endless possibilities.</p>
          <div className="xp-heading">
            <span>Level 7</span>
            <span>
              <strong>340</strong> / 600 XP
            </span>
          </div>
          <div
            className="progress-track"
            role="progressbar"
            aria-label="Sample character experience"
            aria-valuemin={0}
            aria-valuemax={600}
            aria-valuenow={340}
          >
            <motion.div
              initial={animate ? { width: 0 } : false}
              animate={{ width: '56.67%' }}
              transition={{ duration: animate ? 0.8 : 0 }}
            />
          </div>
          <Link className="character-link" to="/character">
            Meet your character <ArrowUpRight size={16} />
          </Link>
        </section>
      </div>
      <div className="stats-strip" aria-label="Sample adventure statistics">
        <div>
          <span className="stat-icon gold">
            <Flame size={22} />
          </span>
          <span>
            <strong>
              7 <small>days</small>
            </strong>
            <span>Current streak</span>
          </span>
          <span className="stat-detail">KEEP THE SPARK ALIVE</span>
        </div>
        <div>
          <span className="stat-icon green">
            <Target size={22} />
          </span>
          <span>
            <strong>24</strong>
            <span>Quests completed</span>
          </span>
          <span className="stat-detail">ONE STEP AT A TIME</span>
        </div>
        <div>
          <span className="stat-icon gold">
            <Coins size={22} />
          </span>
          <span>
            <strong>
              185 <small>gold</small>
            </strong>
            <span>Your little treasure</span>
          </span>
          <Link to="/marketplace" className="stat-shop" aria-label="Explore the sample marketplace">
            <ArrowUpRight size={18} />
          </Link>
        </div>
      </div>
      <div className="lower-grid">
        <section className="panel quest-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">MAKE ROOM FOR WHAT MATTERS</span>
              <h2>A few quests to inspire you</h2>
            </div>
            <SectionLink to="/quests">The journal</SectionLink>
          </div>
          <QuestList quests={sampleQuests} />
          <div className="panel-footnote">
            <Footprints size={14} />
            You don’t have to do it all. Just take the next step.
          </div>
        </section>
        <section className="panel attributes-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">GROW IN YOUR OWN WAY</span>
              <h2>More than a level</h2>
            </div>
            <Sparkles size={18} className="gold" />
          </div>
          <div className="attribute-list">
            {ATTRIBUTES.map(({ key, name }) => (
              <div className={`attribute-row ${key.toLowerCase()}`} key={key}>
                <AttributeIcon attribute={key} size={17} />
                <span>{name}</span>
                <div className="attribute-track" aria-hidden="true">
                  <span style={{ width: `${sampleAttributeLevels[key] * 16}%` }} />
                </div>
                <span className="attribute-level">LV {sampleAttributeLevels[key]}</span>
              </div>
            ))}
          </div>
          <SectionLink to="/character">Discover your strengths</SectionLink>
        </section>
      </div>
      <div className="daily-thought">
        <span>✦</span>
        <p>A remarkable journey is made of ordinary days you chose to show up for.</p>
        <span>YOUR REMINDER FOR TODAY</span>
      </div>
    </div>
  )
}
