import type { RangePreset, SeriesPoint } from '../data/content'

const shortDayFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  timeZone: 'UTC',
})

const shortDayWithYearFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
})

const monthFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  timeZone: 'UTC',
})

const monthDayFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

function getTodayUtc() {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

function shiftUtcDays(date: Date, days: number) {
  const shifted = new Date(date)
  shifted.setUTCDate(shifted.getUTCDate() + days)
  return shifted
}

function shiftUtcMonths(date: Date, months: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1))
}

function startOfQuarter(date: Date) {
  const quarterMonth = Math.floor(date.getUTCMonth() / 3) * 3
  return new Date(Date.UTC(date.getUTCFullYear(), quarterMonth, 1))
}

function formatRange(start: Date, end: Date) {
  return `${shortDayFormatter.format(start)} - ${shortDayWithYearFormatter.format(end)}`
}

function relabelSeriesWithOffsets(source: SeriesPoint[], offsets: number[], referenceDate = getTodayUtc()) {
  return source.map((point, index) => ({
    ...point,
    label: shortDayFormatter.format(shiftUtcDays(referenceDate, offsets[index] ?? 0)),
  }))
}

function relabelQuarterSeries(source: SeriesPoint[], referenceDate = getTodayUtc()) {
  const quarterStart = startOfQuarter(referenceDate)
  const firstMonth = monthFormatter.format(quarterStart)
  const secondMonth = monthFormatter.format(shiftUtcMonths(quarterStart, 1))
  const thirdMonth = monthFormatter.format(shiftUtcMonths(quarterStart, 2))
  const labels = [firstMonth, `Late ${firstMonth}`, secondMonth, `Late ${secondMonth}`, thirdMonth]

  return source.map((point, index) => ({
    ...point,
    label: labels[index] ?? point.label,
  }))
}

export function relabelRecentWeekSeries(source: SeriesPoint[]) {
  return relabelSeriesWithOffsets(source, [-6, -5, -4, -3, -2, -1, 0])
}

export function buildDemoRangePresets(config: {
  sevenDaySeries: SeriesPoint[]
  thirtyDaySeries: SeriesPoint[]
  quarterToDateSeries: SeriesPoint[]
}): RangePreset[] {
  const today = getTodayUtc()
  const quarterStart = startOfQuarter(today)

  return [
    {
      label: '7D',
      dates: formatRange(shiftUtcDays(today, -6), today),
      series: relabelSeriesWithOffsets(config.sevenDaySeries, [-6, -5, -4, -3, -2, -1, 0], today),
    },
    {
      label: '30D',
      dates: formatRange(shiftUtcDays(today, -29), today),
      series: relabelSeriesWithOffsets(config.thirtyDaySeries, [-29, -24, -19, -14, -9, -4, 0], today),
    },
    {
      label: 'QTD',
      dates: formatRange(quarterStart, today),
      series: relabelQuarterSeries(config.quarterToDateSeries, today),
    },
  ]
}

export function formatTimelineLabel(dayOffset: number, time: string) {
  const today = getTodayUtc()
  const entryDate = shiftUtcDays(today, dayOffset)

  if (dayOffset === 0) {
    return `Today, ${time}`
  }

  if (dayOffset === -1) {
    return `Yesterday, ${time}`
  }

  return `${monthDayFormatter.format(entryDate)}, ${time}`
}
