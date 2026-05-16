import { Link } from 'react-router-dom'
import { BrandLockup } from '../components/Brand'
import { CodeBlock } from '../components/CodeBlock'
import { ThemeToggleButton } from '../components/ThemeToggleButton'
import { docsSections, docsSidebarSections } from '../data/content'

function toAnchorId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export function DocsPage() {
  return (
    <div className="site-shell">
      <div className="app-frame docs-frame">
        <aside className="docs-sidebar">
          <Link to="/" className="sidebar-brand-link" aria-label="Open Pulse landing page">
            <BrandLockup compact />
          </Link>

          {docsSidebarSections.map((section) => (
            <section key={section.title} className="docs-sidebar-group">
              <span className="docs-sidebar-label">{section.title}</span>
              <nav className="docs-sidebar-nav">
                {section.items.map((item) => (
                  <a key={item} href={`#${toAnchorId(item)}`} className={item === 'Introduction' ? 'active' : ''}>
                    {item}
                  </a>
                ))}
              </nav>
            </section>
          ))}
        </aside>

        <div className="docs-stage">
          <header className="docs-toolbar">
            <h1>Documentation</h1>

            <div className="docs-toolbar-actions">
              <Link to="/docs/search" className="docs-search">
                <span>Search docs...</span>
                <kbd>Cmd K</kbd>
              </Link>
              <ThemeToggleButton />
            </div>
          </header>

          <div className="docs-content-grid">
            <main className="docs-main-content">
              {docsSections.map((section, index) => (
                <section key={section.title} className="docs-prose-section" id={toAnchorId(section.title)}>
                  <div className="docs-step-header">
                    {index === 0 ? <h2>{section.title}</h2> : <h3>{section.title}</h3>}
                    <p>{section.summary}</p>
                  </div>

                  {section.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}

                  {section.bullets ? (
                    <ul className="content-bullet-list docs-bullet-list">
                      {section.bullets.map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                  ) : null}

                  {section.code ? <CodeBlock title={section.code.title} code={section.code.code} /> : null}
                </section>
              ))}

              <section className="docs-next-steps">
                <div>
                  <h3>What&apos;s next?</h3>
                  <p>Open the dashboard once the script is live, then validate project settings, events, and report destinations.</p>
                </div>
                <div className="docs-next-step-actions">
                  <Link to="/dashboard" className="secondary-button">
                    View Dashboard
                  </Link>
                  <Link to="/support" className="secondary-button">
                    Visit Support
                  </Link>
                </div>
              </section>
            </main>

            <aside className="docs-right-rail">
              <section className="data-panel docs-rail-panel">
                <h3>On this page</h3>
                <nav className="docs-anchor-list">
                  {docsSections.map((section) => (
                    <a key={section.title} href={`#${toAnchorId(section.title)}`}>
                      {section.title}
                    </a>
                  ))}
                </nav>
              </section>

              <section className="data-panel docs-rail-panel">
                <h3>Privacy by design</h3>
                <p>Pulse does not use cookies or fingerprinting, and the docs reflect the same privacy-first assumptions used in the product.</p>
                <Link to="/legal/privacy" className="panel-link">
                  Learn more
                </Link>
              </section>

              <section className="data-panel docs-rail-panel">
                <h3>Need help?</h3>
                <p>Check FAQs here, then use support for rollout blockers, governance checkpoints, or environment-specific issues.</p>
                <Link to="/support" className="panel-link">
                  Visit Support
                </Link>
              </section>
            </aside>
          </div>
        </div>
      </div>
    </div>
  )
}
