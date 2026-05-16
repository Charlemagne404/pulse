import { Link } from 'react-router-dom'
import { ProductShell } from '../components/ProductShell'
import { reportDetails } from '../data/content'

interface ReportDetailPageProps {
  reportKey: keyof typeof reportDetails
}

export function ReportDetailPage({ reportKey }: ReportDetailPageProps) {
  const report = reportDetails[reportKey]

  return (
    <ProductShell
      activeItem="reports"
      pageTitle={<h1>{report.title}</h1>}
      toolbar={
        <div className="toolbar-cluster">
          <Link to="/reports" className="secondary-button">
            All Reports
          </Link>
        </div>
      }
    >
      <section className="data-panel page-intro-panel">
        <div>
          <h2>{report.title}</h2>
          <p>{report.description}</p>
        </div>
        <Link to="/dashboard" className="secondary-button">
          Dashboard
        </Link>
      </section>

      <section className="mini-stat-grid">
        {report.metrics.map((metric) => (
          <article key={metric.label} className="data-panel content-highlight-card">
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </article>
        ))}
      </section>

      <section className="data-panel">
        <div className="panel-head">
          <h2>Breakdown</h2>
          <Link to="/support" className="panel-link">
            Need custom reporting?
          </Link>
        </div>

        <div className="mini-table-list report-detail-list">
          {report.rows.map((row) => (
            <article key={row.label} className="mini-table-row report-detail-row">
              <div>
                <strong>{row.label}</strong>
                <p>{row.detail}</p>
              </div>
              <strong>{row.value}</strong>
            </article>
          ))}
        </div>
      </section>
    </ProductShell>
  )
}
