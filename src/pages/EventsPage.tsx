import { Link } from 'react-router-dom'
import { DataStateCard } from '../components/DataStateCard'
import { ProductShell } from '../components/ProductShell'
import { eventCatalog } from '../data/content'
import { useAnalyticsQuery } from '../hooks/useAnalyticsQuery'
import { fetchRecentEventsPage } from '../lib/analyticsApi'
import {
  formatCount,
  formatCountryCode,
  formatDeviceLabel,
  formatTimestampLabel,
  getProjectName,
} from '../lib/analyticsUi'

export function EventsPage() {
  const { data, error, isLoading, isRefreshing } = useAnalyticsQuery('events:recent', (signal) =>
    fetchRecentEventsPage({ limit: 25 }, signal),
  )
  const trackedProjects = data ? new Set(data.rows.map((row) => row.projectId)).size : 0

  return (
    <ProductShell
      activeItem="events"
      pageTitle={<h1>Events</h1>}
      toolbar={
        <div className="toolbar-cluster">
          <Link to="/docs" className="secondary-button">
            Event Reference
          </Link>
          <span className={`status-chip${isRefreshing ? ' refreshing' : ''}`}>
            {isRefreshing ? 'Refreshing live data' : 'Live data'}
          </span>
        </div>
      }
    >
      <section className="data-panel page-intro-panel">
        <div>
          <h2>Workspace event catalog</h2>
          <p>
            {data
              ? `${formatCount(data.rows.length)} recent events are loaded across ${formatCount(trackedProjects)} active projects.`
              : 'Review the standard events used across projects, then compare them against the most recent activity flowing into the workspace.'}
          </p>
        </div>
        <Link to="/help" className="secondary-button">
          Open Help
        </Link>
      </section>

      {error && data ? (
        <DataStateCard
          title="Live refresh interrupted"
          message={`${error} The event stream is still showing the last successful response.`}
          tone="warning"
        />
      ) : null}

      {isLoading && !data ? (
        <DataStateCard
          title="Loading live event stream"
          message="Pulse is requesting the latest workspace events from the analytics API."
        />
      ) : null}

      {!isLoading && error && !data ? (
        <DataStateCard title="Could not load recent events" message={error} tone="error" />
      ) : null}

      <section className="resource-card-grid">
        {eventCatalog.map((eventItem) => (
          <article key={eventItem.name} className="data-panel resource-card">
            <span className="table-event-pill">{eventItem.category}</span>
            <h2>{eventItem.name}</h2>
            <p>{eventItem.description}</p>
            <Link to="/docs" className="panel-link">
              Open docs
            </Link>
          </article>
        ))}
      </section>

      <section className="data-panel">
        <div className="panel-head">
          <h2>Live event stream</h2>
          <Link to="/reports" className="panel-link">
            Open reporting
          </Link>
        </div>

        {data && data.rows.length > 0 ? (
          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Event</th>
                  <th>Project</th>
                  <th>Location</th>
                  <th>Device</th>
                  <th>Browser</th>
                  <th>Country</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={`${row.occurredAt}-${row.projectId}-${row.eventName}`}>
                    <td>{formatTimestampLabel(row.occurredAt)}</td>
                    <td>
                      <span className="table-event-pill">{row.eventName}</span>
                    </td>
                    <td>{getProjectName(row.projectId)}</td>
                    <td>{row.path}</td>
                    <td>{formatDeviceLabel(row.deviceType)}</td>
                    <td>{row.browserName}</td>
                    <td>
                      <span className="country-pill">{formatCountryCode(row.countryCode)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {!isLoading && !error && data && data.rows.length === 0 ? (
          <p className="empty-list-copy">No recent events are available for this workspace yet.</p>
        ) : null}
      </section>
    </ProductShell>
  )
}
