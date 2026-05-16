import { Link } from 'react-router-dom'
import { BrandLockup } from '../components/Brand'
import { AppIcon } from '../components/Icon'
import { LineChart } from '../components/LineChart'
import { MarketingChrome } from '../components/MarketingChrome'
import { staticPages } from '../data/content'
import { landingFeatureCards, landingPreviewMetrics, landingSeries } from '../data/mockData'

const trustBadgeDots = Array.from({ length: 12 }, (_, index) => {
  const angle = (Math.PI * 2 * index) / 12 - Math.PI / 2

  return {
    cx: 20 + Math.cos(angle) * 9.25,
    cy: 20 + Math.sin(angle) * 9.25,
  }
})

const landingFeatureIconNames = ['shield', 'chart', 'bolt', 'lock'] as const
const landingDestinationPages = [
  { key: 'pricing', cta: 'See plans' },
  { key: 'security', cta: 'Review controls' },
  { key: 'status', cta: 'Check operations' },
] as const

function buildPreviewSparkline(points: number[]) {
  const width = 42
  const height = 14
  const max = Math.max(...points)
  const min = Math.min(...points)
  const range = Math.max(max - min, 1)

  return points
    .map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * width
      const y = height - ((point - min) / range) * height

      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
}

function HeroPreviewMetric({
  delta,
  label,
  live = false,
  trend,
  value,
}: {
  delta?: string
  label: string
  live?: boolean
  trend?: number[]
  value: string
}) {
  return (
    <article className="hero-preview-metric">
      <div className="hero-preview-metric-head">
        <span>{label}</span>
        <div className="hero-preview-metric-trend">
          {delta ? (
            <strong className={live ? 'live' : ''}>
              {live ? <span className="metric-live-dot" aria-hidden="true" /> : null}
              {delta}
            </strong>
          ) : null}
          {trend ? (
            <svg viewBox="0 0 42 14" className="hero-preview-sparkline" aria-hidden="true">
              <path d={buildPreviewSparkline(trend)} />
            </svg>
          ) : null}
        </div>
      </div>
      <div className="hero-preview-metric-value">{value}</div>
    </article>
  )
}

function TrustBadgeMark({ kind }: { kind: 'eu' | 'gdpr' }) {
  return (
    <svg
      className={`trust-badge-mark ${kind}`}
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
    >
      {kind === 'eu' ? <circle cx="20" cy="20" r="18" /> : null}
      {trustBadgeDots.map((dot, index) => (
        <circle key={`${kind}-${index}`} cx={dot.cx} cy={dot.cy} r={kind === 'eu' ? 1.55 : 1.7} />
      ))}
    </svg>
  )
}

export function HomePage() {
  return (
    <MarketingChrome
      frameClassName="landing-frame"
      footerTop={
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
              <TrustBadgeMark kind="gdpr" />
              <div>
                <strong>GDPR</strong>
                <span>Aligned</span>
              </div>
            </div>
            <div className="trust-badge">
              <TrustBadgeMark kind="eu" />
              <div>
                <strong>EU</strong>
                <span>Hosted</span>
              </div>
            </div>
          </div>
        </div>
      }
    >
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
                  <span className="hero-preview-window-dots" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                </div>

                <div className="hero-preview-metrics">
                  {landingPreviewMetrics.map((metric) => (
                    <HeroPreviewMetric key={metric.label} {...metric} />
                  ))}
                </div>

                <div className="hero-preview-chart">
                  <div className="hero-preview-chart-head">
                    <span className="chart-kicker">Visits Over Time</span>
                    <span className="hero-preview-chart-menu" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                  </div>
                  <LineChart data={landingSeries} compact height={136} />
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section className="landing-feature-strip" id="features">
          {landingFeatureCards.map((feature, index) => (
            <article key={feature.title} className="landing-feature-card">
              <div className="feature-icon-shell">
                <AppIcon name={landingFeatureIconNames[index]} className="feature-icon" />
              </div>
              <div>
                <h2>{feature.title}</h2>
                <p>{feature.body}</p>
              </div>
            </article>
          ))}
        </section>

        <section className="landing-destination-strip">
          {landingDestinationPages.map((page) => {
            const content = staticPages[page.key]

            return (
              <article key={page.key} className="data-panel landing-destination-card">
                <span className="section-eyebrow">{content.eyebrow}</span>
                <h2>{content.title}</h2>
                <p>{content.description}</p>
                <div className="landing-destination-metrics">
                  {content.cards.slice(0, 2).map((card) => (
                    <div key={card.label}>
                      <strong>{card.value}</strong>
                      <span>{card.label}</span>
                    </div>
                  ))}
                </div>
                <Link to={`/${page.key}`} className="secondary-button">
                  {page.cta}
                </Link>
              </article>
            )
          })}
        </section>
    </MarketingChrome>
  )
}
