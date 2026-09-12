import { ArrowRight, Check, Flame } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatActivityDate } from '@life-rpg/shared'
import { useActivity } from './hooks.js'
import './activity.css'

import { streakMessage } from './presentation.js'
export default function StreakCard() {
  const query = useActivity()
  const data = query.data
  return (
    <section className="panel streak-card" aria-label="Your daily streak">
      <span className="streak-emblem" aria-hidden="true">
        <Flame size={30} />
      </span>
      <div className="streak-card-copy">
        <span className="eyebrow">THE ART OF SHOWING UP</span>
        <h2>
          {query.isError ? (
            'Your streak will be here.'
          ) : !data ? (
            'Finding your rhythm…'
          ) : (
            <>
              {data.streaks.currentStreak} day{data.streaks.currentStreak === 1 ? '' : 's'}{' '}
              <em>in a row.</em>
            </>
          )}
        </h2>
        <p>
          {query.isError
            ? 'Activity could not be refreshed.'
            : data
              ? streakMessage(data.streaks)
              : 'Loading your saved activity.'}
        </p>
        {query.isError && (
          <button className="text-link" onClick={() => query.refetch()}>
            Retry activity
          </button>
        )}
      </div>
      {data && !query.isError && (
        <div className="streak-week" role="group" aria-label="Last seven days">
          {data.week.map((day) => (
            <span
              key={day.date}
              role="img"
              className={`week-day ${day.count ? 'has-activity' : ''}`}
              aria-label={`${formatActivityDate(day.date)}: ${day.count} completed quests`}
            >
              <small aria-hidden="true">
                {formatActivityDate(day.date, { weekday: 'short' }).slice(0, 1)}
              </small>
              <span aria-hidden="true">{day.count ? <Check size={15} /> : <i />}</span>
            </span>
          ))}
        </div>
      )}
      <Link className="text-link" to="/activity">
        View activity <ArrowRight size={16} />
      </Link>
    </section>
  )
}
