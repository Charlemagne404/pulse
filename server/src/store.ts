import { readFile } from 'node:fs/promises'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { conflict } from './errors.js'
import { getProjectMetadata } from './projects.js'
import type {
  AuthenticatedAccount,
  AnalyticsBreakdownRow,
  AnalyticsGranularity,
  AnalyticsRange,
  ConsentSnapshot,
  CollectorConfig,
  ProjectRecord,
  OverviewAnalyticsResponse,
  OverviewTopProjectRow,
  PagesReportResponse,
  ProjectAnalyticsResponse,
  RecentEventRow,
  RecentEventsPageResponse,
  ReferrersReportResponse,
  StoredPulseEvent,
} from './types.js'

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

interface TimestampBounds {
  minOccurredAtMs: number | null
  maxOccurredAtMs: number | null
}

interface ResolvedRange {
  range: AnalyticsRange
  fromMs: number
  toMs: number
}

interface DayPartition {
  fullBucketFromMs: number | null
  fullBucketToMs: number | null
  edgeRanges: Array<{ fromMs: number; toMs: number }>
}

interface RecentEventsQuery {
  fromRaw: string | null
  toRaw: string | null
  granularityRaw: string | null
  projectId?: string | undefined
  eventName?: string | undefined
  deviceType?: string | undefined
  countryCode?: string | undefined
  pathPrefix?: string | undefined
  limitRaw?: string | null
  cursorRaw?: string | null
}

interface RecentEventsCursor {
  occurredAtMs: number
  eventId: string
}

interface HealthSnapshot {
  service: string
  status: 'ok' | 'degraded'
  timestamp: string
  storage: 'sqlite'
  allowedProjects: string[]
  allowedEvents: string[]
  storedEvents: number
  invalidLines: number
  duplicateEventIds: number
  databasePath: string
  lastRollupAt: string | null
  lastRetentionAt: string | null
  pendingRollupBuckets: number
  retentionDeletedEvents: number
}

interface RegisteredProjectRow {
  project_id: string
  project_name: string
  site_host: string
  integration_preset: 'website' | 'spa'
  created_at: string
  owner_account_id: string
  owner_email: string
  owner_display_name: string
}

const round = (value: number, digits = 1) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

const percentage = (part: number, total: number) => (total > 0 ? round((part / total) * 100, 1) : 0)

const normalizeReferrer = (value: string | undefined) => (value ? value.toLowerCase() : DIRECT_LABEL)

const compareByValueDesc = (a: AnalyticsBreakdownRow, b: AnalyticsBreakdownRow) => b.value - a.value || a.label.localeCompare(b.label)

const summarizeBreakdown = (counts: Map<string, number>, total: number, limit = 5) =>
  Array.from(counts.entries())
    .filter(([, value]) => value > 0)
    .map(([label, value]) => ({
      label,
      value,
      share: percentage(value, total),
    }))
    .sort(compareByValueDesc)
    .slice(0, limit)

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

const summarizeSessions = (events: StoredPulseEvent[]) => {
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

const buildSeries = (dayCounts: Map<number, number>, granularity: AnalyticsGranularity) =>
  Array.from(dayCounts.entries())
    .sort(([a], [b]) => a - b)
    .reduce((buckets, [dayStartMs, value]) => {
      const seriesBucket = bucketStart(new Date(dayStartMs), granularity)
      buckets.set(seriesBucket, (buckets.get(seriesBucket) || 0) + value)
      return buckets
    }, new Map<number, number>())

const resolveRange = (
  bounds: TimestampBounds,
  fromRaw: string | null,
  toRaw: string | null,
  granularityRaw: string | null,
): ResolvedRange => {
  const granularity: AnalyticsGranularity =
    granularityRaw === 'week' || granularityRaw === 'month' ? granularityRaw : 'day'

  const fallbackEnd = bounds.maxOccurredAtMs ? new Date(bounds.maxOccurredAtMs) : new Date()
  const fallbackStart = bounds.maxOccurredAtMs ? new Date(fallbackEnd.getTime() - 6 * MS_PER_DAY) : new Date(fallbackEnd.getTime() - 6 * MS_PER_DAY)

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
    },
    fromMs: from.getTime(),
    toMs: to.getTime(),
  }
}

const clampLimit = (value: string | null | undefined, fallback: number) => {
  if (!value) {
    return fallback
  }

  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.min(100, Math.max(1, parsed))
}

const decodeCursor = (value: string | null | undefined): RecentEventsCursor | null => {
  if (!value) {
    return null
  }

  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as RecentEventsCursor
    if (!Number.isFinite(parsed.occurredAtMs) || typeof parsed.eventId !== 'string' || !parsed.eventId) {
      throw new Error('Invalid cursor.')
    }

    return parsed
  } catch {
    throw new Error('Invalid cursor.')
  }
}

const encodeCursor = (cursor: RecentEventsCursor) =>
  Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url')

const partitionRangeByDay = (fromMs: number, toMs: number): DayPartition => {
  const fromDayStart = startOfUtcDay(new Date(fromMs))
  const toDayStart = startOfUtcDay(new Date(toMs))
  const fromDayEnd = fromDayStart + MS_PER_DAY - 1
  const toDayEnd = toDayStart + MS_PER_DAY - 1

  if (fromDayStart === toDayStart) {
    return {
      fullBucketFromMs: null,
      fullBucketToMs: null,
      edgeRanges: [{ fromMs, toMs }],
    }
  }

  const edgeRanges: Array<{ fromMs: number; toMs: number }> = []

  if (fromMs > fromDayStart) {
    edgeRanges.push({ fromMs, toMs: Math.min(toMs, fromDayEnd) })
  }

  if (toMs < toDayEnd) {
    edgeRanges.push({ fromMs: Math.max(fromMs, toDayStart), toMs })
  }

  const fullBucketFromMs = fromMs === fromDayStart ? fromDayStart : fromDayStart + MS_PER_DAY
  const fullBucketToMs = toMs === toDayEnd ? toDayStart : toDayStart - MS_PER_DAY

  return {
    fullBucketFromMs: fullBucketFromMs <= fullBucketToMs ? fullBucketFromMs : null,
    fullBucketToMs: fullBucketFromMs <= fullBucketToMs ? fullBucketToMs : null,
    edgeRanges,
  }
}

export class SqliteEventStore {
  private readonly db: DatabaseSync
  private readonly readyPromise: Promise<void>
  private maintenanceRunPromise: Promise<void> | null = null
  private lastRetentionRunAtMs = 0
  private readonly maintenanceTimer: NodeJS.Timeout

  constructor(private readonly config: CollectorConfig) {
    mkdirSync(dirname(config.databasePath), { recursive: true })
    this.db = new DatabaseSync(config.databasePath)
    this.readyPromise = this.initialize()
    this.maintenanceTimer = setInterval(() => {
      void this.runMaintenance()
    }, config.rollupIntervalMs)
    this.maintenanceTimer.unref?.()
  }

  async close() {
    clearInterval(this.maintenanceTimer)
    await this.readyPromise
    this.db.close()
  }

  async append(events: StoredPulseEvent[]) {
    await this.readyPromise

    if (!events.length) {
      return
    }

    this.insertEventsSync(events)
    void this.runMaintenance()
  }

  async bootstrapAccountProjects(account: AuthenticatedAccount) {
    await this.readyPromise

    if (this.countRegisteredProjectsSync() > 0 || this.config.allowedProjectIds.size === 0) {
      return
    }

    this.db.exec('BEGIN IMMEDIATE')

    try {
      const insertProject = this.db.prepare(`
        INSERT INTO registered_projects (
          project_id,
          project_name,
          site_host,
          integration_preset,
          created_at,
          owner_account_id,
          owner_email,
          owner_display_name
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      const now = new Date().toISOString()

      for (const projectId of Array.from(this.config.allowedProjectIds).sort()) {
        const project = getProjectMetadata(projectId)
        insertProject.run(
          project.id,
          project.name,
          project.id,
          'website',
          now,
          account.accountId,
          account.email,
          account.displayName,
        )
      }

      this.db.exec('COMMIT')
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }

    this.backfillAccountOwnershipSync(account.accountId, Array.from(this.config.allowedProjectIds))
    this.processDirtyBucketsSync()
  }

  async createProject(
    account: AuthenticatedAccount,
    input: {
      projectId: string
      projectName: string
      siteHost: string
      integrationPreset: 'website' | 'spa'
    },
  ): Promise<ProjectRecord> {
    await this.readyPromise

    try {
      this.db
        .prepare(`
          INSERT INTO registered_projects (
            project_id,
            project_name,
            site_host,
            integration_preset,
            created_at,
            owner_account_id,
            owner_email,
            owner_display_name
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          input.projectId,
          input.projectName,
          input.siteHost,
          input.integrationPreset,
          new Date().toISOString(),
          account.accountId,
          account.email,
          account.displayName,
        )
    } catch (error) {
      if ((error as Error).message.includes('UNIQUE')) {
        throw conflict(`Project ID "${input.projectId}" is already in use.`)
      }

      throw error
    }

    return this.getProjectRecordSync(input.projectId)!
  }

  async listProjectsForAccount(accountId: string): Promise<ProjectRecord[]> {
    await this.readyPromise
    const rows = this.db
      .prepare(`
        SELECT
          project_id,
          project_name,
          site_host,
          integration_preset,
          created_at,
          owner_account_id,
          owner_email,
          owner_display_name
        FROM registered_projects
        WHERE owner_account_id = ?
        ORDER BY project_name COLLATE NOCASE ASC, project_id ASC
      `)
      .all(accountId) as unknown as RegisteredProjectRow[]

    return rows.map((row) => this.toProjectRecord(row))
  }

  async getProjectRecord(projectId: string) {
    await this.readyPromise
    return this.getProjectRecordSync(projectId)
  }

  async getProjectRecordForAccount(accountId: string, projectId: string) {
    await this.readyPromise
    const row = this.db
      .prepare(`
        SELECT
          project_id,
          project_name,
          site_host,
          integration_preset,
          created_at,
          owner_account_id,
          owner_email,
          owner_display_name
        FROM registered_projects
        WHERE owner_account_id = ?
          AND project_id = ?
      `)
      .get(accountId, projectId) as RegisteredProjectRow | undefined

    return row ? this.toProjectRecord(row) : null
  }

  async getProjectOwnershipMap(projectIds: string[]) {
    await this.readyPromise

    if (projectIds.length === 0) {
      return new Map<string, ProjectRecord>()
    }

    const placeholders = projectIds.map(() => '?').join(', ')
    const rows = this.db
      .prepare(`
        SELECT
          project_id,
          project_name,
          site_host,
          integration_preset,
          created_at,
          owner_account_id,
          owner_email,
          owner_display_name
        FROM registered_projects
        WHERE project_id IN (${placeholders})
      `)
      .all(...projectIds) as unknown as RegisteredProjectRow[]

    return new Map(rows.map((row) => [row.project_id, this.toProjectRecord(row)]))
  }

  private insertEventsSync(events: StoredPulseEvent[]) {
    this.db.exec('BEGIN IMMEDIATE')

    try {
      const insert = this.db.prepare(`
        INSERT INTO raw_events (
          event_id,
          schema_version,
          received_at,
          occurred_at,
          occurred_at_ms,
          bucket_start_ms,
          account_id,
          project_id,
          event_name,
          path,
          title,
          referrer,
          device_type,
          browser_name,
          country_code,
          language,
          consent_state,
          consent_mode,
          session_id,
          visitor_key,
          properties_json,
          event_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      const markDirty = this.db.prepare('INSERT OR IGNORE INTO dirty_rollup_buckets (bucket_start_ms) VALUES (?)')

      for (const event of events) {
        const occurredAtMs = Date.parse(event.occurredAt)
        const bucketStartMs = startOfUtcDay(new Date(occurredAtMs))

        insert.run(
          event.eventId,
          event.schemaVersion,
          event.receivedAt,
          event.occurredAt,
          occurredAtMs,
          bucketStartMs,
          event.accountId || '',
          event.projectId,
          event.eventName,
          event.page.path,
          event.page.title || null,
          normalizeReferrer(event.page.referrer),
          event.context?.deviceType || 'unknown',
          event.context?.browserName || 'Unknown',
          event.context?.countryCode || 'XX',
          event.context?.language || null,
          event.consent.state,
          event.consent.mode,
          event.identity?.sessionId || null,
          event.identity?.visitorKey || null,
          event.properties ? JSON.stringify(event.properties) : null,
          JSON.stringify(event),
        )

        markDirty.run(bucketStartMs)
      }

      this.db.exec('COMMIT')
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }

  async getExistingEventIds(eventIds: string[]) {
    await this.readyPromise

    if (!eventIds.length) {
      return new Set<string>()
    }

    const placeholders = eventIds.map(() => '?').join(', ')
    const rows = this.db
      .prepare(`SELECT event_id FROM raw_events WHERE event_id IN (${placeholders})`)
      .all(...eventIds) as Array<{ event_id: string }>

    return new Set(rows.map((row) => row.event_id))
  }

  async readHealthSnapshot(): Promise<HealthSnapshot> {
    await this.ensureCurrentReadModel()

    const storedEvents = this.countRawEventsSync()
    const invalidLines = this.getMetaNumber('legacy_invalid_lines')
    const duplicateEventIds = this.getMetaNumber('legacy_duplicate_event_ids')
    const pendingRollupBuckets = this.countPendingBucketsSync()

    return {
      service: 'pulse-collector',
      status: invalidLines > 0 ? 'degraded' : 'ok',
      timestamp: new Date().toISOString(),
      storage: 'sqlite',
      allowedProjects: Array.from(this.config.allowedProjectIds),
      allowedEvents: Array.from(this.config.allowedEventNames),
      storedEvents,
      invalidLines,
      duplicateEventIds,
      databasePath: this.config.databasePath,
      lastRollupAt: this.getMeta('last_rollup_at'),
      lastRetentionAt: this.getMeta('last_retention_at'),
      pendingRollupBuckets,
      retentionDeletedEvents: this.getMetaNumber('retention_deleted_events'),
    }
  }

  async getOverviewAnalytics(accountId: string, fromRaw: string | null, toRaw: string | null, granularityRaw: string | null) {
    await this.ensureCurrentReadModel()
    const resolved = resolveRange(this.getBoundsSync(accountId), fromRaw, toRaw, granularityRaw)
    const dayCounts = this.getPageViewDayCountsSync(accountId, resolved)
    const totalPageViews = this.getPageViewCountSync(accountId, resolved)
    const sessionEvents = this.getRangeEventsSync(accountId, resolved)
    const sessionSummaries = summarizeSessions(sessionEvents)
    const sessionValues = Array.from(sessionSummaries.values())
    const totalSessionDuration = sessionValues.reduce((sum, session) => sum + session.durationSeconds, 0)
    const bouncedSessions = sessionValues.filter((session) => session.pageViews === 1 && session.engagementEvents === 0).length
    const uniqueVisitors = this.getDistinctCountSync(accountId, 'visitor_key', resolved)
    const liveVisitors = this.getDistinctCountSync(accountId, 'session_id', resolved, Date.now() - 5 * 60 * 1000)
    const topPages = summarizeBreakdown(this.getPageViewBreakdownSync(accountId, 'path', resolved), totalPageViews)
    const topReferrers = summarizeBreakdown(this.getPageViewBreakdownSync(accountId, 'referrer', resolved), totalPageViews)
    const deviceMix = summarizeBreakdown(this.getPageViewBreakdownSync(accountId, 'device_type', resolved), totalPageViews, 10)
    const browserMix = summarizeBreakdown(this.getPageViewBreakdownSync(accountId, 'browser_name', resolved), totalPageViews, 10)

    const topProjectsPageViews = this.getPageViewBreakdownSync(accountId, 'project_id', resolved)
    const topProjectsUniqueVisitors = this.getDistinctCountsByProjectSync(accountId, resolved)
    const totalProjectPageViews = Array.from(topProjectsPageViews.values()).reduce((sum, value) => sum + value, 0)

    const topProjects = Array.from(topProjectsPageViews.entries())
      .map(([projectId, pageViews]) => {
        const project = getProjectMetadata(projectId)
        return {
          projectId,
          projectName: project.name,
          pageViews,
          uniqueVisitors: topProjectsUniqueVisitors.get(projectId) || 0,
          share: percentage(pageViews, totalProjectPageViews),
        } satisfies OverviewTopProjectRow
      })
      .sort((a, b) => b.pageViews - a.pageViews || a.projectName.localeCompare(b.projectName))
      .slice(0, 5)

    return {
      range: resolved.range,
      totals: {
        acceptedEvents: this.getAcceptedEventCountSync(accountId, resolved),
        trackedProjects: this.getTrackedProjectCountSync(accountId, resolved),
      },
      metrics: [
        { key: 'page_views', label: 'Page Views', value: totalPageViews, unit: 'count' as const },
        { key: 'unique_visitors', label: 'Unique Visitors', value: uniqueVisitors, unit: 'count' as const, approximate: true },
        { key: 'live_visitors', label: 'Live Visitors', value: liveVisitors, unit: 'count' as const, approximate: true },
        {
          key: 'bounce_rate',
          label: 'Bounce Rate',
          value: percentage(bouncedSessions, sessionValues.length),
          unit: 'percent' as const,
        },
        {
          key: 'avg_engagement_time',
          label: 'Avg. Engagement Time',
          value: sessionValues.length ? Math.round(totalSessionDuration / sessionValues.length) : 0,
          unit: 'seconds' as const,
        },
      ],
      series: Array.from(buildSeries(dayCounts, resolved.range.granularity).entries())
        .sort(([a], [b]) => a - b)
        .map(([bucketMs, value]) => ({
          label: formatBucketLabel(new Date(bucketMs), resolved.range.granularity),
          value,
        })),
      topProjects,
      topPages,
      topReferrers,
      deviceMix,
      browserMix,
      recentEvents: this.getRecentEventRowsSync(accountId, resolved, { limit: 10 }),
    } satisfies OverviewAnalyticsResponse
  }

  async getProjectOverviewAnalytics(
    accountId: string,
    projectId: string,
    fromRaw: string | null,
    toRaw: string | null,
    granularityRaw: string | null,
  ) {
    await this.ensureCurrentReadModel()
    const resolved = resolveRange(this.getBoundsSync(accountId, projectId), fromRaw, toRaw, granularityRaw)
    const pageViewCount = this.getPageViewCountSync(accountId, resolved, projectId)
    const sessionEvents = this.getRangeEventsSync(accountId, resolved, projectId)
    const sessionSummaries = summarizeSessions(sessionEvents)
    const sessionValues = Array.from(sessionSummaries.values())
    const totalSessionDuration = sessionValues.reduce((sum, session) => sum + session.durationSeconds, 0)
    const bouncedSessions = sessionValues.filter((session) => session.pageViews === 1 && session.engagementEvents === 0).length

    return {
      range: resolved.range,
      project: {
        projectId,
        projectName: getProjectMetadata(projectId).name,
      },
      metrics: [
        { key: 'page_views', label: 'Page Views', value: pageViewCount, unit: 'count' as const },
        {
          key: 'unique_visitors',
          label: 'Unique Visitors',
          value: this.getDistinctCountSync(accountId, 'visitor_key', resolved, undefined, projectId),
          unit: 'count' as const,
          approximate: true,
        },
        {
          key: 'live_visitors',
          label: 'Live Visitors',
          value: this.getDistinctCountSync(accountId, 'session_id', resolved, Date.now() - 5 * 60 * 1000, projectId),
          unit: 'count' as const,
          approximate: true,
        },
        {
          key: 'bounce_rate',
          label: 'Bounce Rate',
          value: percentage(bouncedSessions, sessionValues.length),
          unit: 'percent' as const,
        },
        {
          key: 'avg_engagement_time',
          label: 'Avg. Engagement Time',
          value: sessionValues.length ? Math.round(totalSessionDuration / sessionValues.length) : 0,
          unit: 'seconds' as const,
        },
      ],
      series: Array.from(buildSeries(this.getPageViewDayCountsSync(accountId, resolved, projectId), resolved.range.granularity).entries())
        .sort(([a], [b]) => a - b)
        .map(([bucketMs, value]) => ({
          label: formatBucketLabel(new Date(bucketMs), resolved.range.granularity),
          value,
        })),
      topPages: summarizeBreakdown(this.getPageViewBreakdownSync(accountId, 'path', resolved, projectId), pageViewCount),
      topReferrers: summarizeBreakdown(this.getPageViewBreakdownSync(accountId, 'referrer', resolved, projectId), pageViewCount),
      eventTable: summarizeBreakdown(this.getEventBreakdownSync(accountId, 'event_name', resolved, projectId), this.getAcceptedEventCountSync(accountId, resolved, projectId), 10).map(
        (row) => ({
          label: row.label,
          value: row.value,
        }),
      ),
      countryMix: summarizeBreakdown(this.getPageViewBreakdownSync(accountId, 'country_code', resolved, projectId), pageViewCount, 10),
      recentEvents: this.getRecentEventRowsSync(accountId, resolved, { projectId, limit: 10 }),
    } satisfies ProjectAnalyticsResponse
  }

  async getPagesReport(accountId: string, fromRaw: string | null, toRaw: string | null, granularityRaw: string | null, projectId?: string) {
    await this.ensureCurrentReadModel()
    const resolved = resolveRange(this.getBoundsSync(accountId, projectId), fromRaw, toRaw, granularityRaw)
    const sessionSummaries = summarizeSessions(this.getRangeEventsSync(accountId, resolved, projectId))
    const pageViews = this.getPageViewBreakdownSync(accountId, 'path', resolved, projectId)
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
      range: resolved.range,
      trackedPages: pageViews.size,
      topLandingPages: landings.size,
      averageExitRate: exitRates.length ? round(exitRates.reduce((sum, value) => sum + value, 0) / exitRates.length, 1) : 0,
      rows,
    } satisfies PagesReportResponse
  }

  async getReferrersReport(
    accountId: string,
    fromRaw: string | null,
    toRaw: string | null,
    granularityRaw: string | null,
    projectId?: string,
  ) {
    await this.ensureCurrentReadModel()
    const resolved = resolveRange(this.getBoundsSync(accountId, projectId), fromRaw, toRaw, granularityRaw)
    const sessionSummaries = summarizeSessions(this.getRangeEventsSync(accountId, resolved, projectId))
    const referrerCounts = new Map<string, number>()
    let ownedVisits = 0
    let searchLedVisits = 0

    for (const session of sessionSummaries.values()) {
      referrerCounts.set(session.entryReferrer, (referrerCounts.get(session.entryReferrer) || 0) + 1)

      if (OWNED_HOSTS.has(session.entryReferrer)) {
        ownedVisits += 1
      }

      if (SEARCH_HOSTS.has(session.entryReferrer)) {
        searchLedVisits += 1
      }
    }

    const totalVisits = Array.from(referrerCounts.values()).reduce((sum, value) => sum + value, 0)

    return {
      range: resolved.range,
      trackedReferrers: referrerCounts.size,
      ownedShare: percentage(ownedVisits, totalVisits),
      searchLedVisits,
      rows: summarizeBreakdown(referrerCounts, totalVisits, 10),
    } satisfies ReferrersReportResponse
  }

  async getConsentSnapshot(accountId: string, fromRaw: string | null, toRaw: string | null, projectId?: string): Promise<ConsentSnapshot> {
    await this.ensureCurrentReadModel()
    const resolved = resolveRange(this.getBoundsSync(accountId, projectId), fromRaw, toRaw, null)
    const projectClause = projectId ? 'AND project_id = ?' : ''
    const row = this.db
      .prepare(`
        SELECT
          SUM(CASE WHEN consent_state = 'granted' THEN 1 ELSE 0 END) AS granted,
          SUM(CASE WHEN consent_state = 'denied' THEN 1 ELSE 0 END) AS denied,
          SUM(CASE WHEN consent_state = 'unknown' THEN 1 ELSE 0 END) AS unknown,
          SUM(CASE WHEN consent_mode = 'strict' THEN 1 ELSE 0 END) AS strict_mode,
          SUM(CASE WHEN consent_mode = 'standard' THEN 1 ELSE 0 END) AS standard_mode
        FROM raw_events
        WHERE occurred_at_ms >= ?
          AND occurred_at_ms <= ?
          AND account_id = ?
          ${projectClause}
      `)
      .get(
        resolved.fromMs,
        resolved.toMs,
        accountId,
        ...(projectId ? [projectId] : []),
      ) as
      | {
          granted: number | null
          denied: number | null
          unknown: number | null
          strict_mode: number | null
          standard_mode: number | null
        }
      | undefined

    return {
      granted: row?.granted || 0,
      denied: row?.denied || 0,
      unknown: row?.unknown || 0,
      strictMode: row?.strict_mode || 0,
      standardMode: row?.standard_mode || 0,
    }
  }

  async getLatestEventAt(accountId: string, projectId?: string): Promise<string | null> {
    await this.ensureCurrentReadModel()
    const projectClause = projectId ? 'AND project_id = ?' : ''
    const row = this.db
      .prepare(`
        SELECT MAX(occurred_at) AS last_occurred_at
        FROM raw_events
        WHERE account_id = ?
        ${projectClause}
      `)
      .get(accountId, ...(projectId ? [projectId] : [])) as { last_occurred_at: string | null } | undefined

    return row?.last_occurred_at || null
  }

  async getRecentEventsPage(accountId: string, query: RecentEventsQuery): Promise<RecentEventsPageResponse> {
    await this.ensureCurrentReadModel()
    const resolved = resolveRange(this.getBoundsSync(accountId, query.projectId), query.fromRaw, query.toRaw, query.granularityRaw)
    const limit = clampLimit(query.limitRaw, 25)
    const rows = this.getRecentEventRowsSync(accountId, resolved, {
      projectId: query.projectId,
      eventName: query.eventName,
      deviceType: query.deviceType,
      countryCode: query.countryCode,
      pathPrefix: query.pathPrefix,
      cursor: decodeCursor(query.cursorRaw),
      limit: limit + 1,
    })

    const visibleRows = rows.slice(0, limit)
    const cursorRow = visibleRows[visibleRows.length - 1]
    const nextCursor = rows.length > limit && cursorRow
      ? encodeCursor({
          occurredAtMs: Date.parse(cursorRow.occurredAt),
          eventId: this.getRecentEventIdSync(accountId, cursorRow, resolved, query.projectId),
        })
      : null

    const filters: RecentEventsPageResponse['filters'] = {}
    if (query.projectId) {
      filters.projectId = query.projectId
    }
    if (query.eventName) {
      filters.eventName = query.eventName
    }
    if (query.deviceType) {
      filters.deviceType = query.deviceType as NonNullable<RecentEventsPageResponse['filters']['deviceType']>
    }
    if (query.countryCode) {
      filters.countryCode = query.countryCode
    }
    if (query.pathPrefix) {
      filters.pathPrefix = query.pathPrefix
    }

    return {
      range: resolved.range,
      filters,
      rows: visibleRows,
      page: {
        limit,
        nextCursor,
        hasMore: nextCursor !== null,
      },
    }
  }

  private async initialize() {
    this.initializeSchemaSync()
    await this.migrateLegacyFileIfNeeded()
    this.processDirtyBucketsSync()
    this.enforceRetentionSync()
    this.processDirtyBucketsSync()
  }

  private async ensureCurrentReadModel() {
    await this.readyPromise
    await this.runMaintenance()
  }

  private async runMaintenance(forceRetention = false) {
    if (this.maintenanceRunPromise) {
      return this.maintenanceRunPromise
    }

    this.maintenanceRunPromise = Promise.resolve().then(() => {
      this.processDirtyBucketsSync()

      if (forceRetention || this.isRetentionDue()) {
        this.enforceRetentionSync()
        this.processDirtyBucketsSync()
      }
    }).finally(() => {
      this.maintenanceRunPromise = null
    })

    return this.maintenanceRunPromise
  }

  private initializeSchemaSync() {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;

      CREATE TABLE IF NOT EXISTS store_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS raw_events (
        event_id TEXT PRIMARY KEY,
        schema_version INTEGER NOT NULL,
        received_at TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        occurred_at_ms INTEGER NOT NULL,
        bucket_start_ms INTEGER NOT NULL,
        account_id TEXT NOT NULL DEFAULT '',
        project_id TEXT NOT NULL,
        event_name TEXT NOT NULL,
        path TEXT NOT NULL,
        title TEXT,
        referrer TEXT NOT NULL,
        device_type TEXT NOT NULL,
        browser_name TEXT NOT NULL,
        country_code TEXT NOT NULL,
        language TEXT,
        consent_state TEXT NOT NULL,
        consent_mode TEXT NOT NULL,
        session_id TEXT,
        visitor_key TEXT,
        properties_json TEXT,
        event_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS raw_events_occurred_at_ms_idx ON raw_events (occurred_at_ms DESC, event_id DESC);
      CREATE INDEX IF NOT EXISTS raw_events_account_occurred_at_ms_idx ON raw_events (account_id, occurred_at_ms DESC, event_id DESC);
      CREATE INDEX IF NOT EXISTS raw_events_project_occurred_at_ms_idx ON raw_events (project_id, occurred_at_ms DESC, event_id DESC);
      CREATE INDEX IF NOT EXISTS raw_events_account_project_occurred_at_ms_idx ON raw_events (account_id, project_id, occurred_at_ms DESC, event_id DESC);
      CREATE INDEX IF NOT EXISTS raw_events_session_id_idx ON raw_events (session_id, occurred_at_ms ASC, event_id ASC);
      CREATE INDEX IF NOT EXISTS raw_events_visitor_key_idx ON raw_events (visitor_key, occurred_at_ms DESC);
      CREATE INDEX IF NOT EXISTS raw_events_bucket_start_ms_idx ON raw_events (bucket_start_ms);

      CREATE TABLE IF NOT EXISTS daily_rollups (
        bucket_start_ms INTEGER NOT NULL,
        account_id TEXT NOT NULL DEFAULT '',
        project_id TEXT NOT NULL,
        event_name TEXT NOT NULL,
        path TEXT NOT NULL,
        referrer TEXT NOT NULL,
        device_type TEXT NOT NULL,
        browser_name TEXT NOT NULL,
        country_code TEXT NOT NULL,
        event_count INTEGER NOT NULL,
        page_view_count INTEGER NOT NULL,
        PRIMARY KEY (
          bucket_start_ms,
          project_id,
          event_name,
          path,
          referrer,
          device_type,
          browser_name,
          country_code
        )
      );

      CREATE INDEX IF NOT EXISTS daily_rollups_bucket_project_idx ON daily_rollups (bucket_start_ms, project_id);
      CREATE INDEX IF NOT EXISTS daily_rollups_account_bucket_project_idx ON daily_rollups (account_id, bucket_start_ms, project_id);
      CREATE INDEX IF NOT EXISTS daily_rollups_bucket_path_idx ON daily_rollups (bucket_start_ms, path);

      CREATE TABLE IF NOT EXISTS dirty_rollup_buckets (
        bucket_start_ms INTEGER PRIMARY KEY
      );

      CREATE TABLE IF NOT EXISTS registered_projects (
        project_id TEXT PRIMARY KEY,
        project_name TEXT NOT NULL,
        site_host TEXT NOT NULL,
        integration_preset TEXT NOT NULL,
        created_at TEXT NOT NULL,
        owner_account_id TEXT NOT NULL,
        owner_email TEXT NOT NULL,
        owner_display_name TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS registered_projects_owner_account_idx ON registered_projects (owner_account_id, project_name);
    `)

    this.ensureColumnSync('raw_events', 'account_id', "TEXT NOT NULL DEFAULT ''")
    this.ensureColumnSync('daily_rollups', 'account_id', "TEXT NOT NULL DEFAULT ''")
  }

  private async migrateLegacyFileIfNeeded() {
    if (this.getMeta('legacy_migration_checked_at')) {
      return
    }

    if (this.countRawEventsSync() > 0) {
      this.setMeta('legacy_invalid_lines', '0')
      this.setMeta('legacy_duplicate_event_ids', '0')
      this.setMeta('legacy_migration_checked_at', new Date().toISOString())
      return
    }

    let raw: string

    try {
      raw = await readFile(this.config.legacySinkPath, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.setMeta('legacy_invalid_lines', '0')
        this.setMeta('legacy_duplicate_event_ids', '0')
        this.setMeta('legacy_migration_checked_at', new Date().toISOString())
        return
      }

      throw error
    }

    const lines = raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    const seenEventIds = new Set<string>()
    const events: StoredPulseEvent[] = []
    let invalidLines = 0
    let duplicateEventIds = 0

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line) as StoredPulseEvent
        if (!parsed || typeof parsed !== 'object' || typeof parsed.eventId !== 'string') {
          invalidLines += 1
          continue
        }

        if (seenEventIds.has(parsed.eventId)) {
          duplicateEventIds += 1
          continue
        }

        seenEventIds.add(parsed.eventId)
        events.push(parsed)
      } catch {
        invalidLines += 1
      }
    }

    this.insertEventsSync(events)
    this.setMeta('legacy_invalid_lines', String(invalidLines))
    this.setMeta('legacy_duplicate_event_ids', String(duplicateEventIds))
    this.setMeta('legacy_migration_checked_at', new Date().toISOString())
  }

  private processDirtyBucketsSync() {
    const rows = this.db.prepare('SELECT bucket_start_ms FROM dirty_rollup_buckets ORDER BY bucket_start_ms ASC').all() as Array<{ bucket_start_ms: number }>

    if (!rows.length) {
      return
    }

    this.db.exec('BEGIN IMMEDIATE')

    try {
      const deleteRollups = this.db.prepare('DELETE FROM daily_rollups WHERE bucket_start_ms = ?')
      const insertRollups = this.db.prepare(`
        INSERT INTO daily_rollups (
          bucket_start_ms,
          account_id,
          project_id,
          event_name,
          path,
          referrer,
          device_type,
          browser_name,
          country_code,
          event_count,
          page_view_count
        )
        SELECT
          bucket_start_ms,
          MIN(account_id) AS account_id,
          project_id,
          event_name,
          path,
          referrer,
          device_type,
          browser_name,
          country_code,
          COUNT(*) AS event_count,
          SUM(CASE WHEN event_name = 'page_view' THEN 1 ELSE 0 END) AS page_view_count
        FROM raw_events
        WHERE bucket_start_ms = ?
        GROUP BY
          bucket_start_ms,
          project_id,
          event_name,
          path,
          referrer,
          device_type,
          browser_name,
          country_code
      `)
      const clearDirtyBucket = this.db.prepare('DELETE FROM dirty_rollup_buckets WHERE bucket_start_ms = ?')

      for (const row of rows) {
        deleteRollups.run(row.bucket_start_ms)
        insertRollups.run(row.bucket_start_ms)
        clearDirtyBucket.run(row.bucket_start_ms)
      }

      this.db.exec('COMMIT')
      this.setMeta('last_rollup_at', new Date().toISOString())
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }

  private isRetentionDue() {
    return Date.now() - this.lastRetentionRunAtMs >= this.config.retentionIntervalMs
  }

  private enforceRetentionSync() {
    const now = new Date()
    const deletedBuckets = new Set<number>()
    let deletedEvents = 0

    this.db.exec('BEGIN IMMEDIATE')

    try {
      const cutoff = new Date(now)
      cutoff.setUTCMonth(cutoff.getUTCMonth() - this.config.defaultRetentionMonths)
      const cutoffMs = cutoff.getTime()
      const listBuckets = this.db.prepare(`
        SELECT DISTINCT bucket_start_ms
        FROM raw_events
        WHERE occurred_at_ms < ?
      `)
      const deleteOldEvents = this.db.prepare(`
        DELETE FROM raw_events
        WHERE occurred_at_ms < ?
      `)
      const markDirty = this.db.prepare('INSERT OR IGNORE INTO dirty_rollup_buckets (bucket_start_ms) VALUES (?)')

      const bucketRows = listBuckets.all(cutoffMs) as Array<{ bucket_start_ms: number }>
      for (const row of bucketRows) {
        deletedBuckets.add(row.bucket_start_ms)
      }

      const result = deleteOldEvents.run(cutoffMs) as { changes: number }
      deletedEvents += result.changes

      for (const bucketStartMs of deletedBuckets) {
        markDirty.run(bucketStartMs)
      }

      this.db.exec('COMMIT')
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }

    this.lastRetentionRunAtMs = Date.now()
    this.setMeta('last_retention_at', new Date().toISOString())
    this.setMeta('retention_deleted_events', String(this.getMetaNumber('retention_deleted_events') + deletedEvents))
  }

  private countRawEventsSync() {
    const row = this.db.prepare('SELECT COUNT(*) AS count FROM raw_events').get() as { count: number }
    return row.count
  }

  private countPendingBucketsSync() {
    const row = this.db.prepare('SELECT COUNT(*) AS count FROM dirty_rollup_buckets').get() as { count: number }
    return row.count
  }

  private getMeta(key: string) {
    const row = this.db.prepare('SELECT value FROM store_meta WHERE key = ?').get(key) as { value: string } | undefined
    return row?.value || null
  }

  private getMetaNumber(key: string) {
    const value = this.getMeta(key)
    if (!value) {
      return 0
    }

    const parsed = Number.parseInt(value, 10)
    return Number.isFinite(parsed) ? parsed : 0
  }

  private setMeta(key: string, value: string) {
    this.db
      .prepare(`
        INSERT INTO store_meta (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `)
      .run(key, value)
  }

  private ensureColumnSync(tableName: string, columnName: string, definitionSql: string) {
    const rows = this.db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>
    if (rows.some((row) => row.name === columnName)) {
      return
    }

    this.db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definitionSql}`)
  }

  private countRegisteredProjectsSync() {
    const row = this.db.prepare('SELECT COUNT(*) AS count FROM registered_projects').get() as { count: number }
    return row.count
  }

  private toProjectRecord(row: RegisteredProjectRow): ProjectRecord {
    return {
      projectId: row.project_id,
      projectName: row.project_name,
      siteHost: row.site_host,
      integrationPreset: row.integration_preset,
      createdAt: row.created_at,
      ownerAccountId: row.owner_account_id,
      ownerEmail: row.owner_email,
      ownerDisplayName: row.owner_display_name,
    }
  }

  private getProjectRecordSync(projectId: string) {
    const row = this.db
      .prepare(`
        SELECT
          project_id,
          project_name,
          site_host,
          integration_preset,
          created_at,
          owner_account_id,
          owner_email,
          owner_display_name
        FROM registered_projects
        WHERE project_id = ?
      `)
      .get(projectId) as RegisteredProjectRow | undefined

    return row ? this.toProjectRecord(row) : null
  }

  private backfillAccountOwnershipSync(accountId: string, projectIds: string[]) {
    if (projectIds.length === 0) {
      return
    }

    const updateRaw = this.db.prepare(`
      UPDATE raw_events
      SET account_id = ?
      WHERE account_id = ''
        AND project_id = ?
    `)
    const updateRollups = this.db.prepare(`
      UPDATE daily_rollups
      SET account_id = ?
      WHERE account_id = ''
        AND project_id = ?
    `)

    this.db.exec('BEGIN IMMEDIATE')

    try {
      for (const projectId of projectIds) {
        updateRaw.run(accountId, projectId)
        updateRollups.run(accountId, projectId)
      }

      this.db.exec('COMMIT')
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }

  private getBoundsSync(accountId: string, projectId?: string): TimestampBounds {
    if (projectId) {
      const row = this.db
        .prepare(`
          SELECT MIN(occurred_at_ms) AS min_occurred_at_ms, MAX(occurred_at_ms) AS max_occurred_at_ms
          FROM raw_events
          WHERE account_id = ?
            AND project_id = ?
        `)
        .get(accountId, projectId) as { min_occurred_at_ms: number | null; max_occurred_at_ms: number | null }

      return {
        minOccurredAtMs: row.min_occurred_at_ms,
        maxOccurredAtMs: row.max_occurred_at_ms,
      }
    }

    const row = this.db
      .prepare(`
        SELECT MIN(occurred_at_ms) AS min_occurred_at_ms, MAX(occurred_at_ms) AS max_occurred_at_ms
        FROM raw_events
        WHERE account_id = ?
      `)
      .get(accountId) as { min_occurred_at_ms: number | null; max_occurred_at_ms: number | null }

    return {
      minOccurredAtMs: row.min_occurred_at_ms,
      maxOccurredAtMs: row.max_occurred_at_ms,
    }
  }

  private getAcceptedEventCountSync(accountId: string, resolved: ResolvedRange, projectId?: string) {
    const partition = partitionRangeByDay(resolved.fromMs, resolved.toMs)
    let total = 0

    if (partition.fullBucketFromMs !== null && partition.fullBucketToMs !== null) {
      const params: Array<string | number> = [partition.fullBucketFromMs, partition.fullBucketToMs, accountId]
      let sql = 'SELECT COALESCE(SUM(event_count), 0) AS value FROM daily_rollups WHERE bucket_start_ms BETWEEN ? AND ? AND account_id = ?'
      if (projectId) {
        sql += ' AND project_id = ?'
        params.push(projectId)
      }

      const row = this.db.prepare(sql).get(...params) as { value: number | null }
      total += row.value || 0
    }

    total += this.sumRawEdgesSync(
      accountId,
      partition.edgeRanges,
      'COUNT(*)',
      projectId,
    )

    return total
  }

  private getPageViewCountSync(accountId: string, resolved: ResolvedRange, projectId?: string) {
    const partition = partitionRangeByDay(resolved.fromMs, resolved.toMs)
    let total = 0

    if (partition.fullBucketFromMs !== null && partition.fullBucketToMs !== null) {
      const params: Array<string | number> = [partition.fullBucketFromMs, partition.fullBucketToMs, accountId]
      let sql = 'SELECT COALESCE(SUM(page_view_count), 0) AS value FROM daily_rollups WHERE bucket_start_ms BETWEEN ? AND ? AND account_id = ?'
      if (projectId) {
        sql += ' AND project_id = ?'
        params.push(projectId)
      }

      const row = this.db.prepare(sql).get(...params) as { value: number | null }
      total += row.value || 0
    }

    total += this.sumRawEdgesSync(
      accountId,
      partition.edgeRanges,
      `SUM(CASE WHEN event_name = 'page_view' THEN 1 ELSE 0 END)`,
      projectId,
    )

    return total
  }

  private getTrackedProjectCountSync(accountId: string, resolved: ResolvedRange) {
    const row = this.db
      .prepare(`
        SELECT COUNT(DISTINCT project_id) AS count
        FROM raw_events
        WHERE occurred_at_ms BETWEEN ? AND ?
          AND account_id = ?
      `)
      .get(resolved.fromMs, resolved.toMs, accountId) as { count: number }

    return row.count
  }

  private getDistinctCountSync(
    accountId: string,
    column: 'visitor_key' | 'session_id',
    resolved: ResolvedRange,
    minOccurredAtMs?: number,
    projectId?: string,
  ) {
    const params: Array<string | number> = [resolved.fromMs, resolved.toMs, accountId]
    let sql = `
      SELECT COUNT(DISTINCT ${column}) AS count
      FROM raw_events
      WHERE occurred_at_ms BETWEEN ? AND ?
        AND account_id = ?
        AND ${column} IS NOT NULL
        AND ${column} != ''
    `

    if (minOccurredAtMs !== undefined) {
      sql += ' AND occurred_at_ms >= ?'
      params.push(minOccurredAtMs)
    }

    if (projectId) {
      sql += ' AND project_id = ?'
      params.push(projectId)
    }

    const row = this.db.prepare(sql).get(...params) as { count: number }
    return row.count
  }

  private getDistinctCountsByProjectSync(accountId: string, resolved: ResolvedRange) {
    const rows = this.db
      .prepare(`
        SELECT project_id, COUNT(DISTINCT visitor_key) AS count
        FROM raw_events
        WHERE occurred_at_ms BETWEEN ? AND ?
          AND account_id = ?
          AND visitor_key IS NOT NULL
          AND visitor_key != ''
        GROUP BY project_id
      `)
      .all(resolved.fromMs, resolved.toMs, accountId) as Array<{ project_id: string; count: number }>

    return new Map(rows.map((row) => [row.project_id, row.count]))
  }

  private getPageViewDayCountsSync(accountId: string, resolved: ResolvedRange, projectId?: string) {
    const partition = partitionRangeByDay(resolved.fromMs, resolved.toMs)
    const counts = new Map<number, number>()

    if (partition.fullBucketFromMs !== null && partition.fullBucketToMs !== null) {
      const params: Array<string | number> = [partition.fullBucketFromMs, partition.fullBucketToMs, accountId]
      let sql = `
        SELECT bucket_start_ms, SUM(page_view_count) AS value
        FROM daily_rollups
        WHERE bucket_start_ms BETWEEN ? AND ?
          AND account_id = ?
      `

      if (projectId) {
        sql += ' AND project_id = ?'
        params.push(projectId)
      }

      sql += ' GROUP BY bucket_start_ms'

      const rows = this.db.prepare(sql).all(...params) as Array<{ bucket_start_ms: number; value: number }>
      for (const row of rows) {
        counts.set(row.bucket_start_ms, row.value)
      }
    }

    for (const edge of partition.edgeRanges) {
      const params: Array<string | number> = [edge.fromMs, edge.toMs, accountId]
      let sql = `
        SELECT bucket_start_ms, SUM(CASE WHEN event_name = 'page_view' THEN 1 ELSE 0 END) AS value
        FROM raw_events
        WHERE occurred_at_ms BETWEEN ? AND ?
          AND account_id = ?
      `

      if (projectId) {
        sql += ' AND project_id = ?'
        params.push(projectId)
      }

      sql += ' GROUP BY bucket_start_ms'

      const rows = this.db.prepare(sql).all(...params) as Array<{ bucket_start_ms: number; value: number }>
      for (const row of rows) {
        counts.set(row.bucket_start_ms, (counts.get(row.bucket_start_ms) || 0) + row.value)
      }
    }

    return counts
  }

  private getPageViewBreakdownSync(
    accountId: string,
    column: 'path' | 'referrer' | 'device_type' | 'browser_name' | 'country_code' | 'project_id',
    resolved: ResolvedRange,
    projectId?: string,
  ) {
    return this.getBreakdownSync(accountId, column, 'page_view_count', `SUM(CASE WHEN event_name = 'page_view' THEN 1 ELSE 0 END)`, resolved, projectId)
  }

  private getEventBreakdownSync(accountId: string, column: 'event_name', resolved: ResolvedRange, projectId?: string) {
    return this.getBreakdownSync(accountId, column, 'event_count', 'COUNT(*)', resolved, projectId)
  }

  private getBreakdownSync(
    accountId: string,
    column: 'path' | 'referrer' | 'device_type' | 'browser_name' | 'country_code' | 'event_name' | 'project_id',
    rollupMetricColumn: 'page_view_count' | 'event_count',
    rawMetricSql: string,
    resolved: ResolvedRange,
    projectId?: string,
  ) {
    const partition = partitionRangeByDay(resolved.fromMs, resolved.toMs)
    const counts = new Map<string, number>()

    if (partition.fullBucketFromMs !== null && partition.fullBucketToMs !== null) {
      const params: Array<string | number> = [partition.fullBucketFromMs, partition.fullBucketToMs, accountId]
      let sql = `
        SELECT ${column} AS label, SUM(${rollupMetricColumn}) AS value
        FROM daily_rollups
        WHERE bucket_start_ms BETWEEN ? AND ?
          AND account_id = ?
      `

      if (projectId) {
        sql += ' AND project_id = ?'
        params.push(projectId)
      }

      sql += ` GROUP BY ${column}`

      const rows = this.db.prepare(sql).all(...params) as Array<{ label: string; value: number }>
      for (const row of rows) {
        if (row.value > 0) {
          counts.set(row.label, (counts.get(row.label) || 0) + row.value)
        }
      }
    }

    for (const edge of partition.edgeRanges) {
      const params: Array<string | number> = [edge.fromMs, edge.toMs, accountId]
      let sql = `
        SELECT ${column} AS label, ${rawMetricSql} AS value
        FROM raw_events
        WHERE occurred_at_ms BETWEEN ? AND ?
          AND account_id = ?
      `

      if (projectId) {
        sql += ' AND project_id = ?'
        params.push(projectId)
      }

      sql += ` GROUP BY ${column}`

      const rows = this.db.prepare(sql).all(...params) as Array<{ label: string; value: number }>
      for (const row of rows) {
        if (row.value > 0) {
          counts.set(row.label, (counts.get(row.label) || 0) + row.value)
        }
      }
    }

    return counts
  }

  private sumRawEdgesSync(
    accountId: string,
    edgeRanges: Array<{ fromMs: number; toMs: number }>,
    aggregateSql: string,
    projectId?: string,
  ) {
    let total = 0

    for (const edge of edgeRanges) {
      const params: Array<string | number> = [edge.fromMs, edge.toMs, accountId]
      let sql = `SELECT COALESCE(${aggregateSql}, 0) AS value FROM raw_events WHERE occurred_at_ms BETWEEN ? AND ? AND account_id = ?`

      if (projectId) {
        sql += ' AND project_id = ?'
        params.push(projectId)
      }

      const row = this.db.prepare(sql).get(...params) as { value: number | null }
      total += row.value || 0
    }

    return total
  }

  private getRangeEventsSync(accountId: string, resolved: ResolvedRange, projectId?: string) {
    const params: Array<string | number> = [resolved.fromMs, resolved.toMs, accountId]
    let sql = `
      SELECT event_json
      FROM raw_events
      WHERE occurred_at_ms BETWEEN ? AND ?
        AND account_id = ?
    `

    if (projectId) {
      sql += ' AND project_id = ?'
      params.push(projectId)
    }

    sql += ' ORDER BY occurred_at_ms ASC, event_id ASC'

    const rows = this.db.prepare(sql).all(...params) as Array<{ event_json: string }>
    return rows.map((row) => JSON.parse(row.event_json) as StoredPulseEvent)
  }

  private getRecentEventRowsSync(
    accountId: string,
    resolved: ResolvedRange,
    options: {
      projectId?: string | undefined
      eventName?: string | undefined
      deviceType?: string | undefined
      countryCode?: string | undefined
      pathPrefix?: string | undefined
      cursor?: RecentEventsCursor | null | undefined
      limit: number
    },
  ) {
    const params: Array<string | number> = [resolved.fromMs, resolved.toMs, accountId]
    let sql = `
      SELECT
        event_id,
        occurred_at_ms,
        occurred_at,
        event_name,
        project_id,
        path,
        device_type,
        browser_name,
        country_code
      FROM raw_events
      WHERE occurred_at_ms BETWEEN ? AND ?
        AND account_id = ?
    `

    if (options.projectId) {
      sql += ' AND project_id = ?'
      params.push(options.projectId)
    }

    if (options.eventName) {
      sql += ' AND event_name = ?'
      params.push(options.eventName)
    }

    if (options.deviceType) {
      sql += ' AND device_type = ?'
      params.push(options.deviceType)
    }

    if (options.countryCode) {
      sql += ' AND country_code = ?'
      params.push(options.countryCode.toUpperCase())
    }

    if (options.pathPrefix) {
      sql += ' AND path LIKE ?'
      params.push(`${options.pathPrefix}%`)
    }

    if (options.cursor) {
      sql += ' AND (occurred_at_ms < ? OR (occurred_at_ms = ? AND event_id < ?))'
      params.push(options.cursor.occurredAtMs, options.cursor.occurredAtMs, options.cursor.eventId)
    }

    sql += ' ORDER BY occurred_at_ms DESC, event_id DESC LIMIT ?'
    params.push(options.limit)

    const rows = this.db.prepare(sql).all(...params) as Array<{
      event_id: string
      occurred_at_ms: number
      occurred_at: string
      event_name: string
      project_id: string
      path: string
      device_type: string
      browser_name: string
      country_code: string
    }>

    return rows.map((row) => ({
      occurredAt: row.occurred_at,
      eventName: row.event_name,
      projectId: row.project_id,
      path: row.path,
      deviceType: row.device_type as RecentEventRow['deviceType'],
      browserName: row.browser_name,
      countryCode: row.country_code,
    }))
  }

  private getRecentEventIdSync(accountId: string, row: RecentEventRow, resolved: ResolvedRange, projectId?: string) {
    const params: Array<string | number> = [
      Date.parse(row.occurredAt),
      row.eventName,
      row.projectId,
      row.path,
      row.deviceType,
      row.browserName,
      row.countryCode,
      resolved.fromMs,
      resolved.toMs,
      accountId,
    ]
    let sql = `
      SELECT event_id
      FROM raw_events
      WHERE occurred_at_ms = ?
        AND event_name = ?
        AND project_id = ?
        AND path = ?
        AND device_type = ?
        AND browser_name = ?
        AND country_code = ?
        AND occurred_at_ms BETWEEN ? AND ?
        AND account_id = ?
    `

    if (projectId) {
      sql += ' AND project_id = ?'
      params.push(projectId)
    }

    sql += ' ORDER BY event_id DESC LIMIT 1'

    const result = this.db.prepare(sql).get(...params) as { event_id: string } | undefined
    return result?.event_id || ''
  }
}
