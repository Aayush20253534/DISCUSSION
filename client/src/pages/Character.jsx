import { CheckCheck, Compass, Sparkles } from 'lucide-react'
import { ATTRIBUTES, characterProgress } from '@life-rpg/shared'
import Portrait from '../components/Portrait.jsx'
import { AttributeIcon, PageHeading } from '../components/ui.jsx'
import { useAuth } from '../auth/useAuth.js'
import { equippedItem } from '../economy/equipment.js'
import { useProgress } from '../progression/hooks.js'
import ProgressMeter from '../progression/ProgressMeter.jsx'
import ProgressNotice from '../progression/ProgressNotice.jsx'
import CompletionHistory from '../progression/CompletionHistory.jsx'
import RewardGuide from '../progression/RewardGuide.jsx'
import '../quests.css'
import '../progression/progression.css'

export default function Character() {
  const { user } = useAuth()
  const progress = useProgress()
  const character = progress.data?.character || characterProgress(user.character)
  const equippedFrame = equippedItem(user, 'AVATAR_FRAME')
  const equippedTitle = equippedItem(user, 'CHARACTER_TITLE')
  const equippedBadge = equippedItem(user, 'PROFILE_BADGE')
  return (
    <div className="page growth-character-page" key={user.id}>
      <PageHeading
        eyebrow="BECOMING IS THE ADVENTURE"
        title={
          <>
            Meet <em>{user.displayName}.</em>
          </>
        }
        description="Every part of your life adds something to your story."
      />
      <ProgressNotice query={progress} />
      <div className="character-layout">
        <section className="panel character-feature">
          <div className="eyebrow">YOUR CHARACTER</div>
          <Portrait avatarKey={character.avatarKey} frameKey={equippedFrame?.assetKey} />
          <h2>{user.displayName}</h2>
          <span className="character-title">
            <Compass size={15} />
            {equippedTitle?.name || 'Seeker of small wonders'}
          </span>
          {equippedBadge && <span className="equipped-badge">✦ {equippedBadge.name}</span>}
          <p>A curious soul, a well-worn notebook, and a whole world of possibilities.</p>
          <div className="character-feature-stats" aria-label="Saved character totals">
            <div>
              <strong>{character.progression.level}</strong>
              <span>LEVEL</span>
            </div>
            <div>
              <strong>{character.totalXp.toLocaleString()}</strong>
              <span>TOTAL XP</span>
            </div>
            <div>
              <strong>{character.gold.toLocaleString()}</strong>
              <span>GOLD</span>
            </div>
          </div>
          <ProgressMeter progress={character.progression} />
          <div className="character-completed-note">
            <CheckCheck size={17} />
            <span>
              {progress.isError
                ? 'History is temporarily unavailable'
                : progress.isPending
                  ? 'Reading your story…'
                  : `${progress.data.completedCount} ${progress.data.completedCount === 1 ? 'quest' : 'quests'} completed`}
            </span>
          </div>
        </section>
        <section className="panel character-attributes">
          <div className="section-heading">
            <div>
              <span className="eyebrow">FIVE WAYS TO FLOURISH</span>
              <h2>Your everyday strengths</h2>
            </div>
            <Sparkles size={21} className="gold" />
          </div>
          {ATTRIBUTES.map(({ key, name, description }) => {
            const attribute = character.attributes.find((item) => item.key === key)
            return (
              <div className={`strength-detail ${key.toLowerCase()}`} key={key}>
                <span className="quest-icon">
                  <AttributeIcon attribute={key} size={24} />
                </span>
                <div>
                  <h3>{name}</h3>
                  <p>{description}</p>
                </div>
                <span className="level-chip">{attribute.xp.toLocaleString()} total XP</span>
                <ProgressMeter
                  compact
                  progress={attribute.progression}
                  label={`${name} experience`}
                />
              </div>
            )
          })}
        </section>
      </div>
      <div className="progression-lower-grid">
        <CompletionHistory />
        <RewardGuide level={character.progression.level} />
      </div>
    </div>
  )
}
