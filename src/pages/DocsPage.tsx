import { Link } from 'react-router-dom'
import { BrandLockup } from '../components/Brand'
import { CodeBlock } from '../components/CodeBlock'
import { AppIcon } from '../components/Icon'
import { docsOnThisPage, docsSidebarSections, docsSnippets } from '../data/mockData'

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
              <div className="docs-search">
                <AppIcon name="search" />
                <span>Search docs...</span>
                <kbd>Cmd K</kbd>
              </div>
              <button className="icon-button" aria-label="Toggle theme">
                <AppIcon name="moon" />
              </button>
            </div>
          </header>

          <div className="docs-content-grid">
            <main className="docs-main-content">
              <section className="docs-prose-section" id="introduction">
                <h2>Quick Start</h2>
                <p>Get Continental Pulse up and running in minutes.</p>
              </section>

              <section className="docs-prose-section" id="install-the-tracking-script">
                <div className="docs-step-header">
                  <h3>1. Install the tracking script</h3>
                  <p>Add the following snippet to the &lt;head&gt; of your site.</p>
                </div>
                <CodeBlock title="script tag" code={docsSnippets.install} />
              </section>

              <section className="docs-prose-section" id="initialize-your-project">
                <div className="docs-step-header">
                  <h3>2. Initialize your project</h3>
                  <p>Initialize the client once with your project identifier and default collection mode.</p>
                </div>
                <CodeBlock title="project config" code={docsSnippets.init} />
              </section>

              <section className="docs-prose-section" id="track-a-custom-event">
                <div className="docs-step-header">
                  <h3>3. Track a custom event</h3>
                  <p>Track important interactions when they help teams understand adoption and intent.</p>
                </div>
                <CodeBlock title="custom event" code={docsSnippets.event} />
              </section>

              <section className="docs-next-steps" id={toAnchorId("What's next?")}>
                <div>
                  <h3>What&apos;s next?</h3>
                  <p>
                    Continue with Tracking Pages, Consent Mode, and the Event Reference once the base installation is in
                    place.
                  </p>
                </div>
                <Link to="/dashboard" className="secondary-button">
                  View Dashboard
                </Link>
              </section>
            </main>

            <aside className="docs-right-rail">
              <section className="data-panel docs-rail-panel">
                <h3>On this page</h3>
                <nav className="docs-anchor-list">
                  {docsOnThisPage.map((item) => (
                    <a key={item} href={`#${toAnchorId(item)}`}>
                      {item}
                    </a>
                  ))}
                </nav>
              </section>

              <section className="data-panel docs-rail-panel">
                <div className="rail-card-icon">
                  <AppIcon name="shield" />
                </div>
                <h3>Privacy by design</h3>
                <p>Continental Pulse does not use cookies or fingerprinting. IP addresses are anonymized and rotated regularly.</p>
                <a href="#privacy" className="panel-link">
                  Learn more
                </a>
              </section>

              <section className="data-panel docs-rail-panel">
                <h3>Need help?</h3>
                <p>Check our FAQs or contact the support team.</p>
                <a href="#support" className="panel-link">
                  Visit Support
                </a>
              </section>
            </aside>
          </div>
        </div>
      </div>
    </div>
  )
}
