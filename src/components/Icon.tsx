type IconName =
  | 'overview'
  | 'projects'
  | 'events'
  | 'reports'
  | 'alerts'
  | 'settings'
  | 'docs'
  | 'help'
  | 'calendar'
  | 'search'
  | 'shield'
  | 'lock'
  | 'chart'
  | 'bolt'
  | 'globe'
  | 'moon'
  | 'sun'

interface AppIconProps {
  name: IconName
  className?: string
}

export function AppIcon({ name, className = '' }: AppIconProps) {
  const classes = `app-icon ${className}`.trim()

  switch (name) {
    case 'overview':
      return (
        <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
          <rect x="4" y="5" width="16" height="14" rx="3" />
          <path d="M8 9h8M8 12h8M8 15h4" />
        </svg>
      )
    case 'projects':
      return (
        <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
          <path d="M4 8.5h5l1.5-2H20v10.5A2 2 0 0 1 18 19H6a2 2 0 0 1-2-2V8.5Z" />
          <path d="M4 10h16" />
        </svg>
      )
    case 'events':
      return (
        <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
          <path d="M13 3 6 13h5l-1 8 8-11h-5l0-7Z" />
        </svg>
      )
    case 'reports':
      return (
        <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
          <path d="M5 19V9M12 19V5M19 19v-7" />
          <path d="M4 19h16" />
        </svg>
      )
    case 'alerts':
      return (
        <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
          <path d="M12 4a4 4 0 0 1 4 4v2.5c0 1 .3 2 .9 2.8l1.1 1.5H6l1.1-1.5c.6-.8.9-1.8.9-2.8V8a4 4 0 0 1 4-4Z" />
          <path d="M10 18a2 2 0 0 0 4 0" />
        </svg>
      )
    case 'settings':
      return (
        <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
          <path d="M12 8.5A3.5 3.5 0 1 1 8.5 12 3.5 3.5 0 0 1 12 8.5Z" />
          <path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18.2 5.8l-1.6 1.6M7.4 16.6l-1.6 1.6M18.2 18.2l-1.6-1.6M7.4 7.4 5.8 5.8" />
        </svg>
      )
    case 'docs':
      return (
        <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
          <path d="M7 4.5h7l3 3V19a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 6 19V6A1.5 1.5 0 0 1 7.5 4.5Z" />
          <path d="M14 4.5V8h3" />
          <path d="M9 11.5h6M9 14.5h6M9 17.5h4" />
        </svg>
      )
    case 'help':
      return (
        <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
          <path d="M5 7.5A2.5 2.5 0 0 1 7.5 5h9A2.5 2.5 0 0 1 19 7.5v6A2.5 2.5 0 0 1 16.5 16H11l-3.5 3V16H7.5A2.5 2.5 0 0 1 5 13.5v-6Z" />
        </svg>
      )
    case 'calendar':
      return (
        <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
          <rect x="4.5" y="6" width="15" height="13.5" rx="2.5" />
          <path d="M8 4v4M16 4v4M4.5 10h15" />
        </svg>
      )
    case 'search':
      return (
        <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="5.5" />
          <path d="m15 15 4 4" />
        </svg>
      )
    case 'shield':
      return (
        <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
          <path d="M12 3.5 5.5 6.3v5.4c0 4 2.7 7.6 6.5 8.8 3.8-1.2 6.5-4.8 6.5-8.8V6.3L12 3.5Z" />
          <path d="m9.3 12.1 1.9 1.9 3.8-4.1" />
        </svg>
      )
    case 'lock':
      return (
        <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
          <rect x="6" y="10" width="12" height="9" rx="2.5" />
          <path d="M8.5 10V8a3.5 3.5 0 1 1 7 0v2" />
          <path d="M12 13v2.6" />
        </svg>
      )
    case 'chart':
      return (
        <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
          <path d="M5 17.5h14" />
          <path d="m6.3 15.4 3-3.6 3.1 2.4 5.3-6.3" />
          <path d="M17.7 7.9H14.1V4.4" />
          <circle cx="6.3" cy="15.4" r="0.7" />
          <circle cx="9.3" cy="11.8" r="0.7" />
          <circle cx="12.4" cy="14.2" r="0.7" />
          <circle cx="17.7" cy="7.9" r="0.7" />
        </svg>
      )
    case 'bolt':
      return (
        <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
          <path d="M13.2 3.6 7.1 12h4.6l-1.2 8.4 6.4-8.4h-4.6l.9-8.4Z" />
        </svg>
      )
    case 'globe':
      return (
        <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" />
          <path d="M3.5 12h17M12 3.5a12.5 12.5 0 0 1 0 17M12 3.5a12.5 12.5 0 0 0 0 17M6 7.5c1.7.7 3.8 1 6 1s4.3-.3 6-1M6 16.5c1.7-.7 3.8-1 6-1s4.3.3 6 1" />
        </svg>
      )
    case 'moon':
      return (
        <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
          <path d="M15.5 4.5a7.6 7.6 0 1 0 4 14.1 7 7 0 1 1-4-14.1Z" />
        </svg>
      )
    case 'sun':
      return (
        <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2.3M12 19.2v2.3M21.5 12h-2.3M4.8 12H2.5M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6M18.7 18.7l-1.6-1.6M6.9 6.9 5.3 5.3" />
        </svg>
      )
  }
}
