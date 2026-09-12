import { useEffect, useRef, useState } from 'react'

export default function NetworkStatus() {
  const [state, setState] = useState(() => (navigator.onLine ? 'online' : 'offline'))
  const [visible, setVisible] = useState(() => !navigator.onLine)
  const timer = useRef()

  useEffect(() => {
    const clear = () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
    const offline = () => {
      clear()
      setState('offline')
      setVisible(true)
    }
    const online = () => {
      clear()
      setState('online')
      setVisible(true)
      timer.current = window.setTimeout(() => setVisible(false), 4000)
    }
    window.addEventListener('offline', offline)
    window.addEventListener('online', online)
    return () => {
      clear()
      window.removeEventListener('offline', offline)
      window.removeEventListener('online', online)
    }
  }, [])

  if (!visible) return null
  return (
    <div className={`network-status ${state}`} role="status" aria-live="polite">
      <strong>{state === 'offline' ? 'You are offline.' : 'Back online.'}</strong>{' '}
      {state === 'offline'
        ? 'Saved progress remains safe. New actions will need a connection.'
        : 'Fresh server data will resume automatically.'}
    </div>
  )
}
