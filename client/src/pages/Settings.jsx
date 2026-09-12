import { useOutletContext } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Activity, ArrowRight, RefreshCw, Waves } from 'lucide-react'
import { API_PREFIX, worldSchema } from '@life-rpg/shared'
import { PageHeading } from '../components/ui.jsx'
import { apiGet } from '../lib/api.js'

export default function Settings() {
  const { gentleMotion, setGentleMotion } = useOutletContext()
  const world = useQuery({
    queryKey: ['world'],
    queryFn: async ({ signal }) => worldSchema.parse(await apiGet(`${API_PREFIX}/world`, signal)),
    retry: 1,
  })
  return (
    <div className="page">
      <PageHeading
        eyebrow="MAKE YOURSELF AT HOME"
        title={
          <>
            A little more <em>you.</em>
          </>
        }
        description="Small preferences for a comfortable adventure."
      />
      <section className="panel settings-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">LOOK & FEEL</span>
            <h2>At your own pace</h2>
          </div>
          <Waves size={23} className="green" />
        </div>
        <div className="setting-row">
          <div>
            <label htmlFor="gentle-motion">Gentle animations</label>
            <p id="motion-description">
              Subtle movement, softly appearing panels, and a little sparkle.
              <br />
              Your device’s reduced-motion preference always takes priority.
            </p>
          </div>
          <input
            type="checkbox"
            role="switch"
            className="switch"
            id="gentle-motion"
            aria-describedby="motion-description"
            checked={gentleMotion}
            onChange={(event) => setGentleMotion(event.target.checked)}
          />
        </div>
        <div className="setting-row">
          <div>
            <h3>Adventure theme</h3>
            <p>Evergreen · Deep ink, forest green, and warm gold.</p>
          </div>
          <div className="theme-swatches" role="img" aria-label="Evergreen theme colors">
            <i />
            <i />
            <i />
          </div>
        </div>
      </section>
      <section className="panel settings-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">CONNECTED TO YOUR WORLD</span>
            <h2>Connection status</h2>
          </div>
          <Activity size={21} className="gold" />
        </div>
        <div className="setting-row">
          <div aria-live="polite">
            <h3>
              {world.isPending
                ? 'Checking the connection…'
                : world.isError
                  ? 'The world server is out of reach.'
                  : 'The world server is connected.'}
            </h3>
            <p>
              {world.isError
                ? 'The sample adventure is still available. You can try connecting again.'
                : 'Personal accounts and saved adventures will arrive in a future chapter.'}
            </p>
          </div>
          <button
            className="button button-outline"
            disabled={world.isFetching}
            onClick={() => world.refetch()}
          >
            <RefreshCw size={15} className={world.isFetching ? 'spin' : ''} />
            {world.isFetching ? 'Checking' : 'Check again'}
          </button>
        </div>
        <a className="text-link" href="/">
          Back to your adventure <ArrowRight size={15} />
        </a>
      </section>
    </div>
  )
}
