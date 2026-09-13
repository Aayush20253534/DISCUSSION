import { Coins, Sparkles } from 'lucide-react'
import { ATTRIBUTES, QUEST_REWARDS } from '@atlasborn/shared'
import './progression.css'

export default function RewardPreview({ difficulty, attribute, compact = false }) {
  const reward = QUEST_REWARDS[difficulty]
  const name = ATTRIBUTES.find((item) => item.key === attribute)?.name
  return (
    <div
      className={`reward-preview ${compact ? 'reward-preview-compact' : ''}`}
      aria-label="Rewards on completion"
    >
      <span>
        <Sparkles size={14} />
        {reward.xp} XP
      </span>
      <span>
        <Coins size={14} />
        {reward.gold} gold
      </span>
      {!compact && (
        <small>
          +{reward.attributeXp} {name} XP when completed
        </small>
      )}
    </div>
  )
}
