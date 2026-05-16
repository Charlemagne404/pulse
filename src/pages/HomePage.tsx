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
          <div className="landing-hero-background" aria-hidden="true" />

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
          <div className="landing-privacy-panel">
            <div className="landing-footer-copy">
              <div className="feature-icon-shell">
                <AppIcon name="globe" className="feature-icon" />
              </div>
              <div>
                <h2>Your data. Your control.</h2>
                <p>
                  Continental Pulse is built on strict privacy principles. We collect only what&apos;s necessary and
                  never sell data. Learn more in our Privacy Policy.
                </p>
              </div>
            </div>

            <div className="landing-footer-badges">
              <div className="trust-badge">
                <span className="trust-badge-mark gdpr" aria-hidden="true" />
                <div>
                  <strong>GDPR</strong>
                  <span>Aligned</span>
                </div>
              </div>
              <div className="trust-badge">
                <span className="trust-badge-mark eu" aria-hidden="true" />
                <div>
                  <strong>EU</strong>
                  <span>Hosted</span>
                </div>
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
