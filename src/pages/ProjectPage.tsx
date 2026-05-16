import { useState } from 'react'
import { Link, NavLink, Navigate, useParams } from 'react-router-dom'
import { AppIcon } from '../components/Icon'
import { LineChart } from '../components/LineChart'
import { MetricCard } from '../components/MetricCard'
import { ProductShell } from '../components/ProductShell'
import { projectDirectory, projectOverviewBySlug } from '../data/content'
import { buildSeriesForGranularity, cycleIndex, type GranularityOption } from '../lib/analytics'

const granularityOptions: GranularityOption[] = ['Day', 'Week', 'Month']

export function ProjectPage() {
  const { projectSlug = 'aegis' } = useParams()
  const project = projectDirectory.find((item) => item.slug === projectSlug)
  const overview = projectOverviewBySlug[projectSlug]
  const [rangeIndex, setRangeIndex] = useState(0)
  const [granularityIndex, setGranularityIndex] = useState(0)

  if (!project || !overview) {
    return <Navigate to="/projects" replace />
  }

  const activeRange = overview.rangePresets[rangeIndex]
  const activeGranularity = granularityOptions[granularityIndex]
  const activeSeries = buildSeriesForGranularity(activeRange.series, activeGranularity)

  return (
    <ProductShell
      activeItem="projects"
      pageTitle={<div className="page-breadcrumbs">Projects &gt; {project.name}</div>}
      toolbar={
        <div className="toolbar-cluster">
          <button
            type="button"
            className="toolbar-chip"
            onClick={() => setRangeIndex((currentIndex) => cycleIndex(currentIndex, overview.rangePresets.length))}
          >
            <AppIcon name="calendar" />
            <span>{activeRange.dates}</span>
          </button>
          <button
            type="button"
            className="toolbar-chip compact"
            onClick={() => setRangeIndex((currentIndex) => cycleIndex(currentIndex, overview.rangePresets.length))}
          >
            <span>{activeRange.label}</span>
          </button>
          <Link to="/docs" className="icon-button" aria-label="Open docs">
            ?
          </Link>
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
      <section className="metric-strip five-up">
        {overview.metrics.map((metric) => (
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
            <h2>Top Pages</h2>
            <Link to={`/projects/${project.slug}/pages`} className="panel-link">
              View all
            </Link>
          </div>
          <div className="mini-table-list">
            {overview.topPages.map((row) => (
              <Link key={row.label} to={`/projects/${project.slug}/pages`} className="mini-table-row interactive-row">
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </Link>
            ))}
          </div>
        </section>
      </section>

      <section className="project-detail-grid">
        <section className="data-panel">
          <div className="panel-head">
            <h2>Top Referrers</h2>
            <Link to="/reports/referrers" className="panel-link">
              View all
            </Link>
          </div>
          <div className="mini-table-list">
            {overview.referrers.map((row) => (
              <Link key={row.label} to="/reports/referrers" className="mini-table-row interactive-row">
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </Link>
            ))}
          </div>
        </section>

        <section className="data-panel">
          <div className="panel-head">
            <h2>Events</h2>
            <Link to={`/projects/${project.slug}/events`} className="panel-link">
              View all
            </Link>
          </div>
          <div className="mini-table-list">
            {overview.eventTable.map((row) => (
              <Link key={row.event} to={`/projects/${project.slug}/events`} className="mini-table-row interactive-row">
                <span>{row.event}</span>
                <strong>{row.count}</strong>
              </Link>
            ))}
          </div>
        </section>

        <section className="data-panel">
          <div className="panel-head">
            <h2>Top Countries</h2>
            <Link to="/status" className="panel-link">
              Regional context
            </Link>
          </div>

          <div className="country-panel">
            <svg viewBox="0 0 290 150" className="world-map-svg" aria-hidden="true">
              <path d="M28 58h48l16-18 34 8 18-10 28 14 18-8 24 14 28-4 20 8v18l-18 12-34 4-12 20-42 6-18-14-26-2-12-14-26-10-16-18Z" />
              <path d="M200 92h30l12 10-10 16h-28l-10-10Z" />
              <circle cx="154" cy="66" r="5" className="world-map-highlight" />
            </svg>

            <div className="legend-list">
              {overview.countryMix.map((country) => (
                <div key={country.label} className="legend-row">
                  <span>{country.label}</span>
                  <strong>{country.share}</strong>
                </div>
              ))}
            </div>
          </div>
        </section>
      </section>
    </ProductShell>
  )
}
