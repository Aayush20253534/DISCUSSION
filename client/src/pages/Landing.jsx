import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Coins,
  Flame,
  ShieldCheck,
  Sparkles,
  Swords,
  Trophy,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { usePageMeta } from '../lib/meta.js'

const systems = [
  {
    icon: BookOpen,
    title: 'Turn plans into quests',
    copy: 'Create one-time or daily quests, choose the part of yourself they train, and give today a clear next step.',
  },
  {
    icon: Swords,
    title: 'Grow a real character',
    copy: 'Completing quests earns server-calculated XP and develops Intellect, Strength, Discipline, Creativity, or Vitality.',
  },
  {
    icon: Trophy,
    title: 'Make progress tangible',
    copy: 'Keep streaks alive, earn gold, unlock cosmetics, and build a history that survives refreshes and devices.',
  },
]

export default function Landing() {
  usePageMeta({
    title: 'Life RPG · Turn everyday progress into an adventure',
    description:
      'Life RPG turns real-world tasks into quests with XP, attributes, streaks, gold, and cosmetic rewards. Build momentum one completed quest at a time.',
    path: '/',
  })
  return (
    <div className="marketing-page landing-page">
      <section className="marketing-hero">
        <div className="marketing-hero-copy">
          <span className="marketing-kicker"><Sparkles size={14} /> REAL LIFE, WITH A PROGRESSION SYSTEM</span>
          <h1>
            Your everyday life,
            <br /> turned into an <em>adventure.</em>
          </h1>
          <p>
            Life RPG gives ordinary tasks the feedback loop games get right: clear quests, immediate rewards,
            visible growth, and a reason to return tomorrow.
          </p>
          <div className="marketing-actions">
            <Link className="button button-gold" to="/signup">
              Begin your adventure <ArrowRight size={17} />
            </Link>
            <Link className="button button-outline" to="/how-it-works">
              See how it works
            </Link>
          </div>
          <div className="marketing-trust" aria-label="Product principles">
            <span><ShieldCheck size={15} /> Server-backed progress</span>
            <span><CheckCircle2 size={15} /> Persistent across devices</span>
            <span><Flame size={15} /> Daily streaks without fake rewards</span>
          </div>
        </div>

        <div className="product-preview" aria-label="Life RPG product preview">
          <div className="preview-window-bar">
            <span /><span /><span />
            <small>YOUR ADVENTURE · TODAY</small>
          </div>
          <div className="preview-character-row">
            <div className="preview-avatar">07</div>
            <div>
              <span>THE WANDERER</span>
              <strong>Level 7</strong>
              <small>340 / 700 XP</small>
            </div>
            <div className="preview-streak"><Flame size={17} /> 7 days</div>
          </div>
          <div className="preview-progress"><span style={{ width: '48.6%' }} /></div>
          <div className="preview-quest-card">
            <div>
              <small>INTELLECT · HARD</small>
              <strong>Solve three coding problems</strong>
              <span>Daily quest · ready today</span>
            </div>
            <button type="button" tabIndex={-1} aria-hidden="true"><CheckCircle2 size={18} /></button>
          </div>
          <div className="preview-reward-row">
            <span><Sparkles size={15} /> +120 XP</span>
            <span><Coins size={15} /> +24 gold</span>
            <span><Swords size={15} /> +120 Intellect XP</span>
          </div>
          <div className="preview-attribute-grid">
            {['Intellect', 'Strength', 'Discipline', 'Creativity', 'Vitality'].map((name, index) => (
              <div key={name}>
                <span>{name}</span>
                <i><b style={{ width: `${42 + index * 9}%` }} /></i>
                <small>Lv {index + 2}</small>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="marketing-section marketing-intro" aria-labelledby="why-life-rpg">
        <span className="eyebrow">THE CORE LOOP</span>
        <h2 id="why-life-rpg">Do the thing. See yourself grow.</h2>
        <p>
          Productivity apps usually stop at the checkbox. Life RPG turns the checkbox into the start of a progression loop.
        </p>
        <div className="system-grid">
          {systems.map(({ icon: Icon, title, copy }, index) => (
            <article className="system-card" key={title}>
              <span className="system-number">0{index + 1}</span>
              <Icon size={24} />
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-section loop-section" aria-labelledby="daily-loop">
        <div>
          <span className="eyebrow">A LOOP WORTH RETURNING TO</span>
          <h2 id="daily-loop">One meaningful action becomes visible progress.</h2>
          <p>
            Rewards are calculated on the server, completion history is preserved, and daily quests have one valid reward window per scheduled day.
          </p>
          <Link className="text-link" to="/how-it-works">Explore the full loop <ArrowRight size={15} /></Link>
        </div>
        <ol className="loop-steps">
          <li><span>01</span><strong>Create a quest</strong><p>Choose what you want to do and what attribute it trains.</p></li>
          <li><span>02</span><strong>Complete it in real life</strong><p>Mark it complete only when the work is actually done.</p></li>
          <li><span>03</span><strong>Earn XP and gold</strong><p>Secure server logic records one immutable reward receipt.</p></li>
          <li><span>04</span><strong>Return stronger</strong><p>Build attributes, streaks, cosmetics, and a long-term history.</p></li>
        </ol>
      </section>

      <section className="marketing-cta">
        <span className="eyebrow">YOUR FIRST QUEST IS SMALL ON PURPOSE</span>
        <h2>Start with one thing you already want to do.</h2>
        <p>No leaderboard. No fake urgency. Just a clearer reason to show up for yourself.</p>
        <Link className="button button-gold" to="/signup">Create your character <ArrowRight size={17} /></Link>
      </section>
    </div>
  )
}
