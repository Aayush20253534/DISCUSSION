import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  CheckCheck,
  Coins,
  History,
  LoaderCircle,
  Sparkles,
} from 'lucide-react'
import { ATTRIBUTES, formatCompletionDate } from '@life-rpg/shared'
import { AttributeIcon } from '../components/ui.jsx'
import { useCompletionHistory } from './hooks.js'
import './progression.css'

export default function CompletionHistory() {
  const [filters, setFilters] = useState({ attribute: 'ALL', page: 1, limit: 8 })
  const query = useCompletionHistory(filters)
  const data = query.data
  return (
    <section className="panel completion-history" aria-label="Completion history">
      <div className="section-heading">
        <div>
          <span className="eyebrow">SMALL EFFORTS, REMEMBERED</span>
          <h2>The steps behind you</h2>
        </div>
        <History size={23} className="gold" />
      </div>
      <div className="history-toolbar">
        <span>
          {query.isError
            ? 'History unavailable'
            : query.isPending
              ? 'Opening your story…'
              : `${data.pagination.total} ${data.pagination.total === 1 ? 'completion' : 'completions'}`}
        </span>
        <label>
          <span className="sr-only">Filter completion history by attribute</span>
          <select
            value={filters.attribute}
            onChange={(event) => setFilters({ ...filters, attribute: event.target.value, page: 1 })}
          >
            <option value="ALL">All strengths</option>
            {ATTRIBUTES.map((item) => (
              <option key={item.key} value={item.key}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {query.isPending ? (
        <p className="journal-loading" role="status">
          <LoaderCircle className="spin" size={20} />
          Loading your milestones…
        </p>
      ) : query.isError ? (
        <div className="history-empty">
          <p role="alert">{query.error.message}</p>
          <button className="button button-outline" onClick={() => query.refetch()}>
            Retry history
          </button>
        </div>
      ) : data.completions.length ? (
        <ol className="history-list">
          {data.completions.map((receipt) => (
            <li key={receipt.id}>
              <span className={`history-icon ${receipt.attribute.toLowerCase()}`}>
                <AttributeIcon attribute={receipt.attribute} size={21} />
              </span>
              <div className="history-entry">
                <div className="history-title">
                  {receipt.questId ? (
                    <Link to={`/quests?status=COMPLETED&quest=${receipt.questId}`}>
                      {receipt.title}
                    </Link>
                  ) : (
                    <strong>{receipt.title}</strong>
                  )}
                  {receipt.levelAfter > receipt.levelBefore && (
                    <span className="history-level">
                      <Sparkles size={11} />
                      Level {receipt.levelAfter}
                    </span>
                  )}
                </div>
                <time dateTime={receipt.completedAt}>
                  {formatCompletionDate(receipt.completedAt, receipt.timezone)} ·{' '}
                  {receipt.timezone.replaceAll('_', ' ')}
                </time>
                <div className="history-earned">
                  <span>+{receipt.xpAwarded} XP</span>
                  <span>
                    <Coins size={12} />+{receipt.goldAwarded} gold
                  </span>
                  <span>
                    +{receipt.attributeXpAwarded}{' '}
                    {ATTRIBUTES.find((item) => item.key === receipt.attribute).name} XP
                  </span>
                </div>
                {!receipt.questId && (
                  <small className="history-removed">Journal entry removed · progress kept</small>
                )}
              </div>
              <CheckCheck className="history-check" size={17} />
            </li>
          ))}
        </ol>
      ) : (
        <div className="history-empty">
          <CheckCheck size={32} />
          <h3>
            {filters.attribute === 'ALL'
              ? 'Every story has a first step.'
              : 'A strength waiting to grow.'}
          </h3>
          <p>
            {filters.attribute === 'ALL'
              ? 'Complete a quest and your effort will be remembered here, with the rewards you earned.'
              : 'There are no recorded completions for this attribute yet.'}
          </p>
          <Link className="text-link" to="/quests">
            Find your next quest
            <ArrowRight size={15} />
          </Link>
        </div>
      )}
      {data && !query.isError && data.pagination.pages > 1 && (
        <nav className="quest-pagination" aria-label="Completion history pages">
          <button
            className="button button-outline"
            disabled={query.isFetching || data.pagination.page <= 1}
            onClick={() => setFilters({ ...filters, page: data.pagination.page - 1 })}
          >
            <ArrowLeft size={14} />
            Previous
          </button>
          <span>
            Page {data.pagination.page} of {data.pagination.pages}
          </span>
          <button
            className="button button-outline"
            disabled={query.isFetching || data.pagination.page >= data.pagination.pages}
            onClick={() => setFilters({ ...filters, page: data.pagination.page + 1 })}
          >
            Next
            <ArrowRight size={14} />
          </button>
        </nav>
      )}
      <p className="history-footnote">
        Your earned progress stays with you, even when a completed quest is removed from the
        journal.
      </p>
    </section>
  )
}
