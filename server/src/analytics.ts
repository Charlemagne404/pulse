import type {
  AnalyticsBreakdownRow,
  AnalyticsGranularity,
  AnalyticsMetric,
  AnalyticsRange,
  AnalyticsSeriesPoint,
  OverviewAnalyticsResponse,
  OverviewTopProjectRow,
  PagesReportResponse,
  ProjectAnalyticsResponse,
  RecentEventRow,
  ReferrersReportResponse,
  StoredPulseEvent,
} from './types.js'
import { getProjectMetadata } from './projects.js'

const MS_PER_DAY = 24 * 60 * 60 * 1000
const DIRECT_LABEL = 'direct / none'
const OWNED_HOSTS = new Set(['continental.com', 'www.continental.com'])
const SEARCH_HOSTS = new Set(['google.com', 'www.google.com', 'bing.com', 'www.bing.com'])

interface SessionSummary {
  pageViews: number
  engagementEvents: number
  durationSeconds: number
  pages: string[]
  entryReferrer: string
}

const round = (value: number, digits = 1) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

const percentage = (part: number, total: number) => (total > 0 ? round((part / total) * 100, 1) : 0)

const countDistinct = (values: Iterable<string>) => {
  const set = new Set<string>()
  for (const value of values) {
    if (value) {
      set.add(value)
    }
  }
  return set.size
}

const formatBucketLabel = (date: Date, granularity: AnalyticsGranularity) => {
  if (granularity === 'month') {
    return new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(date)
  }

  if (granularity === 'week') {
    return `${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date)} wk`
  }

  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date)
}

const startOfUtcDay = (date: Date) => Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())

const startOfUtcWeek = (date: Date) => {
  const day = date.getUTCDay()
  const mondayOffset = (day + 6) % 7
  return startOfUtcDay(new Date(date.getTime() - mondayOffset * MS_PER_DAY))
}

const startOfUtcMonth = (date: Date) => Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)

const bucketStart = (date: Date, granularity: AnalyticsGranularity) => {
  if (granularity === 'month') {
    return startOfUtcMonth(date)
  }

  if (granularity === 'week') {
    return startOfUtcWeek(date)
  }

  return startOfUtcDay(date)
}

const normalizeReferrer = (value: string | undefined) => (value ? value.toLowerCase() : DIRECT_LABEL)

const compareByValueDesc = (a: AnalyticsBreakdownRow, b: AnalyticsBreakdownRow) => b.value - a.value || a.label.localeCompare(b.label)

const summarizeBreakdown = (counts: Map<string, number>, total: number, limit = 5) =>
  Array.from(counts.entries())
    .map(([label, value]) => ({
      label,
      value,
      share: percentage(value, total),
    }))
    .sort(compareByValueDesc)
    .slice(0, limit)

const toRecentEventRow = (event: StoredPulseEvent): RecentEventRow => ({
  eventId: event.eventId,
  receivedAt: event.receivedAt,
  occurredAt: event.occurredAt,
  eventName: event.eventName,
  projectId: event.projectId,
  path: event.page.path,
  deviceType: event.context?.deviceType || 'unknown',
  browserName: event.context?.browserName || 'Unknown',
  countryCode: event.context?.countryCode || 'XX',
  consentState: event.consent.state,
  consentMode: event.consent.mode,
})

const groupSessions = (events: StoredPulseEvent[]) => {
  const sessions = new Map<string, StoredPulseEvent[]>()

  for (const event of events) {
    const sessionId = event.identity?.sessionId
    if (!sessionId) {
      continue
    }

    const group = sessions.get(sessionId)
    if (group) {
      group.push(event)
    } else {
      sessions.set(sessionId, [event])
    }
  }

  return sessions
}

const summarizeSessions = (events: StoredPulseEvent[]) => {
  const sessions = groupSessions(events)
  const summaries = new Map<string, SessionSummary>()

  for (const [sessionId, sessionEvents] of sessions.entries()) {
    const sorted = [...sessionEvents].sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt))
    let pageViews = 0
    let engagementEvents = 0
    let durationSeconds = 0
    const pages: string[] = []

    for (let index = 0; index < sorted.length; index += 1) {
      const current = sorted[index]
      if (!current) {
        continue
      }

      if (current.eventName === 'page_view') {
        pageViews += 1
        pages.push(current.page.path)
      } else {
        engagementEvents += 1
      }

      const next = sorted[index + 1]
      if (!next) {
        continue
      }

      const deltaSeconds = Math.max(0, Math.floor((Date.parse(next.occurredAt) - Date.parse(current.occurredAt)) / 1000))
      durationSeconds += Math.min(deltaSeconds, 30 * 60)
    }

    summaries.set(sessionId, {
      pageViews,
      engagementEvents,
      durationSeconds,
      pages,
      entryReferrer: normalizeReferrer(sorted[0]?.page.referrer),
    })
  }

  return summaries
}

export const resolveRange = (
  events: StoredPulseEvent[],
  fromRaw: string | null,
  toRaw: string | null,
  granularityRaw: string | null,
) => {
  const granularity: AnalyticsGranularity =
    granularityRaw === 'week' || granularityRaw === 'month' ? granularityRaw : 'day'

  const eventTimes = events.map((event) => Date.parse(event.occurredAt)).filter((value) => Number.isFinite(value))
  const fallbackEnd = eventTimes.length ? new Date(Math.max(...eventTimes)) : new Date()
  const fallbackStart = new Date(fallbackEnd.getTime() - 6 * MS_PER_DAY)

  const from = fromRaw ? new Date(fromRaw) : fallbackStart
  const to = toRaw ? new Date(toRaw) : fallbackEnd

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from.getTime() > to.getTime()) {
    throw new Error('Invalid analytics range. Use ISO dates where from <= to.')
  }

  return {
    range: {
      from: from.toISOString(),
      to: to.toISOString(),
      granularity,
    } satisfies AnalyticsRange,
    fromMs: from.getTime(),
    toMs: to.getTime(),
  }
}

export const filterEventsByRange = (events: StoredPulseEvent[], fromMs: number, toMs: number, projectId?: string) =>
  events.filter((event) => {
    const eventTime = Date.parse(event.occurredAt)
    if (!Number.isFinite(eventTime) || eventTime < fromMs || eventTime > toMs) {
      return false
    }

    return projectId ? event.projectId === projectId : true
  })

const buildSeries = (events: StoredPulseEvent[], range: AnalyticsRange): AnalyticsSeriesPoint[] => {
  const buckets = new Map<number, number>()

  for (const event of events) {
    if (event.eventName !== 'page_view') {
      continue
    }

    const date = new Date(event.occurredAt)
    const start = bucketStart(date, range.granularity)
    buckets.set(start, (buckets.get(start) || 0) + 1)
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([start, value]) => ({
      label: formatBucketLabel(new Date(start), range.granularity),
      value,
    }))
}

const buildMetrics = (events: StoredPulseEvent[]): AnalyticsMetric[] => {
  const pageViews = events.filter((event) => event.eventName === 'page_view').length
  const uniqueVisitors = countDistinct(
    events.map((event) => event.identity?.visitorKey || '').filter(Boolean),
  )

  const liveCutoff = Date.now() - 5 * 60 * 1000
  const liveVisitors = countDistinct(
    events
      .filter((event) => Date.parse(event.occurredAt) >= liveCutoff)
      .map((event) => event.identity?.sessionId || '')
      .filter(Boolean),
  )

  const sessionSummaries = summarizeSessions(events)
  const sessions = Array.from(sessionSummaries.values())
  const bouncedSessions = sessions.filter((session) => session.pageViews === 1 && session.engagementEvents === 0).length
  const totalSessionDuration = sessions.reduce((sum, session) => sum + session.durationSeconds, 0)

  return [
    { key: 'page_views', label: 'Page Views', value: pageViews, unit: 'count' },
    { key: 'unique_visitors', label: 'Unique Visitors', value: uniqueVisitors, unit: 'count', approximate: true },
    { key: 'live_visitors', label: 'Live Visitors', value: liveVisitors, unit: 'count', approximate: true },
    {
      key: 'bounce_rate',
      label: 'Bounce Rate',
      value: percentage(bouncedSessions, sessions.length),
      unit: 'percent',
    },
    {
      key: 'avg_engagement_time',
      label: 'Avg. Engagement Time',
      value: sessions.length ? Math.round(totalSessionDuration / sessions.length) : 0,
      unit: 'seconds',
    },
  ]
}

const buildTopProjects = (events: StoredPulseEvent[]): OverviewTopProjectRow[] => {
  const pageViewsByProject = new Map<string, number>()
  const visitorKeysByProject = new Map<string, Set<string>>()
  let totalPageViews = 0

  for (const event of events) {
    if (event.eventName !== 'page_view') {
      continue
    }

    totalPageViews += 1
    pageViewsByProject.set(event.projectId, (pageViewsByProject.get(event.projectId) || 0) + 1)

    const visitorKey = event.identity?.visitorKey
    if (visitorKey) {
      const set = visitorKeysByProject.get(event.projectId) || new Set<string>()
      set.add(visitorKey)
      visitorKeysByProject.set(event.projectId, set)
    }
  }

  return Array.from(pageViewsByProject.entries())
    .map(([projectId, pageViews]) => {
      const project = getProjectMetadata(projectId)
      return {
        projectId,
        projectName: project.name,
        pageViews,
        uniqueVisitors: visitorKeysByProject.get(projectId)?.size || 0,
        share: percentage(pageViews, totalPageViews),
      }
    })
    .sort((a, b) => b.pageViews - a.pageViews || a.projectName.localeCompare(b.projectName))
}

const countBy = (events: StoredPulseEvent[], selector: (event: StoredPulseEvent) => string, filter?: (event: StoredPulseEvent) => boolean) => {
  const counts = new Map<string, number>()

  for (const event of events) {
    if (filter && !filter(event)) {
      continue
    }

    const key = selector(event)
    counts.set(key, (counts.get(key) || 0) + 1)
  }

  return counts
}

export const buildOverviewResponse = (events: StoredPulseEvent[], range: AnalyticsRange): OverviewAnalyticsResponse => {
  const pageViewCount = events.filter((event) => event.eventName === 'page_view').length
  const topPages = summarizeBreakdown(
    countBy(events, (event) => event.page.path, (event) => event.eventName === 'page_view'),
    pageViewCount,
  )
  const topReferrers = summarizeBreakdown(
    countBy(events, (event) => normalizeReferrer(event.page.referrer), (event) => event.eventName === 'page_view'),
    pageViewCount,
  )
  const deviceMix = summarizeBreakdown(
    countBy(events, (event) => event.context?.deviceType || 'unknown', (event) => event.eventName === 'page_view'),
    pageViewCount,
      10,
  )
  const browserMix = summarizeBreakdown(
    countBy(events, (event) => event.context?.browserName || 'Unknown', (event) => event.eventName === 'page_view'),
    pageViewCount,
      10,
  )

  return {
    range,
    totals: {
      acceptedEvents: events.length,
      trackedProjects: new Set(events.map((event) => event.projectId)).size,
    },
    metrics: buildMetrics(events),
    series: buildSeries(events, range),
    topProjects: buildTopProjects(events).slice(0, 5),
    topPages,
    topReferrers,
    deviceMix,
    browserMix,
    recentEvents: [...events]
      .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
      .slice(0, 10)
      .map(toRecentEventRow),
  }
}

export const buildProjectOverviewResponse = (
  events: StoredPulseEvent[],
  range: AnalyticsRange,
  projectId: string,
): ProjectAnalyticsResponse => {
  const project = getProjectMetadata(projectId)
  const pageViewCount = events.filter((event) => event.eventName === 'page_view').length

  return {
    range,
    project: {
      projectId,
      projectName: project.name,
    },
    metrics: buildMetrics(events),
    series: buildSeries(events, range),
    topPages: summarizeBreakdown(
      countBy(events, (event) => event.page.path, (event) => event.eventName === 'page_view'),
      pageViewCount,
    ),
    topReferrers: summarizeBreakdown(
      countBy(events, (event) => normalizeReferrer(event.page.referrer), (event) => event.eventName === 'page_view'),
      pageViewCount,
    ),
    eventTable: Array.from(countBy(events, (event) => event.eventName).entries())
      .map(([label, value]) => ({ label, value }))
      .sort(compareByValueDesc)
      .slice(0, 10),
    countryMix: summarizeBreakdown(
      countBy(events, (event) => event.context?.countryCode || 'XX', (event) => event.eventName === 'page_view'),
      pageViewCount,
      10,
    ),
    recentEvents: [...events]
      .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
      .slice(0, 10)
      .map(toRecentEventRow),
  }
}

export const buildPagesReportResponse = (events: StoredPulseEvent[], range: AnalyticsRange): PagesReportResponse => {
  const sessionSummaries = summarizeSessions(events)
  const exits = new Map<string, number>()
  const inclusions = new Map<string, number>()
  const landings = new Map<string, number>()

  for (const session of sessionSummaries.values()) {
    const seen = new Set<string>()
    const firstPage = session.pages[0]
    const lastPage = session.pages[session.pages.length - 1]

    if (firstPage) {
      landings.set(firstPage, (landings.get(firstPage) || 0) + 1)
    }

    if (lastPage) {
      exits.set(lastPage, (exits.get(lastPage) || 0) + 1)
    }

    for (const page of session.pages) {
      if (!seen.has(page)) {
        inclusions.set(page, (inclusions.get(page) || 0) + 1)
        seen.add(page)
      }
    }
  }

  const pageViews = countBy(events, (event) => event.page.path, (event) => event.eventName === 'page_view')
  const rows = Array.from(pageViews.entries())
    .map(([label, value]) => ({
      label,
      value,
      share: percentage(exits.get(label) || 0, inclusions.get(label) || 0),
    }))
    .sort(compareByValueDesc)
    .slice(0, 10)

  const exitRates = rows.map((row) => row.share || 0)

  return {
    range,
    trackedPages: pageViews.size,
    topLandingPages: landings.size,
    averageExitRate: exitRates.length ? round(exitRates.reduce((sum, value) => sum + value, 0) / exitRates.length, 1) : 0,
    rows,
  }
}

export const buildReferrersReportResponse = (events: StoredPulseEvent[], range: AnalyticsRange): ReferrersReportResponse => {
  const sessionSummaries = summarizeSessions(events)
  const referrerCounts = new Map<string, number>()
  let ownedVisits = 0
  let searchLedVisits = 0

  for (const session of sessionSummaries.values()) {
    const referrer = session.entryReferrer
    referrerCounts.set(referrer, (referrerCounts.get(referrer) || 0) + 1)

    if (OWNED_HOSTS.has(referrer)) {
      ownedVisits += 1
    }

    if (SEARCH_HOSTS.has(referrer)) {
      searchLedVisits += 1
    }
  }

  const totalVisits = Array.from(referrerCounts.values()).reduce((sum, value) => sum + value, 0)

  return {
    range,
    trackedReferrers: referrerCounts.size,
    ownedShare: percentage(ownedVisits, totalVisits),
    searchLedVisits,
    rows: summarizeBreakdown(referrerCounts, totalVisits, 10),
  }
}
