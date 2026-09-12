import { useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Check,
  CheckCheck,
  Coins,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react'
import { ATTRIBUTES } from '@life-rpg/shared'
import { AttributeIcon, AttributeTag } from '../components/ui.jsx'
import { apiGet } from '../lib/api.js'
import { useQuestMutation } from '../quests/hooks.js'
import ProgressMeter from './ProgressMeter.jsx'
import RewardPreview from './RewardPreview.jsx'
import { useInteractionFeedback } from '../interactions/interaction-context.js'
import './progression.css'

export default function CompleteQuest({ quest, onClose, returnFocusRef, closeLabel = 'Back to journal' }) {
  const contentRef = useRef(null)
  const [current, setCurrent] = useState(quest)
  const [result, setResult] = useState(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const mutation = useQuestMutation()
  const { moving, notify } = useInteractionFeedback()
  const busy = loading || mutation.isPending
  const conflict = ['QUEST_CHANGED', 'QUEST_ARCHIVED'].includes(mutation.error?.code)
  const missing = mutation.error?.code === 'QUEST_NOT_FOUND'
  const receipt = result?.completion
  const daily = current.recurrence === 'DAILY'
  const levelUp = receipt && receipt.levelAfter > receipt.levelBefore
  const attribute = ATTRIBUTES.find(
    (item) => item.key === (receipt?.attribute || current.attribute),
  )
  async function submit() {
    if (busy || conflict || missing || current.status === 'ARCHIVED' || !current.eligibleToday) return
    setMessage('')
    try {
      const data = await mutation.mutateAsync({
        action: 'complete',
        id: current.id,
        body: { revision: current.revision },
      })
      setResult(data)
      if (data.newlyCompleted) {
        const earned = data.completion
        const earnedAttribute = ATTRIBUTES.find((item) => item.key === earned.attribute)
        const gainedLevel = earned.levelAfter > earned.levelBefore
        notify({
          key: `completion:${earned.id}`,
          tone: gainedLevel ? 'level' : 'quest',
          title: gainedLevel ? `Level ${earned.levelAfter} reached` : 'Quest complete',
          detail: `+${earned.xpAwarded} XP · +${earned.goldAwarded} gold · +${earned.attributeXpAwarded} ${earnedAttribute?.name || 'attribute'} XP`,
          sound: gainedLevel ? 'level' : 'quest',
          duration: gainedLevel ? 5200 : 4200,
        })
      }
      requestAnimationFrame(() => {
        if (contentRef.current) contentRef.current.scrollTop = 0
        contentRef.current?.querySelector('[data-completion-result]')?.focus()
      })
    } catch (error) {
      setMessage(error.message)
    }
  }
  async function reload() {
    setLoading(true)
    try {
      const data = await apiGet(`/api/v1/quests/${current.id}`)
      setCurrent(data.quest)
      mutation.reset()
      setMessage(
        data.quest.status === 'ARCHIVED'
          ? 'This quest is archived. Close this window and restore it from your journal first.'
          : data.quest.completedToday
            ? 'This daily quest is already recorded for its current scheduled day.'
            : '',
      )
    } catch (error) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }
  const close = () => {
    if (!busy) onClose()
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
            ref={contentRef}
            className={`dialog-content completion-dialog ${result ? 'completion-earned' : ''} ${levelUp ? 'completion-level-up' : ''}`}
            initial={moving ? { opacity: 0, marginTop: 14 } : false}
            animate={{ opacity: 1, marginTop: 0 }}
            transition={moving ? { type: 'spring', stiffness: 330, damping: 29, mass: 0.7 } : { duration: 0 }}
            onCloseAutoFocus={(event) => {
              const target = returnFocusRef?.current || document.querySelector('[data-quest-focus]')
              if (!target) return
              event.preventDefault()
              target.focus()
            }}
          >
            <button
            className="icon-button dialog-close"
            disabled={busy}
            onClick={close}
            aria-label="Close completion"
          >
            <X size={20} />
          </button>
          {result ? (
            <>
              <div className="completion-emblem" aria-hidden="true">
                {moving &&
                  result.newlyCompleted &&
                  Array.from({ length: 8 }, (_, i) => (
                    <motion.i
                      key={i}
                      initial={{ opacity: 0, x: 0, y: 0, scale: 0.5 }}
                      animate={{
                        opacity: [0, 1, 0],
                        x: Math.cos((i * Math.PI) / 4) * 100,
                        y: Math.sin((i * Math.PI) / 4) * 90,
                        scale: [0.5, 1, 0.5],
                      }}
                      transition={{ duration: 1.4, delay: i * 0.04, ease: 'easeOut' }}
                    />
                  ))}
                {moving && result.newlyCompleted && (
                  <motion.span
                    className="completion-float completion-float-xp"
                    initial={{ opacity: 0, y: 18, scale: 0.88 }}
                    animate={{ opacity: [0, 1, 1, 0], y: [18, -5, -20, -38], scale: [0.88, 1, 1, 0.96] }}
                    transition={{ duration: 1.55, ease: 'easeOut' }}
                  >
                    +{receipt.xpAwarded} XP
                  </motion.span>
                )}
                <motion.span
                  initial={moving ? { scale: 0.7, opacity: 0 } : false}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 180, damping: 16 }}
                >
                  {levelUp ? <Sparkles size={34} /> : <CheckCheck size={34} />}
                </motion.span>
              </div>
              <span className="eyebrow">
                {result.newlyCompleted
                  ? 'A PROMISE TO YOURSELF, KEPT'
                  : 'ALREADY PART OF YOUR STORY'}
              </span>
              <Dialog.Title data-completion-result tabIndex={-1} className="dialog-title">
                {!result.newlyCompleted
                  ? 'Your quest is recorded.'
                  : levelUp
                    ? `Hello, level ${receipt.levelAfter}.`
                    : 'One small step. Well done.'}
              </Dialog.Title>
              <Dialog.Description className="dialog-description">
                {result.newlyCompleted
                  ? daily
                    ? 'Today’s effort is saved. This quest returns on its next scheduled local day.'
                    : 'Your effort has a place in your story. These rewards are saved.'
                  : daily
                    ? 'This scheduled day was already recorded. No duplicate XP or gold was added.'
                    : 'This quest was completed earlier. Its rewards were credited once; no extra rewards were added.'}
              </Dialog.Description>
              <p className="completion-quest-title">{receipt.title}</p>
              <div className="earned-rewards" aria-label="Recorded rewards">
                {[
                  { icon: <Sparkles size={20} />, value: `+${receipt.xpAwarded}`, label: 'Experience' },
                  { icon: <Coins size={20} />, value: `+${receipt.goldAwarded}`, label: 'Gold earned' },
                  { icon: <AttributeIcon attribute={receipt.attribute} size={20} />, value: `+${receipt.attributeXpAwarded}`, label: `${attribute.name} XP` },
                ].map((reward, index) => (
                  <motion.div
                    key={reward.label}
                    initial={moving && result.newlyCompleted ? { opacity: 0, y: 10 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: moving ? 0.28 : 0, delay: moving ? 0.18 + index * 0.07 : 0 }}
                  >
                    {reward.icon}
                    <strong>{reward.value}</strong>
                    <span>{reward.label}</span>
                  </motion.div>
                ))}
              </div>
              {receipt.attributeLevelAfter > receipt.attributeLevelBefore && (
                <div className="attribute-unlocked">
                  <AttributeIcon attribute={receipt.attribute} size={17} />
                  <span>
                    {attribute.name} reached level {receipt.attributeLevelAfter}.
                  </span>
                </div>
              )}
              <ProgressMeter progress={result.character.progression} />
              <div className="completion-actions">
                <button className="button button-gold" onClick={close}>
                  {closeLabel}
                  <ArrowRight size={16} />
                </button>
                <Link className="text-link" to="/character">
                  View your growth
                </Link>
              </div>
            </>
          ) : (
            <>
              <span className="completion-check" aria-hidden="true">
                <Check size={25} />
              </span>
              <span className="eyebrow">MAKE THIS MOMENT COUNT</span>
              <Dialog.Title className="dialog-title">Ready to call it done?</Dialog.Title>
              <Dialog.Description className="dialog-description">
                {daily
                  ? 'Record today’s real-world effort. This daily quest can award rewards once for the current scheduled day.'
                  : 'Mark this quest complete once you’ve done the real-world task. Its details will become a lasting record.'}
              </Dialog.Description>
              <div className="completion-intention">
                <AttributeTag attribute={current.attribute} />
                <h2>{current.title}</h2>
                {current.description && <p>{current.description}</p>}
                <RewardPreview difficulty={current.difficulty} attribute={current.attribute} />
              </div>
              <p className="completion-note">
                {daily
                  ? `Rewards are credited once per scheduled day in ${current.scheduleTimezone?.replaceAll('_', ' ') || 'the quest schedule timezone'}. Changing account timezone later cannot reopen the same scheduled day.`
                  : 'Rewards are credited once. You can remove the journal entry later; the completion and earned progress will stay in your history.'}
              </p>
              {message && (
                <p className="form-message" role="alert">
                  {message}
                </p>
              )}
              {conflict && (
                <button className="button button-outline" disabled={busy} onClick={reload}>
                  <RefreshCw size={16} />
                  Load latest quest
                </button>
              )}
              {['NETWORK_ERROR', 'INVALID_RESPONSE'].includes(mutation.error?.code) && (
                <p className="field-hint">
                  The request may have arrived. Retry to recover its saved result without awarding
                  rewards twice.
                </p>
              )}
              <div className="completion-actions">
                <button className="button button-outline" disabled={busy} onClick={close}>
                  Not yet
                </button>
                <button
                  autoFocus
                  className="button button-gold"
                  disabled={
                    busy ||
                    conflict ||
                    missing ||
                    current.status === 'ARCHIVED' ||
                    !current.eligibleToday
                  }
                  onClick={submit}
                >
                  {busy ? (
                    <>
                      <LoaderCircle className="spin" size={16} />
                      Recording…
                    </>
                  ) : (
                    <>
                      <Check size={17} />
                      {mutation.isError
                        ? 'Retry completion'
                        : current.status === 'COMPLETED' || current.completedToday
                          ? 'Already recorded'
                          : daily
                            ? 'Record today'
                            : 'Mark complete'}
                    </>
                  )}
                </button>
              </div>
            </>
          )}
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
