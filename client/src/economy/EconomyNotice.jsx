export default function EconomyNotice({ query }) {
  if (!query?.isError) return null
  return (
    <div className="economy-notice" role="alert">
      <strong>The market trail is temporarily blocked.</strong>
      <span>{query.error?.message || 'Please try again shortly.'}</span>
      <button type="button" className="text-link" onClick={() => query.refetch()}>Try again</button>
    </div>
  )
}
