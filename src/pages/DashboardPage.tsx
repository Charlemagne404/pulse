import { Link } from 'react-router-dom'
import { DonutChart } from '../components/DonutChart'
import { AppIcon } from '../components/Icon'
import { LineChart } from '../components/LineChart'
import { MetricCard } from '../components/MetricCard'
import { ProductShell } from '../components/ProductShell'
import {
  dashboardBrowserMix,
  dashboardDeviceMix,
  dashboardMetrics,
  dashboardReferrers,
  dashboardSeries,
  dashboardTopPages,
  dashboardTopProjects,
  recentEvents,
} from '../data/mockData'

export function DashboardPage() {
  return (
    <ProductShell
      activeItem="overview"
      pageTitle={<h1>Overview</h1>}
      toolbar={
        <div className="toolbar-cluster">
          <button className="toolbar-chip">
            <AppIcon name="calendar" />
            <span>May 12 - May 18, 2024</span>
          </button>
          <button className="toolbar-chip compact">
            <span>7D</span>
          </button>
          <Link to="/docs" className="icon-button" aria-label="Open docs">
            ?
          </Link>
          <div className="avatar-pill">AD</div>
        </div>
      }
    >
      <section className="metric-strip five-up">
        {dashboardMetrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} compact />
        ))}
      </section>

      <section className="dashboard-layout-primary">
        <section className="data-panel chart-panel">
          <div className="panel-head">
            <h2>Visits Over Time</h2>
            <button className="toolbar-chip compact">Day</button>
          </div>
          <LineChart data={dashboardSeries} />
        </section>

        <section className="data-panel">
          <div className="panel-head">
            <h2>Top Projects</h2>
            <button className="panel-link">View all</button>
          </div>

          <div className="project-ranking-list">
            {dashboardTopProjects.map((project) => (
              <article key={project.name} className="project-ranking-row">
                <div className="project-ranking-head">
                  <strong>{project.name}</strong>
                  <span>{project.pageViews}</span>
                </div>
                <div className="project-ranking-meta">
                  <span>{project.uniqueVisitors}</span>
                  <div className="mini-progress">
                    <div style={{ width: `${project.share}%` }} />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="dashboard-layout-secondary">
        <section className="data-panel">
          <div className="panel-head">
            <h2>Top Pages</h2>
            <button className="panel-link">View all</button>
          </div>
          <div className="mini-table-list">
            {dashboardTopPages.map((row) => (
              <div key={row.label} className="mini-table-row">
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="data-panel">
          <div className="panel-head">
            <h2>Top Referrers</h2>
            <button className="panel-link">View all</button>
          </div>
          <div className="mini-table-list">
            {dashboardReferrers.map((row) => (
              <div key={row.label} className="mini-table-row">
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="data-panel">
          <div className="panel-head">
            <h2>By Device</h2>
          </div>
          <div className="device-breakdown">
            <DonutChart segments={dashboardDeviceMix} />
            <div className="legend-list">
              {dashboardDeviceMix.map((segment) => (
                <div key={segment.label} className="legend-row">
                  <span className="legend-swatch" style={{ backgroundColor: segment.color }} />
                  <span>{segment.label}</span>
                  <strong>{segment.share}%</strong>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="data-panel">
          <div className="panel-head">
            <h2>By Browser</h2>
          </div>
          <div className="browser-mix-list">
            {dashboardBrowserMix.map((row) => (
              <div key={row.label} className="browser-mix-row">
                <div className="browser-mix-head">
                  <span>{row.label}</span>
                  <strong>{row.share}%</strong>
                </div>
                <div className="mini-progress">
                  <div style={{ width: `${row.share}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>

      <section className="data-panel">
        <div className="panel-head">
          <h2>Recent Events</h2>
          <button className="panel-link">View all events</button>
        </div>
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Event</th>
                <th>Project</th>
                <th>Page / Location</th>
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
