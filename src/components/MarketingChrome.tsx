import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { STATUS_URL } from '../lib/siteLinks'
import { BrandLockup, ContinentalWordmark } from './Brand'

interface MarketingChromeProps {
  children: ReactNode
  footerTop?: ReactNode
  frameClassName?: string
}

export function MarketingChrome({
  children,
  footerTop,
  frameClassName = 'landing-frame marketing-page-frame',
}: MarketingChromeProps) {
  const { isAuthenticated, signIn, user } = useAuth()

  return (
    <div className="site-shell">
      <main className={frameClassName}>
        <header className="landing-header">
          <Link to="/" className="marketing-brand-link" aria-label="Pulse home">
            <BrandLockup />
          </Link>

          <nav className="landing-nav" aria-label="Primary navigation">
            <a href="/#features">Features</a>
            <Link to="/docs">Docs</Link>
            <Link to="/privacy">Privacy</Link>
            <a href={STATUS_URL}>Status</a>
          </nav>

          <div className="landing-header-actions">
            {isAuthenticated ? (
              <span className="auth-session-chip">{user?.displayName || user?.email}</span>
            ) : (
              <button type="button" className="text-link-button" onClick={() => signIn(window.location.href)}>
                Log In
              </button>
            )}
            <Link to="/dashboard" className="primary-button gold">
              {isAuthenticated ? 'Open Pulse' : 'View Dashboard'}
            </Link>
          </div>
        </header>

        {children}

        <footer className="landing-footer">
          {footerTop}

          <div className="landing-footer-bottom">
            <div className="footer-brandline">
              <ContinentalWordmark className="footer-continental-wordmark" />
              <span>&copy; 2026 Continental. All rights reserved.</span>
            </div>

            <nav className="footer-links" aria-label="Footer links">
              <Link to="/privacy">Privacy</Link>
              <Link to="/legal/imprint">Imprint</Link>
              <Link to="/legal/terms">Terms</Link>
              <a href={STATUS_URL}>Status</a>
              <Link to="/help">Help</Link>
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
