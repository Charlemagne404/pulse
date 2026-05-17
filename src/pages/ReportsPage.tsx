import { Link } from 'react-router-dom'
import { DataStateCard } from '../components/DataStateCard'
import { ProductShell } from '../components/ProductShell'
import { reportLibrary } from '../data/content'
import { useAnalyticsQuery } from '../hooks/useAnalyticsQuery'
import { fetchOverviewAnalytics, fetchPagesReport, fetchReferrersReport } from '../lib/analyticsApi'
import {
  formatAnalyticsRangeLabel,
  formatBreakdownShare,
  formatCount,
} from '../lib/analyticsUi'

export function ReportsPage() {
  const { data, error, isLoading, isRefreshing } = useAnalyticsQuery(
    'reports:index',
    async (signal) => {
      const [overview, pagesReport, referrersReport] = await Promise.all([
        fetchOverviewAnalytics({}, signal),
        fetchPagesReport({}, signal),
        fetchReferrersReport({}, signal),
      ])

      return { overview, pagesReport, referrersReport }
    },
  )

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
              ? `Use the current workspace rollups from ${formatAnalyticsRangeLabel(data.overview.range)} for review meetings, then open the deeper report pages for content and acquisition analysis.`
              : 'Use executive rollups for weekly review meetings, then open the deeper report pages for content and acquisition analysis.'}
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
          </article>
        ))}
      </section>

      <section className="data-panel page-intro-panel">
        <div>
          <h2>Weekly reporting rhythm</h2>
          <p>
            {data
              ? `Most teams review the dashboard every day, then use the ${formatCount(data.pagesReport.trackedPages)} tracked pages and ${formatCount(data.referrersReport.trackedReferrers)} tracked referrers in the deeper weekly reporting flow.`
              : 'Most teams review the dashboard every day, the report deep dives every week, and the status and alerts surfaces before major launches.'}
          </p>
        </div>
        <Link to="/alerts" className="secondary-button">
          Review Alerts
        </Link>
      </section>
    </ProductShell>
  )
}
