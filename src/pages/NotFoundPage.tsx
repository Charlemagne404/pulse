import { Link } from 'react-router-dom'
import { MarketingChrome } from '../components/MarketingChrome'

export function NotFoundPage() {
  return (
    <MarketingChrome frameClassName="landing-frame marketing-page-frame not-found-frame">
      <section className="content-hero">
        <div className="content-hero-copy">
          <span className="section-eyebrow">404</span>
          <h1>That page does not exist.</h1>
          <p>The link may be outdated, or the route may have moved. Use the docs or go back to the Pulse home page.</p>
          <div className="hero-actions">
            <Link to="/" className="primary-button gold">
              Go Home
            </Link>
            <Link to="/docs" className="secondary-button">
              Read Docs
            </Link>
          </div>
        </div>
      </section>
    </MarketingChrome>
  )
}
