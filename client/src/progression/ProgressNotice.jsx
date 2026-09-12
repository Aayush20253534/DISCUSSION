export default function ProgressNotice({ query }) {
  if (!query.isError) return null
  return (
    <p className="progress-refresh-error" role="alert">
      Progress could not be refreshed. <button onClick={() => query.refetch()}>Try again</button>
    </p>
  )
}
