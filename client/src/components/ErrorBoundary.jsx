import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    if (this.state.failed)
      return (
        <main className="fatal-error">
          <p className="eyebrow">A MOMENT TO REGROUP</p>
          <h1>A small bump in the trail.</h1>
          <p>Something didn’t load as expected. Refresh to try again.</p>
          <button className="button button-gold" onClick={() => window.location.reload()}>
            Try again
          </button>
          <a className="text-link" href="/">
            Return to the overview
          </a>
        </main>
      )
    return this.props.children
  }
}
