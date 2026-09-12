import { useState } from 'react'
import { BookOpen, Search } from 'lucide-react'
import { ATTRIBUTES } from '@life-rpg/shared'
import { PageHeading, PreviewNotice } from '../components/ui.jsx'
import QuestList from '../components/QuestList.jsx'
import { sampleQuests } from '../data/preview.js'

export default function Quests() {
  const [search, setSearch] = useState('')
  const [attribute, setAttribute] = useState('ALL')
  const quests = sampleQuests.filter(
    (quest) =>
      (attribute === 'ALL' || quest.attribute === attribute) &&
      quest.title.toLowerCase().includes(search.trim().toLowerCase()),
  )
  return (
    <div className="page">
      <PageHeading
        eyebrow="A LITTLE INTENTION GOES A LONG WAY"
        title={
          <>
            Your quest <em>journal.</em>
          </>
        }
        description="Find inspiration for the things you want to make time for."
      />
      <PreviewNotice />
      <section className="panel journal-panel">
        <div className="journal-toolbar">
          <div>
            <BookOpen size={20} />
            <h2>Sample quests</h2>
            <span className="count-badge">{sampleQuests.length}</span>
          </div>
          <label className="search-field">
            <Search size={17} />
            <span className="sr-only">Search sample quests</span>
            <input
              placeholder="Find a quest…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              type="search"
            />
          </label>
        </div>
        <div className="filter-list" role="group" aria-label="Filter by attribute">
          {[{ key: 'ALL', name: 'All quests' }, ...ATTRIBUTES].map(({ key, name }) => (
            <button
              className={`filter-chip ${attribute === key ? 'selected' : ''}`}
              aria-pressed={attribute === key}
              key={key}
              onClick={() => setAttribute(key)}
            >
              {name}
            </button>
          ))}
        </div>
        <p className="sr-only" role="status">
          {quests.length} matching quests
        </p>
        {quests.length ? (
          <QuestList quests={quests} />
        ) : (
          <div className="empty-state">
            <Search size={30} />
            <h2>A little quiet here.</h2>
            <p>No sample quests match these filters.</p>
            <button
              className="button button-outline"
              onClick={() => {
                setAttribute('ALL')
                setSearch('')
              }}
            >
              Clear filters
            </button>
          </div>
        )}
        <div className="panel-footnote">
          Select a quest to explore its details. Personal quest creation opens with your account.
        </div>
      </section>
      <div className="editorial-note">
        <span>01</span>
        <div>
          <h2>Start smaller than you think.</h2>
          <p>
            Ten minutes of reading. A walk around the block. The best quest is one you can begin
            today.
          </p>
        </div>
      </div>
    </div>
  )
}
