import { Link } from 'react-router-dom'
import { DataStateCard } from '../components/DataStateCard'
import { ProductShell } from '../components/ProductShell'
import { useAnalyticsQuery } from '../hooks/useAnalyticsQuery'
import { fetchAlerts } from '../lib/productApi'
import { STATUS_URL } from '../lib/siteLinks'
import { formatCount, formatTimestampLabel } from '../lib/analyticsUi'

export function AlertsPage() {
  const { data, error, isLoading, isRefreshing } = useAnalyticsQuery('alerts:index', (signal) => fetchAlerts(signal))

  return (
    <ProductShell
      activeItem="alerts"
      pageTitle={<h1>Alerts</h1>}
      toolbar={
        <div className="toolbar-cluster">
          <a href={STATUS_URL} className="secondary-button">
            Service Status
          </a>
          <span className={`status-chip${isRefreshing ? ' refreshing' : ''}`}>
            {isRefreshing ? 'Refreshing live data' : 'Live data'}
          </span>
        </div>
      }
    >
      <section className="data-panel page-intro-panel">
        <div>
          <h2>Alert coverage</h2>
          <p>
            {data
              ? `${formatCount(data.summary.activeRules)} active rules and ${formatCount(data.summary.monitoringRules)} monitoring rules are being evaluated against live traffic, consent, export, and collection signals.`
              : 'Pulse evaluates traffic shifts, export freshness, consent changes, and collection health without requiring manual operator review.'}
          </p>
        </div>
        <Link to="/settings" className="secondary-button">
          Alert Settings
        </Link>
      </section>

      {error && data ? (
        <DataStateCard
          title="Live refresh interrupted"
          message={`${error} The alerts surface is still showing the last successful response.`}
          tone="warning"
        />
      ) : null}

      {isLoading && !data ? (
        <DataStateCard
          title="Loading alerts"
          message="Pulse is evaluating the latest alert rules against current analytics and service health."
        />
      ) : null}

      {!isLoading && error && !data ? (
        <DataStateCard title="Could not load alerts" message={error} tone="error" />
      ) : null}

      <section className="resource-card-grid">
        {data?.rules.map((rule) => (
          <article key={rule.id} className="data-panel resource-card">
            <span className="country-pill">
              {rule.status === 'active' ? 'Active' : rule.status === 'monitoring' ? 'Monitoring' : 'OK'}
            </span>
            <h2>{rule.name}</h2>
            <p>{rule.detail}</p>
            <p className="resource-card-meta">
              {rule.scopeLabel} · {rule.metricLabel} · Owner: {rule.owner}
            </p>
          </article>
        )) || null}
      </section>

      <section className="data-panel">
        <div className="panel-head">
          <h2>Recent alert activity</h2>
          <Link to="/help" className="panel-link">
            Troubleshooting
          </Link>
        </div>

        <div className="timeline-list">
          {data?.activity.map((item) => (
            <article key={`${item.occurredAt}-${item.title}`} className="timeline-row">
              <span>{formatTimestampLabel(item.occurredAt)}</span>
              <div>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </div>
            </article>
          )) || null}
        </div>
      </section>
    </ProductShell>
  )
}
