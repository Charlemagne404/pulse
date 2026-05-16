interface DonutSegment {
  label: string
  share: number
  color: string
}

interface DonutChartProps {
  segments: DonutSegment[]
}

const SIZE = 188
const RADIUS = 58
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function DonutChart({ segments }: DonutChartProps) {
  let offset = 0

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="donut-chart" role="img" aria-label="Traffic split by device">
      <defs>
        <radialGradient id="donut-center-glow" cx="50%" cy="42%" r="70%">
          <stop offset="0%" stopColor="rgba(43, 131, 255, 0.2)" />
          <stop offset="100%" stopColor="rgba(8, 15, 24, 0)" />
        </radialGradient>
      </defs>

      <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS + 16} fill="url(#donut-center-glow)" />
      <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="rgba(110, 126, 149, 0.18)" strokeWidth="16" />

      {segments.map((segment) => {
        const length = (segment.share / 100) * CIRCUMFERENCE
        const dashOffset = -offset
        offset += length

        return (
          <circle
            key={segment.label}
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={segment.color}
            strokeWidth="16"
            strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        )
      })}

      <circle cx={SIZE / 2} cy={SIZE / 2} r="40" className="donut-center-fill" />
    </svg>
  )
}
