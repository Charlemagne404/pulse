import { Link } from 'react-router-dom'
import { BrandLockup } from '../components/Brand'
import { AppIcon } from '../components/Icon'
import { LineChart } from '../components/LineChart'
import { MetricCard } from '../components/MetricCard'
import { landingFeatureCards, landingPreviewMetrics, landingSeries } from '../data/mockData'

export function HomePage() {
  return (
    <div className="site-shell">
      <main className="landing-frame">
        <header className="landing-header">
          <Link to="/" className="marketing-brand-link" aria-label="Pulse home">
            <BrandLockup />
          </Link>

          <nav className="landing-nav" aria-label="Primary navigation">
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <Link to="/docs">Docs</Link>
            <a href="#security">Security</a>
            <a href="#status">Status</a>
          </nav>

          <div className="landing-header-actions">
            <a href="#login" className="text-link-button">
              Log In
            </a>
            <Link to="/dashboard" className="primary-button gold">
              View Dashboard
            </Link>
          </div>
        </header>

        <section className="landing-hero">
          <div className="landing-copy">
            <span className="section-eyebrow">Privacy-first analytics</span>
            <h1>Analytics that respect privacy. Insights that drive performance.</h1>
            <p>
              Continental Pulse is a privacy-friendly analytics platform built for Continental websites and apps. Get
              reliable insights without cookies, without personal data, and with full control.
            </p>

            <div className="hero-actions">
              <Link to="/dashboard" className="primary-button gold">
                View Dashboard
              </Link>
              <Link to="/docs" className="secondary-button">
                Read Docs
              </Link>
            </div>
          </div>

          <div className="landing-visual">
            <div className="globe-stage" aria-hidden="true">
              <svg viewBox="0 0 560 560" className="hero-globe-svg">
                <defs>
                  <radialGradient id="hero-globe-fill" cx="45%" cy="42%" r="58%">
                    <stop offset="0%" stopColor="rgba(87, 124, 169, 0.42)" />
                    <stop offset="48%" stopColor="rgba(26, 40, 60, 0.92)" />
                    <stop offset="100%" stopColor="rgba(7, 15, 25, 1)" />
                  </radialGradient>
                  <radialGradient id="hero-globe-glow" cx="50%" cy="50%" r="55%">
                    <stop offset="0%" stopColor="rgba(255, 214, 102, 0.28)" />
                    <stop offset="100%" stopColor="rgba(255, 214, 102, 0)" />
                  </radialGradient>
                </defs>

                <circle cx="280" cy="280" r="178" fill="url(#hero-globe-fill)" />
                <circle cx="280" cy="280" r="226" fill="url(#hero-globe-glow)" />
                <circle cx="280" cy="280" r="178" className="hero-globe-outline" />
                <ellipse cx="280" cy="280" rx="178" ry="74" className="hero-globe-grid" />
                <ellipse cx="280" cy="280" rx="178" ry="132" className="hero-globe-grid faint" />
                <ellipse cx="280" cy="280" rx="92" ry="178" className="hero-globe-grid" />
                <ellipse cx="280" cy="280" rx="148" ry="178" className="hero-globe-grid faint" />
                <path d="M112 250C168 194 226 186 290 192c68 6 119 28 159 64" className="hero-orbit-line" />
                <path d="M130 330c58-36 121-50 186-44 71 6 116 24 153 46" className="hero-orbit-line faint" />
                <path d="M186 156c30 38 60 61 112 72 61 13 121 6 176-14" className="hero-orbit-line faint" />
                <circle cx="214" cy="220" r="4.5" className="hero-globe-node" />
                <circle cx="306" cy="204" r="4.5" className="hero-globe-node" />
                <circle cx="356" cy="282" r="4.5" className="hero-globe-node" />
                <circle cx="258" cy="332" r="4.5" className="hero-globe-node" />
                <circle cx="198" cy="298" r="4.5" className="hero-globe-node" />
              </svg>
            </div>

            <aside className="hero-preview-window" aria-label="Pulse dashboard preview">
              <div className="hero-preview-sidebar">
                <BrandLockup compact />
                <div className="hero-preview-nav">
                  <span className="active">Overview</span>
                  <span>Projects</span>
                  <span>Events</span>
                  <span>Reports</span>
                  <span>Settings</span>
                </div>
              </div>

              <div className="hero-preview-main">
                <div className="hero-preview-head">
                  <strong>Overview</strong>
                </div>

                <div className="hero-preview-metrics">
                  {landingPreviewMetrics.map((metric) => (
                    <MetricCard key={metric.label} {...metric} compact />
                  ))}
                </div>

                <div className="hero-preview-chart">
                  <span className="chart-kicker">Visits Over Time</span>
                  <LineChart data={landingSeries} compact height={146} hideLabels />
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section className="landing-feature-strip" id="features">
          {landingFeatureCards.map((feature, index) => (
            <article key={feature.title} className="landing-feature-card">
              <div className="feature-icon-shell">
                <AppIcon
                  name={(['shield', 'chart', 'bolt', 'lock'] as const)[index]}
                  className="feature-icon"
                />
              </div>
              <div>
                <h2>{feature.title}</h2>
                <p>{feature.body}</p>
              </div>
            </article>
          ))}
        </section>

        <footer className="landing-footer">
          <div className="landing-footer-top">
            <div className="landing-footer-copy">
              <div className="feature-icon-shell">
                <AppIcon name="globe" className="feature-icon" />
              </div>
              <div>
                <h2>Your data. Your control.</h2>
                <p>
                  Continental Pulse is built on strict privacy principles. We collect only what&apos;s necessary and
                  never sell data.
                </p>
              </div>
            </div>

            <div className="landing-footer-badges">
              <div className="trust-badge">
                <strong>GDPR</strong>
                <span>Aligned</span>
              </div>
              <div className="trust-badge">
                <strong>EU</strong>
                <span>Hosted</span>
              </div>
            </div>
          </div>

          <div className="landing-footer-bottom">
            <div className="footer-brandline">
              <span className="footer-brandmark">Continental</span>
              <span>&copy; 2024 Continental AG. All rights reserved.</span>
            </div>

            <nav className="footer-links" aria-label="Footer links">
              <a href="#privacy">Privacy</a>
              <a href="#imprint">Imprint</a>
              <a href="#terms">Terms</a>
              <a href="#status">Status</a>
            </nav>

            <div className="footer-utility-icons" aria-hidden="true">
              <span>in</span>
              <span>gh</span>
              <span>@</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  )
}
