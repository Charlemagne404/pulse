import { Link } from 'react-router-dom'
import { ProductShell } from '../components/ProductShell'
import { eventCatalog } from '../data/content'
import { recentEvents } from '../data/mockData'

export function EventsPage() {
  return (
    <ProductShell
      activeItem="events"
      pageTitle={<h1>Events</h1>}
      toolbar={
        <div className="toolbar-cluster">
          <Link to="/docs" className="secondary-button">
            Event Reference
          </Link>
        </div>
      }
    >
      <section className="data-panel page-intro-panel">
        <div>
          <h2>Workspace event catalog</h2>
          <p>Review the standard events used across projects, then compare them against the most recent activity flowing into the workspace.</p>
        </div>
        <Link to="/support" className="secondary-button">
          Open Help
        </Link>
      </section>

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
              {recentEvents.map((row) => (
                <tr key={`${row.time}-${row.project}-${row.event}`}>
                  <td>{row.time}</td>
                  <td>
                    <span className="table-event-pill">{row.event}</span>
                  </td>
                  <td>{row.project}</td>
                  <td>{row.location}</td>
                  <td>{row.device}</td>
                  <td>{row.browser}</td>
                  <td>
                    <span className="country-pill">{row.country}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </ProductShell>
  )
}
