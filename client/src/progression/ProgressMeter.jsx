import { motion, useReducedMotion } from 'motion/react'
import { useOutletContext } from 'react-router-dom'
import './progression.css'

export default function ProgressMeter({
  progress,
  label = 'Character experience',
  compact = false,
}) {
  const reduce = useReducedMotion()
  const { gentleMotion = true } = useOutletContext() || {}
  return (
    <div className={`growth-meter ${compact ? 'growth-meter-compact' : ''}`}>
      <div className="growth-meter-label">
        <span>Level {progress.level}</span>
        <span>
          <strong>{progress.xpIntoLevel.toLocaleString()}</strong> /{' '}
          {progress.xpForNextLevel.toLocaleString()} XP
        </span>
      </div>
      <div
        className="growth-meter-track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={progress.xpForNextLevel}
        aria-valuenow={progress.xpIntoLevel}
        aria-valuetext={`Level ${progress.level}, ${progress.xpRemaining} XP to level ${progress.level + 1}`}
      >
        <motion.span
          initial={false}
          animate={{ width: `${progress.percent}%` }}
          transition={{ duration: reduce || !gentleMotion ? 0 : 0.65, ease: 'easeOut' }}
        />
      </div>
      {!compact && (
        <p>
          {progress.xpRemaining.toLocaleString()} XP to your next chapter · Level{' '}
          {progress.level + 1}
        </p>
      )}
    </div>
  )
}
