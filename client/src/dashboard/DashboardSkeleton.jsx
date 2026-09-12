export default function DashboardSkeleton() {
  return (
    <div className="dashboard-loading" role="status" aria-label="Loading your adventure dashboard">
      <span className="sr-only">Loading your adventure dashboard…</span>
      <div className="dashboard-loading-grid">
        <div className="panel dashboard-loading-card">
          <span className="skeleton dashboard-skeleton-line short" />
          <span className="skeleton dashboard-skeleton-title" />
          <span className="skeleton dashboard-skeleton-portrait" />
          <span className="skeleton dashboard-skeleton-line" />
          <span className="skeleton dashboard-skeleton-line medium" />
        </div>
        <div className="panel dashboard-loading-card dashboard-loading-quests">
          <span className="skeleton dashboard-skeleton-line short" />
          <span className="skeleton dashboard-skeleton-title" />
          {Array.from({ length: 4 }, (_, index) => (
            <span className="skeleton dashboard-skeleton-row" key={index} />
          ))}
        </div>
      </div>
      <div className="dashboard-loading-lower">
        <span className="panel skeleton dashboard-skeleton-panel" />
        <span className="panel skeleton dashboard-skeleton-panel" />
      </div>
    </div>
  )
}
