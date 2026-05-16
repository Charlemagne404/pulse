import type { ReactNode } from 'react'

interface SectionCardProps {
  title: string
  subtitle?: string
  eyebrow?: string
  actions?: ReactNode
  className?: string
  children: ReactNode
}

export function SectionCard({
  title,
  subtitle,
  eyebrow,
  actions,
  className = '',
  children,
}: SectionCardProps) {
  return (
    <section className={`section-card ${className}`.trim()}>
      <div className="section-card-header">
        <div>
          {eyebrow ? <span className="section-eyebrow">{eyebrow}</span> : null}
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {actions ? <div className="section-card-actions">{actions}</div> : null}
      </div>
      {children}
    </section>
  )
}
