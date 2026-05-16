import { Link } from 'react-router-dom'
import type { StaticPageContent } from '../data/content'
import { MarketingChrome } from '../components/MarketingChrome'

interface StaticPageProps {
  content: StaticPageContent
}

export function StaticPage({ content }: StaticPageProps) {
  return (
    <MarketingChrome
      footerTop={
        <div className="landing-privacy-panel content-footer-panel">
          <div className="landing-footer-copy content-footer-copy">
            <div>
              <h2>Need implementation help?</h2>
              <p>Use the docs for rollout details or support for environment-specific questions and governance reviews.</p>
            </div>
          </div>

          <div className="content-footer-actions">
            <Link to={content.secondaryAction.to} className="secondary-button">
              {content.secondaryAction.label}
            </Link>
            <Link to={content.primaryAction.to} className="primary-button gold">
              {content.primaryAction.label}
            </Link>
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
            <Link to={content.primaryAction.to} className="primary-button gold">
              {content.primaryAction.label}
            </Link>
            <Link to={content.secondaryAction.to} className="secondary-button">
              {content.secondaryAction.label}
            </Link>
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
