import { ArrowRight, BookOpen, Check, Compass, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function FirstJourney({ step, active = true, completedCount = 0 }) {
  const create = active && step === 'CREATE_QUEST'
  const complete = active && step === 'COMPLETE_QUEST'
  const hasHistory = completedCount > 0

  const heading = create
    ? 'Give today one small quest.'
    : complete
      ? 'Your first quest is ready when you are.'
      : 'Give today one small quest.'

  const copy = create
    ? 'Choose something real and achievable. Once it is saved, AtlasBorn can remember the effort, reward it, and begin your activity history.'
    : complete
      ? 'Complete the real-world task, then record it. Your first XP, gold, attribute growth, streak day, and history entry will all come from that one confirmation.'
      : 'Choose something real and achievable. Keep the next step small enough to begin, meaningful enough to matter, and let your character grow with you.'

  const destination = create ? '/quests?new=1' : '/quests'
  const buttonLabel = create ? 'Create your first quest' : active ? 'Open your journal' : 'Plan today’s quest'

  return (
    <section className="panel first-journey fantasy-panel" aria-labelledby="first-journey-title">
      <div className="fantasy-panel-corner fantasy-panel-corner-tl" aria-hidden="true" />
      <div className="fantasy-panel-corner fantasy-panel-corner-br" aria-hidden="true" />

      <div className="first-journey-content">
        <div className="first-journey-mark" aria-hidden="true">
          <Compass size={28} strokeWidth={1.35} />
        </div>
        <div className="first-journey-copy">
          <span className="eyebrow">TODAY’S CHAPTER</span>
          <h2 id="first-journey-title">{heading}</h2>
          <p>{copy}</p>

          <ol className="first-journey-steps" aria-label="Quest progression">
            <li className={create ? 'current' : 'done'}>
              <span className="first-journey-step-icon"><BookOpen size={15} /></span>
              <span>Save a quest</span>
              <ArrowRight size={13} className="step-arrow" />
            </li>
            <li className={complete ? 'current' : hasHistory ? 'done' : ''}>
              <span className="first-journey-step-icon"><Check size={15} /></span>
              <span>Complete it</span>
              <ArrowRight size={13} className="step-arrow" />
            </li>
            <li className={hasHistory ? 'done' : ''}>
              <span className="first-journey-step-icon"><Sparkles size={15} /></span>
              <span>Watch your character grow</span>
            </li>
          </ol>
        </div>
      </div>

      <div className="first-journey-atlas" aria-hidden="true">
        <div className="chapter-map-compass"><Compass size={48} strokeWidth={1} /></div>
        <span className="chapter-map-ridge chapter-map-ridge-one" />
        <span className="chapter-map-ridge chapter-map-ridge-two" />
        <span className="chapter-map-path chapter-map-path-one" />
        <span className="chapter-map-path chapter-map-path-two" />
        <blockquote>Small Steps.<br />Bigger Stories.</blockquote>
      </div>

      <Link className="button button-gold first-journey-cta" to={destination}>
        {buttonLabel}
        <ArrowRight size={17} />
      </Link>
    </section>
  )
}
