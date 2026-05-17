import { startTransition, useDeferredValue, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BrandLockup } from '../components/Brand'
import { AppIcon } from '../components/Icon'
import { ThemeToggleButton } from '../components/ThemeToggleButton'
import { docsSections, docsSidebarSections } from '../data/content'

function toAnchorId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export function DocsSearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const deferredQuery = useDeferredValue(query)
  const normalizedQuery = deferredQuery.trim().toLowerCase()

  useEffect(() => {
    if (!normalizedQuery) {
      setSearchParams({}, { replace: true })
      return
    }

    setSearchParams({ q: normalizedQuery }, { replace: true })
  }, [normalizedQuery, setSearchParams])

  const results = docsSections.filter((section) => {
    if (!normalizedQuery) {
      return true
    }

    const haystack = [section.title, section.summary, ...section.body, ...(section.bullets ?? [])].join(' ').toLowerCase()
    return haystack.includes(normalizedQuery)
  })

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
                  <a key={item} href={`/docs#${toAnchorId(item)}`}>
                    {item}
                  </a>
                ))}
              </nav>
            </section>
          ))}
        </aside>

        <div className="docs-stage">
          <header className="docs-toolbar">
            <h1>Search Docs</h1>

            <div className="docs-toolbar-actions">
              <Link to="/docs" className="secondary-button">
                Open docs
              </Link>
              <ThemeToggleButton />
            </div>
          </header>

          <div className="docs-content-grid">
            <main className="docs-main-content">
              <section className="data-panel docs-search-panel">
                <label className="docs-search-input-shell" htmlFor="docs-search-input">
                  <AppIcon name="search" />
                  <input
                    id="docs-search-input"
                    type="search"
                    value={query}
                    placeholder="Search setup, events, consent..."
                    onChange={(event) => {
                      const nextValue = event.target.value
                      startTransition(() => setQuery(nextValue))
                    }}
                  />
                </label>
                <p>
                  {results.length} result{results.length === 1 ? '' : 's'} for {normalizedQuery ? `"${normalizedQuery}"` : 'all documentation topics'}
                </p>
              </section>

              <section className="search-results-list">
                {results.map((section) => (
                  <article key={section.title} className="data-panel search-result-card">
                    <div className="search-result-head">
                      <div>
                        <h2>{section.title}</h2>
                        <p>{section.summary}</p>
                      </div>
                      <a href={`/docs#${toAnchorId(section.title)}`} className="secondary-button">
                        Go to section
                      </a>
                    </div>

                    <ul className="content-bullet-list">
                      {(section.bullets ?? section.body).slice(0, 3).map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </section>
            </main>

            <aside className="docs-right-rail">
              <section className="data-panel docs-rail-panel">
                <h3>Popular pages</h3>
                <nav className="docs-anchor-list">
                  <a href="/docs#installation">Installation</a>
                  <a href="/docs#custom-events">Custom Events</a>
                  <a href="/docs#consent-mode">Consent Mode</a>
                  <a href="/docs#event-reference">Event Reference</a>
                </nav>
              </section>

              <section className="data-panel docs-rail-panel">
                <h3>Need another check?</h3>
                <p>Use the help page for self-serve troubleshooting, privacy checks, and setup validation.</p>
                <Link to="/help" className="panel-link">
                  Open Help
                </Link>
              </section>
            </aside>
          </div>
        </div>
      </div>
    </div>
  )
}
