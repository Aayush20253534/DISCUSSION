import { useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatActivityDate, shiftCalendarDate, shiftCalendarMonth } from '@life-rpg/shared'
import DayHistory from './DayHistory.jsx'

export default function ActivityCalendar({ data, onMonthChange, currentMonth }) {
  const [chosen, setChosen] = useState(null)
  const selected =
    chosen ||
    (data.month === data.today.slice(0, 7)
      ? data.today
      : data.days.filter((day) => day.count).at(-1)?.date || data.days[0].date)
  const buttons = useRef(new Map())
  const start = (new Date(`${data.month}-01T00:00:00Z`).getUTCDay() + 6) % 7
  const cells = [...Array(start).fill(null), ...data.days]
  while (cells.length % 7) cells.push(null)
  const weeks = Array.from({ length: cells.length / 7 }, (_, index) =>
    cells.slice(index * 7, index * 7 + 7),
  )
  const monthLabel = formatActivityDate(`${data.month}-01`, { month: 'long', year: 'numeric' })
  function move(event, date) {
    const offset = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key]
    if (!offset) return
    event.preventDefault()
    const next = shiftCalendarDate(date, offset)
    if (next.startsWith(data.month) && next <= data.today) {
      setChosen(next)
      buttons.current.get(next)?.focus()
    }
  }
  return (
    <div className="activity-layout">
      <section className="panel activity-calendar" aria-label="Monthly activity calendar">
        <div className="section-heading">
          <div>
            <span className="eyebrow">SMALL STEPS LEAVE A TRACE</span>
            <h2 className="calendar-month-heading" tabIndex={-1}>
              {monthLabel}
            </h2>
          </div>
          <div className="calendar-arrows">
            <button
              className="icon-button"
              aria-label="Previous month"
              disabled={data.month <= '1900-01'}
              onClick={() => onMonthChange(shiftCalendarMonth(data.month, -1))}
            >
              <ChevronLeft size={20} />
            </button>
            <button
              className="icon-button"
              aria-label="Next month"
              disabled={data.month >= data.today.slice(0, 7)}
              onClick={() => onMonthChange(shiftCalendarMonth(data.month, 1))}
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
        <div className="calendar-toolbar">
          <label>
            <span>Jump to month</span>
            <input
              type="month"
              aria-label="Jump to month"
              min="1900-01"
              max={data.today.slice(0, 7)}
              value={data.month}
              onChange={(event) => {
                if (event.target.validity.valid && event.target.value)
                  onMonthChange(event.target.value)
              }}
            />
          </label>
          <button
            className="text-link"
            onClick={() => {
              setChosen(null)
              onMonthChange('')
            }}
            disabled={currentMonth && selected === data.today}
          >
            Today
          </button>
        </div>
        <p className="calendar-help" id="calendar-help">
          Select a day to revisit your quests. Arrow keys move between days.
        </p>
        <table className="calendar-table" aria-describedby="calendar-help">
          <caption className="sr-only">{monthLabel} quest activity, Monday to Sunday</caption>
          <thead>
            <tr>
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(
                (day) => (
                  <th key={day} scope="col">
                    <abbr title={day}>{day.slice(0, 3)}</abbr>
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, index) => (
              <tr key={index}>
                {week.map((day, column) => (
                  <td key={day?.date || column}>
                    {day && (
                      <button
                        ref={(node) => {
                          if (node) buttons.current.set(day.date, node)
                          else buttons.current.delete(day.date)
                        }}
                        className={`calendar-day intensity-${Math.min(day.count, 3)} ${day.date === data.today ? 'is-today' : ''}`}
                        disabled={day.date > data.today}
                        tabIndex={selected === day.date ? 0 : -1}
                        aria-pressed={selected === day.date}
                        aria-current={day.date === data.today ? 'date' : undefined}
                        aria-label={`${formatActivityDate(day.date)}: ${day.count} completed quest${day.count === 1 ? '' : 's'}${day.date > data.today ? ', future date' : ''}`}
                        onKeyDown={(event) => move(event, day.date)}
                        onClick={() => setChosen(day.date)}
                      >
                        <span>{Number(day.date.slice(-2))}</span>
                        <small aria-hidden="true">
                          {day.count
                            ? `${day.count} done`
                            : day.date === data.today
                              ? 'today'
                              : '·'}
                        </small>
                      </button>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="calendar-legend" aria-label="Calendar activity intensity">
          <span>Quests per day</span>
          {[0, 1, 2, 3].map((count) => (
            <span key={count}>
              <i className={`intensity-${count}`} />
              {count === 3 ? '3+' : count}
            </span>
          ))}
        </div>
        <div className="calendar-totals" aria-label="Selected month totals">
          <div>
            <strong>{data.totals.activeDays}</strong>
            <span>active days</span>
          </div>
          <div>
            <strong>{data.totals.completions}</strong>
            <span>quests done</span>
          </div>
          <div>
            <strong>{data.totals.xp.toLocaleString()}</strong>
            <span>XP earned</span>
          </div>
        </div>
      </section>
      <DayHistory key={selected} date={selected} />
    </div>
  )
}
