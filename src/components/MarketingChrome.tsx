import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BrandLockup } from './Brand'

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
  return (
    <div className="site-shell">
      <main className={frameClassName}>
        <header className="landing-header">
          <Link to="/" className="marketing-brand-link" aria-label="Pulse home">
            <BrandLockup />
          </Link>

          <nav className="landing-nav" aria-label="Primary navigation">
            <a href="/#features">Features</a>
            <Link to="/pricing">Pricing</Link>
            <Link to="/docs">Docs</Link>
            <Link to="/security">Security</Link>
            <Link to="/status">Status</Link>
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

        {children}

        <footer className="landing-footer">
          {footerTop}

          <div className="landing-footer-bottom">
            <div className="footer-brandline">
              <span className="footer-brandmark">Continental</span>
              <span>&copy; 2024 Continental AG. All rights reserved.</span>
            </div>

            <nav className="footer-links" aria-label="Footer links">
              <Link to="/legal/privacy">Privacy</Link>
              <Link to="/legal/imprint">Imprint</Link>
              <Link to="/legal/terms">Terms</Link>
              <Link to="/status">Status</Link>
              <Link to="/support">Support</Link>
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
