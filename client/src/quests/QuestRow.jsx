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
  Repeat2,
  ShieldCheck,
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
  const daily = quest.recurrence === 'DAILY'
  return (
    <article
      className={`saved-quest ${quest.attribute.toLowerCase()} ${compact ? 'saved-quest-compact' : ''} ${quest.status === 'COMPLETED' || quest.completedToday ? 'saved-quest-completed' : ''} ${daily ? 'saved-quest-daily' : ''}`}
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
          {daily && (
            <span className="recurrence-label">
              <Repeat2 size={13} />
              Daily
            </span>
          )}
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
          {daily && quest.completedToday && quest.completion && (
            <>
              <span className="completed-label">
                <CheckCheck size={13} />
                Done today
              </span>
              {quest.completion.aiVerified && (
                <span className="quest-ai-verified">
                  <ShieldCheck size={13} /> Gemini verified
                </span>
              )}
              <span>+{quest.completion.xpAwarded} XP</span>
              <span>
                <Coins size={13} />+{quest.completion.goldAwarded} gold
              </span>
            </>
          )}
          {daily && !quest.completedToday && quest.status === 'ACTIVE' && (
            <span className="daily-ready-label">Ready today</span>
          )}
          {quest.status === 'COMPLETED' && quest.completion && (
            <>
              <span className="completed-label">
                <CheckCheck size={13} />
                Completed · {formatQuestDate(quest.completion.completedDate)}
              </span>
              {quest.completion.aiVerified && (
                <span className="quest-ai-verified">
                  <ShieldCheck size={13} /> Gemini verified
                </span>
              )}
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
              className={`icon-button quest-complete-button ${quest.completedToday ? 'quest-complete-button-done' : ''}`}
              aria-label={
                quest.completedToday
                  ? `${quest.title} is complete for today`
                  : `Complete ${quest.title}`
              }
              title={quest.completedToday ? 'Available again on the next scheduled day' : 'Complete quest'}
              disabled={busy || !quest.eligibleToday}
              onClick={() => onComplete(quest)}
            >
              {quest.completedToday ? <CheckCheck size={17} /> : <Check size={17} />}
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
