import { Coins, Sparkles } from 'lucide-react'
import { QUEST_DIFFICULTIES, QUEST_REWARDS } from '@life-rpg/shared'
import './progression.css'

export default function RewardGuide({ level }) {
  return (
    <aside className="panel reward-guide" aria-label="How your progress grows">
      <span className="eyebrow">A LITTLE FURTHER, EVERY DAY</span>
      <h2>
        Room to <em>grow.</em>
      </h2>
      <p>Each new level asks a little more of you. Every small effort still counts.</p>
      <div className="next-level-note">
        <Sparkles size={20} />
        <div>
          <strong>
            Level {level} → {level + 1}
          </strong>
          <span>{(100 * level).toLocaleString()} XP across this level</span>
        </div>
      </div>
      <h3>A reward for showing up</h3>
      <ul>
        {QUEST_DIFFICULTIES.map((item) => (
          <li key={item.key}>
            <span className={`difficulty-dot ${item.key.toLowerCase()}`}>
              <i />
              {item.label}
            </span>
            <strong>{QUEST_REWARDS[item.key].xp} XP</strong>
            <span>
              <Coins size={12} />
              {QUEST_REWARDS[item.key].gold}
            </span>
          </li>
        ))}
      </ul>
      <p className="reward-guide-note">
        Your selected strength earns the same XP. Attribute levels need 50 × their current level;
        character levels need 100 × their current level.
      </p>
      <p className="reward-guide-note">
        Gold is saved for the marketplace. See your daily streak in Activity. Purchases arrive in a
        later chapter.
      </p>
    </aside>
  )
}
