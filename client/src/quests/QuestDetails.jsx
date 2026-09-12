import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import * as Dialog from '@radix-ui/react-dialog'
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
  Trash2,
  X,
} from 'lucide-react'
import { QUEST_DIFFICULTIES, formatQuestDate, formatCompletionDate } from '@life-rpg/shared'
import { useAuth } from '../auth/useAuth.js'
import { AttributeTag } from '../components/ui.jsx'
import { apiGet } from '../lib/api.js'
import RewardPreview from '../progression/RewardPreview.jsx'
import { useQuestMutation, useAccountError } from './hooks.js'

export default function QuestDetails({ id, onClose, onEdit, onChanged, onComplete }) {
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
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="dialog-content quest-detail"
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
              ? quest?.status === 'COMPLETED'
                ? 'Remove from your journal?'
                : 'Delete this quest?'
              : quest?.title || 'Your quest'}
          </Dialog.Title>
          <Dialog.Description className="dialog-description">
            {confirmDelete
              ? quest?.status === 'COMPLETED'
                ? 'The journal entry will be removed. Your completion history, XP, and gold will stay saved.'
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
                    <span className="quest-status-label">
                      {quest.status === 'COMPLETED'
                        ? 'Completed'
                        : quest.status === 'ARCHIVED'
                          ? 'Archived'
                          : 'Active quest'}
                    </span>
                  </div>
                  <p className={`quest-notes ${quest.description ? '' : 'quest-notes-empty'}`}>
                    {quest.description || 'No notes yet. A little intention is enough to begin.'}
                  </p>
                  <dl className="quest-detail-facts">
                    <div>
                      <dt>
                        <CalendarDays size={16} />
                        Due date
                      </dt>
                      <dd>{formatQuestDate(quest.dueDate)}</dd>
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
                  {quest.completion ? (
                    <div className="completion-stamp">
                      <span>
                        <CheckCheck size={18} />A promise, kept
                      </span>
                      <p>
                        {formatCompletionDate(
                          quest.completion.completedAt,
                          quest.completion.timezone,
                        )}{' '}
                        · {quest.completion.timezone.replaceAll('_', ' ')}
                      </p>
                      <p className="recorded-reward-line">
                        +{quest.completion.xpAwarded} XP · +{quest.completion.goldAwarded} gold · +
                        {quest.completion.attributeXpAwarded} attribute XP
                      </p>
                      <small>
                        Recorded once. Your earned progress stays in your completion history.
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
                      {quest.status === 'COMPLETED' ? 'Remove journal entry' : 'Delete permanently'}
                    </button>
                  </>
                ) : (
                  <>
                    {quest.status === 'ACTIVE' && (
                      <button
                        className="button button-gold"
                        disabled={mutation.isPending}
                        onClick={() => onComplete(quest)}
                      >
                        <Check size={16} />
                        Complete quest
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
                      {quest.status === 'COMPLETED' ? 'Remove from journal' : 'Delete'}
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
