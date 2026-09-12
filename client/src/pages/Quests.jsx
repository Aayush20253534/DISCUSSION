import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useSearchParams } from 'react-router-dom'
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCheck,
  ChevronDown,
  Compass,
  LoaderCircle,
  Plus,
  RefreshCw,
  Repeat2,
  Search,
  Sparkles,
  X,
} from 'lucide-react'
import {
  ATTRIBUTES,
  QUEST_DIFFICULTIES,
  QUEST_RECURRENCES,
  questListSchema,
  questIdSchema,
} from '@life-rpg/shared'
import { useAuth } from '../auth/useAuth.js'
import { AttributeIcon, PageHeading } from '../components/ui.jsx'
import QuestRow from '../quests/QuestRow.jsx'
import QuestEditor from '../quests/QuestEditor.jsx'
import CompleteQuest from '../progression/CompleteQuest.jsx'
import QuestDetails from '../quests/QuestDetails.jsx'
import { useQuestMutation, useQuests, useQuestSummary } from '../quests/hooks.js'
import { sampleQuests } from '../data/preview.js'
import { useInteractionFeedback } from '../interactions/interaction-context.js'
import '../quests.css'
import '../progression/progression.css'

const defaults = {
  q: '',
  attribute: 'ALL',
  difficulty: 'ALL',
  recurrence: 'ALL',
  status: 'ACTIVE',
  due: 'ALL',
  sort: 'NEWEST',
  page: 1,
  limit: 12,
}
function useDebounce(value) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), 300)
    return () => clearTimeout(timeout)
  }, [value])
  return debounced
}
export default function Quests() {
  const { user } = useAuth()
  return <QuestJournal key={user.id} />
}
function QuestJournal() {
  const { moving } = useInteractionFeedback()
  const [params, setParams] = useSearchParams()
  const raw = Object.fromEntries([...params].filter(([key]) => key in defaults))
  const parsed = questListSchema.safeParse(raw)
  const filters = parsed.success ? parsed.data : defaults
  const debouncedSearch = useDebounce(filters.q)
  const query = useQuests({ ...filters, q: debouncedSearch })
  const summary = useQuestSummary()
  const mutation = useQuestMutation()
  const [editor, setEditor] = useState(() => (params.get('new') === '1' ? {} : null))
  const [detailId, setDetailId] = useState(() =>
    questIdSchema.safeParse(params.get('quest')).success ? params.get('quest') : null,
  )
  const [completing, setCompleting] = useState(null)
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')
  function changeFilters(updates) {
    const next = { ...filters, ...updates, page: 'page' in updates ? updates.page : 1 }
    const values = new URLSearchParams()
    for (const [key, value] of Object.entries(next))
      if (value !== defaults[key]) values.set(key, String(value))
    setParams(values, { replace: true })
  }
  function closeDetails() {
    setDetailId(null)
    if (params.has('quest')) {
      const next = new URLSearchParams(params)
      next.delete('quest')
      setParams(next, { replace: true })
    }
  }
  function closeEditor() {
    setEditor(null)
    if (params.has('new')) {
      const next = new URLSearchParams(params)
      next.delete('new')
      setParams(next, { replace: true })
    }
  }
  function saved(_quest, edited) {
    closeEditor()
    setNotice(
      edited ? 'Your quest has been updated.' : 'A new quest has been added to your journal.',
    )
    if (!edited) {
      changeFilters({ ...defaults })
    }
  }
  async function archive(quest) {
    if (mutation.isPending) return
    setActionError('')
    setNotice('')
    try {
      await mutation.mutateAsync({
        action: 'update',
        id: quest.id,
        body: {
          revision: quest.revision,
          status: quest.status === 'ARCHIVED' ? 'ACTIVE' : 'ARCHIVED',
        },
      })
      setNotice(
        quest.status === 'ARCHIVED'
          ? 'Quest restored to your journal.'
          : 'Quest archived. Find it in Archived whenever you need it.',
      )
    } catch (error) {
      setActionError(error.message)
    }
  }
  const count = (field) => (summary.isError ? '—' : (summary.data?.[field] ?? '…'))
  const data = query.data
  const hasFilters = Boolean(
    filters.q ||
    filters.attribute !== 'ALL' ||
    filters.difficulty !== 'ALL' ||
    filters.recurrence !== 'ALL' ||
    filters.due !== 'ALL',
  )
  return (
    <div className="page quest-journal-page">
      <PageHeading
        eyebrow="SMALL INTENTIONS. REAL POSSIBILITIES."
        title={
          <>
            Your quest <em>journal.</em>
          </>
        }
        description="Make a little room for what matters. One clear next step at a time."
      >
        <button
          className="button button-gold new-quest-button"
          data-quest-focus
          onClick={() => setEditor({})}
        >
          <Plus size={17} />
          New quest
        </button>
      </PageHeading>
      <div className="journal-summary" aria-label="Your quest counts">
        {[
          {
            key: 'active',
            label: 'Active quests',
            icon: BookOpen,
            updates: { status: 'ACTIVE', due: 'ALL' },
            caption: 'ROOM TO BEGIN',
          },
          {
            key: 'dailyReady',
            label: 'Daily ready',
            icon: Repeat2,
            updates: { status: 'ACTIVE', recurrence: 'DAILY', due: 'ALL' },
            caption: 'RETURN & GROW',
          },
          {
            key: 'completed',
            label: 'Completed',
            icon: CheckCheck,
            updates: { status: 'COMPLETED', due: 'ALL', sort: 'COMPLETED' },
            caption: 'EFFORT, REMEMBERED',
          },
          {
            key: 'archived',
            label: 'Archived',
            icon: Archive,
            updates: { status: 'ARCHIVED', due: 'ALL' },
            caption: 'KEPT FOR LATER',
          },
        ].map(({ key, label, icon: Icon, updates, caption }) => (
          <button
            key={key}
            className="journal-summary-card"
            onClick={() => changeFilters({ ...defaults, ...updates })}
            aria-label={`Show ${label.toLowerCase()}`}
          >
            <span className="journal-summary-icon">
              <Icon size={21} />
            </span>
            <span>
              <strong>{count(key)}</strong>
              <span>{label}</span>
            </span>
            <small>{caption}</small>
          </button>
        ))}
      </div>
      {summary.isError && (
        <p className="journal-inline-error">
          Quest counts are unavailable.{' '}
          <button onClick={() => summary.refetch()}>Retry counts</button>
        </p>
      )}
      <div className="journal-layout">
        <section className="panel saved-journal" aria-label="Saved quests">
          <div className="journal-section-head">
            <div>
              <span className="eyebrow">YOUR EVERYDAY ADVENTURE</span>
              <h2>
                {filters.status === 'ARCHIVED'
                  ? 'Kept for another day'
                  : filters.status === 'COMPLETED'
                    ? 'Small promises, kept'
                    : 'The next small step'}
              </h2>
            </div>
            <BookOpen size={23} className="green" />
          </div>
          <div className="journal-status-tabs" role="group" aria-label="Quest status">
            <button
              className={filters.status === 'ACTIVE' ? 'selected' : ''}
              aria-pressed={filters.status === 'ACTIVE'}
              onClick={() => changeFilters({ status: 'ACTIVE' })}
            >
              Active
            </button>
            <button
              className={filters.status === 'COMPLETED' ? 'selected' : ''}
              aria-pressed={filters.status === 'COMPLETED'}
              onClick={() => changeFilters({ status: 'COMPLETED', sort: 'COMPLETED' })}
            >
              Completed
            </button>
            <button
              className={filters.status === 'ARCHIVED' ? 'selected' : ''}
              aria-pressed={filters.status === 'ARCHIVED'}
              onClick={() => changeFilters({ status: 'ARCHIVED' })}
            >
              Archived
            </button>
            <button
              className={filters.status === 'ALL' ? 'selected' : ''}
              aria-pressed={filters.status === 'ALL'}
              onClick={() => changeFilters({ status: 'ALL' })}
            >
              All quests
            </button>
          </div>
          <div className="journal-search-row">
            <label className="search-field">
              <Search size={17} />
              <span className="sr-only">Search your quests</span>
              <input
                type="search"
                value={filters.q}
                maxLength={120}
                onChange={(event) => changeFilters({ q: event.target.value })}
                placeholder="Find a small intention…"
              />
            </label>
            <label className="journal-sort">
              <span className="sr-only">Sort quests</span>
              <select
                value={filters.sort}
                onChange={(event) => changeFilters({ sort: event.target.value })}
              >
                <option value="NEWEST">Newest first</option>
                <option value="OLDEST">Oldest first</option>
                <option value="DUE">Due date</option>
                <option value="TITLE">Title A–Z</option>
                <option value="COMPLETED">Recently completed</option>
              </select>
              <ChevronDown size={14} />
            </label>
          </div>
          <div className="journal-attributes" role="group" aria-label="Filter quests by attribute">
            {[{ key: 'ALL', name: 'All strengths' }, ...ATTRIBUTES].map(({ key, name }) => (
              <button
                className={`filter-chip ${key.toLowerCase()} ${filters.attribute === key ? 'selected' : ''}`}
                key={key}
                aria-pressed={filters.attribute === key}
                onClick={() => changeFilters({ attribute: key })}
              >
                {key !== 'ALL' && <AttributeIcon attribute={key} size={13} />}
                {name}
              </button>
            ))}
          </div>
          <div className="journal-secondary-filters">
            <label>
              Difficulty
              <select
                value={filters.difficulty}
                onChange={(event) => changeFilters({ difficulty: event.target.value })}
              >
                <option value="ALL">Any difficulty</option>
                {QUEST_DIFFICULTIES.map(({ key, label }) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Recurrence
              <select
                value={filters.recurrence}
                onChange={(event) =>
                  changeFilters({
                    recurrence: event.target.value,
                    ...(event.target.value === 'DAILY' ? { due: 'ALL' } : {}),
                  })
                }
              >
                <option value="ALL">Any recurrence</option>
                {QUEST_RECURRENCES.map(({ key, label }) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              One-time date
              <select
                value={filters.due}
                disabled={filters.recurrence === 'DAILY'}
                onChange={(event) => changeFilters({ due: event.target.value })}
              >
                <option value="ALL">Any due date</option>
                <option value="TODAY">Due today</option>
                <option value="UPCOMING">Upcoming</option>
                <option value="OVERDUE">Overdue</option>
                <option value="UNSCHEDULED">No due date</option>
              </select>
            </label>
            {hasFilters && (
              <button
                className="journal-clear"
                onClick={() => changeFilters({ ...defaults, status: filters.status })}
              >
                <X size={13} />
                Clear filters
              </button>
            )}
          </div>
          <div className="journal-results-head">
            <span aria-live="polite">
              {query.isPending
                ? 'Opening your journal…'
                : query.isError
                  ? 'Unable to load quests'
                  : `${data.pagination.total} ${data.pagination.total === 1 ? 'quest' : 'quests'}${hasFilters ? ' found' : ''}`}
            </span>
            <button
              className="icon-button"
              disabled={query.isFetching}
              aria-label="Refresh quests"
              onClick={() => {
                query.refetch()
                summary.refetch()
                setActionError('')
              }}
            >
              <RefreshCw size={15} className={query.isFetching ? 'spin' : ''} />
            </button>
          </div>
          {actionError && (
            <div className="journal-action-message">
              <p className="form-message" role="alert">
                {actionError}
              </p>
              <button
                className="text-link"
                onClick={() => {
                  query.refetch()
                  setActionError('')
                }}
              >
                Load latest quests
              </button>
            </div>
          )}
          {notice && (
            <div className="quest-notice" role="status">
              <Sparkles size={15} />
              <p>{notice}</p>
              <button
                className="icon-button"
                aria-label="Dismiss notification"
                onClick={() => setNotice('')}
              >
                <X size={14} />
              </button>
            </div>
          )}
          {query.isPending ? (
            <div className="journal-loading" role="status">
              <LoaderCircle className="spin" size={23} />
              <span>Finding your next step…</span>
            </div>
          ) : query.isError ? (
            <div className="journal-empty journal-error">
              <Compass size={32} />
              <h3>Your journal is out of reach.</h3>
              <p role="alert">{query.error.message}</p>
              <button className="button button-outline" onClick={() => query.refetch()}>
                Try again
              </button>
            </div>
          ) : data.quests.length ? (
            <div className="saved-quest-list">
              <AnimatePresence initial={false} mode="popLayout">
                {data.quests.map((quest) => (
                  <motion.div
                    className="quest-motion-row"
                    key={quest.id}
                    layout={moving}
                    initial={moving ? { opacity: 0, y: 8 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    exit={moving ? { opacity: 0, x: 18, scale: 0.99 } : { opacity: 0 }}
                    transition={{ duration: moving ? 0.2 : 0 }}
                  >
                    <QuestRow
                      quest={quest}
                      today={data.today}
                      busy={mutation.isPending}
                      onOpen={(item) => setDetailId(item.id)}
                      onEdit={(item) => setEditor({ quest: item })}
                      onArchive={archive}
                      onComplete={setCompleting}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="journal-empty">
              <span className="empty-journal-icon">
                {hasFilters ? <Search size={31} /> : <BookOpen size={31} />}
              </span>
              <h3>
                {hasFilters
                  ? 'A different path, perhaps?'
                  : filters.status === 'COMPLETED'
                    ? 'Good things take a first step.'
                    : filters.status === 'ARCHIVED'
                      ? 'Nothing tucked away yet.'
                      : 'A fresh page. A small beginning.'}
              </h3>
              <p>
                {hasFilters
                  ? 'No quests match these filters. Try another word or give your search a little more room.'
                  : filters.status === 'COMPLETED'
                    ? 'Finish a real-world quest and mark it complete. Your earned rewards and finished quests will appear here.'
                    : filters.status === 'ARCHIVED'
                      ? 'Archived quests will wait here until you’re ready to return to them.'
                      : 'Read a few pages. Take a walk. Make something. Start with a quest that feels like you.'}
              </p>
              <button
                className="button button-outline"
                onClick={() =>
                  hasFilters
                    ? changeFilters({ ...defaults, status: filters.status })
                    : ['ARCHIVED', 'COMPLETED'].includes(filters.status)
                      ? changeFilters({ status: 'ACTIVE' })
                      : setEditor({})
                }
              >
                {hasFilters
                  ? 'Clear filters'
                  : ['ARCHIVED', 'COMPLETED'].includes(filters.status)
                    ? 'Back to active quests'
                    : 'Create your first quest'}
                <ArrowRight size={15} />
              </button>
            </div>
          )}
          {data && !query.isError && data.pagination.pages > 1 && (
            <nav className="quest-pagination" aria-label="Quest pages">
              <button
                className="button button-outline"
                disabled={query.isFetching || data.pagination.page <= 1}
                onClick={() => changeFilters({ page: data.pagination.page - 1 })}
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
                onClick={() => changeFilters({ page: data.pagination.page + 1 })}
              >
                Next
                <ArrowRight size={14} />
              </button>
            </nav>
          )}
          <div className="journal-footnote">
            <CalendarDays size={14} />
            <span>
              One-time dates follow {summary.data?.timezone?.replaceAll('_', ' ') || 'your account timezone'}. Daily quests keep the timezone they were scheduled in and can reward once per scheduled day.
            </span>
          </div>
        </section>
        <aside className="journal-inspiration" aria-label="Quest inspiration">
          <section className="panel inspiration-panel">
            <span className="eyebrow">A SPARK TO GET STARTED</span>
            <h2>
              Borrow a little
              <br /> <em>inspiration.</em>
            </h2>
            <p>Make an idea your own. You choose what finds a place in your journal.</p>
            <div className="inspiration-list">
              {sampleQuests.map((item) => (
                <div className={`inspiration-item ${item.attribute.toLowerCase()}`} key={item.id}>
                  <AttributeIcon attribute={item.attribute} size={22} />
                  <h3>{item.title}</h3>
                  <p>{item.detail}</p>
                  <button
                    className="text-link"
                    onClick={() =>
                      setEditor({
                        template: {
                          title: item.title,
                          description: item.detail,
                          attribute: item.attribute,
                          difficulty: item.difficulty.toUpperCase(),
                          estimatedMinutes: Number.parseInt(item.duration, 10),
                        },
                      })
                    }
                  >
                    Use this idea
                    <ArrowRight size={14} />
                  </button>
                </div>
              ))}
            </div>
          </section>
          <div className="journal-quote">
            <span>✦</span>
            <p>
              Start smaller than you think.
              <br />
              Begin sooner than you planned.
            </p>
            <small>ONE STEP IS ENOUGH FOR TODAY</small>
          </div>
        </aside>
      </div>
      {completing && <CompleteQuest quest={completing} onClose={() => setCompleting(null)} />}
      {editor && <QuestEditor {...editor} onClose={closeEditor} onSaved={saved} />}
      {detailId && (
        <QuestDetails
          id={detailId}
          onClose={closeDetails}
          onEdit={(quest) => {
            closeDetails()
            setEditor({ quest })
          }}
          onComplete={(quest) => {
            closeDetails()
            setCompleting(quest)
          }}
          onChanged={(message) => {
            closeDetails()
            setNotice(message)
          }}
        />
      )}
    </div>
  )
}
