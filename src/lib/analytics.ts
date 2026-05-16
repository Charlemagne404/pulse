import type { RangePreset, SeriesPoint } from '../data/content'

export type GranularityOption = 'Day' | 'Week' | 'Month'

export function cycleIndex(index: number, length: number) {
  return (index + 1) % length
}

function aggregateSeries(source: SeriesPoint[], chunkSize: number, labelPrefix: string) {
  const aggregated: SeriesPoint[] = []

  for (let index = 0; index < source.length; index += chunkSize) {
    const chunk = source.slice(index, index + chunkSize)
    const total = chunk.reduce((sum, point) => sum + point.value, 0)

    aggregated.push({
      label: `${labelPrefix} ${aggregated.length + 1}`,
      value: Math.round(total / chunk.length),
    })
  }

  return aggregated
}

export function buildSeriesForGranularity(source: SeriesPoint[], granularity: GranularityOption) {
  if (granularity === 'Day') {
    return source
  }

  if (granularity === 'Week') {
    return aggregateSeries(source, 2, 'Week')
  }

  return aggregateSeries(source, 3, 'Month')
}

export function getRangePresetLabel(rangePresets: RangePreset[], activeIndex: number) {
  return rangePresets[activeIndex] ?? rangePresets[0]
}
