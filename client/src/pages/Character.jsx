import { Compass, Sparkles } from 'lucide-react'
import { ATTRIBUTES } from '@life-rpg/shared'
import Portrait from '../components/Portrait.jsx'
import { AttributeIcon, PageHeading, PreviewNotice } from '../components/ui.jsx'
import { sampleAttributeLevels } from '../data/preview.js'

export default function Character() {
  return (
    <div className="page">
      <PageHeading
        eyebrow="BECOMING IS THE ADVENTURE"
        title={
          <>
            Meet the <em>Wanderer.</em>
          </>
        }
        description="Every part of your life adds something to your story."
      />
      <PreviewNotice />
      <div className="character-layout">
        <section className="panel character-feature">
          <div className="eyebrow">SAMPLE CHARACTER</div>
          <Portrait />
          <h2>The Wanderer</h2>
          <span className="character-title">
            <Compass size={15} />
            Seeker of small wonders
          </span>
          <p>A curious soul, a well-worn notebook, and a whole world of possibilities.</p>
          <div className="character-feature-stats">
            <div>
              <strong>7</strong>
              <span>LEVEL</span>
            </div>
            <div>
              <strong>24</strong>
              <span>QUESTS</span>
            </div>
            <div>
              <strong>185</strong>
              <span>GOLD</span>
            </div>
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
          {ATTRIBUTES.map(({ key, name, description }) => (
            <div className={`strength-detail ${key.toLowerCase()}`} key={key}>
              <span className="quest-icon">
                <AttributeIcon attribute={key} size={24} />
              </span>
              <div>
                <h3>{name}</h3>
                <p>{description}</p>
              </div>
              <span className="level-chip">LV {sampleAttributeLevels[key]}</span>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}
