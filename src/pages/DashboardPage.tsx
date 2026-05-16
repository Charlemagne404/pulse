import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DonutChart } from '../components/DonutChart'
import { AppIcon } from '../components/Icon'
import { LineChart } from '../components/LineChart'
import { MetricCard } from '../components/MetricCard'
import { ProductShell } from '../components/ProductShell'
import { projectDirectory } from '../data/content'
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
import { buildSeriesForGranularity, cycleIndex, type GranularityOption } from '../lib/analytics'

const dashboardRangePresets = [
  {
    label: '7D',
    dates: 'May 12 - May 18, 2024',
    series: dashboardSeries,
  },
  {
    label: '30D',
    dates: 'Apr 19 - May 18, 2024',
    series: [
      { label: 'Apr 19', value: 44000 },
      { label: 'Apr 24', value: 63000 },
      { label: 'Apr 29', value: 76000 },
      { label: 'May 04', value: 81000 },
      { label: 'May 09', value: 95000 },
      { label: 'May 14', value: 112000 },
      { label: 'May 18', value: 149000 },
    ],
  },
  {
    label: 'QTD',
    dates: 'Mar 01 - May 18, 2024',
    series: [
      { label: 'Mar', value: 278000 },
      { label: 'Late Mar', value: 342000 },
      { label: 'Apr', value: 405000 },
      { label: 'Late Apr', value: 462000 },
      { label: 'May', value: 521000 },
    ],
  },
]

const granularityOptions: GranularityOption[] = ['Day', 'Week', 'Month']

export function DashboardPage() {
  const [rangeIndex, setRangeIndex] = useState(0)
  const [granularityIndex, setGranularityIndex] = useState(0)
  const activeRange = dashboardRangePresets[rangeIndex]
  const activeGranularity = granularityOptions[granularityIndex]
  const activeSeries = buildSeriesForGranularity(activeRange.series, activeGranularity)

  return (
    <ProductShell
      activeItem="overview"
      pageTitle={<h1>Overview</h1>}
      toolbar={
        <div className="toolbar-cluster">
          <button
            type="button"
            className="toolbar-chip"
            onClick={() => setRangeIndex((currentIndex) => cycleIndex(currentIndex, dashboardRangePresets.length))}
          >
            <AppIcon name="calendar" />
            <span>{activeRange.dates}</span>
          </button>
          <button
            type="button"
            className="toolbar-chip compact"
            onClick={() => setRangeIndex((currentIndex) => cycleIndex(currentIndex, dashboardRangePresets.length))}
          >
            <span>{activeRange.label}</span>
          </button>
          <Link to="/docs" className="icon-button" aria-label="Open docs">
            ?
          </Link>
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
            <div className="panel-heading-copy">
              <h2>Visits Over Time</h2>
              <p>
                {activeRange.dates} · {activeGranularity}
              </p>
            </div>
            <button
              type="button"
              className="toolbar-chip compact"
              onClick={() => setGranularityIndex((currentIndex) => cycleIndex(currentIndex, granularityOptions.length))}
            >
              {activeGranularity}
            </button>
          </div>
          <LineChart data={activeSeries} />
        </section>

        <section className="data-panel">
          <div className="panel-head">
            <h2>Top Projects</h2>
            <Link to="/projects" className="panel-link">
              View all
            </Link>
          </div>

          <div className="project-ranking-list">
            {dashboardTopProjects.map((project) => (
              <Link
                key={project.name}
                to={`/projects/${projectDirectory.find((item) => item.name === project.name)?.slug ?? 'aegis'}`}
                className="project-ranking-row interactive-row"
              >
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
              </Link>
            ))}
          </div>
        </section>
      </section>

      <section className="dashboard-layout-secondary">
        <section className="data-panel">
          <div className="panel-head">
            <h2>Top Pages</h2>
            <Link to="/reports/pages" className="panel-link">
              View all
            </Link>
          </div>
          <div className="mini-table-list">
            {dashboardTopPages.map((row) => (
              <Link key={row.label} to="/reports/pages" className="mini-table-row interactive-row">
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </Link>
            ))}
          </div>
        </section>

        <section className="data-panel">
          <div className="panel-head">
            <h2>Top Referrers</h2>
            <Link to="/reports/referrers" className="panel-link">
              View all
            </Link>
          </div>
          <div className="mini-table-list">
            {dashboardReferrers.map((row) => (
              <Link key={row.label} to="/reports/referrers" className="mini-table-row interactive-row">
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </Link>
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
          <Link to="/events" className="panel-link">
            View all events
          </Link>
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
