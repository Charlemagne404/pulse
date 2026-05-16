export interface ProgressItem {
  label: string
  value: string
  detail: string
  share: number
}

interface ProgressListProps {
  items: ProgressItem[]
  compact?: boolean
}

export function ProgressList({ items, compact = false }: ProgressListProps) {
  return (
    <ul className={`progress-list${compact ? ' compact' : ''}`}>
      {items.map((item) => (
        <li key={`${item.label}-${item.value}`}>
          <div className="progress-list-head">
            <div>
              <strong>{item.label}</strong>
              <span>{item.detail}</span>
            </div>
            <span>{item.value}</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${item.share}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}
