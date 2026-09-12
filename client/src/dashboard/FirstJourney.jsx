import { ArrowRight, BookOpen, Check, Compass, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function FirstJourney({ step }) {
  const create = step === 'CREATE_QUEST'
  return (
    <section className="panel first-journey" aria-labelledby="first-journey-title">
      <div className="first-journey-mark" aria-hidden="true">
        <Compass size={25} />
      </div>
      <div className="first-journey-copy">
        <span className="eyebrow">YOUR FIRST CHAPTER</span>
        <h2 id="first-journey-title">
          {create ? 'Give today one small quest.' : 'Your first quest is ready when you are.'}
        </h2>
        <p>
          {create
            ? 'Choose something real and achievable. Once it is saved, Life RPG can remember the effort, reward it, and begin your activity history.'
            : 'Complete the real-world task, then record it. Your first XP, gold, attribute growth, streak day, and history entry will all come from that one confirmation.'}
        </p>
      </div>
      <ol className="first-journey-steps" aria-label="Getting started">
        <li className={create ? 'current' : 'done'}>
          <BookOpen size={15} />
          <span>Save a quest</span>
          {!create && <Check size={13} />}
        </li>
        <li className={!create ? 'current' : ''}>
          <Check size={15} />
          <span>Complete it</span>
        </li>
        <li>
          <Sparkles size={15} />
          <span>Watch your character grow</span>
        </li>
      </ol>
      <Link className="button button-gold" to={create ? '/quests?new=1' : '/quests'}>
        {create ? 'Create your first quest' : 'Open your journal'}
        <ArrowRight size={16} />
      </Link>
    </section>
  )
}
