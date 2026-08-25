import { Link, useSearchParams } from 'react-router-dom'
import { DataStateCard } from '../components/DataStateCard'
import { ProductShell } from '../components/ProductShell'
import { reportDetails } from '../data/content'
import { useAnalyticsQuery } from '../hooks/useAnalyticsQuery'
import type { PagesReportResponse, ReferrersReportResponse } from '../lib/analyticsApi'
import { fetchPagesReport, fetchReferrersReport } from '../lib/analyticsApi'
import {
  buildReportRowDetail,
  formatAnalyticsRangeLabel,
  formatBreakdownShare,
  formatCount,
  getProjectFilterLabel,
} from '../lib/analyticsUi'
import { buildAnalyticsRangePresets } from '../lib/demoDates'

const defaultAnalyticsRange = buildAnalyticsRangePresets()[0]

interface ReportDetailPageProps {
  reportKey: keyof typeof reportDetails
}

export function ReportDetailPage({ reportKey }: ReportDetailPageProps) {
  const report = reportDetails[reportKey]
  const [searchParams] = useSearchParams()
  const projectId = searchParams.get('projectId')
  const projectLabel = getProjectFilterLabel(projectId)
  const pagesQuery = useAnalyticsQuery<PagesReportResponse | null>(
    `report:pages:${projectId || 'workspace'}`,
    (signal) =>
      reportKey === 'pages'
        ? fetchPagesReport(
            {
              projectId: projectId || undefined,
              from: defaultAnalyticsRange.from,
              to: defaultAnalyticsRange.to,
              granularity: 'day',
            },
            signal,
          )
        : Promise.resolve(null),
  )
  const referrersQuery = useAnalyticsQuery<ReferrersReportResponse | null>(
    `report:referrers:${projectId || 'workspace'}`,
    (signal) =>
      reportKey === 'referrers'
        ? fetchReferrersReport(
            {
              projectId: projectId || undefined,
              from: defaultAnalyticsRange.from,
              to: defaultAnalyticsRange.to,
              granularity: 'day',
            },
            signal,
          )
        : Promise.resolve(null),
  )
  const activeQuery = reportKey === 'pages' ? pagesQuery : referrersQuery
  const { error, isLoading, isRefreshing } = activeQuery
  const pagesData = pagesQuery.data
  const referrersData = referrersQuery.data
  const activeRange = pagesData?.range || referrersData?.range || null

  const hasRows =
    reportKey === 'pages' ? Boolean(pagesData && pagesData.rows.length > 0) : Boolean(referrersData && referrersData.rows.length > 0)

  return (
    <ProductShell
      activeItem="reports"
      pageTitle={<h1>{report.title}</h1>}
      toolbar={
        <div className="toolbar-cluster">
          <Link to="/reports" className="secondary-button">
            All Reports
          </Link>
          {projectId ? (
            <Link to={`/reports/${reportKey}`} className="secondary-button">
              Workspace View
            </Link>
          ) : null}
          <span className={`status-chip${isRefreshing ? ' refreshing' : ''}`}>
            {isRefreshing ? 'Refreshing live data' : 'Live data'}
          </span>
        </div>
      }
    >
      <section className="data-panel page-intro-panel">
        <div>
          <h2>{report.title}</h2>
          <p>
            {projectId
              ? `${report.description} Filtered to ${projectLabel}.`
              : report.description}
          </p>
          {activeRange ? <p className="page-meta-line">Coverage: {formatAnalyticsRangeLabel(activeRange)}</p> : null}
        </div>
        <Link to={projectId ? `/projects/${encodeURIComponent(projectId)}` : '/dashboard'} className="secondary-button">
          {projectId ? 'Project Overview' : 'Dashboard'}
        </Link>
      </section>

      {error && (pagesData || referrersData) ? (
        <DataStateCard
          title="Live refresh interrupted"
          message={`${error} The report is still showing the last successful response.`}
          tone="warning"
        />
      ) : null}

      {isLoading && !pagesData && !referrersData ? (
        <DataStateCard
          title={`Loading ${report.title}`}
          message="Pulse is requesting the latest report breakdown from the analytics API."
        />
      ) : null}

      {!isLoading && error && !pagesData && !referrersData ? (
        <DataStateCard
          title={`Could not load ${report.title}`}
          message={error}
          tone="error"
        />
      ) : null}

      {!isLoading && !error && pagesData ? (
        <>
          <section className="mini-stat-grid">
            <article className="data-panel content-highlight-card">
              <span>Tracked pages</span>
              <strong>{formatCount(pagesData.trackedPages)}</strong>
            </article>
            <article className="data-panel content-highlight-card">
              <span>Landing pages</span>
              <strong>{formatCount(pagesData.topLandingPages)}</strong>
            </article>
            <article className="data-panel content-highlight-card">
              <span>Avg. exit rate</span>
              <strong>{formatBreakdownShare(pagesData.averageExitRate)}</strong>
            </article>
          </section>

          <section className="data-panel">
            <div className="panel-head">
              <h2>Breakdown</h2>
              <Link to="/docs" className="panel-link">
                Reporting docs
              </Link>
            </div>

            {hasRows ? (
              <div className="mini-table-list report-detail-list">
                {pagesData.rows.map((row) => (
                  <article key={row.label} className="mini-table-row report-detail-row">
                    <div>
                      <strong>{row.label}</strong>
                      <p>{buildReportRowDetail('pages', row)}</p>
                    </div>
                    <strong>{formatCount(row.value)}</strong>
                  </article>
                ))}
              </div>
            ) : (
              <p className="empty-list-copy">No rows were returned for this report scope yet.</p>
            )}
          </section>
        </>
      ) : null}

      {!isLoading && !error && referrersData ? (
        <>
          <section className="mini-stat-grid">
            <article className="data-panel content-highlight-card">
              <span>Tracked referrers</span>
              <strong>{formatCount(referrersData.trackedReferrers)}</strong>
            </article>
            <article className="data-panel content-highlight-card">
              <span>Owned share</span>
              <strong>{formatBreakdownShare(referrersData.ownedShare)}</strong>
            </article>
            <article className="data-panel content-highlight-card">
              <span>Search-led visits</span>
              <strong>{formatCount(referrersData.searchLedVisits)}</strong>
            </article>
          </section>

          <section className="data-panel">
            <div className="panel-head">
              <h2>Breakdown</h2>
              <Link to="/docs" className="panel-link">
                Reporting docs
              </Link>
            </div>

            {hasRows ? (
              <div className="mini-table-list report-detail-list">
                {referrersData.rows.map((row) => (
                  <article key={row.label} className="mini-table-row report-detail-row">
                    <div>
                      <strong>{row.label}</strong>
                      <p>{buildReportRowDetail('referrers', row)}</p>
                    </div>
                    <strong>{formatCount(row.value)}</strong>
                  </article>
                ))}
              </div>
            ) : (
              <p className="empty-list-copy">No rows were returned for this report scope yet.</p>
            )}
          </section>
        </>
      ) : null}
    </ProductShell>
  )
}
