interface BrandLockupProps {
  compact?: boolean
}

interface BrandMarkProps {
  className?: string
  alt?: string
}

export function BrandMark({ className = '', alt = '' }: BrandMarkProps) {
  const classes = ['brand-mark-shell', className].filter(Boolean).join(' ')

  return (
    <div className={classes} aria-hidden={alt ? undefined : 'true'}>
      <img src="/branding/pulse-logo.png" alt={alt} className="brand-mark-image" />
    </div>
  )
}

interface ContinentalWordmarkProps {
  className?: string
}

export function ContinentalWordmark({ className = '' }: ContinentalWordmarkProps) {
  return <img src="/branding/made-by-continental-white.png" alt="Continental" className={className} />
}

export function BrandLockup({ compact = false }: BrandLockupProps) {
  return (
    <div className={`brand-lockup${compact ? ' compact' : ''}`}>
      <BrandMark />

      <div className="brand-wordmark">
        <span className="brand-continental">Continental</span>
        <span className="brand-pulse">Pulse</span>
      </div>
    </div>
  )
}

export function ContinentalSignature() {
  return (
    <div className="continental-signature" aria-label="A Continental project">
      <span>Continental</span>
      <small>&copy; 2026 Continental. All rights reserved.</small>
    </div>
  )
}
