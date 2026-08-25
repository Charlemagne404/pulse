import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { badRequest, conflict } from './errors.js'
import { buildCsvDocument, buildPdfSummaryDocument, type ExportSection } from './export.js'
import { getProjectMetadata } from './projects.js'
import type {
  AuthenticatedAccount,
  AnalyticsBreakdownRow,
  AnalyticsGranularity,
  AnalyticsRange,
  ConsentSnapshot,
  CollectorConfig,
  CreateExportRequest,
  EventDebugDetailResponse,
  ExportRun,
  ExportSchedule,
  ProjectRecord,
  ProjectVerificationCheck,
  ProjectVerificationResponse,
  OverviewAnalyticsResponse,
  OverviewTopProjectRow,
  PagesReportResponse,
  ProjectAnalyticsResponse,
  RecentEventRow,
  RecentEventsPageResponse,
  RejectedEventRow,
  RejectedEventsPageResponse,
  ReferrersReportResponse,
  StoredPulseEvent,
  VerificationRecommendation,
  WorkspaceMember,
  WorkspaceRole,
} from './types.js'

const MS_PER_DAY = 24 * 60 * 60 * 1000
const SESSION_INACTIVITY_MS = 30 * 60 * 1000
const SESSION_MAX_LIFETIME_MS = 24 * 60 * 60 * 1000
const DIRECT_LABEL = 'direct / none'
const OWNED_HOSTS = new Set(['continental.com', 'www.continental.com'])
const SEARCH_HOSTS = new Set([
  'google.com',
  'www.google.com',
  'bing.com',
  'www.bing.com',
  'duckduckgo.com',
  'www.duckduckgo.com',
  'yahoo.com',
  'search.yahoo.com',
  'baidu.com',
  'www.baidu.com',
  'yandex.ru',
  'www.yandex.ru',
])

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

interface RecentRejectionsCursor {
  receivedAtMs: number
  rejectionId: number
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
  workspace_id: string
}

interface WorkspaceAccess {
  workspaceId: string
  workspaceName: string
  member: WorkspaceMember
}

interface WorkspaceMemberRow {
  id: number
  workspace_id: string
  account_id: string | null
  email: string
  display_name: string
  role: WorkspaceRole
  status: 'active' | 'invited'
  created_at: string
  updated_at: string
}

interface ExportScheduleRow {
  id: string
  workspace_id: string
  name: string
  report_slug: 'executive' | 'pages' | 'referrers'
  cadence: 'weekly' | 'monthly'
  format: 'pdf_summary'
  owner_account_id: string
  owner_email: string
  owner_display_name: string
  recipients_json: string
  last_run_at: string | null
  next_run_at: string
  status: 'ok' | 'delayed'
  created_at: string
  updated_at: string
}

interface ExportRunRow {
  id: string
  workspace_id: string
  schedule_id: string
  name: string
  status: 'succeeded' | 'delayed' | 'pending' | 'failed'
  format: 'pdf_summary' | 'csv'
  scope_label: string
  started_at: string
  completed_at: string | null
  row_count: number
  detail: string
  file_name: string | null
  file_path: string | null
}

const WORKSPACE_ROLE_RANK: Record<WorkspaceRole, number> = { viewer: 1, editor: 2, owner: 3 }

interface CollectorRejectionRecord {
  accountId: string
  receivedAt: string
  receivedAtMs: number
  eventId: string | null
  eventName: string | null
  projectId: string | null
  occurredAt: string | null
  occurredAtMs: number | null
  path: string | null
  deviceType: string | null
  browserName: string | null
  countryCode: string | null
  consentState: string | null
  consentMode: string | null
  reason: string
  field: string | null
  requestIndex: number
  payloadJson: string
}

interface RejectedEventsQuery {
  fromRaw: string | null
  toRaw: string | null
  granularityRaw: string | null
  projectId?: string | undefined
  eventName?: string | undefined
  pathPrefix?: string | undefined
  limitRaw?: string | null
  cursorRaw?: string | null
}

const round = (value: number, digits = 1) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

const percentage = (part: number, total: number) => (total > 0 ? round((part / total) * 100, 1) : 0)

const normalizeReferrer = (value: string | undefined) => (value ? value.toLowerCase() : DIRECT_LABEL)

const escapeLikePrefix = (value: string) => value.replace(/[\\%_]/g, '\\$&')

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

const formatBucketLabel = (date: Date, granularity: AnalyticsGranularity, includeYear = false) => {
  if (granularity === 'month') {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      ...(includeYear ? { year: 'numeric' as const } : {}),
      timeZone: 'UTC',
    }).format(date)
  }

  if (granularity === 'week') {
    return `${new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      ...(includeYear ? { year: 'numeric' as const } : {}),
      timeZone: 'UTC',
    }).format(date)} wk`
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    ...(includeYear ? { year: 'numeric' as const } : {}),
    timeZone: 'UTC',
  }).format(date)
}

const startOfUtcDay = (date: Date) => Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())

const startOfUtcWeek = (date: Date) => {
  const day = date.getUTCDay()
  const mondayOffset = (day + 6) % 7
  return startOfUtcDay(new Date(date.getTime() - mondayOffset * MS_PER_DAY))
}

const startOfUtcMonth = (date: Date) => Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * MS_PER_DAY)

const nextMondayAtHourUtc = (date: Date, hour: number) => {
  const daysSinceMonday = (date.getUTCDay() + 6) % 7
  const candidate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - daysSinceMonday, hour))
  return candidate.getTime() <= date.getTime() ? addDays(candidate, 7) : candidate
}

const nextMonthStartUtc = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1))

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

    const sessionKey = `${event.projectId}\u0000${sessionId}`
    const group = sessions.get(sessionKey)
    if (group) {
      group.push(event)
    } else {
      sessions.set(sessionKey, [event])
    }
  }

  const summaries = new Map<string, SessionSummary>()

  for (const [sessionKey, sessionEvents] of sessions.entries()) {
    const sorted = [...sessionEvents].sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt))
    let segment: StoredPulseEvent[] = []
    let segmentStartedAtMs = 0
    let previousOccurredAtMs = 0
    let segmentIndex = 0

    const flushSegment = () => {
      if (!segment.length) {
        return
      }

      let pageViews = 0
      let engagementEvents = 0
      let durationSeconds = 0
      const pages: string[] = []
      let firstPageView: StoredPulseEvent | undefined

      for (let index = 0; index < segment.length; index += 1) {
        const current = segment[index]
        if (!current) {
          continue
        }

        if (current.eventName === 'page_view') {
          pageViews += 1
          pages.push(current.page.path)
          firstPageView ||= current
        } else {
          engagementEvents += 1
        }

        const next = segment[index + 1]
        if (!next) {
          continue
        }

        const deltaSeconds = Math.max(0, Math.floor((Date.parse(next.occurredAt) - Date.parse(current.occurredAt)) / 1000))
        durationSeconds += Math.min(deltaSeconds, SESSION_INACTIVITY_MS / 1000)
      }

      // A custom event without a page view is not a visit and should not
      // affect bounce, engagement time, landing pages, or referrer totals.
      if (pageViews > 0) {
        summaries.set(`${sessionKey}\u0000${segmentIndex}`, {
          pageViews,
          engagementEvents,
          durationSeconds,
          pages,
          entryReferrer: normalizeReferrer(firstPageView?.page.referrer),
        })
      }

      segment = []
      segmentIndex += 1
    }

    for (const event of sorted) {
      const occurredAtMs = Date.parse(event.occurredAt)
      const startsNewSession = segment.length > 0 && (
        occurredAtMs - previousOccurredAtMs >= SESSION_INACTIVITY_MS
        || occurredAtMs - segmentStartedAtMs >= SESSION_MAX_LIFETIME_MS
      )

      if (startsNewSession) {
        flushSegment()
      }

      if (!segment.length) {
        segmentStartedAtMs = occurredAtMs
      }

      segment.push(event)
      previousOccurredAtMs = occurredAtMs
    }

    flushSegment()
  }

  return summaries
}

const nextSeriesBucket = (bucketMs: number, granularity: AnalyticsGranularity) => {
  if (granularity === 'month') {
    return nextMonthStartUtc(new Date(bucketMs)).getTime()
  }

  return bucketMs + (granularity === 'week' ? 7 : 1) * MS_PER_DAY
}

const buildSeries = (dayCounts: Map<number, number>, granularity: AnalyticsGranularity, fromMs: number, toMs: number) => {
  const buckets = Array.from(dayCounts.entries())
    .sort(([a], [b]) => a - b)
    .reduce((result, [dayStartMs, value]) => {
      const seriesBucket = bucketStart(new Date(dayStartMs), granularity)
      result.set(seriesBucket, (result.get(seriesBucket) || 0) + value)
      return result
    }, new Map<number, number>())

  const firstBucket = bucketStart(new Date(fromMs), granularity)
  const lastBucket = bucketStart(new Date(toMs), granularity)

  for (let bucketMs = firstBucket; bucketMs <= lastBucket; bucketMs = nextSeriesBucket(bucketMs, granularity)) {
    if (!buckets.has(bucketMs)) {
      buckets.set(bucketMs, 0)
    }
  }

  return buckets
}

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
    throw badRequest('Invalid analytics range. Use ISO dates where from <= to.')
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
    throw badRequest('Invalid cursor.')
  }
}

const encodeCursor = (cursor: RecentEventsCursor) =>
  Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url')

const decodeRejectionsCursor = (value: string | null | undefined): RecentRejectionsCursor | null => {
  if (!value) {
    return null
  }

  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as RecentRejectionsCursor
    if (
      !Number.isFinite(parsed.receivedAtMs) ||
      !Number.isFinite(parsed.rejectionId) ||
      parsed.rejectionId <= 0
    ) {
      throw new Error('Invalid cursor.')
    }

    return parsed
  } catch {
    throw badRequest('Invalid cursor.')
  }
}

const encodeRejectionsCursor = (cursor: RecentRejectionsCursor) =>
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
  private exportRunPromise: Promise<void> | null = null
  private lastRetentionRunAtMs = 0
  private readonly maintenanceTimer: NodeJS.Timeout
  private readonly exportTimer: NodeJS.Timeout

  constructor(private readonly config: CollectorConfig) {
    mkdirSync(dirname(config.databasePath), { recursive: true })
    this.db = new DatabaseSync(config.databasePath)
    this.readyPromise = this.initialize()
    this.maintenanceTimer = setInterval(() => {
      void this.runMaintenance()
    }, config.rollupIntervalMs)
    this.maintenanceTimer.unref?.()
    this.exportTimer = setInterval(() => {
      void this.runDueScheduledExports()
    }, config.exportIntervalMs)
    this.exportTimer.unref?.()
  }

  async close() {
    clearInterval(this.maintenanceTimer)
    clearInterval(this.exportTimer)
    await this.readyPromise
    await this.maintenanceRunPromise
    await this.exportRunPromise
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

  async logRejections(rejections: CollectorRejectionRecord[]) {
    await this.readyPromise

    if (!rejections.length) {
      return
    }

    this.insertRejectionsSync(rejections)
  }

  async bootstrapAccountProjects(account: AuthenticatedAccount): Promise<WorkspaceAccess> {
    await this.readyPromise

    const access = this.ensureWorkspaceAccessSync(account)

    if (this.countRegisteredProjectsSync() === 0 && this.config.allowedProjectIds.size > 0) {
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
            owner_display_name,
            workspace_id
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            access.workspaceId,
          )
        }

        this.db.exec('COMMIT')
      } catch (error) {
        this.db.exec('ROLLBACK')
        throw error
      }
    }

    this.backfillAccountOwnershipSync(access.workspaceId, Array.from(this.config.allowedProjectIds))
    this.ensureDefaultExportSchedulesSync(access)
    this.processDirtyBucketsSync()
    return access
  }

  async getWorkspaceAccess(accountId: string): Promise<WorkspaceAccess | null> {
    await this.readyPromise
    return this.getWorkspaceAccessSync(accountId)
  }

  async listWorkspaceMembers(accountId: string): Promise<WorkspaceMember[]> {
    await this.readyPromise
    const workspaceId = this.getWorkspaceIdSync(accountId)
    const rows = this.db
      .prepare(`
        SELECT id, workspace_id, account_id, email, display_name, role, status, created_at, updated_at
        FROM workspace_members
        WHERE workspace_id = ?
        ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END, display_name COLLATE NOCASE ASC
      `)
      .all(workspaceId) as unknown as WorkspaceMemberRow[]

    return rows.map((row) => this.toWorkspaceMember(row))
  }

  async inviteWorkspaceMember(
    actorAccountId: string,
    input: { email: string; displayName: string; role: WorkspaceRole },
  ): Promise<WorkspaceMember> {
    await this.readyPromise
    const workspaceId = this.getWorkspaceIdSync(actorAccountId)
    const now = new Date().toISOString()

    try {
      const result = this.db
        .prepare(`
          INSERT INTO workspace_members (workspace_id, account_id, email, display_name, role, status, created_at, updated_at)
          VALUES (?, NULL, ?, ?, ?, 'invited', ?, ?)
        `)
        .run(workspaceId, input.email.toLowerCase(), input.displayName, input.role, now, now)

      return this.toWorkspaceMember(
        this.db.prepare(`
          SELECT id, workspace_id, account_id, email, display_name, role, status, created_at, updated_at
          FROM workspace_members WHERE id = ?
        `).get(Number(result.lastInsertRowid)) as unknown as WorkspaceMemberRow,
      )
    } catch (error) {
      if ((error as Error).message.includes('UNIQUE')) {
        throw conflict(`A workspace member or invitation already exists for ${input.email}.`)
      }

      throw error
    }
  }

  async updateWorkspaceMemberRole(actorAccountId: string, memberId: number, role: WorkspaceRole): Promise<WorkspaceMember | null> {
    await this.readyPromise
    const workspaceId = this.getWorkspaceIdSync(actorAccountId)
    const member = this.db
      .prepare('SELECT id, workspace_id, account_id, email, display_name, role, status, created_at, updated_at FROM workspace_members WHERE id = ? AND workspace_id = ?')
      .get(memberId, workspaceId) as WorkspaceMemberRow | undefined

    if (!member) {
      return null
    }

    if (member.role === 'owner' && role !== 'owner') {
      const ownerCount = this.db.prepare("SELECT COUNT(*) AS count FROM workspace_members WHERE workspace_id = ? AND role = 'owner' AND status = 'active'").get(workspaceId) as { count: number }
      if (ownerCount.count <= 1) {
        throw conflict('A workspace must always have at least one active owner.')
      }
    }

    this.db.prepare('UPDATE workspace_members SET role = ?, updated_at = ? WHERE id = ? AND workspace_id = ?').run(role, new Date().toISOString(), memberId, workspaceId)
    return this.toWorkspaceMember(
      this.db.prepare('SELECT id, workspace_id, account_id, email, display_name, role, status, created_at, updated_at FROM workspace_members WHERE id = ?').get(memberId) as unknown as WorkspaceMemberRow,
    )
  }

  async removeWorkspaceMember(actorAccountId: string, memberId: number): Promise<WorkspaceMember | null> {
    await this.readyPromise
    const workspaceId = this.getWorkspaceIdSync(actorAccountId)
    const member = this.db
      .prepare('SELECT id, workspace_id, account_id, email, display_name, role, status, created_at, updated_at FROM workspace_members WHERE id = ? AND workspace_id = ?')
      .get(memberId, workspaceId) as WorkspaceMemberRow | undefined

    if (!member) {
      return null
    }

    if (member.account_id === actorAccountId) {
      throw conflict('You cannot remove your own workspace membership.')
    }

    if (member.role === 'owner') {
      const ownerCount = this.db.prepare("SELECT COUNT(*) AS count FROM workspace_members WHERE workspace_id = ? AND role = 'owner' AND status = 'active'").get(workspaceId) as { count: number }
      if (ownerCount.count <= 1) {
        throw conflict('A workspace must always have at least one active owner.')
      }
    }

    this.db.prepare('DELETE FROM workspace_members WHERE id = ? AND workspace_id = ?').run(memberId, workspaceId)
    return this.toWorkspaceMember(member)
  }

  async hasMinimumRole(accountId: string, minimumRole: WorkspaceRole): Promise<boolean> {
    await this.readyPromise
    const access = this.getWorkspaceAccessSync(accountId)
    return Boolean(access && WORKSPACE_ROLE_RANK[access.member.role] >= WORKSPACE_ROLE_RANK[minimumRole])
  }

  async refreshScheduledExports() {
    await this.runDueScheduledExports()
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
    const workspaceId = this.getWorkspaceIdSync(account.accountId)

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
            owner_display_name,
            workspace_id
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          workspaceId,
        )
    } catch (error) {
      if ((error as Error).message.includes('UNIQUE')) {
        throw conflict(`Project ID "${input.projectId}" is already in use.`)
      }

      throw error
    }

    return this.getProjectRecordSync(input.projectId)!
  }

  async deleteProjectForAccount(accountId: string, projectId: string) {
    await this.readyPromise
    const workspaceId = this.getWorkspaceIdSync(accountId)

    const project = await this.getProjectRecordForAccount(accountId, projectId)
    if (!project) {
      return null
    }

    this.db.exec('BEGIN IMMEDIATE')

    try {
      this.db
        .prepare(
          `
            DELETE FROM raw_events
            WHERE account_id = ?
              AND project_id = ?
          `,
        )
        .run(workspaceId, projectId)

      this.db
        .prepare(
          `
            DELETE FROM daily_rollups
            WHERE account_id = ?
              AND project_id = ?
          `,
        )
        .run(workspaceId, projectId)

      this.db
        .prepare(
          `
            DELETE FROM registered_projects
            WHERE workspace_id = ?
              AND project_id = ?
          `,
        )
        .run(workspaceId, projectId)

      this.db
        .prepare(
          `
            DELETE FROM collector_rejections
            WHERE account_id = ?
              AND project_id = ?
          `,
        )
        .run(workspaceId, projectId)

      this.db.exec('COMMIT')
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }

    return project
  }

  async listProjectsForAccount(accountId: string): Promise<ProjectRecord[]> {
    await this.readyPromise
    const workspaceId = this.getWorkspaceIdSync(accountId)
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
          owner_display_name,
          workspace_id
        FROM registered_projects
        WHERE workspace_id = ?
        ORDER BY project_name COLLATE NOCASE ASC, project_id ASC
      `)
      .all(workspaceId) as unknown as RegisteredProjectRow[]

    return rows.map((row) => this.toProjectRecord(row))
  }

  async getProjectRecord(projectId: string) {
    await this.readyPromise
    return this.getProjectRecordSync(projectId)
  }

  async getProjectRecordForAccount(accountId: string, projectId: string) {
    await this.readyPromise
    const workspaceId = this.getWorkspaceIdSync(accountId)
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
          owner_display_name,
          workspace_id
        FROM registered_projects
        WHERE workspace_id = ?
          AND project_id = ?
      `)
      .get(workspaceId, projectId) as RegisteredProjectRow | undefined

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
          owner_display_name,
          workspace_id
        FROM registered_projects
        WHERE project_id IN (${placeholders})
      `)
      .all(...projectIds) as unknown as RegisteredProjectRow[]

    return new Map(rows.map((row) => [row.project_id, { ...this.toProjectRecord(row), ownerAccountId: row.workspace_id }]))
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

  private insertRejectionsSync(rejections: CollectorRejectionRecord[]) {
    this.db.exec('BEGIN IMMEDIATE')

    try {
      const insert = this.db.prepare(`
        INSERT INTO collector_rejections (
          account_id,
          received_at,
          received_at_ms,
          event_id,
          event_name,
          project_id,
          occurred_at,
          occurred_at_ms,
          path,
          device_type,
          browser_name,
          country_code,
          consent_state,
          consent_mode,
          reason,
          field,
          request_index,
          payload_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      for (const rejection of rejections) {
        insert.run(
          rejection.accountId,
          rejection.receivedAt,
          rejection.receivedAtMs,
          rejection.eventId,
          rejection.eventName,
          rejection.projectId,
          rejection.occurredAt,
          rejection.occurredAtMs,
          rejection.path,
          rejection.deviceType,
          rejection.browserName,
          rejection.countryCode,
          rejection.consentState,
          rejection.consentMode,
          rejection.reason,
          rejection.field,
          rejection.requestIndex,
          rejection.payloadJson,
        )
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
    const workspaceId = this.getWorkspaceIdSync(accountId)
    const resolved = resolveRange(this.getBoundsSync(workspaceId), fromRaw, toRaw, granularityRaw)
    const dayCounts = this.getPageViewDayCountsSync(workspaceId, resolved)
    const totalPageViews = this.getPageViewCountSync(workspaceId, resolved)
    const sessionEvents = this.getRangeEventsSync(workspaceId, resolved)
    const sessionSummaries = summarizeSessions(sessionEvents)
    const sessionValues = Array.from(sessionSummaries.values())
    const totalSessionDuration = sessionValues.reduce((sum, session) => sum + session.durationSeconds, 0)
    const bouncedSessions = sessionValues.filter((session) => session.pageViews === 1 && session.engagementEvents === 0).length
    const uniqueVisitors = this.getDistinctCountSync(workspaceId, 'visitor_key', resolved)
    const liveVisitors = this.getDistinctCountSync(workspaceId, 'session_id', resolved, Date.now() - 5 * 60 * 1000)
    const topPages = summarizeBreakdown(this.getPageViewBreakdownSync(workspaceId, 'path', resolved), totalPageViews)
    const topReferrers = summarizeBreakdown(this.getPageViewBreakdownSync(workspaceId, 'referrer', resolved), totalPageViews)
    const deviceMix = summarizeBreakdown(this.getPageViewBreakdownSync(workspaceId, 'device_type', resolved), totalPageViews, 10)
    const browserMix = summarizeBreakdown(this.getPageViewBreakdownSync(workspaceId, 'browser_name', resolved), totalPageViews, 10)

    const topProjectsPageViews = this.getPageViewBreakdownSync(workspaceId, 'project_id', resolved)
    const topProjectsUniqueVisitors = this.getDistinctCountsByProjectSync(workspaceId, resolved)
    const totalProjectPageViews = Array.from(topProjectsPageViews.values()).reduce((sum, value) => sum + value, 0)
    const projectNames = this.getProjectNamesSync(workspaceId)

    const topProjects = Array.from(topProjectsPageViews.entries())
      .map(([projectId, pageViews]) => {
        return {
          projectId,
          projectName: projectNames.get(projectId) || getProjectMetadata(projectId).name,
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
        acceptedEvents: this.getAcceptedEventCountSync(workspaceId, resolved),
        trackedProjects: this.getTrackedProjectCountSync(workspaceId, resolved),
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
      series: Array.from(buildSeries(dayCounts, resolved.range.granularity, resolved.fromMs, resolved.toMs).entries())
        .sort(([a], [b]) => a - b)
        .map(([bucketMs, value]) => ({
          label: formatBucketLabel(
            new Date(bucketMs),
            resolved.range.granularity,
            new Date(resolved.fromMs).getUTCFullYear() !== new Date(resolved.toMs).getUTCFullYear(),
          ),
          value,
        })),
      topProjects,
      topPages,
      topReferrers,
      deviceMix,
      browserMix,
      recentEvents: this.getRecentEventRowsSync(workspaceId, resolved, { limit: 10 }),
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
    const workspaceId = this.getWorkspaceIdSync(accountId)
    const resolved = resolveRange(this.getBoundsSync(workspaceId, projectId), fromRaw, toRaw, granularityRaw)
    const pageViewCount = this.getPageViewCountSync(workspaceId, resolved, projectId)
    const sessionEvents = this.getRangeEventsSync(workspaceId, resolved, projectId)
    const sessionSummaries = summarizeSessions(sessionEvents)
    const sessionValues = Array.from(sessionSummaries.values())
    const totalSessionDuration = sessionValues.reduce((sum, session) => sum + session.durationSeconds, 0)
    const bouncedSessions = sessionValues.filter((session) => session.pageViews === 1 && session.engagementEvents === 0).length

    return {
      range: resolved.range,
      project: {
        projectId,
        projectName: this.getProjectNameSync(projectId, workspaceId),
      },
      metrics: [
        { key: 'page_views', label: 'Page Views', value: pageViewCount, unit: 'count' as const },
        {
          key: 'unique_visitors',
          label: 'Unique Visitors',
          value: this.getDistinctCountSync(workspaceId, 'visitor_key', resolved, undefined, projectId),
          unit: 'count' as const,
          approximate: true,
        },
        {
          key: 'live_visitors',
          label: 'Live Visitors',
          value: this.getDistinctCountSync(workspaceId, 'session_id', resolved, Date.now() - 5 * 60 * 1000, projectId),
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
      series: Array.from(buildSeries(this.getPageViewDayCountsSync(workspaceId, resolved, projectId), resolved.range.granularity, resolved.fromMs, resolved.toMs).entries())
        .sort(([a], [b]) => a - b)
        .map(([bucketMs, value]) => ({
          label: formatBucketLabel(
            new Date(bucketMs),
            resolved.range.granularity,
            new Date(resolved.fromMs).getUTCFullYear() !== new Date(resolved.toMs).getUTCFullYear(),
          ),
          value,
        })),
      topPages: summarizeBreakdown(this.getPageViewBreakdownSync(workspaceId, 'path', resolved, projectId), pageViewCount),
      topReferrers: summarizeBreakdown(this.getPageViewBreakdownSync(workspaceId, 'referrer', resolved, projectId), pageViewCount),
      eventTable: summarizeBreakdown(this.getEventBreakdownSync(workspaceId, 'event_name', resolved, projectId), this.getAcceptedEventCountSync(workspaceId, resolved, projectId), 10).map(
        (row) => ({
          label: row.label,
          value: row.value,
        }),
      ),
      countryMix: summarizeBreakdown(this.getPageViewBreakdownSync(workspaceId, 'country_code', resolved, projectId), pageViewCount, 10),
      recentEvents: this.getRecentEventRowsSync(workspaceId, resolved, { projectId, limit: 10 }),
    } satisfies ProjectAnalyticsResponse
  }

  async getPagesReport(accountId: string, fromRaw: string | null, toRaw: string | null, granularityRaw: string | null, projectId?: string) {
    await this.ensureCurrentReadModel()
    const workspaceId = this.getWorkspaceIdSync(accountId)
    const resolved = resolveRange(this.getBoundsSync(workspaceId, projectId), fromRaw, toRaw, granularityRaw)
    const sessionSummaries = summarizeSessions(this.getRangeEventsSync(workspaceId, resolved, projectId))
    const pageViews = this.getPageViewBreakdownSync(workspaceId, 'path', resolved, projectId)
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
    const workspaceId = this.getWorkspaceIdSync(accountId)
    const resolved = resolveRange(this.getBoundsSync(workspaceId, projectId), fromRaw, toRaw, granularityRaw)
    const sessionSummaries = summarizeSessions(this.getRangeEventsSync(workspaceId, resolved, projectId))
    const referrerCounts = new Map<string, number>()
    const ownedHosts = this.getOwnedReferrerHostsSync(workspaceId)
    let ownedVisits = 0
    let searchLedVisits = 0

    for (const session of sessionSummaries.values()) {
      referrerCounts.set(session.entryReferrer, (referrerCounts.get(session.entryReferrer) || 0) + 1)

      if (ownedHosts.has(session.entryReferrer)) {
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
    const workspaceId = this.getWorkspaceIdSync(accountId)
    const resolved = resolveRange(this.getBoundsSync(workspaceId, projectId), fromRaw, toRaw, null)
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
        workspaceId,
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
    const workspaceId = this.getWorkspaceIdSync(accountId)
    const projectClause = projectId ? 'AND project_id = ?' : ''
    const row = this.db
      .prepare(`
        SELECT MAX(occurred_at) AS last_occurred_at
        FROM raw_events
        WHERE account_id = ?
        ${projectClause}
      `)
      .get(workspaceId, ...(projectId ? [projectId] : [])) as { last_occurred_at: string | null } | undefined

    return row?.last_occurred_at || null
  }

  async getRecentEventsPage(accountId: string, query: RecentEventsQuery): Promise<RecentEventsPageResponse> {
    await this.ensureCurrentReadModel()
    const workspaceId = this.getWorkspaceIdSync(accountId)
    const resolved = resolveRange(this.getBoundsSync(workspaceId, query.projectId), query.fromRaw, query.toRaw, query.granularityRaw)
    const limit = clampLimit(query.limitRaw, 25)
    const rows = this.getRecentEventRowsSync(workspaceId, resolved, {
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
          eventId: cursorRow.eventId,
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

  async getEventDebugDetail(accountId: string, eventId: string): Promise<EventDebugDetailResponse | null> {
    await this.ensureCurrentReadModel()
    const workspaceId = this.getWorkspaceIdSync(accountId)

    const row = this.db
      .prepare(`
        SELECT event_json
        FROM raw_events
        WHERE account_id = ?
          AND event_id = ?
      `)
      .get(workspaceId, eventId) as { event_json: string } | undefined

    if (!row) {
      return null
    }

    return {
      eventId,
      payload: JSON.parse(row.event_json) as StoredPulseEvent,
    }
  }

  async getRejectedEventsPage(accountId: string, query: RejectedEventsQuery): Promise<RejectedEventsPageResponse> {
    await this.ensureCurrentReadModel()
    const workspaceId = this.getWorkspaceIdSync(accountId)
    const resolved = resolveRange(this.getRejectionBoundsSync(workspaceId, query.projectId), query.fromRaw, query.toRaw, query.granularityRaw)
    const limit = clampLimit(query.limitRaw, 10)
    const rows = this.getRejectedEventRowsSync(workspaceId, resolved, {
      projectId: query.projectId,
      eventName: query.eventName,
      pathPrefix: query.pathPrefix,
      cursor: decodeRejectionsCursor(query.cursorRaw),
      limit: limit + 1,
    })

    const visibleRows = rows.slice(0, limit)
    const cursorRow = visibleRows[visibleRows.length - 1]
    const nextCursor =
      rows.length > limit && cursorRow
        ? encodeRejectionsCursor({
            receivedAtMs: Date.parse(cursorRow.receivedAt),
            rejectionId: cursorRow.rejectionId,
          })
        : null

    const filters: RejectedEventsPageResponse['filters'] = {}
    if (query.projectId) {
      filters.projectId = query.projectId
    }
    if (query.eventName) {
      filters.eventName = query.eventName
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

  async getProjectVerification(accountId: string, projectId: string): Promise<ProjectVerificationResponse | null> {
    await this.ensureCurrentReadModel()
    const workspaceId = this.getWorkspaceIdSync(accountId)
    const project = await this.getProjectRecordForAccount(accountId, projectId)

    if (!project) {
      return null
    }

    const latestAcceptedEvent = this.getLatestAcceptedEventSync(workspaceId, projectId)
    const latestPageViewEvent = this.getLatestAcceptedEventSync(workspaceId, projectId, 'page_view')
    const latestRejectedEvent = this.getLatestRejectedEventSync(workspaceId, projectId)
    const recentAcceptedEvents = this.getRecentEventRowsByProjectSync(workspaceId, projectId, 5)
    const recentRejectedEvents = this.getRecentRejectedRowsByProjectSync(workspaceId, projectId, 5)
    const latestConsentSignal = this.pickLatestConsentSignal(latestAcceptedEvent, latestRejectedEvent)
    const distinctTrackedPages = this.getDistinctTrackedPageCountSync(workspaceId, projectId)

    const checks: ProjectVerificationCheck[] = [
      latestPageViewEvent
        ? {
            key: 'script_installed',
            label: 'Script installed',
            status: 'pass',
            detail: `Pulse received a page view for ${project.projectId} at ${latestPageViewEvent.occurredAt}.`,
          }
        : latestAcceptedEvent
          ? {
              key: 'script_installed',
              label: 'Script installed',
              status: 'warn',
              detail: 'Pulse is receiving events for this project, but no page_view has been accepted yet.',
            }
          : {
              key: 'script_installed',
              label: 'Script installed',
              status: 'fail',
              detail: 'Pulse has not accepted a page_view for this project yet.',
            },
      {
        key: 'project_id',
        label: 'Project ID valid',
        status: 'pass',
        detail: `Pulse recognizes ${project.projectId} as a registered project in this workspace.`,
      },
      latestAcceptedEvent
        ? {
            key: 'last_event',
            label: 'Last event seen',
            status: 'pass',
            detail: `Latest accepted event: ${latestAcceptedEvent.eventName} on ${latestAcceptedEvent.page.path} at ${latestAcceptedEvent.occurredAt}.`,
          }
        : {
            key: 'last_event',
            label: 'Last event seen',
            status: 'fail',
            detail: 'No accepted events have been recorded for this project yet.',
          },
      latestConsentSignal
        ? {
            key: 'consent',
            label: 'Consent state seen',
            status:
              latestConsentSignal.consentState === 'granted'
                ? 'pass'
                : latestConsentSignal.consentState === 'unknown'
                  ? 'warn'
                  : 'warn',
            detail:
              latestConsentSignal.consentState === 'granted'
                ? `Latest consent signal was granted in ${latestConsentSignal.consentMode} mode.`
                : latestConsentSignal.consentState === 'unknown'
                  ? `Latest consent signal was unknown in ${latestConsentSignal.consentMode} mode. Pulse only accepts minimal anonymous page views in this state.`
                  : 'Latest consent signal was denied, so Pulse rejected analytics for that request.',
          }
        : {
            key: 'consent',
            label: 'Consent state seen',
            status: 'fail',
            detail: 'Pulse has not seen a consent signal for this project yet.',
          },
      recentRejectedEvents.length === 0
        ? {
            key: 'script_health',
            label: 'Script health',
            status: latestAcceptedEvent ? 'pass' : 'warn',
            detail: latestAcceptedEvent
              ? 'No recent collector rejections were recorded for this project.'
              : 'No collector rejections were linked to this project yet, but accepted traffic has not appeared either.',
          }
        : {
            key: 'script_health',
            label: 'Script health',
            status: 'warn',
            detail: `Recent collector rejections need review. Latest issue: ${recentRejectedEvents[0]?.reason || 'Unknown rejection'}.`,
          },
    ]

    const recommendations: VerificationRecommendation[] = []

    if (!latestPageViewEvent) {
      recommendations.push({
        title: 'Confirm the snippet is live on a real page',
        detail: 'Paste the generated script into the shared layout or document head, deploy it, and open one live page before checking again.',
      })
    }

    if (project.integrationPreset === 'spa' && latestPageViewEvent && distinctTrackedPages <= 1) {
      recommendations.push({
        title: 'Check SPA route tracking',
        detail: 'Only one tracked path has appeared so far. Open a second route and confirm pulse.page() fires on navigation changes.',
      })
    }

    if (latestConsentSignal?.consentState === 'unknown') {
      recommendations.push({
        title: 'Review consent defaults',
        detail: 'Pulse is seeing unknown consent. Confirm the site upgrades to granted consent when the analytics banner allows it.',
      })
    }

    if (latestConsentSignal?.consentState === 'denied') {
      recommendations.push({
        title: 'Analytics is blocked by denied consent',
        detail: 'Pulse received traffic for this project, but consent was denied. Accepted analytics will stay empty until consent permits collection.',
      })
    }

    if (recentRejectedEvents.some((event) => event.field === 'projectId')) {
      recommendations.push({
        title: 'Double-check the project ID in the snippet',
        detail: `The collector rejected at least one request on the projectId field. Confirm the installed script still uses ${project.projectId}.`,
      })
    }

    if (recommendations.length === 0) {
      recommendations.push({
        title: 'The install looks healthy',
        detail: 'Pulse has enough signal to confirm the project is collecting. Keep using the event debugger to validate paths and custom events.',
      })
    }

    return {
      generatedAt: new Date().toISOString(),
      project,
      summary: {
        scriptInstalled: latestPageViewEvent !== null,
        projectIdValid: true,
        lastEventAt: latestAcceptedEvent?.occurredAt || null,
        lastPageViewAt: latestPageViewEvent?.occurredAt || null,
        latestConsentState: latestConsentSignal?.consentState || null,
        latestConsentMode: latestConsentSignal?.consentMode || null,
      },
      checks,
      recentAcceptedEvents,
      recentRejectedEvents,
      recommendations,
    }
  }

  async listExportSchedules(accountId: string): Promise<ExportSchedule[]> {
    await this.readyPromise
    const workspaceId = this.getWorkspaceIdSync(accountId)
    const rows = this.db
      .prepare(`
        SELECT id, workspace_id, name, report_slug, cadence, format, owner_account_id, owner_email,
          owner_display_name, recipients_json, last_run_at, next_run_at, status, created_at, updated_at
        FROM export_schedules
        WHERE workspace_id = ?
        ORDER BY next_run_at ASC, id ASC
      `)
      .all(workspaceId) as unknown as ExportScheduleRow[]

    return rows.map((row) => this.toExportSchedule(row))
  }

  async listExportRuns(accountId: string): Promise<ExportRun[]> {
    await this.readyPromise
    const workspaceId = this.getWorkspaceIdSync(accountId)
    const rows = this.db
      .prepare(`
        SELECT id, workspace_id, schedule_id, name, status, format, scope_label, started_at,
          completed_at, row_count, detail, file_name, file_path
        FROM export_runs
        WHERE workspace_id = ?
        ORDER BY started_at DESC, id DESC
        LIMIT 25
      `)
      .all(workspaceId) as unknown as ExportRunRow[]

    return rows.map((row) => this.toExportRun(row))
  }

  async createManualExport(account: AuthenticatedAccount, request: CreateExportRequest): Promise<ExportRun> {
    await this.ensureCurrentReadModel()
    const workspaceId = this.getWorkspaceIdSync(account.accountId)
    if (request.projectId && !(await this.getProjectRecordForAccount(account.accountId, request.projectId))) {
      return Promise.reject(conflict(`Unknown project: ${request.projectId}.`))
    }

    const materialized = await this.materializeExport(workspaceId, account, request, 'manual')
    return materialized
  }

  async readExportArtifact(accountId: string, runId: string): Promise<{ body: Buffer; fileName: string; contentType: string } | null> {
    await this.readyPromise
    const workspaceId = this.getWorkspaceIdSync(accountId)
    const row = this.db
      .prepare(`
        SELECT id, workspace_id, schedule_id, name, status, format, scope_label, started_at,
          completed_at, row_count, detail, file_name, file_path
        FROM export_runs
        WHERE id = ? AND workspace_id = ?
      `)
      .get(runId, workspaceId) as ExportRunRow | undefined

    if (!row?.file_path || !row.file_name) {
      return null
    }

    const body = await readFile(row.file_path)
    return {
      body,
      fileName: row.file_name,
      contentType: row.format === 'csv' ? 'text/csv; charset=utf-8' : 'application/pdf',
    }
  }

  private toExportSchedule(row: ExportScheduleRow): ExportSchedule {
    let recipients: string[] = []
    try {
      const parsed = JSON.parse(row.recipients_json) as unknown
      if (Array.isArray(parsed)) {
        recipients = parsed.filter((value): value is string => typeof value === 'string')
      }
    } catch {
      recipients = []
    }

    return {
      id: row.id,
      name: row.name,
      reportSlug: row.report_slug,
      cadence: row.cadence,
      format: row.format,
      owner: row.owner_display_name,
      recipients,
      lastRunAt: row.last_run_at,
      nextRunAt: row.next_run_at,
      status: row.status,
      detail: row.status === 'delayed' ? 'The latest scheduled run needs attention before the next delivery.' : 'Ready for the next scheduled delivery.',
    }
  }

  private toExportRun(row: ExportRunRow): ExportRun {
    return {
      id: row.id,
      scheduleId: row.schedule_id,
      name: row.name,
      status: row.status,
      format: row.format,
      scopeLabel: row.scope_label,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      rowCount: row.row_count,
      detail: row.detail,
      ...(row.file_path ? { downloadUrl: `/v1/exports/runs/${encodeURIComponent(row.id)}/download` } : {}),
    }
  }

  private async materializeExport(
    workspaceId: string,
    account: AuthenticatedAccount,
    request: CreateExportRequest,
    scheduleId: string,
  ): Promise<ExportRun> {
    const reportOptions = {
      from: request.from || null,
      to: request.to || null,
      granularity: request.granularity || 'day',
    } as const
    const sections: ExportSection[] = []
    let rowCount = 0
    let name: string
    const scopeLabel = request.projectId ? `Project ${this.getProjectNameSync(request.projectId, workspaceId)}` : 'Workspace'

    if (request.reportSlug === 'executive') {
      if (request.projectId) {
        const overview = await this.getProjectOverviewAnalytics(account.accountId, request.projectId, reportOptions.from, reportOptions.to, reportOptions.granularity)
        sections.push(
          { title: 'Metrics', rows: overview.metrics.map((metric) => ({ label: metric.label, value: metric.value })) },
          { title: 'Top pages', rows: overview.topPages.map((row) => ({ label: row.label, value: row.value })) },
          { title: 'Top referrers', rows: overview.topReferrers.map((row) => ({ label: row.label, value: row.value })) },
        )
      } else {
        const overview = await this.getOverviewAnalytics(account.accountId, reportOptions.from, reportOptions.to, reportOptions.granularity)
        sections.push(
          { title: 'Metrics', rows: overview.metrics.map((metric) => ({ label: metric.label, value: metric.value })) },
          { title: 'Top projects', rows: overview.topProjects.map((row) => ({ label: row.projectName, value: row.pageViews })) },
          { title: 'Top pages', rows: overview.topPages.map((row) => ({ label: row.label, value: row.value })) },
          { title: 'Top referrers', rows: overview.topReferrers.map((row) => ({ label: row.label, value: row.value })) },
        )
      }
      name = 'Executive overview'
    } else if (request.reportSlug === 'pages') {
      const report = await this.getPagesReport(account.accountId, reportOptions.from, reportOptions.to, reportOptions.granularity, request.projectId)
      sections.push({ title: 'Pages', rows: report.rows.map((row) => ({ label: row.label, value: row.value })) })
      sections.push({ title: 'Summary', rows: [{ label: 'Tracked pages', value: report.trackedPages }, { label: 'Average exit rate', value: `${report.averageExitRate}%` }] })
      rowCount = report.rows.length
      name = 'Pages report'
    } else {
      const report = await this.getReferrersReport(account.accountId, reportOptions.from, reportOptions.to, reportOptions.granularity, request.projectId)
      sections.push({ title: 'Referrers', rows: report.rows.map((row) => ({ label: row.label, value: row.value })) })
      sections.push({ title: 'Summary', rows: [{ label: 'Tracked referrers', value: report.trackedReferrers }, { label: 'Owned share', value: `${report.ownedShare}%` }, { label: 'Search-led visits', value: report.searchLedVisits }] })
      rowCount = report.rows.length
      name = 'Referrers report'
    }

    if (!rowCount) {
      rowCount = sections.reduce((sum, section) => sum + section.rows.length, 0)
    }

    const rows = sections.flatMap((section) => section.rows.map((row) => [section.title, row.label, row.value] as Array<string | number>))
    const body = request.format === 'csv'
      ? buildCsvDocument(['Section', 'Label', 'Value'], rows)
      : buildPdfSummaryDocument(`${name} · ${scopeLabel}`, sections)
    const extension = request.format === 'csv' ? 'csv' : 'pdf'
    const runId = randomUUID()
    const fileName = `pulse-${request.reportSlug}-${runId}.${extension}`
    const workspaceDirectory = `${this.config.exportDirectory}/${workspaceId.replace(/[^a-zA-Z0-9_-]/g, '_')}`
    const filePath = `${workspaceDirectory}/${fileName}`
    await mkdir(workspaceDirectory, { recursive: true })
    await writeFile(filePath, body)

    const startedAt = new Date().toISOString()
    const completedAt = new Date().toISOString()
    const detail = `${name} generated as ${request.format === 'csv' ? 'CSV' : 'PDF summary'} for ${scopeLabel}.`
    this.db.prepare(`
      INSERT INTO export_runs (
        id, workspace_id, schedule_id, name, status, format, scope_label, started_at,
        completed_at, row_count, detail, file_name, file_path
      ) VALUES (?, ?, ?, ?, 'succeeded', ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(runId, workspaceId, scheduleId, name, request.format, scopeLabel, startedAt, completedAt, rowCount, detail, fileName, filePath)

    return this.toExportRun(
      this.db.prepare(`
        SELECT id, workspace_id, schedule_id, name, status, format, scope_label, started_at,
          completed_at, row_count, detail, file_name, file_path
        FROM export_runs WHERE id = ?
      `).get(runId) as unknown as ExportRunRow,
    )
  }

  private async runDueScheduledExports() {
    if (this.exportRunPromise) {
      return this.exportRunPromise
    }

    this.exportRunPromise = Promise.resolve().then(async () => {
      await this.readyPromise
      await this.runMaintenance()
      const now = new Date()
      const dueSchedules = this.db
        .prepare(`
          SELECT id, workspace_id, name, report_slug, cadence, format, owner_account_id, owner_email,
            owner_display_name, recipients_json, last_run_at, next_run_at, status, created_at, updated_at
          FROM export_schedules
          WHERE next_run_at <= ?
          ORDER BY next_run_at ASC
          LIMIT 10
        `)
        .all(now.toISOString()) as unknown as ExportScheduleRow[]

      for (const schedule of dueSchedules) {
        const account: AuthenticatedAccount = {
          accountId: schedule.workspace_id,
          continentalId: schedule.workspace_id,
          email: schedule.owner_email,
          username: '',
          displayName: schedule.owner_display_name,
        }
        try {
          await this.materializeExport(schedule.workspace_id, account, { reportSlug: schedule.report_slug, format: 'pdf_summary' }, schedule.id)
          const nextRunAt = schedule.cadence === 'weekly' ? addDays(new Date(schedule.next_run_at), 7) : nextMonthStartUtc(new Date(schedule.next_run_at))
          this.db.prepare('UPDATE export_schedules SET last_run_at = ?, next_run_at = ?, status = \'ok\', updated_at = ? WHERE id = ?').run(now.toISOString(), nextRunAt.toISOString(), now.toISOString(), schedule.id)
        } catch (error) {
          this.db.prepare('UPDATE export_schedules SET status = \'delayed\', updated_at = ? WHERE id = ?').run(now.toISOString(), schedule.id)
          const detail = error instanceof Error ? error.message : 'Scheduled export failed.'
          const failedRunId = randomUUID()
          this.db.prepare(`
            INSERT INTO export_runs (
              id, workspace_id, schedule_id, name, status, format, scope_label, started_at,
              completed_at, row_count, detail, file_name, file_path
            ) VALUES (?, ?, ?, ?, 'failed', 'pdf_summary', 'Workspace', ?, ?, 0, ?, NULL, NULL)
          `).run(failedRunId, schedule.workspace_id, schedule.id, schedule.name, now.toISOString(), now.toISOString(), `Scheduled export failed: ${detail}`)
        }
      }
    }).finally(() => {
      this.exportRunPromise = null
    })

    return this.exportRunPromise
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

    this.maintenanceRunPromise = this.readyPromise.then(() => {
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
        owner_display_name TEXT NOT NULL,
        workspace_id TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS registered_projects_owner_account_idx ON registered_projects (owner_account_id, project_name);
      CREATE TABLE IF NOT EXISTS workspaces (
        workspace_id TEXT PRIMARY KEY,
        workspace_name TEXT NOT NULL,
        default_retention_months INTEGER NOT NULL DEFAULT 13,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS workspace_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workspace_id TEXT NOT NULL,
        account_id TEXT,
        email TEXT NOT NULL,
        display_name TEXT NOT NULL,
        role TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS workspace_members_workspace_email_idx
        ON workspace_members (workspace_id, email);
      CREATE UNIQUE INDEX IF NOT EXISTS workspace_members_active_account_idx
        ON workspace_members (account_id)
        WHERE account_id IS NOT NULL AND status = 'active';
      CREATE INDEX IF NOT EXISTS workspace_members_workspace_idx
        ON workspace_members (workspace_id, status, role);

      CREATE TABLE IF NOT EXISTS export_schedules (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        name TEXT NOT NULL,
        report_slug TEXT NOT NULL,
        cadence TEXT NOT NULL,
        format TEXT NOT NULL,
        owner_account_id TEXT NOT NULL,
        owner_email TEXT NOT NULL,
        owner_display_name TEXT NOT NULL,
        recipients_json TEXT NOT NULL,
        last_run_at TEXT,
        next_run_at TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS export_schedules_workspace_next_run_idx
        ON export_schedules (workspace_id, next_run_at);

      CREATE TABLE IF NOT EXISTS export_runs (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        schedule_id TEXT NOT NULL,
        name TEXT NOT NULL,
        status TEXT NOT NULL,
        format TEXT NOT NULL,
        scope_label TEXT NOT NULL,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        row_count INTEGER NOT NULL DEFAULT 0,
        detail TEXT NOT NULL,
        file_name TEXT,
        file_path TEXT
      );

      CREATE INDEX IF NOT EXISTS export_runs_workspace_started_idx
        ON export_runs (workspace_id, started_at DESC);

      CREATE TABLE IF NOT EXISTS collector_rejections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id TEXT NOT NULL DEFAULT '',
        received_at TEXT NOT NULL,
        received_at_ms INTEGER NOT NULL,
        event_id TEXT,
        event_name TEXT,
        project_id TEXT,
        occurred_at TEXT,
        occurred_at_ms INTEGER,
        path TEXT,
        device_type TEXT,
        browser_name TEXT,
        country_code TEXT,
        consent_state TEXT,
        consent_mode TEXT,
        reason TEXT NOT NULL,
        field TEXT,
        request_index INTEGER NOT NULL,
        payload_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS collector_rejections_account_received_idx
        ON collector_rejections (account_id, received_at_ms DESC, id DESC);
      CREATE INDEX IF NOT EXISTS collector_rejections_account_project_received_idx
        ON collector_rejections (account_id, project_id, received_at_ms DESC, id DESC);
    `)

    this.ensureColumnSync('raw_events', 'account_id', "TEXT NOT NULL DEFAULT ''")
    this.ensureColumnSync('daily_rollups', 'account_id', "TEXT NOT NULL DEFAULT ''")
    this.ensureColumnSync('collector_rejections', 'occurred_at_ms', 'INTEGER')
    this.ensureColumnSync('registered_projects', 'workspace_id', "TEXT NOT NULL DEFAULT ''")
    this.db.prepare("UPDATE registered_projects SET workspace_id = owner_account_id WHERE workspace_id = ''").run()
    this.db.exec('CREATE INDEX IF NOT EXISTS registered_projects_workspace_idx ON registered_projects (workspace_id, project_name)')
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
      const deleteOldRejections = this.db.prepare(`
        DELETE FROM collector_rejections
        WHERE received_at_ms < ?
      `)
      const markDirty = this.db.prepare('INSERT OR IGNORE INTO dirty_rollup_buckets (bucket_start_ms) VALUES (?)')

      const bucketRows = listBuckets.all(cutoffMs) as Array<{ bucket_start_ms: number }>
      for (const row of bucketRows) {
        deletedBuckets.add(row.bucket_start_ms)
      }

      const result = deleteOldEvents.run(cutoffMs) as { changes: number }
      deletedEvents += result.changes
      deleteOldRejections.run(cutoffMs)

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

  private toWorkspaceMember(row: WorkspaceMemberRow): WorkspaceMember {
    return {
      id: row.id,
      accountId: row.account_id,
      email: row.email,
      displayName: row.display_name,
      role: row.role,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  private getWorkspaceAccessSync(accountId: string): WorkspaceAccess | null {
    const row = this.db
      .prepare(`
        SELECT
          m.id,
          m.workspace_id,
          m.account_id,
          m.email,
          m.display_name,
          m.role,
          m.status,
          m.created_at,
          m.updated_at,
          w.workspace_name
        FROM workspace_members m
        JOIN workspaces w ON w.workspace_id = m.workspace_id
        WHERE m.account_id = ? AND m.status = 'active'
        LIMIT 1
      `)
      .get(accountId) as (WorkspaceMemberRow & { workspace_name: string }) | undefined

    if (!row) {
      return null
    }

    return {
      workspaceId: row.workspace_id,
      workspaceName: row.workspace_name,
      member: this.toWorkspaceMember(row),
    }
  }

  private getWorkspaceIdSync(accountId: string) {
    return this.getWorkspaceAccessSync(accountId)?.workspaceId || accountId
  }

  private ensureWorkspaceAccessSync(account: AuthenticatedAccount): WorkspaceAccess {
    const existing = this.getWorkspaceAccessSync(account.accountId)
    if (existing) {
      return existing
    }

    const pending = this.db
      .prepare(`
        SELECT id, workspace_id, account_id, email, display_name, role, status, created_at, updated_at
        FROM workspace_members
        WHERE lower(email) = lower(?) AND status = 'invited'
        ORDER BY id ASC
        LIMIT 1
      `)
      .get(account.email) as WorkspaceMemberRow | undefined

    const now = new Date().toISOString()
    if (pending) {
      this.db
        .prepare(`
          UPDATE workspace_members
          SET account_id = ?, display_name = ?, status = 'active', updated_at = ?
          WHERE id = ?
        `)
        .run(account.accountId, account.displayName, now, pending.id)

      const access = this.getWorkspaceAccessSync(account.accountId)
      if (access) {
        return access
      }
    }

    const workspaceId = account.accountId
    this.db
      .prepare(`
        INSERT OR IGNORE INTO workspaces (workspace_id, workspace_name, default_retention_months, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `)
      .run(workspaceId, `${account.displayName} Workspace`, this.config.defaultRetentionMonths, now, now)
    this.db
      .prepare(`
        INSERT OR IGNORE INTO workspace_members (workspace_id, account_id, email, display_name, role, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'owner', 'active', ?, ?)
      `)
      .run(workspaceId, account.accountId, account.email.toLowerCase(), account.displayName, now, now)

    const access = this.getWorkspaceAccessSync(account.accountId)
    if (!access) {
      throw new Error(`Could not initialize workspace access for ${account.accountId}.`)
    }

    return access
  }

  private ensureDefaultExportSchedulesSync(access: WorkspaceAccess) {
    const row = this.db.prepare('SELECT COUNT(*) AS count FROM export_schedules WHERE workspace_id = ?').get(access.workspaceId) as { count: number }
    if (row.count > 0) {
      return
    }

    const now = new Date()
    const createdAt = now.toISOString()
    const insert = this.db.prepare(`
      INSERT INTO export_schedules (
        id, workspace_id, name, report_slug, cadence, format, owner_account_id, owner_email,
        owner_display_name, recipients_json, last_run_at, next_run_at, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'pdf_summary', ?, ?, ?, ?, NULL, ?, 'ok', ?, ?)
    `)

    insert.run(
      `${access.workspaceId}:weekly-executive-summary`,
      access.workspaceId,
      'Weekly executive summary',
      'executive',
      'weekly',
      access.member.accountId || access.workspaceId,
      access.member.email,
      access.member.displayName,
      JSON.stringify([access.member.email]),
      nextMondayAtHourUtc(now, 8).toISOString(),
      createdAt,
      createdAt,
    )
    insert.run(
      `${access.workspaceId}:monthly-acquisition-digest`,
      access.workspaceId,
      'Monthly acquisition digest',
      'referrers',
      'monthly',
      access.member.accountId || access.workspaceId,
      access.member.email,
      access.member.displayName,
      JSON.stringify([access.member.email]),
      nextMonthStartUtc(now).toISOString(),
      createdAt,
      createdAt,
    )
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
          owner_display_name,
          workspace_id
        FROM registered_projects
        WHERE project_id = ?
      `)
      .get(projectId) as RegisteredProjectRow | undefined

    return row ? this.toProjectRecord(row) : null
  }

  private getProjectNameSync(projectId: string, workspaceId?: string) {
    const row = workspaceId
      ? this.db
          .prepare('SELECT project_name FROM registered_projects WHERE workspace_id = ? AND project_id = ?')
          .get(workspaceId, projectId) as { project_name: string } | undefined
      : this.db
          .prepare('SELECT project_name FROM registered_projects WHERE project_id = ?')
          .get(projectId) as { project_name: string } | undefined

    return row?.project_name || getProjectMetadata(projectId).name
  }

  private getProjectNamesSync(workspaceId: string) {
    const rows = this.db
      .prepare('SELECT project_id, project_name FROM registered_projects WHERE workspace_id = ?')
      .all(workspaceId) as Array<{ project_id: string; project_name: string }>

    return new Map(rows.map((row) => [row.project_id, row.project_name]))
  }

  private getOwnedReferrerHostsSync(workspaceId: string) {
    const hosts = new Set(OWNED_HOSTS)
    const rows = this.db
      .prepare('SELECT site_host FROM registered_projects WHERE workspace_id = ?')
      .all(workspaceId) as Array<{ site_host: string }>

    for (const row of rows) {
      const host = row.site_host.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0] || ''
      if (!host) {
        continue
      }

      hosts.add(host)
      hosts.add(host.startsWith('www.') ? host.slice(4) : `www.${host}`)
    }

    return hosts
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
    const updateRejections = this.db.prepare(`
      UPDATE collector_rejections
      SET account_id = ?
      WHERE account_id = ''
        AND project_id = ?
    `)

    this.db.exec('BEGIN IMMEDIATE')

    try {
      for (const projectId of projectIds) {
        updateRaw.run(accountId, projectId)
        updateRollups.run(accountId, projectId)
        updateRejections.run(accountId, projectId)
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

  private getRejectionBoundsSync(accountId: string, projectId?: string): TimestampBounds {
    const params: Array<string> = [accountId]
    let sql = `
      SELECT
        MIN(COALESCE(occurred_at_ms, received_at_ms)) AS min_received_at_ms,
        MAX(COALESCE(occurred_at_ms, received_at_ms)) AS max_received_at_ms
      FROM collector_rejections
      WHERE account_id = ?
    `

    if (projectId) {
      sql += ' AND project_id = ?'
      params.push(projectId)
    }

    const row = this.db.prepare(sql).get(...params) as {
      min_received_at_ms: number | null
      max_received_at_ms: number | null
    }

    return {
      minOccurredAtMs: row.min_received_at_ms,
      maxOccurredAtMs: row.max_received_at_ms,
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
        received_at,
        occurred_at_ms,
        occurred_at,
        event_name,
        project_id,
        path,
        device_type,
        browser_name,
        country_code,
        consent_state,
        consent_mode
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
      sql += " AND path LIKE ? ESCAPE '\\'"
      params.push(`${escapeLikePrefix(options.pathPrefix)}%`)
    }

    if (options.cursor) {
      sql += ' AND (occurred_at_ms < ? OR (occurred_at_ms = ? AND event_id < ?))'
      params.push(options.cursor.occurredAtMs, options.cursor.occurredAtMs, options.cursor.eventId)
    }

    sql += ' ORDER BY occurred_at_ms DESC, event_id DESC LIMIT ?'
    params.push(options.limit)

    const rows = this.db.prepare(sql).all(...params) as Array<{
      event_id: string
      received_at: string
      occurred_at_ms: number
      occurred_at: string
      event_name: string
      project_id: string
      path: string
      device_type: string
      browser_name: string
      country_code: string
      consent_state: RecentEventRow['consentState']
      consent_mode: RecentEventRow['consentMode']
    }>

    return rows.map((row) => ({
      eventId: row.event_id,
      receivedAt: row.received_at,
      occurredAt: row.occurred_at,
      eventName: row.event_name,
      projectId: row.project_id,
      path: row.path,
      deviceType: row.device_type as RecentEventRow['deviceType'],
      browserName: row.browser_name,
      countryCode: row.country_code,
      consentState: row.consent_state,
      consentMode: row.consent_mode,
    }))
  }

  private getRejectedEventRowsSync(
    accountId: string,
    resolved: ResolvedRange,
    options: {
      projectId?: string | undefined
      eventName?: string | undefined
      pathPrefix?: string | undefined
      cursor?: RecentRejectionsCursor | null | undefined
      limit: number
    },
  ) {
    const params: Array<string | number> = [resolved.fromMs, resolved.toMs, accountId]
    let sql = `
      SELECT
        id,
        received_at,
        received_at_ms,
        event_id,
        event_name,
        project_id,
        path,
        device_type,
        browser_name,
        country_code,
        consent_state,
        consent_mode,
        reason,
        field,
        payload_json
      FROM collector_rejections
      WHERE COALESCE(occurred_at_ms, received_at_ms) BETWEEN ? AND ?
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

    if (options.pathPrefix) {
      sql += " AND path LIKE ? ESCAPE '\\'"
      params.push(`${escapeLikePrefix(options.pathPrefix)}%`)
    }

    if (options.cursor) {
      sql += ' AND (received_at_ms < ? OR (received_at_ms = ? AND id < ?))'
      params.push(options.cursor.receivedAtMs, options.cursor.receivedAtMs, options.cursor.rejectionId)
    }

    sql += ' ORDER BY received_at_ms DESC, id DESC LIMIT ?'
    params.push(options.limit)

    const rows = this.db.prepare(sql).all(...params) as Array<{
      id: number
      received_at: string
      received_at_ms: number
      event_id: string | null
      event_name: string | null
      project_id: string | null
      path: string | null
      device_type: string | null
      browser_name: string | null
      country_code: string | null
      consent_state: RejectedEventRow['consentState']
      consent_mode: RejectedEventRow['consentMode']
      reason: string
      field: string | null
      payload_json: string
    }>

    return rows.map((row) => ({
      rejectionId: row.id,
      receivedAt: row.received_at,
      eventId: row.event_id,
      eventName: row.event_name,
      projectId: row.project_id,
      path: row.path,
      deviceType: row.device_type,
      browserName: row.browser_name,
      countryCode: row.country_code,
      consentState: row.consent_state,
      consentMode: row.consent_mode,
      reason: row.reason,
      field: row.field,
      payload: JSON.parse(row.payload_json) as unknown,
    }))
  }

  private getRecentEventRowsByProjectSync(accountId: string, projectId: string, limit: number) {
    return this.getRecentEventRowsSync(
      accountId,
      {
        range: {
          from: new Date(0).toISOString(),
          to: new Date().toISOString(),
          granularity: 'day',
        },
        fromMs: 0,
        toMs: Date.now(),
      },
      { projectId, limit },
    )
  }

  private getRecentRejectedRowsByProjectSync(accountId: string, projectId: string, limit: number) {
    return this.getRejectedEventRowsSync(
      accountId,
      {
        range: {
          from: new Date(0).toISOString(),
          to: new Date().toISOString(),
          granularity: 'day',
        },
        fromMs: 0,
        toMs: Date.now(),
      },
      { projectId, limit },
    )
  }

  private getLatestAcceptedEventSync(accountId: string, projectId: string, eventName?: string) {
    const params: Array<string> = [accountId, projectId]
    let sql = `
      SELECT event_json
      FROM raw_events
      WHERE account_id = ?
        AND project_id = ?
    `

    if (eventName) {
      sql += ' AND event_name = ?'
      params.push(eventName)
    }

    sql += ' ORDER BY occurred_at_ms DESC, event_id DESC LIMIT 1'

    const row = this.db.prepare(sql).get(...params) as { event_json: string } | undefined
    return row ? (JSON.parse(row.event_json) as StoredPulseEvent) : null
  }

  private getLatestRejectedEventSync(accountId: string, projectId: string) {
    const row = this.db
      .prepare(`
        SELECT received_at, consent_state, consent_mode
        FROM collector_rejections
        WHERE account_id = ?
          AND project_id = ?
        ORDER BY received_at_ms DESC, id DESC
        LIMIT 1
      `)
      .get(accountId, projectId) as
      | {
          received_at: string
          consent_state: RejectedEventRow['consentState']
          consent_mode: RejectedEventRow['consentMode']
        }
      | undefined

    return row
      ? {
          occurredAt: row.received_at,
          consentState: row.consent_state,
          consentMode: row.consent_mode,
        }
      : null
  }

  private pickLatestConsentSignal(
    acceptedEvent: StoredPulseEvent | null,
    rejectedEvent:
      | {
          occurredAt: string
          consentState: RejectedEventRow['consentState']
          consentMode: RejectedEventRow['consentMode']
        }
      | null,
  ) {
    if (!acceptedEvent && !rejectedEvent) {
      return null
    }

    if (!acceptedEvent) {
      return rejectedEvent
    }

    if (!rejectedEvent) {
      return {
        occurredAt: acceptedEvent.occurredAt,
        consentState: acceptedEvent.consent.state,
        consentMode: acceptedEvent.consent.mode,
      }
    }

    return Date.parse(rejectedEvent.occurredAt) > Date.parse(acceptedEvent.occurredAt)
      ? rejectedEvent
      : {
          occurredAt: acceptedEvent.occurredAt,
          consentState: acceptedEvent.consent.state,
          consentMode: acceptedEvent.consent.mode,
        }
  }

  private getDistinctTrackedPageCountSync(accountId: string, projectId: string) {
    const row = this.db
      .prepare(`
        SELECT COUNT(DISTINCT path) AS count
        FROM raw_events
        WHERE account_id = ?
          AND project_id = ?
          AND event_name = 'page_view'
      `)
      .get(accountId, projectId) as { count: number }

    return row.count
  }
}
