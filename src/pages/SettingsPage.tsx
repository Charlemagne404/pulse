import { Link } from 'react-router-dom'
import { DataStateCard } from '../components/DataStateCard'
import { ProductShell } from '../components/ProductShell'
import { useAnalyticsQuery } from '../hooks/useAnalyticsQuery'
import { formatCount, formatTimestampLabel } from '../lib/analyticsUi'
import { fetchWorkspaceSettings } from '../lib/productApi'

export function SettingsPage() {
  const { data, error, isLoading, isRefreshing } = useAnalyticsQuery(
    'workspace:settings',
    (signal) => fetchWorkspaceSettings(signal),
  )

  return (
    <ProductShell
      activeItem="settings"
      pageTitle={<h1>Settings</h1>}
      toolbar={
        <div className="toolbar-cluster">
          <Link to="/docs" className="secondary-button">
            Setup Documentation
          </Link>
          <span className={`status-chip${isRefreshing ? ' refreshing' : ''}`}>
            {isRefreshing ? 'Refreshing live data' : 'Live data'}
          </span>
        </div>
      }
    >
      <section className="data-panel page-intro-panel">
        <div>
          <h2>Workspace controls</h2>
          <p>
            {data
              ? `${data.workspace.name} is using ${data.workspace.defaultRetentionMonths} months of default retention across ${formatCount(data.projects.length)} configured projects.`
              : 'Review workspace roles, collection defaults, retention visibility, and export controls directly in the product.'}
          </p>
        </div>
        <Link to="/help" className="secondary-button">
          Self-Serve Help
        </Link>
      </section>

      {error && data ? (
        <DataStateCard
          title="Live refresh interrupted"
          message={`${error} The settings page is still showing the last successful response.`}
          tone="warning"
        />
      ) : null}

      {isLoading && !data ? (
        <DataStateCard
          title="Loading workspace settings"
          message="Pulse is requesting the latest workspace controls, project retention settings, and operational guardrails."
        />
      ) : null}

      {!isLoading && error && !data ? (
        <DataStateCard title="Could not load workspace settings" message={error} tone="error" />
      ) : null}

      <section className="content-section-grid">
        {data?.controls.map((section) => (
          <article key={section.title} className="data-panel content-section-card">
            <h2>{section.title}</h2>
            <p>{section.body}</p>
            <ul className="content-bullet-list">
              {section.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          </article>
        )) || null}
      </section>

      {data ? (
        <section className="resource-card-grid">
          {data.roles.map((role) => (
            <article key={role.role} className="data-panel resource-card">
              <span className="country-pill">{role.role}</span>
              <h2>{role.role.charAt(0).toUpperCase() + role.role.slice(1)}</h2>
              <p>{role.can.join(' • ')}</p>
              <p className="resource-card-meta">
                {role.cannot.length > 0 ? `Restricted from: ${role.cannot.join(' • ')}` : 'Full workspace administration access.'}
              </p>
            </article>
          ))}
        </section>
      ) : null}

      {data ? (
        <section className="data-panel">
          <div className="panel-head">
            <h2>Project retention and activity</h2>
            <Link to="/projects" className="panel-link">
              Open Projects
            </Link>
          </div>

          <div className="mini-table-list">
            {data.projects.map((project) => (
              <article key={project.projectId} className="mini-table-row report-detail-row">
                <span className="country-pill">{project.status === 'live' ? 'Live' : 'Idle'}</span>
                <div>
                  <strong>{project.projectName}</strong>
                  <p>
                    {project.retentionMonths} month retention · Last event {formatTimestampLabel(project.lastEventAt)}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {data ? (
        <section className="data-panel">
          <div className="panel-head">
            <h2>Operational safeguards</h2>
            <Link to="/alerts" className="panel-link">
              Review Alerts
            </Link>
          </div>

          <div className="mini-table-list">
            <article className="mini-table-row report-detail-row">
              <strong>Collector health</strong>
              <div>
                <p>{data.operations.healthStatus === 'ok' ? 'Healthy' : 'Degraded'} service state</p>
                <p className="resource-card-meta">Last rollup {formatTimestampLabel(data.operations.lastRollupAt)}</p>
              </div>
            </article>
            <article className="mini-table-row report-detail-row">
              <strong>Rate limiting</strong>
              <div>
                <p>
                  {formatCount(data.operations.rateLimitMaxRequests)} requests every{' '}
                  {formatCount(Math.round(data.operations.rateLimitWindowMs / 1000))} seconds
                </p>
                <p className="resource-card-meta">Batch size cap {formatCount(data.operations.maxBatchSize)} events</p>
              </div>
            </article>
            <article className="mini-table-row report-detail-row">
              <strong>Request size</strong>
              <div>
                <p>{formatCount(Math.round(data.operations.maxBodyBytes / 1024))} KB JSON body limit</p>
                <p className="resource-card-meta">Retention job every {formatCount(Math.round(data.operations.retentionIntervalMs / 60_000))} minutes</p>
              </div>
            </article>
          </div>
        </section>
      ) : null}
    </ProductShell>
  )
}
