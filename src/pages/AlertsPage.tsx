import { Link } from 'react-router-dom'
import { ProductShell } from '../components/ProductShell'
import { alertRules, alertTimeline } from '../data/content'
import { STATUS_URL } from '../lib/siteLinks'

export function AlertsPage() {
  return (
    <ProductShell
      activeItem="alerts"
      pageTitle={<h1>Alerts</h1>}
      toolbar={
        <div className="toolbar-cluster">
          <a href={STATUS_URL} className="secondary-button">
            Service Status
          </a>
        </div>
      }
    >
      <section className="data-panel page-intro-panel">
        <div>
          <h2>Alert coverage</h2>
          <p>Pulse alerts help teams catch traffic shifts, export delays, and collection anomalies before they affect weekly reporting cycles.</p>
        </div>
        <Link to="/settings" className="secondary-button">
          Alert Settings
        </Link>
      </section>

      <section className="resource-card-grid">
        {alertRules.map((rule) => (
          <article key={rule.name} className="data-panel resource-card">
            <span className="country-pill">{rule.status}</span>
            <h2>{rule.name}</h2>
            <p>{rule.trigger}</p>
            <p className="resource-card-meta">Owner: {rule.owner}</p>
          </article>
        ))}
      </section>

      <section className="data-panel">
        <div className="panel-head">
          <h2>Recent alert activity</h2>
          <Link to="/support" className="panel-link">
            Troubleshooting
          </Link>
        </div>

        <div className="timeline-list">
          {alertTimeline.map((item) => (
            <article key={`${item.when}-${item.title}`} className="timeline-row">
              <span>{item.when}</span>
              <div>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </ProductShell>
  )
}
