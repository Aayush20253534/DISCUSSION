import {
  ArrowRight,
  CheckCheck,
  Coins,
  Compass,
  Flame,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { ATTRIBUTES, formatActivityDate } from '@life-rpg/shared'
import { useAuth } from '../auth/useAuth.js'
import { equippedItem } from '../economy/equipment.js'
import { useDashboard } from '../dashboard/hooks.js'
import DashboardSkeleton from '../dashboard/DashboardSkeleton.jsx'
import FirstJourney from '../dashboard/FirstJourney.jsx'
import RecentJourney from '../dashboard/RecentJourney.jsx'
import TodayQuests from '../dashboard/TodayQuests.jsx'
import WeeklyActivity from '../dashboard/WeeklyActivity.jsx'
import ProgressMeter from '../progression/ProgressMeter.jsx'
import Portrait from './Portrait.jsx'
import { AttributeIcon, PageHeading, SectionLink } from './ui.jsx'
import '../dashboard/dashboard.css'

export default function PersonalDashboard() {
  const { user } = useAuth()
  const dashboard = useDashboard()
  const data = dashboard.data
  const equippedFrame = equippedItem(user, 'AVATAR_FRAME')
  const equippedTitle = equippedItem(user, 'CHARACTER_TITLE')
  const equippedBadge = equippedItem(user, 'PROFILE_BADGE')

  return (
    <div className="page dashboard-page dashboard-page-authenticated" key={user.id}>
      <PageHeading
        eyebrow="YOUR ADVENTURE, TODAY"
        title={
          <>
            Welcome back, <em>{user.displayName}.</em>
          </>
        }
        description={
          data
            ? `${formatActivityDate(data.today)} · ${data.timezone.replaceAll('_', ' ')}. Your saved progress is gathered here in one place.`
            : 'Your quests, growth, streaks, rewards, and recent progress are gathered here in one place.'
        }
      >
        {dashboard.isFetching && data ? (
          <span className="dashboard-updating" role="status">
            <RefreshCw className="spin" size={13} /> Refreshing
          </span>
        ) : (
          <span className="chapter-badge">
            <Compass size={16} /> CHAPTER 08 <span>·</span> ADVENTURE DASHBOARD
          </span>
        )}
      </PageHeading>

      {dashboard.isPending ? (
        <DashboardSkeleton />
      ) : dashboard.isError && !data ? (
        <section className="panel dashboard-error" role="alert">
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
          {dashboard.isError && data && (
            <div className="dashboard-stale-warning" role="status">
              <span>Showing your last loaded dashboard. The refresh did not complete.</span>
              <button className="text-link" onClick={() => dashboard.refetch()}>
                Retry refresh <RefreshCw size={13} />
              </button>
            </div>
          )}
          {data.firstUse.active && <FirstJourney step={data.firstUse.step} />}

          <div className="dashboard-primary-grid">
            <section className="panel dashboard-character-summary" aria-labelledby="dashboard-character-title">
              <div className="dashboard-character-top">
                <div className="dashboard-character-portrait">
                  <Portrait avatarKey={data.character.avatarKey} frameKey={equippedFrame?.assetKey} />
                  <span className="dashboard-character-level">
                    Lv {data.character.progression.level}
                  </span>
                </div>
                <div className="dashboard-character-copy">
                  <span className="eyebrow">YOUR ADVENTURER</span>
                  <h2 id="dashboard-character-title">{user.displayName}</h2>
                  <span className="dashboard-character-title">
                    <Compass size={13} />
                    {equippedTitle?.name || 'Seeker of small wonders'}
                  </span>
                  {equippedBadge && (
                    <span className="dashboard-character-badge">✦ {equippedBadge.name}</span>
                  )}
                </div>
              </div>

              <ProgressMeter progress={data.character.progression} />

              <div className="dashboard-mini-stats" aria-label="Your current progress">
                <div className="dashboard-mini-stat">
                  <Flame size={18} />
                  <div>
                    <strong>{data.streaks.currentStreak}</strong>
                    <span>day streak</span>
                  </div>
                </div>
                <div className="dashboard-mini-stat gold">
                  <Coins size={18} />
                  <div>
                    <strong>{data.character.gold.toLocaleString()}</strong>
                    <span>gold available</span>
                  </div>
                </div>
                <div className="dashboard-mini-stat">
                  <CheckCheck size={18} />
                  <div>
                    <strong>{data.completedCount.toLocaleString()}</strong>
                    <span>completions</span>
                  </div>
                </div>
              </div>

              <div className="dashboard-character-links">
                <Link className="text-link" to="/character">
                  Open character <ArrowRight size={14} />
                </Link>
                <Link className="text-link" to="/marketplace">
                  Spend earned gold <ArrowRight size={14} />
                </Link>
              </div>
            </section>

            <TodayQuests quests={data.todayQuests} today={data.today} summary={data.quests} />
          </div>

          <div className="dashboard-secondary-grid">
            <WeeklyActivity week={data.week} totals={data.weeklyTotals} today={data.today} />

            <section className="panel attributes-panel dashboard-attributes" aria-labelledby="dashboard-attributes-title">
              <div className="section-heading dashboard-section-heading">
                <div>
                  <span className="eyebrow">FIVE WAYS TO GROW</span>
                  <h2 id="dashboard-attributes-title">Attribute progress</h2>
                </div>
                <Sparkles size={19} className="gold" />
              </div>
              <div className="attribute-list">
                {ATTRIBUTES.map(({ key, name }) => {
                  const attribute = data.character.attributes.find((item) => item.key === key)
                  return (
                    <div className={`attribute-row ${key.toLowerCase()}`} key={key}>
                      <AttributeIcon attribute={key} size={17} />
                      <span className="dashboard-attribute-copy">
                        <strong>{name}</strong>
                        <small>{attribute.xp.toLocaleString()} total XP</small>
                      </span>
                      <div
                        className="attribute-track"
                        role="progressbar"
                        aria-label={`${name} level ${attribute.progression.level} progress`}
                        aria-valuemin={0}
                        aria-valuemax={attribute.progression.xpForNextLevel}
                        aria-valuenow={attribute.progression.xpIntoLevel}
                      >
                        <span style={{ width: `${attribute.progression.percent}%` }} />
                      </div>
                      <span className="attribute-level">Lv. {attribute.progression.level}</span>
                    </div>
                  )
                })}
              </div>
              <SectionLink to="/character">See every strength in detail</SectionLink>
            </section>
          </div>

          <div className="dashboard-tertiary-grid">
            <RecentJourney completions={data.recentCompletions} />
          </div>

          <div className="daily-thought">
            <span>✦</span>
            <p>
              {data.streaks.todayCompletedCount
                ? `${data.streaks.todayCompletedCount} ${data.streaks.todayCompletedCount === 1 ? 'quest has' : 'quests have'} already become part of today’s story.`
                : 'A remarkable journey can begin with one ordinary thing you choose to finish.'}
            </p>
            <span>
              {data.streaks.longestStreak
                ? `BEST STREAK · ${data.streaks.longestStreak} DAYS`
                : 'YOUR REMINDER FOR TODAY'}
            </span>
          </div>
        </>
      )}
    </div>
  )
}
