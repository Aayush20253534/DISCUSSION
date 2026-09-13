import { useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  CheckCheck,
  LoaderCircle,
  Pencil,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import {
  ATTRIBUTES,
  QUEST_DIFFICULTIES,
  QUEST_MASTER_PACES,
  formatQuestDate,
  questCreateSchema,
  questMasterRequestSchema,
} from '@atlasborn/shared'
import { AttributeIcon, Modal } from '../components/ui.jsx'
import { apiSend } from '../lib/api.js'
import { useQuestMutation } from './hooks.js'

const defaults = {
  goal: '',
  questCount: 5,
  horizonDays: 14,
  pace: 'BALANCED',
}

function validationFields(error) {
  const fields = {}
  for (const issue of error.issues)
    if (issue.path[0] && !fields[issue.path[0]]) fields[issue.path[0]] = issue.message
  return fields
}

function providerName(provider) {
  return provider === 'groq' ? 'Groq' : 'Gemini'
}

export default function QuestMaster({ open, onOpenChange, onSaved }) {
  const goalRef = useRef(null)
  const mutation = useQuestMutation()
  const [values, setValues] = useState(defaults)
  const [fields, setFields] = useState({})
  const [message, setMessage] = useState('')
  const [generating, setGenerating] = useState(false)
  const [plan, setPlan] = useState(null)
  const [drafts, setDrafts] = useState([])
  const [selected, setSelected] = useState(() => new Set())
  const [saved, setSaved] = useState(() => new Set())
  const [editingId, setEditingId] = useState(null)

  const chosen = useMemo(
    () => drafts.filter((quest) => selected.has(quest.requestId) && !saved.has(quest.requestId)),
    [drafts, selected, saved],
  )
  const busy = generating || mutation.isPending

  function resetPlan() {
    setPlan(null)
    setDrafts([])
    setSelected(new Set())
    setSaved(new Set())
    setEditingId(null)
  }

  function updateValue(event) {
    const { name, value } = event.target
    setValues((previous) => ({
      ...previous,
      [name]: ['questCount', 'horizonDays'].includes(name) ? Number(value) : value,
    }))
    setFields((previous) => ({ ...previous, [name]: undefined }))
    setMessage('')
  }

  async function generate(event) {
    event.preventDefault()
    if (busy) return
    const parsed = questMasterRequestSchema.safeParse(values)
    if (!parsed.success) {
      const nextFields = validationFields(parsed.error)
      setFields(nextFields)
      setMessage('Give the Quest Master a clearer goal first.')
      requestAnimationFrame(() => goalRef.current?.focus())
      return
    }
    setGenerating(true)
    setFields({})
    setMessage('')
    resetPlan()
    try {
      const result = await apiSend('/api/v1/ai/quest-master/generate', parsed.data, 'POST', {
        timeoutMs: 30000,
      })
      setPlan(result)
      setDrafts(result.quests)
      setSelected(new Set(result.quests.map((quest) => quest.requestId)))
    } catch (error) {
      setMessage(error.message)
    } finally {
      setGenerating(false)
    }
  }

  function toggle(requestId) {
    if (saved.has(requestId)) return
    setSelected((previous) => {
      const next = new Set(previous)
      if (next.has(requestId)) next.delete(requestId)
      else next.add(requestId)
      return next
    })
  }

  function updateDraft(requestId, field, value) {
    setDrafts((previous) =>
      previous.map((quest) => (quest.requestId === requestId ? { ...quest, [field]: value } : quest)),
    )
    setMessage('')
  }

  async function saveSelected() {
    if (busy || !chosen.length) return
    setMessage('')
    const prepared = []
    for (const quest of chosen) {
      const payload = {
        requestId: quest.requestId,
        title: quest.title,
        description: quest.description,
        attribute: quest.attribute,
        difficulty: quest.difficulty,
        recurrence: 'ONCE',
        estimatedMinutes: quest.estimatedMinutes,
        dueDate: quest.dueDate || null,
      }
      const parsed = questCreateSchema.safeParse(payload)
      if (!parsed.success) {
        setEditingId(quest.requestId)
        setMessage(`“${quest.title || 'This quest'}” needs a valid title, time estimate, and date.`)
        return
      }
      prepared.push({ requestId: quest.requestId, payload: parsed.data })
    }

    const completed = []
    try {
      for (const item of prepared) {
        await mutation.mutateAsync({ action: 'create', body: item.payload })
        completed.push(item.requestId)
        setSaved((previous) => new Set([...previous, item.requestId]))
      }
      resetPlan()
      setValues(defaults)
      onSaved(completed.length)
    } catch (error) {
      setMessage(
        completed.length
          ? `${completed.length} quest${completed.length === 1 ? '' : 's'} reached your journal, but the rest could not be saved. ${error.message}`
          : error.message,
      )
    }
  }

  const allUnsavedSelected = drafts
    .filter((quest) => !saved.has(quest.requestId))
    .every((quest) => selected.has(quest.requestId))

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !busy && onOpenChange(next)}
      className="quest-master-dialog"
      eyebrow="THE QUEST MASTER"
      returnFocusSelector="[data-quest-master-trigger]"
      title={plan ? plan.campaignTitle : 'Let the Quest Master chart the path.'}
      description={
        plan
          ? plan.summary
          : 'Describe a real goal. AI will turn it into a practical sequence of quests while your server keeps XP, gold, and progression rules authoritative.'
      }
    >
      {!plan ? (
        <form className="quest-master-form" onSubmit={generate} noValidate aria-busy={generating}>
          <div className="quest-master-callout">
            <span className="quest-master-sigil" aria-hidden="true">
              <Sparkles size={21} />
            </span>
            <div>
              <strong>Goal → campaign</strong>
              <p>The Quest Master plans the path. It never decides rewards or edits your stats.</p>
            </div>
          </div>

          <div className="form-field quest-master-goal">
            <label htmlFor="quest-master-goal">What do you want to accomplish?</label>
            <textarea
              ref={goalRef}
              id="quest-master-goal"
              name="goal"
              value={values.goal}
              onChange={updateValue}
              rows={5}
              maxLength={800}
              placeholder="Example: I want to learn React well enough to build and deploy a polished project in two weeks."
              aria-invalid={Boolean(fields.goal)}
              aria-describedby={fields.goal ? 'quest-master-goal-error' : 'quest-master-goal-help'}
              autoFocus
            />
            <p
              id={fields.goal ? 'quest-master-goal-error' : 'quest-master-goal-help'}
              className={fields.goal ? 'field-error' : 'field-hint'}
            >
              {fields.goal || `${values.goal.length.toLocaleString()} / 800 characters`}
            </p>
          </div>

          <div className="quest-master-options">
            <label>
              Quests
              <select name="questCount" value={values.questCount} onChange={updateValue}>
                {[3, 4, 5, 6, 7, 8].map((count) => (
                  <option key={count} value={count}>
                    {count} milestones
                  </option>
                ))}
              </select>
            </label>
            <label>
              Time horizon
              <select name="horizonDays" value={values.horizonDays} onChange={updateValue}>
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={21}>21 days</option>
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
              </select>
            </label>
            <label>
              Pace
              <select name="pace" value={values.pace} onChange={updateValue}>
                {QUEST_MASTER_PACES.map(({ key, label }) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {message && (
            <p className="form-message" role="alert">
              {message}
            </p>
          )}

          <button className="button button-gold quest-master-generate" disabled={generating}>
            {generating ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />}
            {generating ? 'Forging your campaign…' : 'Forge questline'}
          </button>
          <p className="quest-master-privacy">
            Your goal and a small amount of game context are sent to the configured AI provider. API keys stay on the server.
          </p>
        </form>
      ) : (
        <div className="quest-master-plan" aria-busy={mutation.isPending}>
          <div className="quest-master-planbar">
            <span>
              <Sparkles size={14} /> Forged with {providerName(plan.provider)}
            </span>
            <button
              type="button"
              className="text-link"
              disabled={busy}
              onClick={() => {
                resetPlan()
                requestAnimationFrame(() => goalRef.current?.focus())
              }}
            >
              <RefreshCw size={13} /> New plan
            </button>
          </div>

          <div className="quest-master-selectbar">
            <label>
              <input
                type="checkbox"
                checked={allUnsavedSelected}
                onChange={() => {
                  const unsaved = drafts.filter((quest) => !saved.has(quest.requestId))
                  setSelected(
                    allUnsavedSelected
                      ? new Set()
                      : new Set(unsaved.map((quest) => quest.requestId)),
                  )
                }}
              />
              Select all
            </label>
            <span>{chosen.length} ready for your journal</span>
          </div>

          <div className="quest-master-drafts">
            {drafts.map((quest, index) => {
              const isSaved = saved.has(quest.requestId)
              const isEditing = editingId === quest.requestId
              return (
                <article
                  className={`quest-master-draft ${selected.has(quest.requestId) ? 'selected' : ''} ${isSaved ? 'saved' : ''}`}
                  key={quest.requestId}
                >
                  <div className="quest-master-draft-head">
                    <label className="quest-master-check">
                      <input
                        type="checkbox"
                        checked={selected.has(quest.requestId) || isSaved}
                        disabled={isSaved || busy}
                        onChange={() => toggle(quest.requestId)}
                        aria-label={`Include ${quest.title}`}
                      />
                      <span>{isSaved ? <CheckCheck size={14} /> : index + 1}</span>
                    </label>
                    <div className="quest-master-draft-copy">
                      <strong>{quest.title}</strong>
                      <p>{quest.description}</p>
                    </div>
                    <button
                      type="button"
                      className="icon-button"
                      disabled={isSaved || busy}
                      aria-label={`Tune ${quest.title}`}
                      onClick={() => setEditingId(isEditing ? null : quest.requestId)}
                    >
                      <Pencil size={14} />
                    </button>
                  </div>
                  <div className="quest-master-meta">
                    <span className={`attribute-tag ${quest.attribute.toLowerCase()}`}>
                      <AttributeIcon attribute={quest.attribute} size={12} />
                      {ATTRIBUTES.find(({ key }) => key === quest.attribute)?.name}
                    </span>
                    <span>{QUEST_DIFFICULTIES.find(({ key }) => key === quest.difficulty)?.label}</span>
                    <span>{quest.estimatedMinutes} min</span>
                    <span>{formatQuestDate(quest.dueDate)}</span>
                  </div>
                  <p className="quest-master-rationale">{quest.rationale}</p>

                  {isEditing && (
                    <div className="quest-master-tune">
                      <label className="quest-master-wide">
                        Title
                        <input
                          value={quest.title}
                          maxLength={120}
                          onChange={(event) => updateDraft(quest.requestId, 'title', event.target.value)}
                        />
                      </label>
                      <label>
                        Attribute
                        <select
                          value={quest.attribute}
                          onChange={(event) => updateDraft(quest.requestId, 'attribute', event.target.value)}
                        >
                          {ATTRIBUTES.map(({ key, name }) => (
                            <option key={key} value={key}>
                              {name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Difficulty
                        <select
                          value={quest.difficulty}
                          onChange={(event) => updateDraft(quest.requestId, 'difficulty', event.target.value)}
                        >
                          {QUEST_DIFFICULTIES.map(({ key, label }) => (
                            <option key={key} value={key}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Minutes
                        <input
                          type="number"
                          min={1}
                          max={1440}
                          value={quest.estimatedMinutes ?? ''}
                          onChange={(event) =>
                            updateDraft(
                              quest.requestId,
                              'estimatedMinutes',
                              event.target.value === '' ? null : Number(event.target.value),
                            )
                          }
                        />
                      </label>
                      <label>
                        Due date
                        <input
                          type="date"
                          value={quest.dueDate || ''}
                          onChange={(event) =>
                            updateDraft(quest.requestId, 'dueDate', event.target.value || null)
                          }
                        />
                      </label>
                      <label className="quest-master-wide">
                        Notes
                        <textarea
                          rows={2}
                          maxLength={2000}
                          value={quest.description}
                          onChange={(event) =>
                            updateDraft(quest.requestId, 'description', event.target.value)
                          }
                        />
                      </label>
                    </div>
                  )}
                </article>
              )
            })}
          </div>

          {message && (
            <p className="form-message" role="alert">
              {message}
            </p>
          )}

          <div className="quest-master-actions">
            <button
              type="button"
              className="button button-outline"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Keep as preview
            </button>
            <button
              type="button"
              className="button button-gold"
              disabled={busy || !chosen.length}
              onClick={saveSelected}
            >
              {mutation.isPending ? <LoaderCircle className="spin" size={16} /> : <CheckCheck size={16} />}
              {mutation.isPending
                ? 'Adding quests…'
                : `Add ${chosen.length} quest${chosen.length === 1 ? '' : 's'} to journal`}
              {!mutation.isPending && <ArrowRight size={14} />}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
