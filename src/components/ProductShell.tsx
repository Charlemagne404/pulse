import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { BrandLockup } from './Brand'
import { AppIcon } from './Icon'
import { ThemeToggleButton } from './ThemeToggleButton'

interface ProductShellProps {
  activeItem: 'overview' | 'projects' | 'events' | 'reports' | 'alerts' | 'settings'
  pageTitle: ReactNode
  toolbar?: ReactNode
  header?: ReactNode
  children: ReactNode
}

const navItems = [
  { key: 'overview', to: '/dashboard', label: 'Overview', icon: 'overview' as const },
  { key: 'projects', to: '/projects', label: 'Projects', icon: 'projects' as const },
  { key: 'events', to: '/events', label: 'Events', icon: 'events' as const },
  { key: 'reports', to: '/reports', label: 'Reports', icon: 'reports' as const },
  { key: 'alerts', to: '/alerts', label: 'Alerts', icon: 'alerts' as const },
  { key: 'settings', to: '/settings', label: 'Settings', icon: 'settings' as const },
]

export function ProductShell({ activeItem, pageTitle, toolbar, header, children }: ProductShellProps) {
  const { signOut, user, userInitials } = useAuth()
  const accountLabel = user?.displayName || user?.email?.split('@')[0] || 'Account'

  return (
    <div className="site-shell">
      <div className="app-frame">
        <aside className="app-sidebar">
          <Link to="/" className="sidebar-brand-link" aria-label="Open Pulse landing page">
            <BrandLockup compact />
          </Link>

          <nav className="app-nav" aria-label="Primary navigation">
            {navItems.map((item) => (
              <NavLink
                key={item.key}
                to={item.to}
                className={() => `app-nav-link${activeItem === item.key ? ' active' : ''}`}
              >
                <AppIcon name={item.icon} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <nav className="app-sidebar-secondary" aria-label="Secondary navigation">
            <Link to="/docs" className="app-nav-link subtle">
              <AppIcon name="docs" />
              <span>Docs</span>
            </Link>
            <Link to="/help" className="app-nav-link subtle">
              <AppIcon name="help" />
              <span>Help</span>
            </Link>
          </nav>
        </aside>

        <div className="app-stage">
          <header className="app-toolbar">
            <div className="page-heading">{pageTitle}</div>
            <div className="app-toolbar-actions">
              {toolbar ? <div className="toolbar-context-actions">{toolbar}</div> : null}
              <div className="toolbar-utility-actions">
                <ThemeToggleButton />
                <Link to="/alerts" className="icon-button" aria-label="Open alerts">
                  <AppIcon name="alerts" />
                </Link>
                <Link to="/docs" className="icon-button" aria-label="Open docs">
                  <AppIcon name="docs" />
                </Link>
              </div>
              <div className="toolbar-account">
                <div className="avatar-pill">{userInitials}</div>
                <div className="toolbar-account-copy">
                  <strong>{accountLabel}</strong>
                  <span>Signed in via Continental ID</span>
                </div>
                <button type="button" className="text-link-button toolbar-signout-button" onClick={() => void signOut()}>
                  Sign out
                </button>
              </div>
            </div>
          </header>

          {header ? <div className="app-stage-header">{header}</div> : null}
          <main className="page-content">{children}</main>
        </div>
      </div>
    </div>
  )
}
