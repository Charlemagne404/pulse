import { Link } from 'react-router-dom'
import type { StaticPageContent } from '../data/content'
import { MarketingChrome } from '../components/MarketingChrome'

interface StaticPageProps {
  content: StaticPageContent
}

function ActionLink({ className, label, to }: { className: string; label: string; to: string }) {
  if (to.startsWith('http://') || to.startsWith('https://')) {
    return (
      <a href={to} className={className}>
        {label}
      </a>
    )
  }

  return (
    <Link to={to} className={className}>
      {label}
    </Link>
  )
}

export function StaticPage({ content }: StaticPageProps) {
  return (
    <MarketingChrome
      footerTop={
        <div className="landing-privacy-panel content-footer-panel">
          <div className="landing-footer-copy content-footer-copy">
            <div>
              <h2>Set it up yourself.</h2>
              <p>Use the docs to install Pulse, confirm what gets collected, and validate the dashboard without a sales or implementation call.</p>
            </div>
          </div>

          <div className="content-footer-actions">
            <ActionLink className="secondary-button" to={content.secondaryAction.to} label={content.secondaryAction.label} />
            <ActionLink className="primary-button gold" to={content.primaryAction.to} label={content.primaryAction.label} />
          </div>
        </div>
      }
    >
      <section className="content-hero">
        <div className="content-hero-copy">
          <span className="section-eyebrow">{content.eyebrow}</span>
          <h1>{content.title}</h1>
          <p>{content.description}</p>
          <div className="hero-actions">
            <ActionLink className="primary-button gold" to={content.primaryAction.to} label={content.primaryAction.label} />
            <ActionLink className="secondary-button" to={content.secondaryAction.to} label={content.secondaryAction.label} />
          </div>
        </div>

        <div className="content-card-grid">
          {content.cards.map((card) => (
            <article key={card.label} className="data-panel content-highlight-card">
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <p>{card.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="content-section-grid">
        {content.sections.map((section) => (
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
    </MarketingChrome>
  )
}
