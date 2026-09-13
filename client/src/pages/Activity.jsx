import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Flame, Footprints, Trophy } from 'lucide-react'
import { PageHeading } from '../components/ui.jsx'
import { useAuth } from '../auth/useAuth.js'
import { useActivity } from '../activity/hooks.js'
import { streakMessage } from '../activity/presentation.js'
import ActivityCalendar from '../activity/ActivityCalendar.jsx'
import '../progression/progression.css'
import '../activity/activity.css'

function ActivityJournal() {
  const [month, setMonth] = useState('')
  const query = useActivity(month)
  const data = query.data
  const monthFocus = useRef(false)
  const calendarRegion = useRef(null)
  function changeMonth(value) {
    monthFocus.current = true
    setMonth(value)
  }
  useEffect(() => {
    if (data && monthFocus.current) {
      calendarRegion.current?.querySelector('.calendar-month-heading')?.focus()
      monthFocus.current = false
    }
  }, [data])
  return (
    <div className="page activity-page">
      <PageHeading
        eyebrow="THE CHRONICLE OF YOUR JOURNEY"
        title={
          <>
            Find your <em>rhythm.</em>
          </>
        }
        description="A little effort, a little more often. Your journey takes shape one day at a time."
      >
        <span className="chapter-badge">
          <CalendarDays size={16} /> CHRONICLE <span>•</span> YOUR ACTIVITY
        </span>
      </PageHeading>
      {query.isPending ? (
        <section className="panel activity-loading" role="status">
          Opening your activity journal…
        </section>
      ) : query.isError ? (
        <section className="panel activity-loading">
          <p role="alert">{query.error.message}</p>
          <button className="button button-outline" onClick={() => query.refetch()}>
            Retry activity
          </button>
          {month && (
            <button className="text-link" onClick={() => setMonth('')}>
              Return to this month
            </button>
          )}
        </section>
      ) : (
        <>
          <section className="activity-stats" aria-label="Streak statistics">
            <div className="panel activity-stat current-streak">
              <Flame size={25} />
              <span className="eyebrow">CURRENT STREAK</span>
              <strong>
                {data.streaks.currentStreak}
                <small>day{data.streaks.currentStreak === 1 ? '' : 's'}</small>
              </strong>
              <p>{streakMessage(data.streaks)}</p>
            </div>
            <div className="panel activity-stat">
              <Trophy size={25} />
              <span className="eyebrow">LONGEST STREAK</span>
              <strong>
                {data.streaks.longestStreak}
                <small>day{data.streaks.longestStreak === 1 ? '' : 's'}</small>
              </strong>
              <p>Your longest run of consecutive active days.</p>
            </div>
            <div className="panel activity-stat">
              <Footprints size={25} />
              <span className="eyebrow">DAYS YOU SHOWED UP</span>
              <strong>
                {data.streaks.totalActiveDays}
                <small>in total</small>
              </strong>
              <p>Each day counts once, however many quests you finish.</p>
            </div>
          </section>
          <div
            className={`activity-today-note ${data.streaks.todayCompletedCount ? 'is-complete' : ''}`}
          >
            <Flame size={18} />
            <p>
              {data.streaks.todayCompletedCount
                ? `Today is counted. You’ve completed ${data.streaks.todayCompletedCount} quest${data.streaks.todayCompletedCount === 1 ? '' : 's'}.`
                : 'There is still a little room for progress today.'}
            </p>
            <Link to="/quests">
              {data.streaks.todayCompletedCount ? 'Visit your journal' : 'Find a quest'}
            </Link>
          </div>
          <div ref={calendarRegion}>
            <ActivityCalendar
              key={data.month}
              data={data}
              onMonthChange={changeMonth}
              currentMonth={!month}
            />
          </div>
          <aside className="panel activity-guide" aria-label="How streaks work">
            <div>
              <span className="eyebrow">A RHYTHM, NOT A RACE</span>
              <h2>
                Every day is a <em>new beginning.</em>
              </h2>
            </div>
            <div>
              <p>
                Complete at least one quest to count an active day. Yesterday’s streak stays alive
                until the end of today. After a missed day, start again; your longest streak and
                earned rewards stay with you.
              </p>
              <p>
                Today follows <strong>{data.timezone.replaceAll('_', ' ')}</strong>. Past activity
                keeps the local date and timezone recorded when each quest was completed. Removing a
                journal entry keeps its activity.
              </p>
            </div>
          </aside>
        </>
      )}
    </div>
  )
}
export default function Activity() {
  const { user } = useAuth()
  return <ActivityJournal key={user.id} />
}
