import { ArrowRight, Coins, Compass, Sparkles, BookOpen } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ATTRIBUTES } from '@life-rpg/shared'
import { useAuth } from '../auth/useAuth.js'
import Landscape from './Landscape.jsx'
import Portrait from './Portrait.jsx'
import { AttributeIcon, PageHeading, SectionLink } from './ui.jsx'

export default function PersonalDashboard() {
  const { user } = useAuth()
  const character = user.character
  return (
    <div className="page dashboard-page">
      <PageHeading
        eyebrow="WELCOME TO YOUR NEXT CHAPTER"
        title={
          <>
            Your story, <em>just beginning.</em>
          </>
        }
        description={`Welcome, ${user.displayName}. Make a little room for the person you want to become.`}
      >
        <span className="chapter-badge">
          <Compass size={16} /> CHAPTER 02 <span>·</span> YOUR ADVENTURE
        </span>
      </PageHeading>
      <div className="account-welcome">
        <Sparkles size={17} /> Your character is saved. A whole adventure lies ahead.
      </div>
      <div className="hero-grid">
        <section className="adventure-hero">
          <Landscape />
          <div className="hero-content">
            <span className="hero-kicker">
              <span /> THE PATH IS YOURS
            </span>
            <h2>
              A new chapter.
              <br />
              An everyday hero.
            </h2>
            <p>
              There is no rush to become.
              <br />
              Start with a little curiosity, and keep going.
            </p>
            <Link className="button button-gold" to="/character">
              Meet your character <ArrowRight size={17} />
            </Link>
          </div>
          <div className="hero-coordinate">
            <span>THE EVERGREEN TRAIL</span>
            <span>02 / ∞</span>
          </div>
        </section>
        <section className="character-card panel">
          <div className="card-kicker">
            YOUR ADVENTURER <span>READY</span>
          </div>
          <div className="portrait-ring">
            <Portrait avatarKey={character.avatarKey} />
            <span className="level-medallion">01</span>
          </div>
          <h2>{user.displayName}</h2>
          <p className="character-subtitle">Curious soul. Endless possibilities.</p>
          <div className="xp-heading">
            <span>Level 1</span>
            <span>
              <strong>{character.totalXp}</strong> total XP
            </span>
          </div>
          <p className="field-hint">Your journey begins here. Earning XP opens with quests.</p>
          <Link className="character-link" to="/settings">
            Your account & preferences <ArrowRight size={16} />
          </Link>
        </section>
      </div>
      <div className="stats-strip" aria-label="Your starting adventure">
        <div>
          <span className="stat-icon green">
            <Compass size={22} />
          </span>
          <span>
            <strong>1</strong>
            <span>Starting level</span>
          </span>
          <span className="stat-detail">A NEW BEGINNING</span>
        </div>
        <div>
          <span className="stat-icon green">
            <Sparkles size={22} />
          </span>
          <span>
            <strong>{character.totalXp}</strong>
            <span>Total experience</span>
          </span>
          <span className="stat-detail">ROOM TO GROW</span>
        </div>
        <div>
          <span className="stat-icon gold">
            <Coins size={22} />
          </span>
          <span>
            <strong>
              {character.gold} <small>gold</small>
            </strong>
            <span>Your little treasure</span>
          </span>
        </div>
      </div>
      <div className="lower-grid">
        <section className="panel quest-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">MAKE ROOM FOR WHAT MATTERS</span>
              <h2>A fresh page in your journal</h2>
            </div>
            <BookOpen size={22} className="green" />
          </div>
          <div className="empty-state">
            <Compass size={32} />
            <h2>Your first quest is ahead.</h2>
            <p>
              Creating and completing quests opens in the next chapter. For now, explore a few ideas
              for your everyday adventure.
            </p>
            <Link className="button button-outline" to="/quests">
              Explore quest inspiration <ArrowRight size={16} />
            </Link>
          </div>
        </section>
        <section className="panel attributes-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">FIVE WAYS TO GROW</span>
              <h2>Your everyday strengths</h2>
            </div>
            <Sparkles size={18} className="gold" />
          </div>
          <div className="attribute-list">
            {ATTRIBUTES.map(({ key, name }) => (
              <div className={`attribute-row ${key.toLowerCase()}`} key={key}>
                <AttributeIcon attribute={key} size={17} />
                <span>{name}</span>
                <div className="attribute-track" aria-hidden="true">
                  <span style={{ width: 0 }} />
                </div>
                <span className="attribute-level">
                  {character.attributes.find((attribute) => attribute.key === key)?.xp ?? 0} XP
                </span>
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
