import { ArrowRight, Coins, Compass, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ATTRIBUTES, characterProgress } from '@life-rpg/shared'
import { useProgress } from '../progression/hooks.js'
import ProgressMeter from '../progression/ProgressMeter.jsx'
import ProgressNotice from '../progression/ProgressNotice.jsx'
import StreakCard from '../activity/StreakCard.jsx'
import DashboardQuests from '../quests/DashboardQuests.jsx'
import { useAuth } from '../auth/useAuth.js'
import { equippedItem } from '../economy/equipment.js'
import Landscape from './Landscape.jsx'
import Portrait from './Portrait.jsx'
import { AttributeIcon, PageHeading, SectionLink } from './ui.jsx'

export default function PersonalDashboard() {
  const { user } = useAuth()
  const progress = useProgress()
  const character = progress.data?.character || characterProgress(user.character)
  const equippedFrame = equippedItem(user, 'AVATAR_FRAME')
  const equippedTitle = equippedItem(user, 'CHARACTER_TITLE')
  const equippedBadge = equippedItem(user, 'PROFILE_BADGE')
  const level = character.progression.level
  return (
    <div className="page dashboard-page">
      <PageHeading
        eyebrow="WELCOME TO YOUR NEXT CHAPTER"
        title={
          <>
            Your story, <em>still unfolding.</em>
          </>
        }
        description={`Welcome, ${user.displayName}. Make a little room for the person you want to become.`}
      >
        <span className="chapter-badge">
          <Compass size={16} /> CHAPTER 05 <span>·</span> YOUR ADVENTURE
        </span>
      </PageHeading>
      <div className="account-welcome">
        <Sparkles size={17} /> Every small effort adds to your story.
        <Link to="/character">
          {progress.isError
            ? 'View your growth'
            : progress.isPending
              ? 'Your progress'
              : `${progress.data.completedCount} ${progress.data.completedCount === 1 ? 'quest' : 'quests'} completed`}
        </Link>
      </div>
      <ProgressNotice query={progress} />
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
            <Link className="button button-gold" to="/quests?new=1">
              Create a quest <ArrowRight size={17} />
            </Link>
          </div>
          <div className="hero-coordinate">
            <span>THE EVERGREEN TRAIL</span>
            <span>05 / ∞</span>
          </div>
        </section>
        <section className="character-card panel">
          <div className="card-kicker">
            YOUR ADVENTURER <span>READY</span>
          </div>
          <div className="portrait-ring">
            <Portrait avatarKey={character.avatarKey} frameKey={equippedFrame?.assetKey} />
            <span className="level-medallion">{String(level).padStart(2, '0')}</span>
          </div>
          <h2>{user.displayName}</h2>
          <p className="character-subtitle">{equippedTitle?.name || 'Curious soul. Endless possibilities.'}</p>
          {equippedBadge && <span className="dashboard-badge">✦ {equippedBadge.name}</span>}
          <ProgressMeter progress={character.progression} />
          <Link className="character-link" to="/settings">
            Your account & preferences <ArrowRight size={16} />
          </Link>
        </section>
      </div>
      <div className="stats-strip" aria-label="Your saved progress">
        <div>
          <span className="stat-icon green">
            <Compass size={22} />
          </span>
          <span>
            <strong>{level}</strong>
            <span>Character level</span>
          </span>
          <span className="stat-detail">KEEP BECOMING</span>
        </div>
        <div>
          <span className="stat-icon green">
            <Sparkles size={22} />
          </span>
          <span>
            <strong>{character.totalXp}</strong>
            <span>Total experience</span>
          </span>
          <span className="stat-detail">EFFORT, REMEMBERED</span>
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
      <StreakCard />
      <div className="lower-grid">
        <DashboardQuests />
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
                  <span
                    style={{
                      width: `${character.attributes.find((attribute) => attribute.key === key)?.progression.percent || 0}%`,
                    }}
                  />
                </div>
                <span className="attribute-level">
                  Lv.{' '}
                  {character.attributes.find((attribute) => attribute.key === key)?.progression
                    .level || 1}
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
