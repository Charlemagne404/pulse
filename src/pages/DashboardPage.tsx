import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DataStateCard } from '../components/DataStateCard'
import { DonutChart } from '../components/DonutChart'
import { AppIcon } from '../components/Icon'
import { LineChart } from '../components/LineChart'
import { MetricCard } from '../components/MetricCard'
import { ProductShell } from '../components/ProductShell'
import { useAnalyticsQuery } from '../hooks/useAnalyticsQuery'
import { cycleIndex, type GranularityOption } from '../lib/analytics'
import type { AnalyticsGranularity } from '../lib/analyticsApi'
import { fetchOverviewAnalytics } from '../lib/analyticsApi'
import {
  buildDeviceSegments,
  buildMetricCards,
  formatBreakdownShare,
  formatCount,
  formatCountryCode,
  formatDeviceLabel,
  formatRecentEventTime,
  getProjectName,
  getProjectSlug,
} from '../lib/analyticsUi'
import { buildAnalyticsRangePresets } from '../lib/demoDates'

const granularityOptions: GranularityOption[] = ['Day', 'Week', 'Month']
const granularityByOption: Record<GranularityOption, AnalyticsGranularity> = {
  Day: 'day',
  Week: 'week',
  Month: 'month',
}
const dashboardRangePresets = buildAnalyticsRangePresets()

export function DashboardPage() {
  const [rangeIndex, setRangeIndex] = useState(0)
  const [granularityIndex, setGranularityIndex] = useState(0)
  const activeRange = dashboardRangePresets[rangeIndex] ?? dashboardRangePresets[0]
  const activeGranularity = granularityOptions[granularityIndex]
  const { data, error, isLoading, isRefreshing } = useAnalyticsQuery(
    `overview:${activeRange.label}:${activeGranularity}`,
    (signal) =>
      fetchOverviewAnalytics(
        {
          from: activeRange.from,
          to: activeRange.to,
          granularity: granularityByOption[activeGranularity],
        },
        signal,
      ),
  )

  const metricCards = data ? buildMetricCards(data.metrics) : []
  const deviceSegments = data ? buildDeviceSegments(data.deviceMix) : []
  const hasData = Boolean(data && data.totals.acceptedEvents > 0)

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
          <span className={`status-chip${isRefreshing ? ' refreshing' : ''}`}>
            {isRefreshing ? 'Refreshing live data' : 'Live data'}
          </span>
        </div>
      }
    >
      {error && data ? (
        <DataStateCard
          title="Live refresh interrupted"
          message={`${error} The dashboard is still showing the last successful response.`}
          tone="warning"
        />
      ) : null}

      {isLoading && !data ? (
        <DataStateCard
          title="Loading live analytics"
          message="Pulse is requesting the current overview from the analytics API."
        />
      ) : null}

      {!isLoading && error && !data ? (
        <DataStateCard
          title="Could not load the dashboard"
          message={error}
          tone="error"
          action={
            <Link to="/docs" className="secondary-button">
              Open Docs
            </Link>
          }
        />
      ) : null}

      {!isLoading && !error && data && !hasData ? (
        <DataStateCard
          title="No analytics yet"
          message="The backend is reachable, but there are no accepted events in this dashboard range yet."
        />
      ) : null}

      {data && hasData ? (
        <>
          <section className="metric-strip five-up">
            {metricCards.map((metric) => (
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
              {data.series.length > 0 ? (
                <LineChart data={data.series} />
              ) : (
                <p className="empty-list-copy">No page-view series is available for this range.</p>
              )}
            </section>

            <section className="data-panel">
              <div className="panel-head">
                <h2>Top Projects</h2>
                <Link to="/projects" className="panel-link">
                  View all
                </Link>
              </div>

              {data.topProjects.length > 0 ? (
                <div className="project-ranking-list">
                  {data.topProjects.map((project) => (
                    <Link
                      key={project.projectId}
                      to={`/projects/${getProjectSlug(project.projectId)}`}
                      className="project-ranking-row interactive-row"
                    >
                      <div className="project-ranking-head">
                        <strong>{project.projectName}</strong>
                        <span>{formatCount(project.pageViews)}</span>
                      </div>
                      <div className="project-ranking-meta">
                        <span>{formatCount(project.uniqueVisitors)}</span>
                        <div className="mini-progress">
                          <div style={{ width: `${project.share}%` }} />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="empty-list-copy">No projects recorded page views in this range.</p>
              )}
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
              {data.topPages.length > 0 ? (
                <div className="mini-table-list">
                  {data.topPages.map((row) => (
                    <Link key={row.label} to="/reports/pages" className="mini-table-row interactive-row">
                      <span>{row.label}</span>
                      <strong>{formatCount(row.value)}</strong>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="empty-list-copy">No page views are available for this range.</p>
              )}
            </section>

            <section className="data-panel">
              <div className="panel-head">
                <h2>Top Referrers</h2>
                <Link to="/reports/referrers" className="panel-link">
                  View all
                </Link>
              </div>
              {data.topReferrers.length > 0 ? (
                <div className="mini-table-list">
                  {data.topReferrers.map((row) => (
                    <Link key={row.label} to="/reports/referrers" className="mini-table-row interactive-row">
                      <span>{row.label}</span>
                      <strong>{formatCount(row.value)}</strong>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="empty-list-copy">No tracked referrers are available for this range.</p>
              )}
            </section>

            <section className="data-panel">
              <div className="panel-head">
                <h2>By Device</h2>
              </div>
              {deviceSegments.length > 0 ? (
                <div className="device-breakdown">
                  <DonutChart segments={deviceSegments} />
                  <div className="legend-list">
                    {deviceSegments.map((segment) => (
                      <div key={segment.label} className="legend-row">
                        <span className="legend-swatch" style={{ backgroundColor: segment.color }} />
                        <span>{segment.label}</span>
                        <strong>{formatBreakdownShare(segment.share)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="empty-list-copy">No device breakdown is available yet.</p>
              )}
            </section>

            <section className="data-panel">
              <div className="panel-head">
                <h2>By Browser</h2>
              </div>
              {data.browserMix.length > 0 ? (
                <div className="browser-mix-list">
                  {data.browserMix.map((row) => (
                    <div key={row.label} className="browser-mix-row">
                      <div className="browser-mix-head">
                        <span>{row.label}</span>
                        <strong>{formatBreakdownShare(row.share)}</strong>
                      </div>
                      <div className="mini-progress">
                        <div style={{ width: `${row.share || 0}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-list-copy">No browser mix is available yet.</p>
              )}
            </section>
          </section>

          <section className="data-panel">
            <div className="panel-head">
              <h2>Recent Events</h2>
              <Link to="/events" className="panel-link">
                View all events
              </Link>
            </div>
            {data.recentEvents.length > 0 ? (
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
                    {data.recentEvents.map((row) => (
                      <tr key={`${row.occurredAt}-${row.projectId}-${row.eventName}`}>
                        <td>{formatRecentEventTime(row.occurredAt)}</td>
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
            ) : (
              <p className="empty-list-copy">No recent events were returned for this range.</p>
            )}
          </section>
        </>
      ) : null}
    </ProductShell>
  )
}
