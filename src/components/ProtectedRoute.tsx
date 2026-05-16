import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { BrandLockup } from './Brand'

function AuthShell({
  eyebrow,
  title,
  message,
  detail,
  actions,
}: {
  eyebrow: string
  title: string
  message: string
  detail?: string
  actions?: ReactNode
}) {
  return (
    <div className="site-shell">
      <section className="landing-frame auth-gate-frame">
        <header className="auth-gate-header">
          <Link to="/" className="marketing-brand-link" aria-label="Return to Pulse home">
            <BrandLockup />
          </Link>
        </header>

        <div className="auth-gate-panel data-panel">
          <span className="section-eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{message}</p>
          {detail ? <p className="auth-gate-detail">{detail}</p> : null}
          {actions ? <div className="auth-gate-actions">{actions}</div> : null}
        </div>
      </section>
    </div>
  )
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { errorMessage, signIn, signInFullPage, status } = useAuth()
  const location = useLocation()
  const redirectTo = `${window.location.origin}${location.pathname}${location.search}${location.hash}`

  if (status === 'loading') {
    return (
      <AuthShell
        eyebrow="Continental ID"
        title="Checking your Continental ID session"
        message="Pulse is confirming whether this browser already has an active Continental ID session."
        detail="If you just signed in, this should only take a moment."
      />
    )
  }

  if (status === 'authenticated') {
    return <>{children}</>
  }

  return (
    <AuthShell
      eyebrow="Secure Workspace"
      title="Sign in with Continental ID to open Pulse"
      message="Pulse uses Continental ID for account access, session recovery, and connected provider sign-in."
      detail={errorMessage || 'Use the popup flow first. If your browser blocks popups, open the full login page instead.'}
      actions={
        <>
          <button type="button" className="primary-button gold" onClick={() => signIn(redirectTo)}>
            Continue with Continental ID
          </button>
          <button type="button" className="secondary-button" onClick={() => signInFullPage(redirectTo)}>
            Open Full-Page Login
          </button>
        </>
      }
    />
  )
}
