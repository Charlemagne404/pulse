import { Link, NavLink, Navigate, useParams } from 'react-router-dom'
import { DataStateCard } from '../components/DataStateCard'
import { AppIcon } from '../components/Icon'
import { ProductShell } from '../components/ProductShell'
import { ProgressList } from '../components/ProgressList'
import { projectConversionBySlug, projectDirectory, projectSettingsBySlug } from '../data/content'
import { useAnalyticsQuery } from '../hooks/useAnalyticsQuery'
import { fetchProjectOverview } from '../lib/analyticsApi'
import { formatCount } from '../lib/analyticsUi'

interface ProjectSectionPageProps {
  sectionKey: 'pages' | 'events' | 'conversions' | 'settings'
}

const sectionLabels = {
  pages: 'Pages',
  events: 'Events',
  conversions: 'Conversions',
  settings: 'Settings',
} as const

export function ProjectSectionPage({ sectionKey }: ProjectSectionPageProps) {
  const { projectSlug = 'aegis' } = useParams()
  const project = projectDirectory.find((item) => item.slug === projectSlug)
  const usesLiveOverview = sectionKey === 'pages' || sectionKey === 'events'
  const { data, error, isLoading, isRefreshing } = useAnalyticsQuery(
    `project-section:${projectSlug}:${sectionKey}`,
    (signal) => (usesLiveOverview ? fetchProjectOverview(projectSlug, {}, signal) : Promise.resolve(null)),
  )

  if (!project) {
    return <Navigate to="/projects" replace />
  }

  return (
    <ProductShell
      activeItem="projects"
      pageTitle={<div className="page-breadcrumbs">Projects &gt; {project.name}</div>}
      toolbar={
        <div className="toolbar-cluster">
          <Link to="/docs" className="secondary-button">
            Project Docs
          </Link>
          <Link to="/help" className="secondary-button">
            Help
          </Link>
          {usesLiveOverview ? (
            <span className={`status-chip${isRefreshing ? ' refreshing' : ''}`}>
              {isRefreshing ? 'Refreshing live data' : 'Live data'}
            </span>
          ) : null}
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
      <section className="data-panel page-intro-panel">
        <div>
          <h2>{sectionLabels[sectionKey]}</h2>
          <p>{buildSectionIntro(sectionKey, project.name)}</p>
        </div>
        <Link to="/reports" className="secondary-button">
          Workspace Reports
        </Link>
      </section>

      {sectionKey === 'pages' && error && !data ? (
        <DataStateCard
          title={`Could not load ${project.name} pages`}
          message={error}
          tone="error"
        />
      ) : null}

      {sectionKey === 'pages' && isLoading && !data ? (
        <DataStateCard
          title={`Loading ${project.name} pages`}
          message="Pulse is requesting the current page breakdown for this project."
        />
      ) : null}

      {sectionKey === 'pages' && data ? (
        <section className="data-panel">
          <div className="panel-head">
            <h2>Top pages</h2>
            <Link to={`/reports/pages?projectId=${encodeURIComponent(project.slug)}`} className="panel-link">
              Content report
            </Link>
          </div>
          {data.topPages.length > 0 ? (
            <div className="mini-table-list">
              {data.topPages.map((row) => (
                <div key={row.label} className="mini-table-row">
                  <span>{row.label}</span>
                  <strong>{formatCount(row.value)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-list-copy">No project pages were returned yet.</p>
          )}
        </section>
      ) : null}

      {sectionKey === 'events' && error && !data ? (
        <DataStateCard
          title={`Could not load ${project.name} events`}
          message={error}
          tone="error"
        />
      ) : null}

      {sectionKey === 'events' && isLoading && !data ? (
        <DataStateCard
          title={`Loading ${project.name} events`}
          message="Pulse is requesting the current event mix for this project."
        />
      ) : null}

      {sectionKey === 'events' && data ? (
        <section className="data-panel">
          <div className="panel-head">
            <h2>Tracked events</h2>
            <Link to="/events" className="panel-link">
              Event catalog
            </Link>
          </div>
          {data.eventTable.length > 0 ? (
            <div className="mini-table-list">
              {data.eventTable.map((row) => (
                <div key={row.label} className="mini-table-row">
                  <span>{row.label}</span>
                  <strong>{formatCount(row.value)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-list-copy">No project events were returned yet.</p>
          )}
        </section>
      ) : null}

      {sectionKey === 'conversions' ? (
        <section className="data-panel">
          <div className="panel-head">
            <h2>Primary conversion paths</h2>
            <Link to="/help" className="panel-link">
              Validation checklist
            </Link>
          </div>
          <ProgressList items={projectConversionBySlug[project.slug]} />
        </section>
      ) : null}

      {sectionKey === 'settings' ? (
        <section className="content-section-grid">
          {projectSettingsBySlug[project.slug].map((section) => (
            <article key={section.title} className="data-panel content-section-card">
              <h2>{section.title}</h2>
              <p>{section.body}</p>
              <ul className="content-bullet-list">
                {section.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </article>
          ))}
        </section>
      ) : null}
    </ProductShell>
  )
}

function buildSectionIntro(sectionKey: ProjectSectionPageProps['sectionKey'], projectName: string) {
  if (sectionKey === 'pages') {
    return `Review the strongest landing and help content for ${projectName}, then compare the results with the workspace-level content report.`
  }

  if (sectionKey === 'events') {
    return `See the current event mix for ${projectName}, including the interactions most useful for setup validation and conversion review.`
  }

  if (sectionKey === 'conversions') {
    return `Track the primary conversion moments defined for ${projectName} and compare which journeys are producing the strongest follow-through.`
  }

  return `Check the configuration and reporting defaults that control how ${projectName} is measured and reviewed.`
}
