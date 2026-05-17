import type { ReactNode } from 'react'

interface DataStateCardProps {
  title: string
  message: string
  tone?: 'neutral' | 'warning' | 'error'
  action?: ReactNode
}

export function DataStateCard({
  title,
  message,
  tone = 'neutral',
  action,
}: DataStateCardProps) {
  return (
    <section className={`data-panel data-state-card ${tone}`}>
      <div className="data-state-copy">
        <h2>{title}</h2>
        <p>{message}</p>
      </div>
      {action ? <div className="data-state-action">{action}</div> : null}
    </section>
  )
}
