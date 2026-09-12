import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, CalendarCheck, Check, Coins, Plus, Repeat2, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { QUEST_REWARDS, QUEST_DIFFICULTIES, formatQuestDate } from '@life-rpg/shared'
import CompleteQuest from '../progression/CompleteQuest.jsx'
import { AttributeIcon } from '../components/ui.jsx'
import { useInteractionFeedback } from '../interactions/interaction-context.js'

export default function TodayQuests({ quests, today, summary }) {
  const { moving } = useInteractionFeedback()
  const [completion, setCompletion] = useState(null)
  const returnFocusRef = useRef(null)
  return (
    <section className="panel today-quests" aria-labelledby="today-quests-title">
      <div className="section-heading dashboard-section-heading">
        <div>
          <span className="eyebrow">WHAT DESERVES YOUR ATTENTION</span>
          <h2 id="today-quests-title">Today’s quests</h2>
        </div>
        <Link className="button button-gold dashboard-new-quest" to="/quests?new=1">
          <Plus size={15} /> New quest
        </Link>
      </div>
      <div className="today-quest-summary" aria-label="Quest summary">
        <span><strong>{summary.active}</strong> active</span>
        <span className={summary.dueToday ? 'attention' : ''}><strong>{summary.dueToday}</strong> due today</span>
        <span className={summary.overdue ? 'danger' : ''}><strong>{summary.overdue}</strong> overdue</span>
        <span><strong>{summary.dailyReady}</strong> daily ready</span>
      </div>
      {quests.length ? (
        <div className="today-quest-list">
          <AnimatePresence initial={false} mode="popLayout">
          {quests.map((quest) => {
            const reward = QUEST_REWARDS[quest.difficulty]
            const overdue = quest.recurrence === 'ONCE' && quest.dueDate && quest.dueDate < today
            const dueToday = quest.dueDate === today
            return (
              <motion.article
                layout={moving}
                className={`today-quest ${quest.attribute.toLowerCase()}`}
                key={quest.id}
                initial={moving ? { opacity: 0, y: 7 } : false}
                animate={{ opacity: 1, y: 0 }}
                exit={moving ? { opacity: 0, x: 16, scale: 0.985 } : { opacity: 0 }}
                transition={{ duration: moving ? 0.2 : 0 }}
              >
                <span className="today-quest-icon"><AttributeIcon attribute={quest.attribute} size={20} /></span>
                <div className="today-quest-copy">
                  <Link to={`/quests?quest=${quest.id}`}>{quest.title}</Link>
                  <div>
                    <span>{QUEST_DIFFICULTIES.find((item) => item.key === quest.difficulty)?.label}</span>
                    {quest.recurrence === 'DAILY' ? (
                      <span><Repeat2 size={11} /> Daily · ready now</span>
                    ) : quest.dueDate ? (
                      <span className={overdue ? 'overdue' : dueToday ? 'due-today' : ''}>
                        <CalendarCheck size={11} /> {overdue ? 'Overdue · ' : dueToday ? 'Today · ' : ''}{formatQuestDate(quest.dueDate)}
                      </span>
                    ) : (
                      <span>No due date</span>
                    )}
                    <span className="today-quest-reward"><Sparkles size={11} /> +{reward.xp} XP</span>
                    <span className="today-quest-reward"><Coins size={11} /> +{reward.gold}</span>
                  </div>
                </div>
                <button
                  className="today-complete-button"
                  onClick={(event) => {
                    returnFocusRef.current = event.currentTarget
                    setCompletion(quest)
                  }}
                  aria-label={`Complete ${quest.title}`}
                >
                  <Check size={16} />
                  <span>Complete</span>
                </button>
              </motion.article>
            )
          })}
          </AnimatePresence>
        </div>
      ) : (
        <div className="today-quests-empty">
          <CalendarCheck size={31} />
          <h3>Your path is clear.</h3>
          <p>{summary.active ? 'Nothing else is eligible right now. Future or completed daily quests remain safely in your journal.' : 'Create a small quest for something that matters today.'}</p>
          <Link className="text-link" to="/quests?new=1">Create a quest <ArrowRight size={14} /></Link>
        </div>
      )}
      <div className="today-quests-footer">
        <Link className="text-link" to="/quests">Open the full journal <ArrowRight size={14} /></Link>
      </div>
      {completion && (
        <CompleteQuest
          quest={completion}
          onClose={() => setCompletion(null)}
          returnFocusRef={returnFocusRef}
          closeLabel="Back to dashboard"
        />
      )}
    </section>
  )
}
