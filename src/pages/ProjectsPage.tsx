import { Link } from 'react-router-dom'
import { DataStateCard } from '../components/DataStateCard'
import { AppIcon } from '../components/Icon'
import { ProductShell } from '../components/ProductShell'
import { projectDirectory } from '../data/content'
import { useAnalyticsQuery } from '../hooks/useAnalyticsQuery'
import { fetchProjectOverview, type AnalyticsMetric } from '../lib/analyticsApi'
import { formatCount, formatMetricValue, formatTimestampLabel } from '../lib/analyticsUi'
import { fetchWorkspaceSettings } from '../lib/productApi'

const projectChromeById = new Map(projectDirectory.map((project) => [project.slug, project]))

const getMetric = (metrics: AnalyticsMetric[], key: string) => metrics.find((metric) => metric.key === key)

export function ProjectsPage() {
  const { data, error, isLoading, isRefreshing } = useAnalyticsQuery('projects:index', async (signal) => {
    const workspace = await fetchWorkspaceSettings(signal)
    const projects = await Promise.all(
      workspace.projects.map(async (project) => {
        const overview = await fetchProjectOverview(project.projectId, {}, signal)

        return {
          ...project,
          chrome: projectChromeById.get(project.projectId),
          pageViews: formatMetricValue(
            getMetric(overview.metrics, 'page_views') || {
              key: 'page_views',
              label: 'Page Views',
              value: 0,
              unit: 'count',
            },
          ),
          uniqueVisitors: formatMetricValue(
            getMetric(overview.metrics, 'unique_visitors') || {
              key: 'unique_visitors',
              label: 'Unique Visitors',
              value: 0,
              unit: 'count',
            },
          ),
          liveVisitors: formatMetricValue(
            getMetric(overview.metrics, 'live_visitors') || {
              key: 'live_visitors',
              label: 'Live Visitors',
              value: 0,
              unit: 'count',
            },
          ),
        }
      }),
    )

    return {
      workspace,
      projects,
    }
  })

  return (
    <ProductShell
      activeItem="projects"
      pageTitle={<h1>Projects</h1>}
      toolbar={
        <div className="toolbar-cluster">
          <Link to="/docs" className="secondary-button">
            Setup Docs
          </Link>
          <span className={`status-chip${isRefreshing ? ' refreshing' : ''}`}>
            {isRefreshing ? 'Refreshing live data' : 'Live data'}
          </span>
        </div>
      }
    >
      <section className="data-panel page-intro-panel">
        <div>
          <h2>Workspace portfolio</h2>
          <p>
            {data
              ? `${data.workspace.workspace.name} currently tracks ${formatCount(data.projects.length)} configured projects with live portfolio metrics and retention visibility.`
              : 'Open an individual project to review traffic, event coverage, and project-specific reporting and settings.'}
          </p>
        </div>
        <Link to="/docs" className="secondary-button">
          Setup Docs
        </Link>
      </section>

      {error && data ? (
        <DataStateCard
          title="Live refresh interrupted"
          message={`${error} The projects directory is still showing the last successful response.`}
          tone="warning"
        />
      ) : null}

      {isLoading && !data ? (
        <DataStateCard
          title="Loading projects"
          message="Pulse is requesting the current workspace settings and project summaries."
        />
      ) : null}

      {!isLoading && error && !data ? (
        <DataStateCard title="Could not load projects" message={error} tone="error" />
      ) : null}

      {data ? (
        <section className="project-card-grid">
          {data.projects.map((project) => {
            const chrome = project.chrome
            const projectSlug = chrome?.slug || project.projectId

            return (
              <article key={project.projectId} className="data-panel project-directory-card">
                <div className="project-directory-head">
                  <div className="project-avatar">
                    <AppIcon name={chrome?.icon || 'projects'} />
                  </div>
                  <div>
                    <h2>{chrome?.name || project.projectName}</h2>
                    <p>{chrome?.domain || `Project ID: ${project.projectId}`}</p>
                  </div>
                  <span className="project-status">{chrome?.status || (project.status === 'live' ? 'Live' : 'Idle')}</span>
                </div>

                <div className="project-directory-meta">
                  <div>
                    <span>Owner</span>
                    <strong>{chrome?.owner || 'Workspace owner'}</strong>
                  </div>
                  <div>
                    <span>Region</span>
                    <strong>{chrome?.region || 'Global'}</strong>
                  </div>
                  <div>
                    <span>Page views</span>
                    <strong>{project.pageViews}</strong>
                  </div>
                  <div>
                    <span>Visitors</span>
                    <strong>{project.uniqueVisitors}</strong>
                  </div>
                  <div>
                    <span>Live visitors</span>
                    <strong>{project.liveVisitors}</strong>
                  </div>
                  <div>
                    <span>Retention</span>
                    <strong>{project.retentionMonths} mo</strong>
                  </div>
                </div>

                <p>
                  Last event {formatTimestampLabel(project.lastEventAt)}.{' '}
                  {chrome?.note || 'Open the project to review live traffic, content, and referrer behavior.'}
                </p>

                <div className="project-directory-actions">
                  <Link to={`/projects/${projectSlug}`} className="primary-button gold">
                    Open Project
                  </Link>
                  <Link to={`/projects/${projectSlug}/settings`} className="secondary-button">
                    Project Settings
                  </Link>
                </div>
              </article>
            )
          })}
        </section>
      ) : null}
    </ProductShell>
  )
}
