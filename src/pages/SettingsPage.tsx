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
          <Link to="/help" className="secondary-button">
            Setup Help
          </Link>
        </div>
      }
    >
      <section className="data-panel page-intro-panel">
        <div>
          <h2>Workspace controls</h2>
          <p>Review workspace roles, collection defaults, retention visibility, and export controls so the product stays aligned with the MVP operating model.</p>
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
