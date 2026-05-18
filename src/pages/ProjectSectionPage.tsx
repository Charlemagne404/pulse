import { Link, NavLink, useParams } from 'react-router-dom'
import { DataStateCard } from '../components/DataStateCard'
import { AppIcon } from '../components/Icon'
import { ProductShell } from '../components/ProductShell'
import { ProgressList, type ProgressItem } from '../components/ProgressList'
import { useAnalyticsQuery } from '../hooks/useAnalyticsQuery'
import { fetchProjectOverview } from '../lib/analyticsApi'
import { formatCount, formatTimestampLabel, getProjectName } from '../lib/analyticsUi'
import { fetchWorkspaceSettings, type WorkspaceProjectSetting } from '../lib/productApi'

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
  const { projectSlug = '' } = useParams()
  const usesLiveOverview = sectionKey === 'pages' || sectionKey === 'events' || sectionKey === 'conversions'
  const { data, error, isLoading, isRefreshing } = useAnalyticsQuery(
    `project-section:${projectSlug}:${sectionKey}`,
    (signal) => (usesLiveOverview ? fetchProjectOverview(projectSlug, {}, signal) : Promise.resolve(null)),
  )
  const settingsQuery = useAnalyticsQuery(
    `project-settings:${projectSlug}`,
    (signal) => (sectionKey === 'settings' ? fetchWorkspaceSettings(signal) : Promise.resolve(null)),
  )
  const projectName = data?.project.projectName || getProjectName(projectSlug)
  const projectSetting = settingsQuery.data?.projects.find((project) => project.projectId === projectSlug) || null
  const conversionItems = buildConversionItems(data?.eventTable || [])
  const settingsSections = buildProjectSettingsSections(projectSlug, projectSetting)

  return (
    <ProductShell
      activeItem="projects"
      pageTitle={<div className="page-breadcrumbs">Projects &gt; {projectName}</div>}
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
                <AppIcon name="projects" />
              </div>
              <div>
                <h1>{projectName}</h1>
                <p>Project ID: {projectSlug}</p>
              </div>
              <span className="project-status">{projectSetting?.status === 'live' ? 'Live' : 'No recent events'}</span>
            </div>
            <Link to={`/projects/${projectSlug}/settings`} className="secondary-button">
              Project Settings
            </Link>
          </section>

          <nav className="project-tabs" aria-label="Project tabs">
            <NavLink to={`/projects/${projectSlug}`} end>
              Overview
            </NavLink>
            <NavLink to={`/projects/${projectSlug}/pages`}>Pages</NavLink>
            <NavLink to={`/projects/${projectSlug}/events`}>Events</NavLink>
            <NavLink to={`/projects/${projectSlug}/conversions`}>Conversions</NavLink>
            <NavLink to={`/projects/${projectSlug}/settings`}>Settings</NavLink>
          </nav>
        </>
      }
    >
      <section className="data-panel page-intro-panel">
        <div>
          <h2>{sectionLabels[sectionKey]}</h2>
          <p>{buildSectionIntro(sectionKey, projectName)}</p>
        </div>
        <Link to="/reports" className="secondary-button">
          Workspace Reports
        </Link>
      </section>

      {sectionKey === 'pages' && error && !data ? (
        <DataStateCard
          title={`Could not load ${projectName} pages`}
          message={error}
          tone="error"
        />
      ) : null}

      {sectionKey === 'pages' && isLoading && !data ? (
        <DataStateCard
          title={`Loading ${projectName} pages`}
          message="Pulse is requesting the current page breakdown for this project."
        />
      ) : null}

      {sectionKey === 'pages' && data ? (
        <section className="data-panel">
          <div className="panel-head">
            <h2>Top pages</h2>
            <Link to={`/reports/pages?projectId=${encodeURIComponent(projectSlug)}`} className="panel-link">
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
          title={`Could not load ${projectName} events`}
          message={error}
          tone="error"
        />
      ) : null}

      {sectionKey === 'events' && isLoading && !data ? (
        <DataStateCard
          title={`Loading ${projectName} events`}
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
            <h2>Tracked conversion signals</h2>
            <Link to="/help" className="panel-link">
              Validation checklist
            </Link>
          </div>
          {conversionItems.length > 0 ? (
            <ProgressList items={conversionItems} />
          ) : (
            <p className="empty-list-copy">No tracked event signals are available for this project yet.</p>
          )}
        </section>
      ) : null}

      {sectionKey === 'settings' ? (
        <section className="content-section-grid">
          {settingsSections.map((section) => (
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
    return `Review the highest-volume tracked events for ${projectName} to confirm the project is emitting the conversion signals you expect.`
  }

  return `Check the current workspace-level settings that apply to ${projectName}, including retention and recent collection activity.`
}

function buildConversionItems(eventTable: Array<{ label: string; value: number }>): ProgressItem[] {
  const highestValue = Math.max(...eventTable.map((row) => row.value), 0)

  return eventTable.slice(0, 5).map((row) => ({
    label: row.label,
    value: formatCount(row.value),
    detail: 'Recent event volume for this project.',
    share: highestValue > 0 ? Math.max(8, Math.round((row.value / highestValue) * 100)) : 0,
  }))
}

function buildProjectSettingsSections(projectId: string, project: WorkspaceProjectSetting | null) {
  return [
    {
      title: 'Project identity',
      body: 'This project is referenced by its configured identifier throughout collection, reporting, and filtering.',
      bullets: [`Project ID: ${projectId}`, `Label: ${project?.projectName || getProjectName(projectId)}`, 'Project-specific presentation metadata is not seeded by default'],
    },
    {
      title: 'Retention and activity',
      body: 'Retention is managed at the workspace level in MVP, so every project follows the same retention setting.',
      bullets: [
        `Retention: ${project ? `${project.retentionMonths} months` : 'Not available'}`,
        `Status: ${project ? (project.status === 'live' ? 'Receiving recent events' : 'No recent events') : 'Not available'}`,
        `Last event: ${project ? formatTimestampLabel(project.lastEventAt) : 'Not available'}`,
      ],
    },
  ]
}
