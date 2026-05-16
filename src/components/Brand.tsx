interface BrandLockupProps {
  compact?: boolean
}

export function BrandLockup({ compact = false }: BrandLockupProps) {
  return (
    <div className={`brand-lockup${compact ? ' compact' : ''}`}>
      <div className="brand-mark-shell" aria-hidden="true">
        <img src="/branding/c2-mark-white.png" alt="" className="brand-mark-image" />
      </div>

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
      <small>&copy; 2024 Continental AG. All rights reserved.</small>
    </div>
  )
}
