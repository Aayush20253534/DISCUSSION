import { useState } from 'react'
import { ArrowUpRight, Clock3, Coins, Sparkles } from 'lucide-react'
import { AttributeIcon, AttributeTag, Modal } from './ui.jsx'

export default function QuestList({ quests }) {
  const [selected, setSelected] = useState(null)
  return (
    <>
      <div className="quest-list">
        {quests.map((quest) => (
          <button
            key={quest.id}
            className="quest-row"
            onClick={() => setSelected(quest)}
            aria-label={`Preview quest: ${quest.title}`}
          >
            <span className={`quest-icon ${quest.attribute.toLowerCase()}`}>
              <AttributeIcon attribute={quest.attribute} size={21} />
            </span>
            <span className="quest-copy">
              <strong>{quest.title}</strong>
              <span className="quest-meta">
                <AttributeTag attribute={quest.attribute} />
                <span>
                  <Clock3 size={12} />
                  {quest.duration}
                </span>
                <span className="difficulty">{quest.difficulty}</span>
              </span>
            </span>
            <span className="quest-reward">
              +{quest.xp} <small>XP</small>
            </span>
            <ArrowUpRight className="quest-arrow" size={17} />
          </button>
        ))}
      </div>
      <Modal
        open={Boolean(selected)}
        onOpenChange={(value) => !value && setSelected(null)}
        title={selected?.title || 'Quest preview'}
        description={selected?.detail || ''}
      >
        {selected && (
          <>
            <div className="quest-detail-tags">
              <AttributeTag attribute={selected.attribute} />
              <span className="muted">
                {selected.difficulty} · {selected.duration}
              </span>
            </div>
            <div className="reward-preview">
              <div>
                <Sparkles size={20} />
                <strong>{selected.xp} XP</strong>
                <span>Experience</span>
              </div>
              <div>
                <Coins size={20} />
                <strong>{selected.gold} gold</strong>
                <span>Quest reward</span>
              </div>
            </div>
            <p className="modal-note">
              An example of a future quest. Exploring this preview does not complete a task or award
              progress.
            </p>
            <button className="button button-gold full-width" onClick={() => setSelected(null)}>
              Back to the adventure
            </button>
          </>
        )}
      </Modal>
    </>
  )
}
