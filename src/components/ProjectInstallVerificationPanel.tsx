import { useEffect, useState } from 'react'
import { DataStateCard } from './DataStateCard'
import { useAnalyticsQuery } from '../hooks/useAnalyticsQuery'
import { formatCountryCode, formatDeviceLabel, formatTimestampLabel } from '../lib/analyticsUi'
import { fetchProjectVerification } from '../lib/productApi'

interface ProjectInstallVerificationPanelProps {
  projectId: string
  title?: string
  description?: string
  compact?: boolean
  autoRefresh?: boolean
}

const checkStatusLabel = {
  pass: 'Passing',
  warn: 'Needs review',
  fail: 'Missing',
} as const

export function ProjectInstallVerificationPanel({
  projectId,
  title = 'Install verification',
  description = 'Pulse checks the first page view, consent signal, and recent collector health for this project.',
  compact = false,
  autoRefresh = false,
}: ProjectInstallVerificationPanelProps) {
  const [refreshNonce, setRefreshNonce] = useState(0)
  const { data, error, isLoading, isRefreshing } = useAnalyticsQuery(
    `project-verification:${projectId}:${refreshNonce}`,
    (signal) => fetchProjectVerification(projectId, signal),
  )

  useEffect(() => {
    if (!autoRefresh) {
      return
    }

    const timer = window.setInterval(() => {
      setRefreshNonce((current) => current + 1)
    }, 15_000)

    return () => window.clearInterval(timer)
  }, [autoRefresh])

  return (
    <section className="data-panel verification-panel">
      <div className="panel-head verification-panel-head">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <div className="verification-panel-actions">
          <span className={`status-chip${isRefreshing ? ' refreshing' : ''}`}>
            {isRefreshing ? 'Refreshing' : autoRefresh ? 'Auto refresh on' : 'Manual refresh'}
          </span>
          <button
            type="button"
            className="secondary-button"
            onClick={() => setRefreshNonce((current) => current + 1)}
          >
            Check again
          </button>
        </div>
      </div>

      {isLoading && !data ? (
        <DataStateCard
          title="Loading verification"
          message="Pulse is checking recent accepted and rejected traffic for this project."
        />
      ) : null}

      {!isLoading && error && !data ? (
        <DataStateCard title="Could not load verification" message={error} tone="error" />
      ) : null}

      {error && data ? (
        <DataStateCard
          title="Verification refresh interrupted"
          message={`${error} The panel is still showing the last successful result.`}
          tone="warning"
        />
      ) : null}

      {data ? (
        <>
          <div className="verification-summary-grid">
            <article className="verification-summary-card">
              <span>Script</span>
              <strong>{data.summary.scriptInstalled ? 'Installed' : 'Not confirmed'}</strong>
              <p>
                {data.summary.lastPageViewAt
                  ? `Last page view ${formatTimestampLabel(data.summary.lastPageViewAt)}`
                  : 'No accepted page_view yet'}
              </p>
            </article>
            <article className="verification-summary-card">
              <span>Project ID</span>
              <strong>{data.summary.projectIdValid ? 'Valid' : 'Missing'}</strong>
              <p>{data.project.projectId}</p>
            </article>
            <article className="verification-summary-card">
              <span>Last accepted event</span>
              <strong>{data.summary.lastEventAt ? formatTimestampLabel(data.summary.lastEventAt) : 'None yet'}</strong>
              <p>{data.recentAcceptedEvents[0]?.eventName || 'Waiting for first accepted event'}</p>
            </article>
            <article className="verification-summary-card">
              <span>Consent</span>
              <strong>{data.summary.latestConsentState || 'Not seen'}</strong>
              <p>{data.summary.latestConsentMode ? `${data.summary.latestConsentMode} mode` : 'No consent signal yet'}</p>
            </article>
          </div>

          <div className="verification-check-grid">
            {data.checks.map((check) => (
              <article key={check.key} className={`verification-check-card status-${check.status}`}>
                <div className="verification-check-head">
                  <h4>{check.label}</h4>
                  <span className="country-pill">{checkStatusLabel[check.status]}</span>
                </div>
                <p>{check.detail}</p>
              </article>
            ))}
          </div>

          <div className={`verification-detail-grid${compact ? ' compact' : ''}`}>
            <article className="verification-detail-card">
              <div className="panel-head">
                <h4>Recent accepted signals</h4>
              </div>
              {data.recentAcceptedEvents.length > 0 ? (
                <div className="mini-table-list">
                  {data.recentAcceptedEvents.map((event) => (
                    <article key={event.eventId} className="mini-table-row report-detail-row">
                      <span className="table-event-pill">{event.eventName}</span>
                      <div>
                        <strong>{event.path}</strong>
                        <p>
                          {formatTimestampLabel(event.occurredAt)} · {formatDeviceLabel(event.deviceType)} ·{' '}
                          {formatCountryCode(event.countryCode)}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="empty-list-copy">No accepted signals have been recorded for this project yet.</p>
              )}
            </article>

            <article className="verification-detail-card">
              <div className="panel-head">
                <h4>Recent collector issues</h4>
              </div>
              {data.recentRejectedEvents.length > 0 ? (
                <div className="mini-table-list">
                  {data.recentRejectedEvents.map((event) => (
                    <article key={event.rejectionId} className="mini-table-row report-detail-row">
                      <span className="country-pill">{event.field || 'Collector'}</span>
                      <div>
                        <strong>{event.reason}</strong>
                        <p>
                          {formatTimestampLabel(event.receivedAt)}
                          {event.eventName ? ` · ${event.eventName}` : ''}
                          {event.path ? ` · ${event.path}` : ''}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="empty-list-copy">No recent collector issues were linked to this project.</p>
              )}
            </article>
          </div>

          <article className="verification-detail-card">
            <div className="panel-head">
              <h4>Common setup mistakes</h4>
            </div>
            <div className="resource-card-grid verification-recommendation-grid">
              {data.recommendations.map((recommendation) => (
                <article key={recommendation.title} className="resource-card verification-recommendation-card">
                  <h4>{recommendation.title}</h4>
                  <p>{recommendation.detail}</p>
                </article>
              ))}
            </div>
          </article>
        </>
      ) : null}
    </section>
  )
}
