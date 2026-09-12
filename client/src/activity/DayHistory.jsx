import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCheck, Coins, Repeat2 } from 'lucide-react'
import {
  ATTRIBUTES,
  formatActivityDate,
  formatCompletionDate,
  formatQuestDate,
} from '@life-rpg/shared'
import { AttributeIcon } from '../components/ui.jsx'
import { useActivityDay } from './hooks.js'

export default function DayHistory({ date }) {
  const [page, setPage] = useState(1)
  const query = useActivityDay(date, page)
  const data = query.data
  return (
    <section className="panel activity-day-history" aria-label="Selected day history">
      <div className="section-heading">
        <div>
          <span className="eyebrow">ONE DAY IN YOUR STORY</span>
          <h2>{formatActivityDate(date, { day: 'numeric', month: 'long' })}</h2>
        </div>
        <CheckCheck size={23} className="gold" />
      </div>
      <p className="activity-day-subtitle">
        {formatActivityDate(date, { weekday: 'long', year: 'numeric' })}
      </p>
      {query.isPending ? (
        <p role="status" className="activity-empty">
          Loading this day’s effort…
        </p>
      ) : query.isError ? (
        <div className="activity-empty">
          <p role="alert">{query.error.message}</p>
          <button className="button button-outline" onClick={() => query.refetch()}>
            Retry day
          </button>
        </div>
      ) : data.completions.length ? (
        <>
          <p className="activity-day-count" role="status">
            {data.pagination.total} completed quest{data.pagination.total === 1 ? '' : 's'}
          </p>
          <ol className="activity-receipts">
            {data.completions.map((receipt) => (
              <li key={receipt.id}>
                <span className={`history-icon ${receipt.attribute.toLowerCase()}`}>
                  <AttributeIcon attribute={receipt.attribute} size={19} />
                </span>
                <div className="activity-receipt-body">
                  {receipt.questId ? (
                    <Link
                      to={`/quests?status=${receipt.recurrence === 'DAILY' ? 'ALL' : 'COMPLETED'}&quest=${receipt.questId}`}
                    >
                      {receipt.title}
                    </Link>
                  ) : (
                    <strong>{receipt.title}</strong>
                  )}
                  {receipt.recurrence === 'DAILY' && (
                    <span className="activity-recurrence">
                      <Repeat2 size={11} />
                      Daily schedule · {formatQuestDate(receipt.scheduledDate)}
                    </span>
                  )}
                  <time dateTime={receipt.completedAt}>
                    {formatCompletionDate(receipt.completedAt, receipt.timezone)} ·{' '}
                    {receipt.timezone.replaceAll('_', ' ')}
                  </time>
                  <div className="activity-earned">
                    <span>+{receipt.xpAwarded} XP</span>
                    <span>
                      <Coins size={12} />+{receipt.goldAwarded} gold
                    </span>
                  </div>
                  <small>
                    +{receipt.attributeXpAwarded}{' '}
                    {ATTRIBUTES.find((item) => item.key === receipt.attribute).name} XP
                  </small>
                  {!receipt.questId && <small>Journal entry removed · activity kept</small>}
                </div>
              </li>
            ))}
          </ol>
          {data.pagination.pages > 1 && (
            <nav className="activity-pagination" aria-label="Day history pages">
              <button
                className="icon-button"
                aria-label="Previous day history page"
                disabled={query.isFetching || data.pagination.page <= 1}
                onClick={() => setPage(data.pagination.page - 1)}
              >
                <ArrowLeft size={18} />
              </button>
              <span>
                Page {data.pagination.page} of {data.pagination.pages}
              </span>
              <button
                className="icon-button"
                aria-label="Next day history page"
                disabled={query.isFetching || data.pagination.page >= data.pagination.pages}
                onClick={() => setPage(data.pagination.page + 1)}
              >
                <ArrowRight size={18} />
              </button>
            </nav>
          )}
        </>
      ) : (
        <div className="activity-empty">
          <CheckCheck size={30} />
          <h3>
            {date === data.today ? 'A little effort goes a long way.' : 'A quiet day on the trail.'}
          </h3>
          <p>
            {date === data.today
              ? 'Complete a quest to light up today and grow your streak.'
              : 'No quests were completed on this date. Every new day is another chance to begin.'}
          </p>
          <Link className="text-link" to="/quests">
            Open your quest journal <ArrowRight size={15} />
          </Link>
        </div>
      )}
    </section>
  )
}
