import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Award, CheckCircle2, Coins, Sparkles, WandSparkles } from 'lucide-react'
import { InteractionContext } from './interaction-context.js'
import './interactions.css'
const MAX_REMEMBERED_EVENTS = 120

const toneIcons = {
  quest: CheckCircle2,
  level: Award,
  purchase: Coins,
  equip: WandSparkles,
  success: Sparkles,
}

function createAudioContext() {
  const AudioContext = window.AudioContext || window.webkitAudioContext
  return AudioContext ? new AudioContext() : null
}

async function playFeedbackSound(kind) {
  if (typeof window === 'undefined') return
  const context = createAudioContext()
  if (!context) return
  try {
    if (context.state === 'suspended') await context.resume()
    const now = context.currentTime
    const notes =
      kind === 'level'
        ? [523.25, 659.25, 783.99]
        : kind === 'purchase'
          ? [392, 523.25]
          : kind === 'equip'
            ? [440, 587.33]
            : [440, 554.37]
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0, now + index * 0.075)
      gain.gain.linearRampToValueAtTime(0.035, now + index * 0.075 + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.075 + 0.19)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(now + index * 0.075)
      oscillator.stop(now + index * 0.075 + 0.21)
    })
    window.setTimeout(() => void context.close(), 700)
  } catch {
    void context.close().catch(() => {})
  }
}

export default function InteractionProvider({ gentleMotion, soundEnabled, children }) {
  const reducedMotion = useReducedMotion()
  const moving = Boolean(gentleMotion && !reducedMotion)
  const [notices, setNotices] = useState([])
  const [announcement, setAnnouncement] = useState({ id: 0, text: '' })
  const seen = useRef(new Set())
  const timers = useRef(new Map())

  useEffect(
    () => () => {
      for (const timer of timers.current.values()) window.clearTimeout(timer)
      timers.current.clear()
    },
    [],
  )

  const announce = useCallback((text) => {
    if (!text) return
    setAnnouncement((current) => ({ id: current.id + 1, text }))
  }, [])

  const notify = useCallback(
    ({ key, tone = 'success', title, detail = '', sound = tone, duration = 4200 }) => {
      if (!title) return false
      if (key && seen.current.has(key)) return false
      if (key) {
        seen.current.add(key)
        if (seen.current.size > MAX_REMEMBERED_EVENTS) {
          const oldest = seen.current.values().next().value
          seen.current.delete(oldest)
        }
      }
      const id = key || `${Date.now()}-${Math.random().toString(36).slice(2)}`
      setNotices((current) => [...current.filter((notice) => notice.id !== id).slice(-2), { id, tone, title, detail }])
      announce(detail ? `${title}. ${detail}` : title)
      if (soundEnabled) void playFeedbackSound(sound)
      const existing = timers.current.get(id)
      if (existing) window.clearTimeout(existing)
      const timer = window.setTimeout(() => {
        setNotices((current) => current.filter((notice) => notice.id !== id))
        timers.current.delete(id)
      }, duration)
      timers.current.set(id, timer)
      return true
    },
    [announce, soundEnabled],
  )

  const value = useMemo(() => ({ moving, announce, notify }), [announce, moving, notify])

  return (
    <InteractionContext.Provider value={value}>
      {children}
      <div className="interaction-announcer sr-only" aria-live="polite" aria-atomic="true">
        <span key={announcement.id}>{announcement.text}</span>
      </div>
      <div className="interaction-toasts" aria-hidden="true">
        <AnimatePresence initial={false}>
          {notices.map((notice) => {
            const Icon = toneIcons[notice.tone] || Sparkles
            return (
              <motion.div
                className={`interaction-toast interaction-toast-${notice.tone}`}
                key={notice.id}
                initial={moving ? { opacity: 0, y: 18, scale: 0.96 } : { opacity: 0 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={moving ? { opacity: 0, y: 8, scale: 0.98 } : { opacity: 0 }}
                transition={{ duration: moving ? 0.24 : 0 }}
              >
                <span className="interaction-toast-icon">
                  <Icon size={18} />
                </span>
                <span>
                  <strong>{notice.title}</strong>
                  {notice.detail && <small>{notice.detail}</small>}
                </span>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </InteractionContext.Provider>
  )
}
