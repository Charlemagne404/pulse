import { interpolateNumberSeries } from '../lib/analytics'

interface MetricCardProps {
  label: string
  value: string
  note?: string
  delta?: string
  compact?: boolean
  trend?: number[]
  live?: boolean
}

function renderSparkline(points: number[]) {
  const renderPoints = interpolateNumberSeries(points, 4)
  const max = Math.max(...renderPoints)
  const min = Math.min(...renderPoints)
  const range = Math.max(max - min, 1)
  const width = 76
  const height = 24

  const path = renderPoints
    .map((point, index) => {
      const x = (index / Math.max(renderPoints.length - 1, 1)) * width
      const y = height - ((point - min) / range) * height
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="metric-sparkline" aria-hidden="true">
      <path d={path} pathLength={1} />
    </svg>
  )
}

export function MetricCard({ label, value, note, delta, compact = false, trend, live = false }: MetricCardProps) {
  return (
    <article className={`metric-card${compact ? ' compact' : ''}`}>
      <div className="metric-card-top">
        <span>{label}</span>
        <div className="metric-card-trend-group">
          {delta ? (
            <strong className={live ? 'live' : ''}>
              {live ? <span className="metric-live-dot" aria-hidden="true" /> : null}
              {delta}
            </strong>
          ) : null}
          {trend ? renderSparkline(trend) : null}
        </div>
      </div>
      <div className="metric-card-value">{value}</div>
      {note ? <p>{note}</p> : null}
    </article>
  )
}
