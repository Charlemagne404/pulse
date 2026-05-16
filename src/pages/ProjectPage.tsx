import { Link } from 'react-router-dom'
import { AppIcon } from '../components/Icon'
import { LineChart } from '../components/LineChart'
import { MetricCard } from '../components/MetricCard'
import { ProductShell } from '../components/ProductShell'
import {
  projectCountryMix,
  projectEventTable,
  projectMetrics,
  projectReferrers,
  projectSeries,
  projectTopPages,
} from '../data/mockData'

export function ProjectPage() {
  return (
    <ProductShell
      activeItem="projects"
      pageTitle={<div className="page-breadcrumbs">Projects &gt; Aegis</div>}
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
      header={
        <>
          <section className="project-hero-panel">
            <div className="project-hero-title">
              <div className="project-avatar">
                <AppIcon name="shield" />
              </div>
              <div>
                <h1>Aegis</h1>
                <p>https://aegis.continental.com</p>
              </div>
              <span className="project-status">Active</span>
            </div>
            <button className="secondary-button">Project Settings</button>
          </section>

          <nav className="project-tabs" aria-label="Project tabs">
            <a href="#overview" className="active">
              Overview
            </a>
            <a href="#pages">Pages</a>
            <a href="#events">Events</a>
            <a href="#conversions">Conversions</a>
            <a href="#settings">Settings</a>
          </nav>
        </>
      }
    >
      <section className="metric-strip five-up">
        {projectMetrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} compact />
        ))}
      </section>

      <section className="dashboard-layout-primary">
        <section className="data-panel chart-panel">
          <div className="panel-head">
            <h2>Visits Over Time</h2>
            <button className="toolbar-chip compact">Day</button>
          </div>
          <LineChart data={projectSeries} />
        </section>

        <section className="data-panel">
          <div className="panel-head">
            <h2>Top Pages</h2>
            <button className="panel-link">View all</button>
          </div>
          <div className="mini-table-list">
            {projectTopPages.map((row) => (
              <div key={row.label} className="mini-table-row">
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
        </section>
      </section>

      <section className="project-detail-grid">
        <section className="data-panel">
          <div className="panel-head">
            <h2>Top Referrers</h2>
            <button className="panel-link">View all</button>
          </div>
          <div className="mini-table-list">
            {projectReferrers.map((row) => (
              <div key={row.label} className="mini-table-row">
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="data-panel">
          <div className="panel-head">
            <h2>Events</h2>
            <button className="panel-link">View all</button>
          </div>
          <div className="mini-table-list">
            {projectEventTable.map((row) => (
              <div key={row.event} className="mini-table-row">
                <span>{row.event}</span>
                <strong>{row.count}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="data-panel">
          <div className="panel-head">
            <h2>Top Countries</h2>
          </div>

          <div className="country-panel">
            <svg viewBox="0 0 290 150" className="world-map-svg" aria-hidden="true">
              <path d="M28 58h48l16-18 34 8 18-10 28 14 18-8 24 14 28-4 20 8v18l-18 12-34 4-12 20-42 6-18-14-26-2-12-14-26-10-16-18Z" />
              <path d="M200 92h30l12 10-10 16h-28l-10-10Z" />
              <circle cx="154" cy="66" r="5" className="world-map-highlight" />
            </svg>

            <div className="legend-list">
              {projectCountryMix.map((country) => (
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
