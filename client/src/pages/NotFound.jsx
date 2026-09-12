import { Link } from 'react-router-dom'
import { ArrowLeft, Compass } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="page lost-page">
      <span className="lost-compass">
        <Compass size={76} strokeWidth={1} />
      </span>
      <p className="eyebrow">A SMALL DETOUR · 404</p>
      <h1>
        A little off the <em>beaten path.</em>
      </h1>
      <p>
        This part of the map hasn’t been drawn yet.
        <br />
        Let’s find our way back to your adventure.
      </p>
      <Link className="button button-gold" to="/">
        <ArrowLeft size={16} />
        Back to the trail
      </Link>
    </div>
  )
}
