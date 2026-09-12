import { BookOpen, Compass, LoaderCircle, Plus } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { SectionLink } from '../components/ui.jsx'
import QuestRow from './QuestRow.jsx'
import { useQuests, useQuestSync } from './hooks.js'
import '../quests.css'

export default function DashboardQuests() {
  const query = useQuests({ status: 'ACTIVE', sort: 'DUE', limit: 3 })
  const navigate = useNavigate()
  useQuestSync()
  return (
    <section className="panel quest-panel dashboard-quest-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">MAKE ROOM FOR WHAT MATTERS</span>
          <h2>Your next small steps</h2>
        </div>
        <BookOpen size={22} className="green" />
      </div>
      {query.isPending ? (
        <div className="journal-loading" role="status">
          <LoaderCircle size={22} className="spin" />
          Opening your journal…
        </div>
      ) : query.isError ? (
        <div className="journal-empty">
          <p role="alert">{query.error.message}</p>
          <button className="button button-outline" onClick={() => query.refetch()}>
            Try again
          </button>
        </div>
      ) : query.data.quests.length ? (
        <>
          <div className="saved-quest-list">
            {query.data.quests.map((quest) => (
              <QuestRow
                compact
                key={quest.id}
                quest={quest}
                today={query.data.today}
                onOpen={() => navigate(`/quests?quest=${quest.id}`)}
              />
            ))}
          </div>
          <div className="dashboard-journal-link">
            <SectionLink to="/quests">
              Open your journal · {query.data.pagination.total} active
            </SectionLink>
          </div>
        </>
      ) : (
        <div className="journal-empty">
          <Compass size={32} />
          <h3>Your first quest starts here.</h3>
          <p>Give a small intention a place in your day. Choose a quest that feels like you.</p>
          <Link className="button button-outline" to="/quests?new=1">
            <Plus size={16} />
            Create your first quest
          </Link>
        </div>
      )}
    </section>
  )
}
