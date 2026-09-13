import { useCallback, useRef, useState } from 'react'
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
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import { ATTRIBUTES } from '@atlasborn/shared'
import { AttributeIcon, AttributeTag } from '../components/ui.jsx'
import { apiGet } from '../lib/api.js'
import { useQuestMutation } from '../quests/hooks.js'
import ProgressMeter from './ProgressMeter.jsx'
import RewardPreview from './RewardPreview.jsx'
import QuestVerification from './QuestVerification.jsx'
import { useInteractionFeedback } from '../interactions/interaction-context.js'
import './progression.css'

export default function CompleteQuest({ quest, onClose, returnFocusRef, closeLabel = 'Back to journal' }) {
  const contentRef = useRef(null)
  const [current, setCurrent] = useState(quest)
  const [result, setResult] = useState(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [verificationToken, setVerificationToken] = useState(null)
  const [verificationResult, setVerificationResult] = useState(null)
  const [verificationSession, setVerificationSession] = useState(0)
  const mutation = useQuestMutation()
  const { moving, notify } = useInteractionFeedback()
  const busy = loading || mutation.isPending
  const conflict = ['QUEST_CHANGED', 'QUEST_ARCHIVED'].includes(mutation.error?.code)
  const missing = mutation.error?.code === 'QUEST_NOT_FOUND'
  const receipt = result?.completion
  const daily = current.recurrence === 'DAILY'
  const levelUp = receipt && receipt.levelAfter > receipt.levelBefore
  const verificationPassed = Boolean(
    verificationToken && verificationResult?.verdict === 'VERIFIED',
  )
  const attribute = ATTRIBUTES.find(
    (item) => item.key === (receipt?.attribute || current.attribute),
  )
  const handleVerification = useCallback((token, verification) => {
    setVerificationToken(token)
    setVerificationResult(verification)
  }, [])
  async function submit() {
    if (busy || conflict || missing || current.status === 'ARCHIVED' || !current.eligibleToday) return
    if (!verificationPassed) {
      setMessage('Verified evidence is required before this quest can be recorded.')
      contentRef.current
        ?.querySelector('.quest-verification')
        ?.scrollIntoView({ block: 'center', behavior: moving ? 'smooth' : 'auto' })
      return
    }
    setMessage('')
    try {
      const data = await mutation.mutateAsync({
        action: 'complete',
        id: current.id,
        body: {
          revision: current.revision,
          ...(verificationToken && { verificationToken }),
        },
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
      if (['QUEST_VERIFICATION_EXPIRED', 'QUEST_VERIFICATION_MISMATCH'].includes(error.code)) {
        setVerificationToken(null)
        setVerificationResult(null)
        setVerificationSession((value) => value + 1)
      }
      setMessage(error.message)
    }
  }
  async function reload() {
    setLoading(true)
    try {
      const data = await apiGet(`/api/v1/quests/${current.id}`)
      setCurrent(data.quest)
      setVerificationToken(null)
      setVerificationResult(null)
      setVerificationSession((value) => value + 1)
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
              {receipt.aiVerified && (
                <div className="completion-ai-verified">
                  <ShieldCheck size={16} />
                  Evidence verified by AI
                </div>
              )}
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
              <div className="completion-proof-heading">
                <span className="completion-check" aria-hidden="true">
                  <ShieldCheck size={25} />
                </span>
                <div>
                  <span className="eyebrow">PROOF BEFORE PROGRESS</span>
                  <Dialog.Title className="dialog-title">Verify the effort. Then claim the reward.</Dialog.Title>
                  <Dialog.Description className="dialog-description">
                    Add visual evidence of the real-world task and pass the AI check. Completion is
                    locked until the evidence is verified.
                  </Dialog.Description>
                </div>
              </div>

              <div className="completion-proof-steps" aria-label="Quest completion steps">
                <span className="done"><Check size={14} /> Quest chosen</span>
                <span className={verificationPassed ? 'done' : 'current'}>
                  <ShieldCheck size={14} /> Evidence verified
                </span>
                <span className={verificationPassed ? 'current' : ''}>
                  <Sparkles size={14} /> Record rewards
                </span>
              </div>

              <div className="completion-proof-layout">
                <div className="completion-proof-summary">
                  <span className="completion-section-label">QUEST TO PROVE</span>
                  <div className="completion-intention">
                    <AttributeTag attribute={current.attribute} />
                    <h2>{current.title}</h2>
                    {current.description && <p>{current.description}</p>}
                    <RewardPreview difficulty={current.difficulty} attribute={current.attribute} />
                  </div>
                  <p className="completion-note">
                    {daily
                      ? `Verified rewards are credited once per scheduled day in ${current.scheduleTimezone?.replaceAll('_', ' ') || 'the quest schedule timezone'}.`
                      : 'Verified rewards are credited once. Your completion remains in history even if the journal entry is later removed.'}
                  </p>
                </div>

                <div className={`completion-proof-verification ${verificationPassed ? 'verified' : ''}`}>
                  <div className="completion-verification-gate">
                    <div>
                      <span className="completion-section-label">REQUIRED EVIDENCE</span>
                      <strong>{verificationPassed ? 'Proof accepted' : 'Verification required'}</strong>
                    </div>
                    <span className={`completion-gate-badge ${verificationPassed ? 'verified' : ''}`}>
                      <ShieldCheck size={14} />
                      {verificationPassed ? 'VERIFIED' : 'LOCKED'}
                    </span>
                  </div>
                  <QuestVerification
                    key={`${current.id}:${current.revision}:${verificationSession}`}
                    quest={current}
                    required
                    disabled={
                      busy ||
                      conflict ||
                      missing ||
                      current.status === 'ARCHIVED' ||
                      !current.eligibleToday
                    }
                    onVerified={handleVerification}
                  />
                </div>
              </div>
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
                    !current.eligibleToday ||
                    !verificationPassed
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
                          : verificationPassed
                            ? daily
                              ? 'Record verified day'
                              : 'Record verified quest'
                            : 'Verify evidence to continue'}
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
