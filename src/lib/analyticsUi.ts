import { projectDirectory } from '../data/content'
import type { AnalyticsBreakdownRow, AnalyticsMetric, AnalyticsRange } from './analyticsApi'

const compactNumberFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

const integerFormatter = new Intl.NumberFormat('en-US')

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

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

const regionNames =
  typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['en'], { type: 'region' }) : null

const DEVICE_COLORS = ['#d59c31', '#347fff', '#5c6c88', '#35c585', '#9e6bff']

const projectById = new Map(projectDirectory.map((project) => [project.slug, project]))

export interface MetricCardModel {
  label: string
  value: string
  delta?: string
  note?: string
  live?: boolean
}

const formatRange = (from: string, to: string) => {
  const start = new Date(from)
  const end = new Date(to)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 'Custom range'
  }

  return `${shortDayFormatter.format(start)} - ${shortDayWithYearFormatter.format(end)}`
}

const formatPercent = (value: number) => {
  const rounded = Math.round(value * 10) / 10
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`
}

export const formatCount = (value: number) => {
  if (Math.abs(value) >= 1000) {
    return compactNumberFormatter.format(value)
  }

  return integerFormatter.format(value)
}

export const formatDurationSeconds = (value: number) => {
  const rounded = Math.max(0, Math.round(value))
  const hours = Math.floor(rounded / 3600)
  const minutes = Math.floor((rounded % 3600) / 60)
  const seconds = rounded % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }

  return `${seconds}s`
}

export const formatMetricValue = (metric: AnalyticsMetric) => {
  if (metric.unit === 'percent') {
    return formatPercent(metric.value)
  }

  if (metric.unit === 'seconds') {
    return formatDurationSeconds(metric.value)
  }

  return formatCount(metric.value)
}

export const buildMetricCards = (metrics: AnalyticsMetric[]): MetricCardModel[] =>
  metrics.map((metric) => ({
    label: metric.label,
    value: formatMetricValue(metric),
    delta: metric.key === 'live_visitors' ? 'Live' : undefined,
    note: metric.approximate ? 'Approximate' : undefined,
    live: metric.key === 'live_visitors',
  }))

export const formatBreakdownShare = (value?: number) => formatPercent(value || 0)

export const formatRecentEventTime = (occurredAt: string) => {
  const date = new Date(occurredAt)
  return Number.isNaN(date.getTime()) ? occurredAt : timeFormatter.format(date)
}

export const formatCountryCode = (countryCode: string) => {
  if (!countryCode || countryCode === 'XX') {
    return 'Unknown'
  }

  return regionNames?.of(countryCode.toUpperCase()) || countryCode.toUpperCase()
}

export const formatDeviceLabel = (deviceType: string) => {
  if (!deviceType) {
    return 'Unknown'
  }

  return deviceType.charAt(0).toUpperCase() + deviceType.slice(1)
}

export const buildDeviceSegments = (rows: AnalyticsBreakdownRow[]) =>
  rows.map((row, index) => ({
    label: formatDeviceLabel(row.label),
    share: row.share || 0,
    color: DEVICE_COLORS[index % DEVICE_COLORS.length] || DEVICE_COLORS[0],
  }))

export const getProjectName = (projectId: string) => projectById.get(projectId)?.name || projectId

export const getProjectSlug = (projectId: string) => projectById.get(projectId)?.slug || projectId

export const getProjectFilterLabel = (projectId: string | null) => {
  if (!projectId) {
    return 'All projects'
  }

  return getProjectName(projectId)
}

export const formatAnalyticsRangeLabel = (range: AnalyticsRange) => formatRange(range.from, range.to)

export const buildReportRowDetail = (reportKey: 'pages' | 'referrers', row: AnalyticsBreakdownRow) => {
  if (reportKey === 'pages') {
    return `${formatBreakdownShare(row.share)} exit rate across sessions that included this page.`
  }

  return `${formatBreakdownShare(row.share)} of tracked visits started from this referrer.`
}
