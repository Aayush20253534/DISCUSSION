import { ArrowRight, CalendarDays, Check, Coins, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatActivityDate } from '@atlasborn/shared'

export default function WeeklyActivity({ week, totals, today }) {
  const peak = Math.max(1, ...week.map((day) => day.count))
  return (
    <section className="panel weekly-activity" aria-labelledby="weekly-activity-title">
      <div className="section-heading dashboard-section-heading">
        <div>
          <span className="eyebrow">THE LAST SEVEN DAYS</span>
          <h2 id="weekly-activity-title">Your weekly rhythm</h2>
        </div>
        <CalendarDays size={21} className="green" />
      </div>
      <div className="weekly-bars" role="list" aria-label="Quest completions over the last seven days">
        {week.map((day) => {
          const percent = day.count ? Math.max(18, (day.count / peak) * 100) : 0
          const current = day.date === today
          return (
            <div className={`weekly-day ${current ? 'today' : ''}`} role="listitem" key={day.date}>
              <div className="weekly-bar-track" aria-hidden="true">
                <span style={{ height: `${percent}%` }}>{day.count > 0 && <i />}</span>
              </div>
              <strong>{day.count || '·'}</strong>
              <span>{formatActivityDate(day.date, { weekday: 'short' }).slice(0, 2)}</span>
              <small>{day.date.slice(8)}</small>
              <span className="sr-only">
                {formatActivityDate(day.date)}: {day.count} completed quest{day.count === 1 ? '' : 's'}, {day.xp} XP and {day.gold} gold.
              </span>
            </div>
          )
        })}
      </div>
      <div className="weekly-totals" aria-label="Seven-day totals">
        <span>
          <Check size={14} />
          <strong>{totals.completions}</strong> completions
        </span>
        <span>
          <Sparkles size={14} />
          <strong>{totals.xp}</strong> XP
        </span>
        <span>
          <Coins size={14} />
          <strong>{totals.gold}</strong> gold earned
        </span>
      </div>
      <Link className="text-link weekly-activity-link" to="/activity">
        Open the full activity journal <ArrowRight size={15} />
      </Link>
    </section>
  )
}
