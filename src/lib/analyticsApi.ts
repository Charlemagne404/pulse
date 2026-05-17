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

export interface RecentEventsPageResponse {
  range: AnalyticsRange
  filters: {
    projectId?: string
    eventName?: string
    deviceType?: string
    countryCode?: string
    pathPrefix?: string
  }
  rows: RecentEventRow[]
  page: {
    limit: number
    hasMore: boolean
    nextCursor: string | null
  }
}

export interface AnalyticsQueryOptions {
  from?: string
  to?: string
  granularity?: AnalyticsGranularity
  projectId?: string
}

export interface RecentEventsQueryOptions extends AnalyticsQueryOptions {
  eventName?: string
  deviceType?: string
  countryCode?: string
  pathPrefix?: string
  cursor?: string
  limit?: number
}

interface ApiErrorPayload {
  message?: string
}

const configuredApiBase = (import.meta.env.VITE_PULSE_API_BASE_URL || '').trim().replace(/\/+$/, '')
const JSON_CONTENT_TYPE = 'application/json'

type RequestQueryOptions = AnalyticsQueryOptions | RecentEventsQueryOptions

const buildRequestUrl = (path: string, options: RequestQueryOptions) => {
  const baseUrl = configuredApiBase || window.location.origin
  const url = new URL(path, baseUrl)

  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined && value !== '') {
      url.searchParams.set(key, String(value))
    }
  }

  return url
}

const buildNonJsonResponseMessage = (response: Response) => {
  const contentType = response.headers.get('content-type') || 'unknown content type'
  return `Analytics API returned ${contentType} instead of JSON. Check that /api and /v1 are routed to the Pulse backend.`
}

const buildErrorMessage = async (response: Response) => {
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes(JSON_CONTENT_TYPE)) {
    return buildNonJsonResponseMessage(response)
  }

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
  options: RequestQueryOptions = {},
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

  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes(JSON_CONTENT_TYPE)) {
    throw new Error(buildNonJsonResponseMessage(response))
  }

  try {
    return (await response.json()) as T
  } catch {
    throw new Error('Analytics API returned invalid JSON. Check that the backend is reachable and not serving HTML.')
  }
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

export const fetchRecentEventsPage = (options: RecentEventsQueryOptions = {}, signal?: AbortSignal) =>
  requestJson<RecentEventsPageResponse>('/v1/analytics/events/recent', options, signal)
