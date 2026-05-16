import { useId } from 'react'

interface SeriesPoint {
  label: string
  value: number
}

interface LineChartProps {
  data: SeriesPoint[]
  compact?: boolean
  height?: number
  hideLabels?: boolean
}

const CHART_WIDTH = 720
const PADDING_X = 18
const PADDING_TOP = 22
const PADDING_BOTTOM = 34

export function LineChart({ data, compact = false, height = 240, hideLabels = false }: LineChartProps) {
  const gradientId = useId().replace(/:/g, '')
  const max = Math.max(...data.map((point) => point.value))
  const min = Math.min(...data.map((point) => point.value))
  const range = Math.max(max - min, 1)

  const points = data.map((point, index) => {
    const x =
      PADDING_X + (index / Math.max(data.length - 1, 1)) * (CHART_WIDTH - PADDING_X * 2)
    const y =
      PADDING_TOP + ((max - point.value) / range) * (height - PADDING_TOP - PADDING_BOTTOM)

    return { ...point, x, y }
  })

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ')

  const areaPath = `${linePath} L ${points[points.length - 1]?.x.toFixed(2)} ${
    height - PADDING_BOTTOM
  } L ${points[0]?.x.toFixed(2)} ${height - PADDING_BOTTOM} Z`

  const labelStep = Math.max(Math.floor(data.length / 5), 1)
  const visibleLabels = data.filter((_, index) => index % labelStep === 0 || index === data.length - 1)

  return (
    <div className={`line-chart${compact ? ' compact' : ''}`}>
      <svg viewBox={`0 0 ${CHART_WIDTH} ${height}`} role="img" aria-label="Visits over time chart">
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(58, 139, 255, 0.34)" />
            <stop offset="100%" stopColor="rgba(58, 139, 255, 0.03)" />
          </linearGradient>
        </defs>

        {[0.2, 0.45, 0.7, 0.95].map((stop) => (
          <line
            key={stop}
            x1={PADDING_X}
            x2={CHART_WIDTH - PADDING_X}
            y1={PADDING_TOP + stop * (height - PADDING_TOP - PADDING_BOTTOM)}
            y2={PADDING_TOP + stop * (height - PADDING_TOP - PADDING_BOTTOM)}
            className="chart-grid-line"
          />
        ))}

        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path d={linePath} className="chart-line-path" />

        {points.map((point, index) =>
          index === points.length - 1 || (!compact && index % labelStep === 0) ? (
            <circle key={point.label} cx={point.x} cy={point.y} r={compact ? 3 : 4} className="chart-dot" />
          ) : null,
        )}
      </svg>

      {hideLabels ? null : (
        <div className="chart-label-row">
          {visibleLabels.map((point) => (
            <span key={point.label}>{point.label}</span>
          ))}
        </div>
      )}
    </div>
  )
}
