import {
  ArrowRight,
  CalendarDays,
  Compass,
  Flame,
  Map,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatActivityDate } from '@atlasborn/shared'
import { useAuth } from '../auth/useAuth.js'
import { equippedItem } from '../economy/equipment.js'
import { useDashboard } from '../dashboard/hooks.js'
import DashboardSkeleton from '../dashboard/DashboardSkeleton.jsx'
import FirstJourney from '../dashboard/FirstJourney.jsx'
import TodayQuests from '../dashboard/TodayQuests.jsx'
import ProgressMeter from '../progression/ProgressMeter.jsx'
import Portrait from './Portrait.jsx'
import { AttributeIcon } from './ui.jsx'
import '../dashboard/dashboard.css'

const featuredAttributes = [
  { key: 'INTELLECT', label: 'Mind' },
  { key: 'DISCIPLINE', label: 'Discipline' },
  { key: 'CREATIVITY', label: 'Creativity' },
]

function CharacterSummary({ data, user, equippedFrame, equippedTitle, equippedBadge }) {
  const quickAttributes = featuredAttributes.map((item) => ({
    ...item,
    attribute: data.character.attributes.find((attribute) => attribute.key === item.key),
  }))

  return (
    <section className="panel dashboard-character-summary fantasy-panel" aria-labelledby="dashboard-character-title">
      <div className="fantasy-panel-corner fantasy-panel-corner-tl" aria-hidden="true" />
      <div className="fantasy-panel-corner fantasy-panel-corner-br" aria-hidden="true" />
      <div className="dashboard-panel-heading">
        <span className="eyebrow">YOUR CHARACTER</span>
        <Link className="text-link" to="/character">
          View Character <ArrowRight size={14} />
        </Link>
      </div>

      <div className="dashboard-character-main">
        <div className="dashboard-character-portrait" aria-hidden="true">
          <span className="portrait-ornament portrait-ornament-n" />
          <span className="portrait-ornament portrait-ornament-e" />
          <span className="portrait-ornament portrait-ornament-s" />
          <span className="portrait-ornament portrait-ornament-w" />
          <Portrait avatarKey={data.character.avatarKey} frameKey={equippedFrame?.assetKey} />
          <span className="dashboard-character-level">Lv {data.character.progression.level}</span>
        </div>

        <div className="dashboard-character-copy">
          <h2 id="dashboard-character-title">{user.displayName}</h2>
          <span className="dashboard-character-title">
            <Compass size={13} />
            {equippedTitle?.name || 'Seeker of small wonders'}
          </span>
          {equippedBadge && <span className="dashboard-character-badge">✦ {equippedBadge.name}</span>}
        </div>

        <div className="dashboard-attribute-summary" aria-label="Character attribute levels">
          {quickAttributes.map(({ key, label, attribute }) => (
            <div className={`dashboard-attribute-cell ${key.toLowerCase()}`} key={key}>
              <AttributeIcon attribute={key} size={17} />
              <span>
                <small>{label}</small>
                <strong>{attribute?.progression.level ?? 0}</strong>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="dashboard-character-progress">
        <ProgressMeter progress={data.character.progression} />
        <blockquote>“A better you awaits ahead.”</blockquote>
      </div>
    </section>
  )
}

function AtlasPanel() {
  return (
    <section className="panel dashboard-atlas fantasy-panel" aria-labelledby="dashboard-atlas-title">
      <div className="dashboard-panel-heading dashboard-atlas-heading">
        <span className="eyebrow" id="dashboard-atlas-title">YOUR ATLAS</span>
        <Link className="text-link atlas-open-link" to="/activity">
          Open Atlas <ArrowRight size={14} />
        </Link>
      </div>
      <div className="dashboard-atlas-map" aria-hidden="true">
        <div className="atlas-compass"><Compass size={28} strokeWidth={1.2} /></div>
        <span className="atlas-path atlas-path-one" />
        <span className="atlas-path atlas-path-two" />
        <span className="atlas-node atlas-node-one" />
        <span className="atlas-node atlas-node-two" />
        <span className="atlas-node atlas-node-three" />
        <span className="atlas-landmark atlas-mountain"><span>Mount</span> Better Habits</span>
        <span className="atlas-landmark atlas-valley"><span>Valley of</span> Consistency</span>
        <span className="atlas-landmark atlas-city"><span>City of a</span> Brighter You</span>
      </div>
      <div className="dashboard-atlas-copy">
        <strong>Explore a richer you.</strong>
        <span>Quests, growth, and a bigger story await.</span>
      </div>
    </section>
  )
}

function StreakPanel({ streaks }) {
  return (
    <Link className="panel dashboard-streak fantasy-panel" to="/activity" aria-label="Open your streak activity">
      <span className="dashboard-streak-emblem"><Flame size={26} /></span>
      <span className="dashboard-streak-copy">
        <span className="eyebrow">YOUR STREAK</span>
        <strong>{streaks.currentStreak} {streaks.currentStreak === 1 ? 'day' : 'days'}</strong>
        <small>{streaks.currentStreak ? 'Keep it alive. Build momentum.' : 'Start today. Build momentum.'}</small>
      </span>
      <ArrowRight className="dashboard-streak-arrow" size={18} />
    </Link>
  )
}

export default function PersonalDashboard() {
  const { user } = useAuth()
  const dashboard = useDashboard()
  const data = dashboard.data
  const equippedFrame = equippedItem(user, 'AVATAR_FRAME')
  const equippedTitle = equippedItem(user, 'CHARACTER_TITLE')
  const equippedBadge = equippedItem(user, 'PROFILE_BADGE')

  return (
    <div className="page dashboard-page dashboard-page-authenticated" key={user.id}>
      {dashboard.isPending ? (
        <DashboardSkeleton />
      ) : dashboard.isError && !data ? (
        <section className="panel dashboard-error fantasy-panel" role="alert">
          <div>
            <Compass size={34} />
            <h2>Your adventure is still here.</h2>
            <p>
              The dashboard could not gather your saved progress right now. Nothing has been reset or
              recalculated. Retry the same server-backed summary.
            </p>
            <button className="button button-gold" onClick={() => dashboard.refetch()}>
              <RefreshCw size={15} /> Retry dashboard
            </button>
          </div>
        </section>
      ) : (
        <>
          <header className="dashboard-welcome" aria-labelledby="dashboard-welcome-title">
            <div className="dashboard-welcome-copy">
              <p className="eyebrow">YOUR ADVENTURE, TODAY</p>
              <h1 id="dashboard-welcome-title">
                Welcome back, <em>{user.displayName}.</em>
              </h1>
              <div className="dashboard-welcome-meta">
                <span><CalendarDays size={14} /> {formatActivityDate(data.today)}</span>
                <span className="dashboard-meta-dot" aria-hidden="true">·</span>
                <span><Compass size={13} /> {data.timezone.replaceAll('_', ' ')}</span>
                <span className="dashboard-meta-dot" aria-hidden="true">·</span>
                <span><Sparkles size={13} /> Chapter {String(data.character.progression.level).padStart(2, '0')}</span>
                <span className="dashboard-meta-dot" aria-hidden="true">·</span>
                <span><Map size={13} /> The Rising Path</span>
              </div>
            </div>
            <blockquote className="dashboard-welcome-quote">“Discipline today.<br />A brighter tomorrow.”</blockquote>
            {dashboard.isFetching && data && (
              <span className="dashboard-updating" role="status">
                <RefreshCw className="spin" size={13} /> Refreshing
              </span>
            )}
          </header>

          {dashboard.isError && data && (
            <div className="dashboard-stale-warning" role="status">
              <span>Showing your last loaded dashboard. The refresh did not complete.</span>
              <button className="text-link" onClick={() => dashboard.refetch()}>
                Retry refresh <RefreshCw size={13} />
              </button>
            </div>
          )}

          <FirstJourney
            step={data.firstUse.step}
            active={data.firstUse.active}
            completedCount={data.completedCount}
          />

          <div className="dashboard-reference-grid">
            <CharacterSummary
              data={data}
              user={user}
              equippedFrame={equippedFrame}
              equippedTitle={equippedTitle}
              equippedBadge={equippedBadge}
            />

            <TodayQuests quests={data.todayQuests} today={data.today} summary={data.quests} />

            <div className="dashboard-right-rail">
              <AtlasPanel />
              <StreakPanel streaks={data.streaks} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
