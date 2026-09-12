import { useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { ArrowRight, LoaderCircle, RefreshCw, X } from 'lucide-react'
import {
  ATTRIBUTES,
  QUEST_DIFFICULTIES,
  questCreateSchema,
  questUpdateSchema,
} from '@life-rpg/shared'
import { AttributeIcon } from '../components/ui.jsx'
import { apiGet } from '../lib/api.js'
import RewardPreview from '../progression/RewardPreview.jsx'
import { useQuestMutation } from './hooks.js'

function valuesFrom(quest) {
  return {
    title: quest?.title || '',
    description: quest?.description || '',
    attribute: quest?.attribute || 'INTELLECT',
    difficulty: quest?.difficulty || 'EASY',
    estimatedMinutes: quest?.estimatedMinutes?.toString() || '',
    dueDate: quest?.dueDate || '',
  }
}
export default function QuestEditor({ quest, template, onClose, onSaved }) {
  const [original, setOriginal] = useState(quest || null)
  const [values, setValues] = useState(() => valuesFrom(quest || template))
  const [requestId] = useState(() => crypto.randomUUID())
  const [fields, setFields] = useState({})
  const [message, setMessage] = useState('')
  const [discard, setDiscard] = useState(false)
  const [reloading, setReloading] = useState(false)
  const [lockedDraft, setLockedDraft] = useState(null)
  const form = useRef(null)
  const cancel = useRef(null)
  const mutation = useQuestMutation()
  const busy = mutation.isPending || reloading
  const conflict = mutation.error?.code === 'QUEST_CHANGED'
  const missing = ['QUEST_NOT_FOUND', 'QUEST_COMPLETED'].includes(mutation.error?.code)
  const dirty = JSON.stringify(values) !== JSON.stringify(valuesFrom(original || template))
  function close() {
    if (busy) return
    if (dirty) {
      setDiscard(true)
      requestAnimationFrame(() => cancel.current?.focus())
    } else onClose()
  }
  function change(event) {
    const { name, value } = event.target
    setValues((previous) => ({ ...previous, [name]: value }))
    setFields((previous) => ({ ...previous, [name]: undefined }))
    setMessage('')
  }
  async function submit(event) {
    event.preventDefault()
    if (busy || conflict || missing) return
    const draft = {
      ...values,
      dueDate: values.dueDate || null,
      estimatedMinutes: values.estimatedMinutes === '' ? null : Number(values.estimatedMinutes),
      ...(original ? { revision: original.revision } : { requestId }),
    }
    const parsed = (original ? questUpdateSchema : questCreateSchema).safeParse(
      lockedDraft || draft,
    )
    if (!parsed.success) {
      const errors = {}
      for (const issue of parsed.error.issues)
        if (issue.path[0] && !errors[issue.path[0]]) errors[issue.path[0]] = issue.message
      setFields(errors)
      setMessage('Please check your quest details.')
      form.current.elements.namedItem(Object.keys(errors)[0])?.focus()
      return
    }
    setFields({})
    setMessage('')
    try {
      const result = await mutation.mutateAsync({
        action: original ? 'update' : 'create',
        id: original?.id,
        body: parsed.data,
      })
      onSaved(result.quest, Boolean(original))
    } catch (error) {
      setFields(error.fields || {})
      setMessage(error.message)
      // A timed-out create may already have committed. Retry the same payload and request ID.
      if (!original && ['NETWORK_ERROR', 'INVALID_RESPONSE'].includes(error.code))
        setLockedDraft(parsed.data)
    }
  }
  async function reload() {
    setReloading(true)
    setMessage('')
    try {
      const result = await apiGet(`/api/v1/quests/${original.id}`)
      if (result.quest.status === 'COMPLETED') {
        setMessage('This quest has been completed. Close this draft to view the saved result.')
        return
      }
      setOriginal(result.quest)
      setValues(valuesFrom(result.quest))
      setFields({})
      mutation.reset()
    } catch (error) {
      setMessage(error.message)
    } finally {
      setReloading(false)
    }
  }
  return (
    <Dialog.Root open onOpenChange={(open) => !open && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="dialog-content quest-editor"
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            form.current?.elements.namedItem('title')?.focus()
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            document.querySelector('[data-quest-focus]')?.focus()
          }}
        >
          <button
            className="icon-button dialog-close"
            onClick={close}
            disabled={busy}
            aria-label="Close quest editor"
          >
            <X size={20} />
          </button>
          <span className="eyebrow">A LITTLE INTENTION GOES A LONG WAY</span>
          <Dialog.Title className="dialog-title">
            {discard
              ? 'Leave this draft behind?'
              : original
                ? 'A little change of plan.'
                : 'Give your day a quest.'}
          </Dialog.Title>
          <Dialog.Description className="dialog-description">
            {discard
              ? 'Your unsaved changes will be discarded.'
              : 'Choose something meaningful. Make the next step clear and small enough to begin.'}
          </Dialog.Description>
          {discard ? (
            <div className="editor-discard">
              <button
                className="button button-gold"
                ref={cancel}
                onClick={() => {
                  setDiscard(false)
                  requestAnimationFrame(() => form.current?.elements.namedItem('title')?.focus())
                }}
              >
                Keep editing
              </button>
              <button className="button button-outline" onClick={onClose}>
                Discard changes
              </button>
            </div>
          ) : (
            <form className="quest-form" ref={form} onSubmit={submit} noValidate aria-busy={busy}>
              <fieldset disabled={busy || Boolean(lockedDraft)} className="quest-form-fields">
                <div className="form-field">
                  <label htmlFor="quest-title">
                    Quest title <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="quest-title"
                    name="title"
                    value={values.title}
                    onChange={change}
                    maxLength={120}
                    required
                    placeholder="Read a chapter. Take a walk. Begin something."
                    aria-invalid={Boolean(fields.title)}
                    aria-describedby={fields.title ? 'quest-title-error' : undefined}
                  />
                  {fields.title && (
                    <p id="quest-title-error" className="field-error">
                      {fields.title}
                    </p>
                  )}
                </div>
                <div className="form-field">
                  <label htmlFor="quest-description">
                    A few notes <span>Optional</span>
                  </label>
                  <textarea
                    id="quest-description"
                    name="description"
                    value={values.description}
                    onChange={change}
                    maxLength={2000}
                    rows={3}
                    placeholder="What would a good small step look like?"
                    aria-invalid={Boolean(fields.description)}
                    aria-describedby="quest-description-help"
                  />
                  <p
                    id="quest-description-help"
                    className={fields.description ? 'field-error' : 'field-hint'}
                  >
                    {fields.description ||
                      `${values.description.length.toLocaleString()} / 2,000 characters`}
                  </p>
                </div>
                <fieldset className="quest-attribute-picker">
                  <legend>What would you like to grow?</legend>
                  <div>
                    {ATTRIBUTES.map(({ key, name }) => (
                      <label
                        key={key}
                        className={`${key.toLowerCase()} ${values.attribute === key ? 'chosen' : ''}`}
                      >
                        <input
                          type="radio"
                          name="attribute"
                          value={key}
                          checked={values.attribute === key}
                          onChange={change}
                        />
                        <AttributeIcon attribute={key} size={19} />
                        <span>{name}</span>
                      </label>
                    ))}
                  </div>
                  {fields.attribute && <p className="field-error">{fields.attribute}</p>}
                </fieldset>
                <div className="quest-form-grid">
                  <div className="form-field">
                    <label htmlFor="quest-difficulty">Difficulty</label>
                    <select
                      id="quest-difficulty"
                      name="difficulty"
                      value={values.difficulty}
                      onChange={change}
                    >
                      {QUEST_DIFFICULTIES.map(({ key, label }) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-field">
                    <label htmlFor="quest-minutes">
                      Time estimate <span>Optional</span>
                    </label>
                    <input
                      id="quest-minutes"
                      name="estimatedMinutes"
                      type="number"
                      min={1}
                      max={1440}
                      step={1}
                      value={values.estimatedMinutes}
                      onChange={change}
                      placeholder="Minutes"
                      aria-invalid={Boolean(fields.estimatedMinutes)}
                      aria-describedby={fields.estimatedMinutes ? 'quest-minutes-error' : undefined}
                    />
                    {fields.estimatedMinutes && (
                      <p className="field-error" id="quest-minutes-error">
                        {fields.estimatedMinutes}
                      </p>
                    )}
                  </div>
                  <div className="form-field quest-date-field">
                    <label htmlFor="quest-date">
                      Due date <span>Optional</span>
                    </label>
                    <input
                      id="quest-date"
                      name="dueDate"
                      type="date"
                      min="1900-01-01"
                      max="2100-12-31"
                      value={values.dueDate}
                      onChange={change}
                      aria-invalid={Boolean(fields.dueDate)}
                      aria-describedby="quest-date-help"
                    />
                    <p
                      id="quest-date-help"
                      className={fields.dueDate ? 'field-error' : 'field-hint'}
                    >
                      {fields.dueDate || 'A calendar date in your account’s timezone.'}
                    </p>
                  </div>
                </div>
              </fieldset>
              <div className="quest-form-rewards">
                <span>WHEN YOU COMPLETE THIS QUEST</span>
                <RewardPreview difficulty={values.difficulty} attribute={values.attribute} />
              </div>
              {message && (
                <p className="form-message" role="alert">
                  {message}
                </p>
              )}
              {conflict && (
                <button
                  className="button button-outline"
                  type="button"
                  disabled={busy}
                  onClick={reload}
                >
                  <RefreshCw size={16} />
                  Load latest quest (replace this draft)
                </button>
              )}
              {lockedDraft && (
                <p className="field-hint">
                  We could not confirm whether the save arrived. Retry this same draft to check
                  without adding a duplicate.
                </p>
              )}
              <div className="quest-form-footer">
                <span>Give your effort a place to grow.</span>
                <div>
                  <button
                    className="button button-outline"
                    type="button"
                    onClick={close}
                    disabled={busy}
                  >
                    Cancel
                  </button>
                  <button
                    className="button button-gold"
                    type="submit"
                    disabled={busy || conflict || missing}
                  >
                    {busy ? (
                      <>
                        <LoaderCircle className="spin" size={16} />
                        Saving…
                      </>
                    ) : (
                      <>
                        {lockedDraft ? 'Retry save' : original ? 'Save changes' : 'Add to journal'}
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
