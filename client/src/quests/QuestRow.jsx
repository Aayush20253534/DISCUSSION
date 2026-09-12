import {
  Check,
  CheckCheck,
  Coins,
  Archive,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  Pencil,
  RotateCcw,
} from 'lucide-react'
import { QUEST_DIFFICULTIES, formatQuestDate } from '@life-rpg/shared'
import { AttributeIcon, AttributeTag } from '../components/ui.jsx'

export default function QuestRow({
  quest,
  today,
  onOpen,
  onEdit,
  onArchive,
  onComplete,
  busy = false,
  compact = false,
}) {
  const overdue = quest.status === 'ACTIVE' && quest.dueDate && quest.dueDate < today
  const dueToday = quest.dueDate === today
  return (
    <article
      className={`saved-quest ${quest.attribute.toLowerCase()} ${compact ? 'saved-quest-compact' : ''} ${quest.status === 'COMPLETED' ? 'saved-quest-completed' : ''}`}
    >
      <span className="saved-quest-icon">
        <AttributeIcon attribute={quest.attribute} size={22} />
      </span>
      <div className="saved-quest-copy">
        <button className="saved-quest-title" onClick={() => onOpen(quest)}>
          {quest.title}
        </button>
        {quest.description && !compact && (
          <p className="saved-quest-description">{quest.description}</p>
        )}
        <div className="saved-quest-meta">
          <AttributeTag attribute={quest.attribute} />
          <span className={`difficulty-dot ${quest.difficulty.toLowerCase()}`}>
            <i />
            {QUEST_DIFFICULTIES.find((item) => item.key === quest.difficulty)?.label}
          </span>
          {quest.estimatedMinutes && (
            <span>
              <Clock3 size={13} />
              {quest.estimatedMinutes} min
            </span>
          )}
          {quest.dueDate && quest.status !== 'COMPLETED' && (
            <span className={overdue ? 'due-overdue' : dueToday ? 'due-today' : ''}>
              <CalendarDays size={13} />
              {overdue ? 'Overdue · ' : dueToday ? 'Today · ' : ''}
              {formatQuestDate(quest.dueDate)}
            </span>
          )}
          {quest.status === 'COMPLETED' && quest.completion && (
            <>
              <span className="completed-label">
                <CheckCheck size={13} />
                Completed · {formatQuestDate(quest.completion.completedDate)}
              </span>
              <span>+{quest.completion.xpAwarded} XP</span>
              <span>
                <Coins size={13} />+{quest.completion.goldAwarded} gold
              </span>
            </>
          )}
          {quest.status === 'ARCHIVED' && (
            <span>
              <Archive size={13} />
              Archived
            </span>
          )}
        </div>
      </div>
      {!compact && quest.status !== 'COMPLETED' && (
        <div className="saved-quest-actions">
          {quest.status === 'ACTIVE' && (
            <button
              className="icon-button quest-complete-button"
              aria-label={`Complete ${quest.title}`}
              title="Complete quest"
              disabled={busy}
              onClick={() => onComplete(quest)}
            >
              <Check size={17} />
            </button>
          )}
          <button
            className="icon-button"
            aria-label={`Edit ${quest.title}`}
            title="Edit quest"
            disabled={busy}
            onClick={() => onEdit(quest)}
          >
            <Pencil size={16} />
          </button>
          <button
            className="icon-button"
            aria-label={`${quest.status === 'ARCHIVED' ? 'Restore' : 'Archive'} ${quest.title}`}
            title={quest.status === 'ARCHIVED' ? 'Restore quest' : 'Archive quest'}
            disabled={busy}
            onClick={() => onArchive(quest)}
          >
            {quest.status === 'ARCHIVED' ? <RotateCcw size={16} /> : <Archive size={16} />}
          </button>
        </div>
      )}
      {compact && <ArrowUpRight className="saved-quest-arrow" size={17} aria-hidden="true" />}
    </article>
  )
}
