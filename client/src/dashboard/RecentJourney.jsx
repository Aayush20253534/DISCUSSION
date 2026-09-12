import { ArrowRight, CheckCheck, Coins, History, Repeat2, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ATTRIBUTES, formatCompletionDate, formatQuestDate } from '@life-rpg/shared'
import { AttributeIcon } from '../components/ui.jsx'

export default function RecentJourney({ completions }) {
  return (
    <section className="panel recent-journey" aria-labelledby="recent-journey-title">
      <div className="section-heading dashboard-section-heading">
        <div>
          <span className="eyebrow">RECENTLY EARNED</span>
          <h2 id="recent-journey-title">The steps you just took</h2>
        </div>
        <History size={21} className="gold" />
      </div>
      {completions.length ? (
        <ol className="dashboard-history-list">
          {completions.map((receipt) => {
            const attribute = ATTRIBUTES.find((item) => item.key === receipt.attribute)
            return (
              <li key={receipt.id}>
                <span className={`dashboard-history-icon ${receipt.attribute.toLowerCase()}`}>
                  <AttributeIcon attribute={receipt.attribute} size={19} />
                </span>
                <div className="dashboard-history-copy">
                  <div className="dashboard-history-title">
                    {receipt.questId ? (
                      <Link to={`/quests?status=${receipt.recurrence === 'DAILY' ? 'ALL' : 'COMPLETED'}&quest=${receipt.questId}`}>
                        {receipt.title}
                      </Link>
                    ) : (
                      <strong>{receipt.title}</strong>
                    )}
                    {receipt.recurrence === 'DAILY' && (
                      <span><Repeat2 size={11} /> {formatQuestDate(receipt.scheduledDate)}</span>
                    )}
                    {receipt.levelAfter > receipt.levelBefore && (
                      <span className="dashboard-level-up"><Sparkles size={11} /> Level {receipt.levelAfter}</span>
                    )}
                  </div>
                  <time dateTime={receipt.completedAt}>
                    {formatCompletionDate(receipt.completedAt, receipt.timezone)}
                  </time>
                  <div className="dashboard-history-rewards">
                    <span>+{receipt.xpAwarded} XP</span>
                    <span><Coins size={11} /> +{receipt.goldAwarded} gold</span>
                    <span>+{receipt.attributeXpAwarded} {attribute?.name || 'attribute'} XP</span>
                  </div>
                </div>
                <CheckCheck className="dashboard-history-check" size={16} aria-hidden="true" />
              </li>
            )
          })}
        </ol>
      ) : (
        <div className="dashboard-history-empty">
          <CheckCheck size={30} />
          <h3>Your first completed quest will live here.</h3>
          <p>History keeps the date and awarded rewards even if you later remove the journal entry.</p>
          <Link className="text-link" to="/quests">Find a quest <ArrowRight size={14} /></Link>
        </div>
      )}
      {completions.length > 0 && (
        <Link className="text-link dashboard-history-link" to="/character">
          View complete progress history <ArrowRight size={15} />
        </Link>
      )}
    </section>
  )
}
