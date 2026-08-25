import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DataStateCard } from '../components/DataStateCard'
import { ProductShell } from '../components/ProductShell'
import { reportLibrary } from '../data/content'
import { useAnalyticsQuery } from '../hooks/useAnalyticsQuery'
import { fetchOverviewAnalytics, fetchPagesReport, fetchReferrersReport } from '../lib/analyticsApi'
import { createManualExport, downloadExport, fetchExports, type ExportReportSlug } from '../lib/productApi'
import {
  formatAnalyticsRangeLabel,
  formatBreakdownShare,
  formatCount,
  formatTimestampLabel,
} from '../lib/analyticsUi'
import { buildAnalyticsRangePresets } from '../lib/demoDates'

const defaultAnalyticsRange = buildAnalyticsRangePresets()[0]

export function ReportsPage() {
  const [exportState, setExportState] = useState<{ slug: ExportReportSlug | null; message: string; working: boolean }>({
    slug: null,
    message: '',
    working: false,
  })
  const { data, error, isLoading, isRefreshing } = useAnalyticsQuery(
    'reports:index',
    async (signal) => {
      const range = {
        from: defaultAnalyticsRange.from,
        to: defaultAnalyticsRange.to,
        granularity: 'day' as const,
      }
      const [overview, pagesReport, referrersReport, exports] = await Promise.all([
        fetchOverviewAnalytics(range, signal),
        fetchPagesReport(range, signal),
        fetchReferrersReport(range, signal),
        fetchExports(signal),
      ])

      return { overview, pagesReport, referrersReport, exports }
    },
  )

  const handleManualExport = async (reportSlug: ExportReportSlug) => {
    setExportState({ slug: reportSlug, message: '', working: true })

    try {
      const run = await createManualExport({
        reportSlug,
        format: 'csv',
        from: defaultAnalyticsRange.from,
        to: defaultAnalyticsRange.to,
        granularity: 'day',
      })
      const artifact = await downloadExport(run.id)
      const objectUrl = URL.createObjectURL(artifact.blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = artifact.fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
      setExportState({ slug: reportSlug, message: 'CSV downloaded.', working: false })
    } catch (exportError) {
      setExportState({
        slug: reportSlug,
        message: exportError instanceof Error ? exportError.message : 'The CSV export could not be generated.',
        working: false,
      })
    }
  }

  return (
    <ProductShell
      activeItem="reports"
      pageTitle={<h1>Reports</h1>}
      toolbar={
        <div className="toolbar-cluster">
          <Link to="/reports/pages" className="secondary-button">
            Content Report
          </Link>
          <Link to="/reports/referrers" className="secondary-button">
            Referrer Report
          </Link>
          <span className={`status-chip${isRefreshing ? ' refreshing' : ''}`}>
            {isRefreshing ? 'Refreshing live data' : 'Live data'}
          </span>
        </div>
      }
    >
      <section className="data-panel page-intro-panel">
        <div>
          <h2>Ready-to-share reporting surfaces</h2>
          <p>
            {data
              ? `Use the current workspace rollups from ${formatAnalyticsRangeLabel(data.overview.range)} for self-serve reviews, then open the deeper report pages for content and acquisition analysis.`
              : 'Use the executive rollup for recurring reviews, then open the deeper report pages for content and acquisition analysis.'}
          </p>
        </div>
        <Link to="/dashboard" className="secondary-button">
          Back to Overview
        </Link>
      </section>

      {error && data ? (
        <DataStateCard
          title="Live refresh interrupted"
          message={`${error} The reports index is still showing the last successful response.`}
          tone="warning"
        />
      ) : null}

      {isLoading && !data ? (
        <DataStateCard
          title="Loading report summaries"
          message="Pulse is requesting the current dashboard, content, and referrer reports."
        />
      ) : null}

      {!isLoading && error && !data ? (
        <DataStateCard
          title="Could not load report summaries"
          message={error}
          tone="error"
        />
      ) : null}

      <section className="resource-card-grid">
        {reportLibrary.map((report) => (
          <article key={report.slug} className="data-panel resource-card">
            <h2>{report.title}</h2>
            <p>{report.description}</p>
            {data ? (
              <div className="resource-card-meta">
                {report.slug === 'executive'
                  ? `${data.overview.totals.trackedProjects} tracked projects · ${formatCount(data.overview.totals.acceptedEvents)} accepted events`
                  : null}
                {report.slug === 'pages'
                  ? `${formatCount(data.pagesReport.trackedPages)} tracked pages · ${formatBreakdownShare(data.pagesReport.averageExitRate)} avg. exit rate`
                  : null}
                {report.slug === 'referrers'
                  ? `${formatCount(data.referrersReport.trackedReferrers)} tracked referrers · ${formatBreakdownShare(data.referrersReport.ownedShare)} owned share`
                  : null}
              </div>
            ) : null}
            <Link to={report.to} className="primary-button gold">
              Open Report
            </Link>
            <button
              type="button"
              className="secondary-button"
              disabled={exportState.working}
              onClick={() => void handleManualExport(report.slug as ExportReportSlug)}
            >
              {exportState.working && exportState.slug === report.slug ? 'Preparing CSV…' : 'Download CSV'}
            </button>
          </article>
        ))}
      </section>

      {exportState.message ? (
        <DataStateCard
          title={exportState.message === 'CSV downloaded.' ? 'Export ready' : 'Export could not be created'}
          message={exportState.message}
          tone={exportState.message === 'CSV downloaded.' ? 'neutral' : 'warning'}
        />
      ) : null}

      <section className="data-panel page-intro-panel">
        <div>
          <h2>Export pipeline</h2>
          <p>
            {data
              ? `${formatCount(data.exports.summary.scheduledExports)} scheduled export flows are configured. ${data.exports.summary.delayedExports > 0 ? `${formatCount(data.exports.summary.delayedExports)} are delayed while rollups catch up.` : 'The export queue is current.'}`
              : 'Scheduled PDF summaries and manual CSV exports appear here once the export pipeline loads.'}
          </p>
        </div>
        <Link to="/alerts" className="secondary-button">
          Review Alerts
        </Link>
      </section>

      {data ? (
        <section className="resource-card-grid">
          {data.exports.schedules.map((schedule) => (
            <article key={schedule.id} className="data-panel resource-card">
              <span className="country-pill">{schedule.status === 'delayed' ? 'Delayed' : 'On schedule'}</span>
              <h2>{schedule.name}</h2>
              <p>{schedule.detail}</p>
              <p className="resource-card-meta">
                {schedule.cadence === 'weekly' ? 'Weekly' : 'Monthly'} PDF summary · Next run {formatTimestampLabel(schedule.nextRunAt)}
              </p>
            </article>
          ))}
        </section>
      ) : null}

      {data ? (
        <section className="data-panel">
          <div className="panel-head">
            <h2>Recent export runs</h2>
            <Link to="/settings" className="panel-link">
              Export Settings
            </Link>
          </div>

          <div className="timeline-list">
            {data.exports.recentRuns.map((run) => (
              <article key={run.id} className="timeline-row">
                <span>{formatTimestampLabel(run.completedAt || run.startedAt)}</span>
                <div>
                  <strong>
                    {run.name} · {run.status}
                  </strong>
                  <p>
                    {run.detail} {run.rowCount > 0 ? `${formatCount(run.rowCount)} rows or summary blocks were included.` : ''}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </ProductShell>
  )
}
