import type { RangePreset, SeriesPoint } from '../data/content'

export type GranularityOption = 'Day' | 'Week' | 'Month'
export interface RenderSeriesPoint extends SeriesPoint {
  synthetic?: boolean
}

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

export function interpolateNumberSeries(source: number[], pointsPerSegment = 4) {
  if (source.length < 2 || pointsPerSegment < 2) {
    return source
  }

  const interpolated: number[] = []

  for (let index = 0; index < source.length - 1; index += 1) {
    const start = source[index]
    const end = source[index + 1]

    interpolated.push(start)

    for (let step = 1; step < pointsPerSegment; step += 1) {
      const position = step / pointsPerSegment
      interpolated.push(Math.round(start + (end - start) * position))
    }
  }

  interpolated.push(source[source.length - 1])
  return interpolated
}

export function interpolateSeriesPoints(source: SeriesPoint[], pointsPerSegment = 4): RenderSeriesPoint[] {
  if (source.length < 2 || pointsPerSegment < 2) {
    return source.map((point) => ({ ...point }))
  }

  const interpolated: RenderSeriesPoint[] = []

  for (let index = 0; index < source.length - 1; index += 1) {
    const start = source[index]
    const end = source[index + 1]

    interpolated.push({ ...start })

    for (let step = 1; step < pointsPerSegment; step += 1) {
      const position = step / pointsPerSegment
      interpolated.push({
        label: '',
        value: Math.round(start.value + (end.value - start.value) * position),
        synthetic: true,
      })
    }
  }

  interpolated.push({ ...source[source.length - 1] })
  return interpolated
}
