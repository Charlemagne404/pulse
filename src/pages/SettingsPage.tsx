import { Link } from 'react-router-dom'
import { ProductShell } from '../components/ProductShell'
import { workspaceSettingsSections } from '../data/content'

export function SettingsPage() {
  return (
    <ProductShell
      activeItem="settings"
      pageTitle={<h1>Settings</h1>}
      toolbar={
        <div className="toolbar-cluster">
          <Link to="/support" className="secondary-button">
            Governance Help
          </Link>
        </div>
      }
    >
      <section className="data-panel page-intro-panel">
        <div>
          <h2>Workspace controls</h2>
          <p>Review access, collection defaults, and export governance so the portfolio stays consistent as more projects come online.</p>
        </div>
        <Link to="/docs" className="secondary-button">
          Setup Documentation
        </Link>
      </section>

      <section className="content-section-grid">
        {workspaceSettingsSections.map((section) => (
          <article key={section.title} className="data-panel content-section-card">
            <h2>{section.title}</h2>
            <p>{section.body}</p>
            <ul className="content-bullet-list">
              {section.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </ProductShell>
  )
}
