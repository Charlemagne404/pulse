export type AnalyticsGranularity = 'day' | 'week' | 'month'

export interface AnalyticsRange {
  from: string
  to: string
  granularity: AnalyticsGranularity
}

export interface AnalyticsMetric {
  key: string
  label: string
  value: number
  unit?: 'count' | 'percent' | 'seconds'
  approximate?: boolean
}

export interface AnalyticsSeriesPoint {
  label: string
  value: number
}

export interface AnalyticsBreakdownRow {
  label: string
  value: number
  share?: number
}

export interface RecentEventRow {
  occurredAt: string
  eventName: string
  projectId: string
  path: string
  deviceType: string
  browserName: string
  countryCode: string
}

export interface OverviewTopProjectRow {
  projectId: string
  projectName: string
  pageViews: number
  uniqueVisitors: number
  share: number
}

export interface OverviewAnalyticsResponse {
  range: AnalyticsRange
  totals: {
    acceptedEvents: number
    trackedProjects: number
  }
  metrics: AnalyticsMetric[]
  series: AnalyticsSeriesPoint[]
  topProjects: OverviewTopProjectRow[]
  topPages: AnalyticsBreakdownRow[]
  topReferrers: AnalyticsBreakdownRow[]
  deviceMix: AnalyticsBreakdownRow[]
  browserMix: AnalyticsBreakdownRow[]
  recentEvents: RecentEventRow[]
}

export interface ProjectAnalyticsResponse {
  range: AnalyticsRange
  project: {
    projectId: string
    projectName: string
  }
  metrics: AnalyticsMetric[]
  series: AnalyticsSeriesPoint[]
  topPages: AnalyticsBreakdownRow[]
  topReferrers: AnalyticsBreakdownRow[]
  eventTable: AnalyticsBreakdownRow[]
  countryMix: AnalyticsBreakdownRow[]
  recentEvents: RecentEventRow[]
}

export interface PagesReportResponse {
  range: AnalyticsRange
  trackedPages: number
  topLandingPages: number
  averageExitRate: number
  rows: AnalyticsBreakdownRow[]
}

export interface ReferrersReportResponse {
  range: AnalyticsRange
  trackedReferrers: number
  ownedShare: number
  searchLedVisits: number
  rows: AnalyticsBreakdownRow[]
}

export interface AnalyticsQueryOptions {
  from?: string
  to?: string
  granularity?: AnalyticsGranularity
  projectId?: string
}

interface ApiErrorPayload {
  message?: string
}

const configuredApiBase = (import.meta.env.VITE_PULSE_API_BASE_URL || '').trim().replace(/\/+$/, '')

const buildRequestUrl = (path: string, options: AnalyticsQueryOptions) => {
  const baseUrl = configuredApiBase || window.location.origin
  const url = new URL(path, baseUrl)

  if (options.from) {
    url.searchParams.set('from', options.from)
  }

  if (options.to) {
    url.searchParams.set('to', options.to)
  }

  if (options.granularity) {
    url.searchParams.set('granularity', options.granularity)
  }

  if (options.projectId) {
    url.searchParams.set('projectId', options.projectId)
  }

  return url
}

const buildErrorMessage = async (response: Response) => {
  try {
    const payload = (await response.json()) as ApiErrorPayload
    if (payload.message) {
      return payload.message
    }
  } catch {
    // Fall back to a generic HTTP message when the server payload is unavailable.
  }

  return `Analytics request failed with status ${response.status}.`
}

const requestJson = async <T>(
  path: string,
  options: AnalyticsQueryOptions = {},
  signal?: AbortSignal,
): Promise<T> => {
  const response = await fetch(buildRequestUrl(path, options), {
    signal,
    headers: {
      accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(await buildErrorMessage(response))
  }

  return (await response.json()) as T
}

export const fetchOverviewAnalytics = (options: AnalyticsQueryOptions = {}, signal?: AbortSignal) =>
  requestJson<OverviewAnalyticsResponse>('/v1/analytics/overview', options, signal)

export const fetchProjectOverview = (
  projectId: string,
  options: AnalyticsQueryOptions = {},
  signal?: AbortSignal,
) =>
  requestJson<ProjectAnalyticsResponse>(
    `/v1/analytics/projects/${encodeURIComponent(projectId)}/overview`,
    options,
    signal,
  )

export const fetchPagesReport = (options: AnalyticsQueryOptions = {}, signal?: AbortSignal) =>
  requestJson<PagesReportResponse>('/v1/analytics/reports/pages', options, signal)

export const fetchReferrersReport = (options: AnalyticsQueryOptions = {}, signal?: AbortSignal) =>
  requestJson<ReferrersReportResponse>('/v1/analytics/reports/referrers', options, signal)
