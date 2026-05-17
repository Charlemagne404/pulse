import { useState } from 'react'
import { Link, NavLink, Navigate, useParams } from 'react-router-dom'
import { DataStateCard } from '../components/DataStateCard'
import { AppIcon } from '../components/Icon'
import { LineChart } from '../components/LineChart'
import { MetricCard } from '../components/MetricCard'
import { ProductShell } from '../components/ProductShell'
import { projectDirectory } from '../data/content'
import { useAnalyticsQuery } from '../hooks/useAnalyticsQuery'
import { cycleIndex, type GranularityOption } from '../lib/analytics'
import type { AnalyticsGranularity } from '../lib/analyticsApi'
import { fetchProjectOverview } from '../lib/analyticsApi'
import {
  buildMetricCards,
  formatAnalyticsRangeLabel,
  formatBreakdownShare,
  formatCount,
  getProjectSlug,
} from '../lib/analyticsUi'
import { buildAnalyticsRangePresets } from '../lib/demoDates'
import { STATUS_URL } from '../lib/siteLinks'

const granularityOptions: GranularityOption[] = ['Day', 'Week', 'Month']
const granularityByOption: Record<GranularityOption, AnalyticsGranularity> = {
  Day: 'day',
  Week: 'week',
  Month: 'month',
}
const projectRangePresets = buildAnalyticsRangePresets()

export function ProjectPage() {
  const { projectSlug = 'aegis' } = useParams()
  const project = projectDirectory.find((item) => item.slug === projectSlug)
  const [rangeIndex, setRangeIndex] = useState(0)
  const [granularityIndex, setGranularityIndex] = useState(0)

  const activeRange = projectRangePresets[rangeIndex] ?? projectRangePresets[0]
  const activeGranularity = granularityOptions[granularityIndex]
  const { data, error, isLoading, isRefreshing } = useAnalyticsQuery(
    `project:${project?.slug || projectSlug}:${activeRange.label}:${activeGranularity}`,
    (signal) =>
      project
        ? fetchProjectOverview(
            project.slug,
            {
              from: activeRange.from,
              to: activeRange.to,
              granularity: granularityByOption[activeGranularity],
            },
            signal,
          )
        : Promise.resolve(null),
  )

  if (!project) {
    return <Navigate to="/projects" replace />
  }

  const metricCards = data ? buildMetricCards(data.metrics) : []
  const hasData = Boolean(data && (data.series.length > 0 || data.topPages.length > 0 || data.eventTable.length > 0))
  const projectPagesReportLink = `/reports/pages?projectId=${encodeURIComponent(project.slug)}`
  const projectReferrersReportLink = `/reports/referrers?projectId=${encodeURIComponent(project.slug)}`

  return (
    <ProductShell
      activeItem="projects"
      pageTitle={<div className="page-breadcrumbs">Projects &gt; {project.name}</div>}
      toolbar={
        <div className="toolbar-cluster">
          <button
            type="button"
            className="toolbar-chip"
            onClick={() => setRangeIndex((currentIndex) => cycleIndex(currentIndex, projectRangePresets.length))}
          >
            <AppIcon name="calendar" />
            <span>{activeRange.dates}</span>
          </button>
          <button
            type="button"
            className="toolbar-chip compact"
            onClick={() => setRangeIndex((currentIndex) => cycleIndex(currentIndex, projectRangePresets.length))}
          >
            <span>{activeRange.label}</span>
          </button>
          <span className={`status-chip${isRefreshing ? ' refreshing' : ''}`}>
            {isRefreshing ? 'Refreshing live data' : 'Live data'}
          </span>
        </div>
      }
      header={
        <>
          <section className="project-hero-panel">
            <div className="project-hero-title">
              <div className="project-avatar">
                <AppIcon name={project.icon} />
              </div>
              <div>
                <h1>{project.name}</h1>
                <p>{project.domain}</p>
              </div>
              <span className="project-status">{project.status}</span>
            </div>
            <Link to={`/projects/${project.slug}/settings`} className="secondary-button">
              Project Settings
            </Link>
          </section>

          <nav className="project-tabs" aria-label="Project tabs">
            <NavLink to={`/projects/${project.slug}`} end>
              Overview
            </NavLink>
            <NavLink to={`/projects/${project.slug}/pages`}>Pages</NavLink>
            <NavLink to={`/projects/${project.slug}/events`}>Events</NavLink>
            <NavLink to={`/projects/${project.slug}/conversions`}>Conversions</NavLink>
            <NavLink to={`/projects/${project.slug}/settings`}>Settings</NavLink>
          </nav>
        </>
      }
    >
      {error && data ? (
        <DataStateCard
          title="Live refresh interrupted"
          message={`${error} The project overview is still showing the last successful response.`}
          tone="warning"
        />
      ) : null}

      {isLoading && !data ? (
        <DataStateCard
          title={`Loading ${project.name}`}
          message="Pulse is requesting the current project overview from the analytics API."
        />
      ) : null}

      {!isLoading && error && !data ? (
        <DataStateCard
          title={`Could not load ${project.name}`}
          message={error}
          tone="error"
        />
      ) : null}

      {!isLoading && !error && data && !hasData ? (
        <DataStateCard
          title={`No analytics for ${project.name}`}
          message={`No tracked activity was returned for ${project.name} in ${formatAnalyticsRangeLabel(data.range)}.`}
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
                <h2>Top Pages</h2>
                <Link to={`/projects/${project.slug}/pages`} className="panel-link">
                  View all
                </Link>
              </div>
              {data.topPages.length > 0 ? (
                <div className="mini-table-list">
                  {data.topPages.map((row) => (
                    <Link key={row.label} to={projectPagesReportLink} className="mini-table-row interactive-row">
                      <span>{row.label}</span>
                      <strong>{formatCount(row.value)}</strong>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="empty-list-copy">No project pages were recorded in this range.</p>
              )}
            </section>
          </section>

          <section className="project-detail-grid">
            <section className="data-panel">
              <div className="panel-head">
                <h2>Top Referrers</h2>
                <Link to={projectReferrersReportLink} className="panel-link">
                  View all
                </Link>
              </div>
              {data.topReferrers.length > 0 ? (
                <div className="mini-table-list">
                  {data.topReferrers.map((row) => (
                    <Link key={row.label} to={projectReferrersReportLink} className="mini-table-row interactive-row">
                      <span>{row.label}</span>
                      <strong>{formatCount(row.value)}</strong>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="empty-list-copy">No project referrers were recorded in this range.</p>
              )}
            </section>

            <section className="data-panel">
              <div className="panel-head">
                <h2>Events</h2>
                <Link to={`/projects/${project.slug}/events`} className="panel-link">
                  View all
                </Link>
              </div>
              {data.eventTable.length > 0 ? (
                <div className="mini-table-list">
                  {data.eventTable.map((row) => (
                    <Link
                      key={row.label}
                      to={`/projects/${getProjectSlug(data.project.projectId)}/events`}
                      className="mini-table-row interactive-row"
                    >
                      <span>{row.label}</span>
                      <strong>{formatCount(row.value)}</strong>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="empty-list-copy">No project events were recorded in this range.</p>
              )}
            </section>

            <section className="data-panel">
              <div className="panel-head">
                <h2>Top Countries</h2>
                <a href={STATUS_URL} className="panel-link">
                  Regional context
                </a>
              </div>

              <div className="country-panel">
                <svg viewBox="0 0 290 150" className="world-map-svg" aria-hidden="true">
                  <path d="M28 58h48l16-18 34 8 18-10 28 14 18-8 24 14 28-4 20 8v18l-18 12-34 4-12 20-42 6-18-14-26-2-12-14-26-10-16-18Z" />
                  <path d="M200 92h30l12 10-10 16h-28l-10-10Z" />
                  <circle cx="154" cy="66" r="5" className="world-map-highlight" />
                </svg>

                {data.countryMix.length > 0 ? (
                  <div className="legend-list">
                    {data.countryMix.map((country) => (
                      <div key={country.label} className="legend-row">
                        <span>{country.label}</span>
                        <strong>{formatBreakdownShare(country.share)}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="empty-list-copy">No country mix is available for this range.</p>
                )}
              </div>
            </section>
          </section>
        </>
      ) : null}
    </ProductShell>
  )
}
