import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import * as Dialog from '@radix-ui/react-dialog'
import { motion } from 'motion/react'
import {
  Archive,
  Check,
  CheckCheck,
  CalendarDays,
  Clock3,
  LoaderCircle,
  Pencil,
  RefreshCw,
  RotateCcw,
  Repeat2,
  Trash2,
  X,
} from 'lucide-react'
import { QUEST_DIFFICULTIES, formatQuestDate, formatCompletionDate } from '@life-rpg/shared'
import { useAuth } from '../auth/useAuth.js'
import { AttributeTag } from '../components/ui.jsx'
import { useInteractionFeedback } from '../interactions/interaction-context.js'
import { apiGet } from '../lib/api.js'
import RewardPreview from '../progression/RewardPreview.jsx'
import { useQuestMutation, useAccountError } from './hooks.js'

export default function QuestDetails({ id, onClose, onEdit, onChanged, onComplete }) {
  const { moving } = useInteractionFeedback()
  const { user } = useAuth()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')
  const query = useQuery({
    queryKey: ['quests', user.id, 'detail', id],
    queryFn: ({ signal }) => apiGet(`/api/v1/quests/${id}`, signal),
    retry: false,
    staleTime: 0,
  })
  useAccountError(query.error)
  const mutation = useQuestMutation()
  const quest = query.data?.quest
  const recorded = quest?.completion || quest?.lastCompletion
  const hasHistory = Boolean(quest?.lastCompletion)
  async function act(action) {
    if (!quest || mutation.isPending) return
    setError('')
    try {
      await mutation.mutateAsync({
        action: action === 'delete' ? 'delete' : 'update',
        id,
        body: {
          revision: quest.revision,
          ...(action !== 'delete' && {
            status: quest.status === 'ARCHIVED' ? 'ACTIVE' : 'ARCHIVED',
          }),
        },
      })
      onChanged(
        action === 'delete'
          ? 'Quest deleted.'
          : quest.status === 'ARCHIVED'
            ? 'Quest restored to your journal.'
            : 'Quest archived.',
      )
    } catch (err) {
      setError(err.message)
    }
  }
  const close = () => {
    if (!mutation.isPending) onClose()
  }
  return (
    <Dialog.Root open onOpenChange={(open) => !open && close()}>
      <Dialog.Portal>
        <Dialog.Overlay asChild>
          <motion.div
            className="dialog-overlay"
            initial={moving ? { opacity: 0 } : false}
            animate={{ opacity: 1 }}
            transition={{ duration: moving ? 0.16 : 0 }}
          />
        </Dialog.Overlay>
        <Dialog.Content asChild>
          <motion.div
            className="dialog-content quest-detail"
            initial={moving ? { opacity: 0, marginTop: 14 } : false}
            animate={{ opacity: 1, marginTop: 0 }}
            transition={moving ? { type: 'spring', stiffness: 330, damping: 29, mass: 0.7 } : { duration: 0 }}
            onCloseAutoFocus={(event) => {
              event.preventDefault()
              document.querySelector('[data-quest-focus]')?.focus()
            }}
          >
            <button
            className="icon-button dialog-close"
            onClick={close}
            disabled={mutation.isPending}
            aria-label="Close quest details"
          >
            <X size={20} />
          </button>
          <span className="eyebrow">A PAGE FROM YOUR JOURNAL</span>
          <Dialog.Title className="dialog-title">
            {confirmDelete
              ? hasHistory
                ? 'Remove from your journal?'
                : 'Delete this quest?'
              : quest?.title || 'Your quest'}
          </Dialog.Title>
          <Dialog.Description className="dialog-description">
            {confirmDelete
              ? hasHistory
                ? 'The journal entry will be removed. Every saved completion, XP reward, and gold reward will stay in your history.'
                : 'This permanently removes the quest. You can archive it instead if you may want it later.'
              : 'A small intention, ready for your next step.'}
          </Dialog.Description>
          {query.isPending ? (
            <p className="journal-loading" role="status">
              <LoaderCircle size={20} className="spin" />
              Loading quest…
            </p>
          ) : query.isError ? (
            <div className="journal-error">
              <p role="alert">{query.error.message}</p>
              <button className="button button-outline" onClick={() => query.refetch()}>
                Try again
              </button>
            </div>
          ) : (
            <>
              {confirmDelete ? (
                <p className="delete-quest-name">{quest.title}</p>
              ) : (
                <>
                  <div className="quest-detail-tags">
                    <AttributeTag attribute={quest.attribute} />
                    <span className={`difficulty-dot ${quest.difficulty.toLowerCase()}`}>
                      <i />
                      {QUEST_DIFFICULTIES.find((item) => item.key === quest.difficulty)?.label}
                    </span>
                    {quest.recurrence === 'DAILY' && (
                      <span className="recurrence-label">
                        <Repeat2 size={13} />
                        Daily
                      </span>
                    )}
                    <span className="quest-status-label">
                      {quest.status === 'COMPLETED'
                        ? 'Completed'
                        : quest.status === 'ARCHIVED'
                          ? 'Archived'
                          : quest.recurrence === 'DAILY'
                            ? quest.completedToday
                              ? 'Done for today'
                              : 'Ready today'
                            : 'Active'}
                    </span>
                  </div>
                  <p className={`quest-notes ${quest.description ? '' : 'quest-notes-empty'}`}>
                    {quest.description || 'No notes yet. A little intention is enough to begin.'}
                  </p>
                  <dl className="quest-detail-facts">
                    <div>
                      <dt>
                        <CalendarDays size={16} />
                        {quest.recurrence === 'DAILY' ? 'Schedule' : 'Due date'}
                      </dt>
                      <dd>
                        {quest.recurrence === 'DAILY'
                          ? `Daily from ${formatQuestDate(quest.scheduleStartDate)}`
                          : formatQuestDate(quest.dueDate)}
                      </dd>
                    </div>
                    <div>
                      <dt>
                        <Clock3 size={16} />
                        Time estimate
                      </dt>
                      <dd>
                        {quest.estimatedMinutes
                          ? `${quest.estimatedMinutes} minutes`
                          : 'At your own pace'}
                      </dd>
                    </div>
                  </dl>
                  {quest.recurrence === 'DAILY' && quest.scheduleTimezone && (
                    <p className="quest-schedule-note">
                      <Repeat2 size={14} />
                      One reward per scheduled day in {quest.scheduleTimezone.replaceAll('_', ' ')}.
                      This anchor does not move if the account timezone changes later.
                    </p>
                  )}
                  {recorded ? (
                    <div className="completion-stamp">
                      <span>
                        <CheckCheck size={18} />A promise, kept
                      </span>
                      <p>
                        {formatCompletionDate(
                          recorded.completedAt,
                          recorded.timezone,
                        )}{' '}
                        · {recorded.timezone.replaceAll('_', ' ')}
                      </p>
                      <p className="recorded-reward-line">
                        +{recorded.xpAwarded} XP · +{recorded.goldAwarded} gold · +
                        {recorded.attributeXpAwarded} attribute XP
                      </p>
                      <small>
                        {quest.recurrence === 'DAILY'
                          ? quest.completedToday
                            ? 'Today’s scheduled completion is saved. This quest returns on the next scheduled day.'
                            : 'Your latest completion is preserved. This quest is ready again for today.'
                          : 'Recorded once. Your earned progress stays in your completion history.'}
                      </small>
                    </div>
                  ) : (
                    <div className="quest-detail-boundary">
                      <RewardPreview difficulty={quest.difficulty} attribute={quest.attribute} />
                    </div>
                  )}
                </>
              )}
              {error && (
                <p className="form-message" role="alert">
                  {error}
                </p>
              )}
              {mutation.error?.code === 'QUEST_CHANGED' && (
                <button
                  className="button button-outline"
                  disabled={query.isFetching}
                  onClick={async () => {
                    await query.refetch()
                    mutation.reset()
                    setError('')
                    setConfirmDelete(false)
                  }}
                >
                  <RefreshCw size={16} />
                  Load latest quest
                </button>
              )}
              <div className="quest-detail-actions">
                {confirmDelete ? (
                  <>
                    <button
                      autoFocus
                      className="button button-outline"
                      disabled={mutation.isPending}
                      onClick={() => setConfirmDelete(false)}
                    >
                      Keep quest
                    </button>
                    <button
                      className="button button-danger"
                      disabled={mutation.isPending || mutation.error?.code === 'QUEST_CHANGED'}
                      onClick={() => act('delete')}
                    >
                      {mutation.isPending ? (
                        <LoaderCircle className="spin" size={16} />
                      ) : (
                        <Trash2 size={16} />
                      )}
                      {hasHistory ? 'Remove journal entry' : 'Delete permanently'}
                    </button>
                  </>
                ) : (
                  <>
                    {quest.status === 'ACTIVE' && (
                      <button
                        className="button button-gold"
                        disabled={mutation.isPending || !quest.eligibleToday}
                        onClick={() => onComplete(quest)}
                      >
                        {quest.completedToday ? <CheckCheck size={16} /> : <Check size={16} />}
                        {quest.completedToday ? 'Done for today' : 'Complete quest'}
                      </button>
                    )}
                    {quest.status !== 'COMPLETED' && (
                      <>
                        <button
                          className="button button-outline"
                          disabled={mutation.isPending}
                          onClick={() => onEdit(quest)}
                        >
                          <Pencil size={15} />
                          Edit quest
                        </button>
                        <button
                          className="button button-outline"
                          disabled={mutation.isPending}
                          onClick={() => act('archive')}
                        >
                          {quest.status === 'ARCHIVED' ? (
                            <RotateCcw size={15} />
                          ) : (
                            <Archive size={15} />
                          )}
                          {quest.status === 'ARCHIVED' ? 'Restore' : 'Archive'}
                        </button>
                      </>
                    )}
                    <button
                      className="quest-delete-link"
                      disabled={mutation.isPending}
                      onClick={() => {
                        setConfirmDelete(true)
                        setError('')
                        mutation.reset()
                      }}
                    >
                      <Trash2 size={15} />
                      {hasHistory ? 'Remove from journal' : 'Delete'}
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
