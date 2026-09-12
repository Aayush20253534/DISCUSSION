import { ArrowRight, CalendarDays, Coins, Database, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { usePageMeta } from '../lib/meta.js'

const steps = [
  ['01', 'Choose a real-world quest', 'Turn studying, exercise, planning, reading, creative work, or self-care into something concrete enough to finish.'],
  ['02', 'Connect it to an attribute', 'Each quest trains Intellect, Strength, Discipline, Creativity, or Vitality so progress has a direction, not just a number.'],
  ['03', 'Complete it and earn rewards', 'The server calculates XP, attribute XP, and gold, records the completion, and prevents duplicate reward claims.'],
  ['04', 'Build your ongoing story', 'Your dashboard, streak calendar, character, inventory, and history all reflect the same persisted account state.'],
]

export default function HowItWorks() {
  usePageMeta({
    title: 'How Life RPG works · Quests, XP, streaks and rewards',
    description:
      'See how Life RPG turns real-world tasks into quests, secure XP, attributes, streaks, gold, and cosmetic rewards that persist across devices.',
    path: '/how-it-works',
  })
  return (
    <div className="marketing-page how-page">
      <header className="how-hero">
        <span className="marketing-kicker"><Sparkles size={14} /> THE SYSTEM BEHIND THE ADVENTURE</span>
        <h1>Progress you can <em>see, trust, and return to.</em></h1>
        <p>
          Life RPG combines a task journal with a lightweight game economy. The game layer rewards consistency without pretending the real-world work happened by magic.
        </p>
        <div className="marketing-actions">
          <Link className="button button-gold" to="/signup">Start free <ArrowRight size={17} /></Link>
          <Link className="button button-outline" to="/login">Sign in</Link>
        </div>
      </header>

      <section className="marketing-section how-steps" aria-labelledby="journey-loop-title">
        <span className="eyebrow">FROM INTENTION TO PROGRESSION</span>
        <h2 id="journey-loop-title">The complete player loop</h2>
        <div className="how-step-list">
          {steps.map(([number, title, copy]) => (
            <article key={number}>
              <span>{number}</span>
              <div><h3>{title}</h3><p>{copy}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-section mechanic-grid" aria-label="Life RPG systems">
        <article>
          <TrendingUp size={24} />
          <h3>Non-linear progression</h3>
          <p>Later levels need more XP, while each attribute advances independently based on the quests you actually complete.</p>
        </article>
        <article>
          <CalendarDays size={24} />
          <h3>Calendar-aware streaks</h3>
          <p>At least one valid completion makes a day active. Multiple quests in one day never inflate the streak.</p>
        </article>
        <article>
          <Coins size={24} />
          <h3>Cosmetic economy</h3>
          <p>Earn gold through quests, buy cosmetic rewards, and equip titles, badges, frames, and themes without pay-to-win mechanics.</p>
        </article>
        <article>
          <Database size={24} />
          <h3>Real persistence</h3>
          <p>Your account, quests, completions, progression, wallet, and inventory live in PostgreSQL instead of disappearing with local storage.</p>
        </article>
      </section>

      <section className="marketing-section integrity-section">
        <div className="integrity-icon"><ShieldCheck size={38} /></div>
        <div>
          <span className="eyebrow">BUILT TO KEEP THE GAME HONEST</span>
          <h2>The browser asks. The server decides.</h2>
          <p>
            Clients never submit their own reward amounts. Completion, purchases, daily eligibility, balances, and ownership are checked against server state and database constraints.
          </p>
        </div>
      </section>

      <section className="marketing-cta">
        <span className="eyebrow">READY FOR CHAPTER ONE?</span>
        <h2>Give tomorrow a quest worth returning to.</h2>
        <p>Create an account, choose your character, and start with one small win.</p>
        <Link className="button button-gold" to="/signup">Begin your adventure <ArrowRight size={17} /></Link>
      </section>
    </div>
  )
}
