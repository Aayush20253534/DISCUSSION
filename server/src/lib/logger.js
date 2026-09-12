export function log(level, event, details = {}) {
  const entry = JSON.stringify({ time: new Date().toISOString(), level, event, ...details })
  if (level === 'error') console.error(entry)
  else console.log(entry)
}
