import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AddProjectDialog } from '../components/AddProjectDialog'
import { DataStateCard } from '../components/DataStateCard'
import { AppIcon } from '../components/Icon'
import { ProductShell } from '../components/ProductShell'
import { useAnalyticsQuery } from '../hooks/useAnalyticsQuery'
import { fetchProjectOverview, type AnalyticsMetric } from '../lib/analyticsApi'
import { formatCount, formatMetricValue, formatTimestampLabel } from '../lib/analyticsUi'
import { deleteProject, fetchWorkspaceSettings } from '../lib/productApi'

const getMetric = (metrics: AnalyticsMetric[], key: string) => metrics.find((metric) => metric.key === key)

export function ProjectsPage() {
  const [isAddProjectOpen, setIsAddProjectOpen] = useState(false)
  const [refreshNonce, setRefreshNonce] = useState(0)
  const [deleteProjectId, setDeleteProjectId] = useState('')
  const [actionError, setActionError] = useState('')
  const { data, error, isLoading, isRefreshing } = useAnalyticsQuery(`projects:index:${refreshNonce}`, async (signal) => {
    const workspace = await fetchWorkspaceSettings(signal)
    const projects = await Promise.all(
      workspace.projects.map(async (project) => {
        const overview = await fetchProjectOverview(project.projectId, {}, signal)

        return {
          ...project,
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

  const handleDeleteProject = async (projectId: string, projectName: string) => {
    const confirmed = window.confirm(
      `Delete ${projectName}? This removes the project and its collected analytics from Pulse.`,
    )
    if (!confirmed) {
      return
    }

    setDeleteProjectId(projectId)
    setActionError('')

    try {
      await deleteProject(projectId)
      setRefreshNonce((current) => current + 1)
    } catch (deleteError) {
      setActionError(deleteError instanceof Error ? deleteError.message : 'Could not delete the project.')
    } finally {
      setDeleteProjectId('')
    }
  }

  return (
    <ProductShell
      activeItem="projects"
      pageTitle={<h1>Projects</h1>}
      toolbar={
        <div className="toolbar-cluster">
          <button type="button" className="primary-button gold" onClick={() => setIsAddProjectOpen(true)}>
            Add Project
          </button>
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
              ? `${data.workspace.workspace.name} currently tracks ${formatCount(data.projects.length)} configured projects with live portfolio metrics and a simple install flow for new sites.`
              : 'Open an individual project to review traffic, event coverage, or generate one install script for a new site.'}
          </p>
        </div>
        <div className="page-intro-actions">
          <button type="button" className="primary-button gold" onClick={() => setIsAddProjectOpen(true)}>
            Add Project
          </button>
          <Link to="/docs" className="secondary-button">
            Setup Docs
          </Link>
        </div>
      </section>

      {error && data ? (
        <DataStateCard
          title="Live refresh interrupted"
          message={`${error} The projects directory is still showing the last successful response.`}
          tone="warning"
        />
      ) : null}

      {actionError ? <DataStateCard title="Project action failed" message={actionError} tone="error" /> : null}

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
            const projectSlug = project.projectId

            return (
              <article key={project.projectId} className="data-panel project-directory-card">
                <div className="project-directory-head">
                  <div className="project-avatar">
                    <AppIcon name="projects" />
                  </div>
                  <div>
                    <h2>{project.projectName}</h2>
                    <p>Project ID: {project.projectId}</p>
                  </div>
                  <span className="project-status">{project.status === 'live' ? 'Live' : 'Idle'}</span>
                </div>

                <div className="project-directory-meta">
                  <div>
                    <span>Status</span>
                    <strong>{project.status === 'live' ? 'Receiving events' : 'No recent events'}</strong>
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
                  Last event {formatTimestampLabel(project.lastEventAt)}. Open the project to review live traffic,
                  event coverage, and report detail.
                </p>

                <div className="project-directory-actions">
                  <Link to={`/projects/${projectSlug}`} className="primary-button gold">
                    Open Project
                  </Link>
                  <Link to={`/projects/${projectSlug}/settings`} className="secondary-button">
                    Project Settings
                  </Link>
                  <button
                    type="button"
                    className="secondary-button danger-button"
                    disabled={deleteProjectId === project.projectId}
                    onClick={() => void handleDeleteProject(project.projectId, project.projectName)}
                  >
                    {deleteProjectId === project.projectId ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </article>
            )
          })}
        </section>
      ) : null}

      {isAddProjectOpen ? (
        <AddProjectDialog
          isOpen={isAddProjectOpen}
          onClose={() => setIsAddProjectOpen(false)}
          onProjectCreated={() => setRefreshNonce((current) => current + 1)}
        />
      ) : null}
    </ProductShell>
  )
}
