import { CheckCheck, Coins, Compass, Map, Sparkles } from 'lucide-react'
import { ATTRIBUTES, characterProgress, levelProgress } from '@atlasborn/shared'
import Portrait from '../components/Portrait.jsx'
import { AttributeIcon } from '../components/ui.jsx'
import { useAuth } from '../auth/useAuth.js'
import { equippedItem } from '../economy/equipment.js'
import { useProgress } from '../progression/hooks.js'
import ProgressMeter from '../progression/ProgressMeter.jsx'
import ProgressNotice from '../progression/ProgressNotice.jsx'
import CompletionHistory from '../progression/CompletionHistory.jsx'
import RewardGuide from '../progression/RewardGuide.jsx'
import '../quests.css'
import '../progression/progression.css'

const ATTRIBUTE_REALMS = {
  INTELLECT: {
    realm: 'Arcane Archives',
    note: 'Knowledge lights the road ahead.',
  },
  STRENGTH: {
    realm: 'Iron Peaks',
    note: 'Resilience is forged one climb at a time.',
  },
  DISCIPLINE: {
    realm: 'Citadel of Resolve',
    note: 'Consistency turns intention into character.',
  },
  CREATIVITY: {
    realm: 'Emberwild',
    note: 'Every idea can become a new path.',
  },
  VITALITY: {
    realm: 'Verdant Reach',
    note: 'A long journey needs a steady flame.',
  },
}

export default function Character() {
  const { user } = useAuth()
  const progress = useProgress()
  const character = progress.data?.character || characterProgress(user.character)
  const equippedFrame = equippedItem(user, 'AVATAR_FRAME')
  const equippedTitle = equippedItem(user, 'CHARACTER_TITLE')
  const equippedBadge = equippedItem(user, 'PROFILE_BADGE')
  const equippedOutfit = equippedItem(user, 'OUTFIT')
  const equippedCompanion = equippedItem(user, 'COMPANION')
  const equippedAura = equippedItem(user, 'AURA')
  const completedCount = progress.data?.completedCount ?? 0

  return (
    <div className="page growth-character-page" key={user.id}>
      <header className="character-world-heading">
        <div className="character-world-heading-copy">
          <span className="eyebrow">BECOMING IS THE ADVENTURE</span>
          <h1>
            Meet <em>{user.displayName}.</em>
          </h1>
          <p>Every quest leaves a mark. Every strength reveals more of the adventurer you are becoming.</p>
        </div>
        <div className="character-chapter-mark" aria-label={`Character level ${character.progression.level}`}>
          <Compass size={16} />
          <span>
            CHARACTER CHRONICLE <i>·</i> LEVEL {character.progression.level}
          </span>
        </div>
      </header>

      <ProgressNotice query={progress} />

      <div className="character-layout character-world-grid">
        <section className="panel character-feature character-identity-panel">
          <div className="character-panel-kicker">
            <span className="eyebrow">YOUR ADVENTURER</span>
            <span>CHAPTER {String(character.progression.level).padStart(2, '0')}</span>
          </div>

          <div className="character-portrait-stage">
            <span className="portrait-orbit portrait-orbit-one" aria-hidden="true" />
            <span className="portrait-orbit portrait-orbit-two" aria-hidden="true" />
            <Portrait avatarKey={character.avatarKey} frameKey={equippedFrame?.assetKey} />
            <span className="character-level-seal">Lv {character.progression.level}</span>
          </div>

          <h2>{user.displayName}</h2>
          <span className="character-title">
            <Compass size={15} />
            {equippedTitle?.name || 'Seeker of small wonders'}
          </span>
          {equippedBadge && <span className="equipped-badge">✦ {equippedBadge.name}</span>}
          {(equippedOutfit || equippedCompanion || equippedAura) && (
            <div className="character-cosmetic-loadout" aria-label="Equipped visual rewards">
              {equippedOutfit && <span><small>OUTFIT</small>{equippedOutfit.name}</span>}
              {equippedCompanion && <span><small>COMPANION</small>{equippedCompanion.name}</span>}
              {equippedAura && <span><small>AURA</small>{equippedAura.name}</span>}
            </div>
          )}
          <p className="character-lore-copy">
            A curious soul crossing one small threshold at a time. The map changes because you do.
          </p>

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

          <div className="character-journey-progress">
            <div className="character-progress-title">
              <span>THE ROAD TO LEVEL {character.progression.level + 1}</span>
              <Sparkles size={14} />
            </div>
            <ProgressMeter progress={character.progression} />
          </div>

          <div className="character-completed-note">
            <CheckCheck size={17} />
            <span>
              {progress.isError
                ? 'History is temporarily unavailable'
                : progress.isPending
                  ? 'Reading your story…'
                  : `${completedCount} ${completedCount === 1 ? 'quest' : 'quests'} written into your chronicle`}
            </span>
          </div>
        </section>

        <section className="panel character-attributes character-realms-panel">
          <div className="section-heading character-realms-heading">
            <div>
              <span className="eyebrow">FIVE REALMS OF GROWTH</span>
              <h2>Your everyday strengths</h2>
              <p>Each kind of quest advances a different region of your character.</p>
            </div>
            <div className="character-atlas-emblem" aria-hidden="true">
              <Map size={21} />
            </div>
          </div>

          <div className="character-realms-grid">
            {ATTRIBUTES.map(({ key, name, description }) => {
              const attribute = character.attributes.find((item) => item.key === key) || {
                key,
                xp: 0,
                progression: levelProgress(0, 50),
              }
              const realm = ATTRIBUTE_REALMS[key] || { realm: name, note: description }
              return (
                <article className={`character-realm-card ${key.toLowerCase()}`} key={key}>
                  <div className="character-realm-topline">
                    <span className="quest-icon">
                      <AttributeIcon attribute={key} size={23} />
                    </span>
                    <div className="character-realm-title">
                      <span>{realm.realm}</span>
                      <h3>{name}</h3>
                    </div>
                    <span className="level-chip">Lv {attribute.progression.level}</span>
                  </div>
                  <p>{description}</p>
                  <small>{realm.note}</small>
                  <ProgressMeter compact progress={attribute.progression} label={`${name} experience`} />
                </article>
              )
            })}
          </div>

          <div className="character-realms-footer">
            <Sparkles size={15} />
            <span>Complete quests across different realms to build a balanced adventurer.</span>
          </div>
        </section>
      </div>

      <section className="character-chronicle-heading" aria-labelledby="character-chronicle-title">
        <div>
          <span className="eyebrow">THE ROAD BEHIND. THE ROAD AHEAD.</span>
          <h2 id="character-chronicle-title">Your growing chronicle</h2>
        </div>
        <div className="character-chronicle-totals" aria-label="Character journey summary">
          <span>
            <CheckCheck size={15} /> {completedCount} completed
          </span>
          <span>
            <Coins size={15} /> {character.gold.toLocaleString()} gold
          </span>
        </div>
      </section>

      <div className="progression-lower-grid character-progress-grid">
        <CompletionHistory />
        <RewardGuide level={character.progression.level} />
      </div>
    </div>
  )
}
