import { Component } from 'react'

function reportClientError(error, info) {
  // Keep production reporting deliberately local until a telemetry provider is configured.
  // Never serialize application state, cookies, form values, or API responses here.
  console.error('life-rpg.render_error', {
    name: error?.name || 'Error',
    message: error?.message || 'Unknown render failure',
    componentStack: info?.componentStack || undefined,
  })
}

export default class ErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error, info) {
    reportClientError(error, info)
  }

  componentDidUpdate(previousProps) {
    if (this.state.failed && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ failed: false })
    }
  }

  reset = () => this.setState({ failed: false })

  render() {
    if (this.state.failed)
      return (
        <main className="fatal-error" role="main">
          <p className="eyebrow">A MOMENT TO REGROUP</p>
          <h1>This part of the trail hit a snag.</h1>
          <p role="alert">
            Your saved progress is still on the server. Try this screen again, or reload the latest
            version if a deployment changed while the app was open.
          </p>
          <div className="fatal-error-actions">
            <button className="button button-gold" onClick={this.reset}>
              Try this screen again
            </button>
            <button className="button button-outline" onClick={() => window.location.reload()}>
              Reload application
            </button>
          </div>
          <a className="text-link" href="/">
            Return to the overview
          </a>
        </main>
      )
    return this.props.children
  }
}
