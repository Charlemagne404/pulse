import { Link } from 'react-router-dom'
import { ProductShell } from '../components/ProductShell'
import { reportLibrary } from '../data/content'

export function ReportsPage() {
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
        </div>
      }
    >
      <section className="data-panel page-intro-panel">
        <div>
          <h2>Ready-to-share reporting surfaces</h2>
          <p>Use executive rollups for weekly review meetings, then open the deeper report pages for content and acquisition analysis.</p>
        </div>
        <Link to="/dashboard" className="secondary-button">
          Back to Overview
        </Link>
      </section>

      <section className="resource-card-grid">
        {reportLibrary.map((report) => (
          <article key={report.slug} className="data-panel resource-card">
            <h2>{report.title}</h2>
            <p>{report.description}</p>
            <Link to={report.to} className="primary-button gold">
              Open Report
            </Link>
          </article>
        ))}
      </section>

      <section className="data-panel page-intro-panel">
        <div>
          <h2>Weekly reporting rhythm</h2>
          <p>Most teams review the dashboard every day, the report deep dives every week, and the status and alerts surfaces before major launches.</p>
        </div>
        <Link to="/alerts" className="secondary-button">
          Review Alerts
        </Link>
      </section>
    </ProductShell>
  )
}
