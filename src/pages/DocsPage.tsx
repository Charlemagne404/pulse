import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BrandLockup } from '../components/Brand'
import { CodeBlock } from '../components/CodeBlock'
import { AppIcon } from '../components/Icon'
import { ThemeToggleButton } from '../components/ThemeToggleButton'
import { docsSections, docsSidebarSections, type DocsSectionContent } from '../data/content'

function toAnchorId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

type DocsSectionWithAnchor = DocsSectionContent & {
  anchor: string
}

const docsSectionsWithAnchors: DocsSectionWithAnchor[] = docsSections.map((section) => ({
  ...section,
  anchor: toAnchorId(section.title),
}))

const docsSectionsByTitle = new Map(docsSectionsWithAnchors.map((section) => [section.title, section]))

function requireSection(title: string) {
  const section = docsSectionsByTitle.get(title)

  if (!section) {
    throw new Error(`Unknown docs section: ${title}`)
  }

  return section
}

function getSectionGroup(groupTitle: string) {
  const group = docsSidebarSections.find((section) => section.title === groupTitle)

  if (!group) {
    throw new Error(`Unknown docs group: ${groupTitle}`)
  }

  return group.items.map(requireSection)
}

const quickStartSections = getSectionGroup('Get started')
const guideSections = getSectionGroup('Guides')
const referenceSections = getSectionGroup('Reference')
const resourceSections = getSectionGroup('Resources')

const overviewAnchors = [
  { anchor: 'overview', label: 'Overview', children: [] as string[] },
  { anchor: 'quick-start-path', label: 'Quick Start Path', children: quickStartSections.map((section) => section.anchor) },
  { anchor: 'guide-library', label: 'Guides', children: guideSections.map((section) => section.anchor) },
  { anchor: 'reference-library', label: 'Reference', children: referenceSections.map((section) => section.anchor) },
  { anchor: 'resource-library', label: 'Resources', children: resourceSections.map((section) => section.anchor) },
  { anchor: 'next-steps', label: 'Next Steps', children: [] as string[] },
]

const setupSteps = [
  {
    title: 'Install the client',
    body: 'Load Pulse once in the document head, then keep environment settings centralized.',
    anchor: 'installation',
  },
  {
    title: 'Initialize the project',
    body: 'Set the project identifier once in the application shell and keep debug off in production.',
    anchor: 'project-setup',
  },
  {
    title: 'Validate one event',
    body: 'Check page views first, then add one high-signal custom event before expanding scope.',
    anchor: 'custom-events',
  },
  {
    title: 'Cover advanced routing',
    body: 'Add SPA route tracking and consent-aware collection only where the product surface requires it.',
    anchor: 'spa-support',
  },
]

const popularReferenceLinks = [
  { label: 'Installation snippet', anchor: 'installation' },
  { label: 'Custom event example', anchor: 'custom-events' },
  { label: 'Consent mode guidance', anchor: 'consent-mode' },
  { label: 'Browser API methods', anchor: 'api-reference' },
]

function isActiveAnchor(activeAnchor: string, anchor: string, children: string[] = []) {
  return activeAnchor === anchor || children.includes(activeAnchor)
}

function DocsSectionContentBlock({ section }: { section: DocsSectionWithAnchor }) {
  return (
    <>
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
    </>
  )
}

function DocsLibraryCard({
  section,
  label,
  index,
}: {
  section: DocsSectionWithAnchor
  label: string
  index?: number
}) {
  return (
    <article className={`data-panel docs-library-card ${section.code ? 'docs-library-card-code' : ''}`} id={section.anchor} data-doc-anchor>
      <div className="docs-library-card-head">
        <div className="docs-library-card-meta">
          <span className="docs-inline-label">{label}</span>
          {typeof index === 'number' ? <span className="docs-step-badge">{index + 1}</span> : null}
        </div>
        <a href={`#${section.anchor}`} className="docs-anchor-jump">
          Jump to anchor
        </a>
      </div>

      <div className="docs-step-header">
        <h3>{section.title}</h3>
        <p>{section.summary}</p>
      </div>

      <DocsSectionContentBlock section={section} />
    </article>
  )
}

export function DocsPage() {
  const [activeAnchor, setActiveAnchor] = useState('overview')

  useEffect(() => {
    const updateFromHash = () => {
      const nextAnchor = window.location.hash.replace('#', '')
      if (nextAnchor) {
        setActiveAnchor(nextAnchor)
      }
    }

    updateFromHash()
    window.addEventListener('hashchange', updateFromHash)

    const targets = Array.from(document.querySelectorAll<HTMLElement>('[data-doc-anchor]'))
    if (!targets.length) {
      return () => window.removeEventListener('hashchange', updateFromHash)
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((entryA, entryB) => entryB.intersectionRatio - entryA.intersectionRatio)

        if (visibleEntries[0]?.target.id) {
          setActiveAnchor(visibleEntries[0].target.id)
        }
      },
      {
        rootMargin: '-18% 0px -62% 0px',
        threshold: [0.1, 0.3, 0.65],
      },
    )

    targets.forEach((target) => observer.observe(target))

    return () => {
      window.removeEventListener('hashchange', updateFromHash)
      observer.disconnect()
    }
  }, [])

  return (
    <div className="site-shell">
      <div className="app-frame docs-frame">
        <aside className="docs-sidebar">
          <Link to="/" className="sidebar-brand-link" aria-label="Open Pulse landing page">
            <BrandLockup compact />
          </Link>

          <section className="data-panel docs-sidebar-callout">
            <div className="docs-sidebar-callout-copy">
              <span className="docs-inline-label">Launch Faster</span>
              <p>Start with the four-step setup path, then branch into guides, reference, and privacy notes.</p>
            </div>
            <a href="#quick-start-path" className="panel-link">
              Open quick start
            </a>
          </section>

          {docsSidebarSections.map((section) => (
            <section key={section.title} className="docs-sidebar-group">
              <div className="docs-sidebar-group-head">
                <span className="docs-sidebar-label">{section.title}</span>
                <span className="docs-sidebar-count">{section.items.length}</span>
              </div>
              <nav className="docs-sidebar-nav">
                {section.items.map((item) => {
                  const anchor = toAnchorId(item)
                  return (
                    <a key={item} href={`#${anchor}`} className={activeAnchor === anchor ? 'active' : ''}>
                      {item}
                    </a>
                  )
                })}
              </nav>
            </section>
          ))}
        </aside>

        <div className="docs-stage">
          <header className="docs-toolbar docs-toolbar-expanded">
            <div className="docs-toolbar-copy">
              <div className="docs-toolbar-kicker">
                <span className="docs-inline-label">Pulse Docs</span>
                <span className="docs-release-chip">Current release</span>
              </div>
              <h1>Documentation for getting Pulse live and verifying what it collects.</h1>
              <p>
                Install the client, validate the right events, and keep privacy assumptions visible without digging
                through a flat wall of prose.
              </p>
            </div>

            <div className="docs-toolbar-actions">
              <Link to="/docs/search" className="docs-search">
                <AppIcon name="search" />
                <span>Search docs...</span>
                <kbd>Cmd K</kbd>
              </Link>
              <Link to="/help" className="secondary-button">
                Help
              </Link>
              <ThemeToggleButton />
            </div>
          </header>

          <section className="docs-hero-grid" id="overview" data-doc-anchor>
            <article className="data-panel docs-hero-card docs-hero-card-primary">
              <div className="docs-hero-card-head">
                <div>
                  <span className="docs-inline-label">Recommended Path</span>
                  <h2>Ship Pulse in one short setup pass.</h2>
                </div>
                <span className="docs-hero-badge">4 core steps</span>
              </div>

              <p className="docs-hero-summary">
                Most sites only need installation, project setup, one meaningful event, and a quick validation pass
                before the data is useful.
              </p>

              <div className="docs-hero-stat-grid">
                <div className="docs-hero-stat">
                  <span>Coverage</span>
                  <strong>{docsSections.length} topics</strong>
                </div>
                <div className="docs-hero-stat">
                  <span>Fast path</span>
                  <strong>10 minute setup</strong>
                </div>
                <div className="docs-hero-stat">
                  <span>Privacy posture</span>
                  <strong>Cookie-free</strong>
                </div>
                <div className="docs-hero-stat">
                  <span>Best first check</span>
                  <strong>Page views + 1 event</strong>
                </div>
              </div>

              <div className="docs-next-step-actions">
                <a href="#installation" className="primary-button">
                  Start Installation
                </a>
                <Link to="/dashboard" className="secondary-button">
                  Open Dashboard
                </Link>
              </div>
            </article>

            <article className="data-panel docs-hero-card">
              <div className="docs-hero-card-head">
                <div>
                  <span className="docs-inline-label">Launch Checklist</span>
                  <h2>Recommended setup order</h2>
                </div>
                <AppIcon name="bolt" className="docs-accent-icon" />
              </div>

              <div className="docs-rollout-list">
                {setupSteps.map((step, index) => (
                  <a key={step.title} href={`#${step.anchor}`} className="docs-rollout-item">
                    <span className="docs-step-badge">{index + 1}</span>
                    <div>
                      <strong>{step.title}</strong>
                      <p>{step.body}</p>
                    </div>
                  </a>
                ))}
              </div>
            </article>

            <article className="data-panel docs-hero-card">
              <div className="docs-hero-card-head">
                <div>
                  <span className="docs-inline-label">Popular Snippets</span>
                  <h2>Most-used reference points</h2>
                </div>
                <AppIcon name="docs" className="docs-accent-icon" />
              </div>

              <nav className="docs-popular-links">
                {popularReferenceLinks.map((link) => (
                  <a key={link.anchor} href={`#${link.anchor}`} className="docs-popular-link">
                    <span>{link.label}</span>
                    <small>#{link.anchor}</small>
                  </a>
                ))}
              </nav>

              <div className="docs-hero-note">
                <AppIcon name="shield" className="docs-accent-icon" />
                <p>Treat privacy and consent sections as part of setup, not cleanup.</p>
              </div>
            </article>
          </section>

          <div className="docs-content-grid">
            <main className="docs-main-content">
              <section className="docs-library-section" id="quick-start-path" data-doc-anchor>
                <div className="docs-library-header">
                  <div>
                    <span className="docs-inline-label">Get Started</span>
                    <h2>Quick start path</h2>
                    <p>These four sections cover the minimum production-ready setup without forcing you into every advanced option.</p>
                  </div>
                  <a href="#project-setup" className="panel-link">
                    Jump to init config
                  </a>
                </div>

                <div className="docs-quickstart-stack">
                  {quickStartSections.map((section, index) => (
                    <DocsLibraryCard key={section.title} section={section} label="Quick Start" index={index} />
                  ))}
                </div>
              </section>

              <section className="docs-library-section" id="guide-library" data-doc-anchor>
                <div className="docs-library-header">
                  <div>
                    <span className="docs-inline-label">Guides</span>
                    <h2>Tracking patterns</h2>
                    <p>Use these playbooks when the core setup is done and you need cleaner tracking semantics for specific product behaviors.</p>
                  </div>
                  <a href="#tracking-pages" className="panel-link">
                    Open guide library
                  </a>
                </div>

                <div className="docs-library-grid docs-library-grid-two-up">
                  {guideSections.map((section) => (
                    <DocsLibraryCard key={section.title} section={section} label="Guide" />
                  ))}
                </div>
              </section>

              <section className="docs-library-section" id="reference-library" data-doc-anchor>
                <div className="docs-library-header">
                  <div>
                    <span className="docs-inline-label">Reference</span>
                    <h2>Core methods and naming rules</h2>
                    <p>Keep this section close while wiring the site. It gives you the naming rules and API surface needed to stay consistent.</p>
                  </div>
                  <a href="#api-reference" className="panel-link">
                    Open reference
                  </a>
                </div>

                <div className="docs-library-grid">
                  {referenceSections.map((section) => (
                    <DocsLibraryCard key={section.title} section={section} label="Reference" />
                  ))}
                </div>
              </section>

              <section className="docs-library-section" id="resource-library" data-doc-anchor>
                <div className="docs-library-header">
                  <div>
                    <span className="docs-inline-label">Resources</span>
                    <h2>Resources, FAQs, and updates</h2>
                    <p>Use these pages to answer common setup questions and keep privacy and measurement limits visible as the implementation evolves.</p>
                  </div>
                  <a href="#privacy" className="panel-link">
                    Review privacy notes
                  </a>
                </div>

                <div className="docs-library-grid docs-library-grid-three-up">
                  {resourceSections.map((section) => (
                    <DocsLibraryCard key={section.title} section={section} label="Resource" />
                  ))}
                </div>
              </section>

              <section className="docs-next-steps docs-next-steps-panel" id="next-steps" data-doc-anchor>
                <div>
                  <span className="docs-inline-label">Next Steps</span>
                  <h3>Validate Pulse once the script is live.</h3>
                  <p>Check project settings, confirm page views, validate one custom event, and only then expand into reports, alerts, or export destinations.</p>
                </div>
                <div className="docs-next-step-actions">
                  <Link to="/dashboard" className="secondary-button">
                    View Dashboard
                  </Link>
                  <Link to="/help" className="secondary-button">
                    Open Help
                  </Link>
                </div>
              </section>
            </main>

            <aside className="docs-right-rail">
              <section className="data-panel docs-rail-panel docs-rail-panel-sticky">
                <h3>On this page</h3>
                <nav className="docs-anchor-list">
                  {overviewAnchors.map((item) => (
                    <a
                      key={item.anchor}
                      href={`#${item.anchor}`}
                      className={isActiveAnchor(activeAnchor, item.anchor, item.children) ? 'active' : ''}
                    >
                      {item.label}
                    </a>
                  ))}
                </nav>
              </section>

              <section className="data-panel docs-rail-panel">
                <h3>Starter snippets</h3>
                <nav className="docs-anchor-list docs-anchor-list-compact">
                  {popularReferenceLinks.map((item) => (
                    <a key={item.anchor} href={`#${item.anchor}`} className={activeAnchor === item.anchor ? 'active' : ''}>
                      {item.label}
                    </a>
                  ))}
                </nav>
              </section>

              <section className="data-panel docs-rail-panel">
                <h3>Privacy by design</h3>
                <p>Pulse does not use cookies or fingerprinting, and the setup guidance keeps those assumptions visible from install through reporting.</p>
                <Link to="/privacy" className="panel-link">
                  Learn more
                </Link>
              </section>

              <section className="data-panel docs-rail-panel">
                <h3>Need another check?</h3>
                <p>Use the help page for self-serve troubleshooting, privacy checks, and validation tips.</p>
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
