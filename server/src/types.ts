export type ConsentState = 'unknown' | 'denied' | 'granted'
export type ConsentMode = 'strict' | 'standard'
export type DeviceType = 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown'
export type RetentionMonths = 6 | 12 | 13
export type Scalar = string | number | boolean | null

export interface AuthenticatedAccount {
  accountId: string
  continentalId: string
  email: string
  username: string
  displayName: string
}

export interface PulseEventInput {
  eventId?: unknown
  eventName?: unknown
  occurredAt?: unknown
  projectId?: unknown
  page?: {
    path?: unknown
    title?: unknown
    referrer?: unknown
  }
  context?: {
    deviceType?: unknown
    browserName?: unknown
    countryCode?: unknown
    language?: unknown
  }
  consent?: {
    state?: unknown
    mode?: unknown
  }
  identity?: {
    sessionId?: unknown
    visitorKey?: unknown
  }
  properties?: Record<string, unknown>
}

export interface StoredPulseEvent {
  schemaVersion: 1
  receivedAt: string
  eventId: string
  accountId?: string
  eventName: string
  occurredAt: string
  projectId: string
  page: {
    path: string
    title?: string
    referrer?: string
  }
  context?: {
    deviceType?: DeviceType
    browserName?: string
    countryCode?: string
    language?: string
  }
  consent: {
    state: ConsentState
    mode: ConsentMode
  }
  identity?: {
    sessionId?: string
    visitorKey?: string
  }
  properties?: Record<string, Scalar>
}

export interface CollectRequestBody {
  events?: unknown
}

export interface ValidationSuccess {
  ok: true
  event: StoredPulseEvent
  warnings: string[]
}

export interface ValidationFailure {
  ok: false
  reason: string
  field?: string
}

export type ValidationResult = ValidationSuccess | ValidationFailure

export interface CollectorConfig {
  host: string
  port: number
  authApiBaseUrl: string
  corsOrigin: string
  maxBatchSize: number
  maxBodyBytes: number
  rateLimitWindowMs: number
  rateLimitMaxRequests: number
  databasePath: string
  legacySinkPath: string
  rollupIntervalMs: number
  retentionIntervalMs: number
  defaultRetentionMonths: RetentionMonths
  allowedProjectIds: Set<string>
  allowedEventNames: Set<string>
}

export interface CreateProjectRequestBody {
  name?: unknown
  domain?: unknown
  projectId?: unknown
  integrationPreset?: unknown
}

export interface ProjectRecord {
  projectId: string
  projectName: string
  siteHost: string
  integrationPreset: 'website' | 'spa'
  createdAt: string
  ownerAccountId: string
  ownerEmail: string
  ownerDisplayName: string
}

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
  eventId: string
  receivedAt: string
  occurredAt: string
  eventName: string
  projectId: string
  path: string
  deviceType: DeviceType
  browserName: string
  countryCode: string
  consentState: ConsentState
  consentMode: ConsentMode
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
    deviceType?: DeviceType
    countryCode?: string
    pathPrefix?: string
  }
  rows: RecentEventRow[]
  page: {
    limit: number
    nextCursor: string | null
    hasMore: boolean
  }
}

export interface EventDebugDetailResponse {
  eventId: string
  payload: StoredPulseEvent
}

export interface RejectedEventRow {
  rejectionId: number
  receivedAt: string
  eventId: string | null
  eventName: string | null
  projectId: string | null
  path: string | null
  deviceType: string | null
  browserName: string | null
  countryCode: string | null
  consentState: ConsentState | null
  consentMode: ConsentMode | null
  reason: string
  field: string | null
  payload: unknown
}

export interface RejectedEventsPageResponse {
  range: AnalyticsRange
  filters: {
    projectId?: string
    eventName?: string
    pathPrefix?: string
  }
  rows: RejectedEventRow[]
  page: {
    limit: number
    nextCursor: string | null
    hasMore: boolean
  }
}

export type VerificationCheckStatus = 'pass' | 'warn' | 'fail'

export interface ProjectVerificationCheck {
  key: 'script_installed' | 'project_id' | 'last_event' | 'consent' | 'script_health'
  label: string
  status: VerificationCheckStatus
  detail: string
}

export interface VerificationRecommendation {
  title: string
  detail: string
}

export interface ProjectVerificationResponse {
  generatedAt: string
  project: ProjectRecord
  summary: {
    scriptInstalled: boolean
    projectIdValid: boolean
    lastEventAt: string | null
    lastPageViewAt: string | null
    latestConsentState: ConsentState | null
    latestConsentMode: ConsentMode | null
  }
  checks: ProjectVerificationCheck[]
  recentAcceptedEvents: RecentEventRow[]
  recentRejectedEvents: RejectedEventRow[]
  recommendations: VerificationRecommendation[]
}

export interface ConsentSnapshot {
  granted: number
  denied: number
  unknown: number
  strictMode: number
  standardMode: number
}

export type AlertRuleStatus = 'ok' | 'monitoring' | 'active'
export type AlertSeverity = 'info' | 'warning' | 'critical'

export interface AlertRuleEvaluation {
  id: string
  name: string
  scopeLabel: string
  owner: string
  status: AlertRuleStatus
  severity: AlertSeverity
  metricLabel: string
  thresholdLabel: string
  currentValue: number
  baselineValue: number
  deltaPercent: number
  detail: string
}

export interface AlertTimelineItem {
  occurredAt: string
  severity: AlertSeverity
  title: string
  detail: string
}

export interface AlertsResponse {
  generatedAt: string
  evaluationRange: {
    currentFrom: string
    currentTo: string
    baselineFrom: string
    baselineTo: string
  }
  summary: {
    activeRules: number
    monitoringRules: number
    okRules: number
  }
  rules: AlertRuleEvaluation[]
  activity: AlertTimelineItem[]
}

export type ExportScheduleStatus = 'ok' | 'delayed'
export type ExportRunStatus = 'succeeded' | 'delayed' | 'pending'

export interface ExportSchedule {
  id: string
  name: string
  reportSlug: 'executive' | 'pages' | 'referrers'
  cadence: 'weekly' | 'monthly'
  format: 'pdf_summary'
  owner: string
  recipients: string[]
  lastRunAt: string
  nextRunAt: string
  status: ExportScheduleStatus
  detail: string
}

export interface ExportRun {
  id: string
  scheduleId: string
  name: string
  status: ExportRunStatus
  format: 'pdf_summary' | 'csv'
  scopeLabel: string
  startedAt: string
  completedAt: string | null
  rowCount: number
  detail: string
}

export interface ExportsResponse {
  generatedAt: string
  summary: {
    scheduledExports: number
    delayedExports: number
    manualExportFormat: 'csv'
    scheduledExportFormat: 'pdf_summary'
  }
  schedules: ExportSchedule[]
  recentRuns: ExportRun[]
}

export interface WorkspaceRoleDefinition {
  role: 'viewer' | 'editor' | 'owner'
  can: string[]
  cannot: string[]
}

export interface WorkspaceProjectSetting {
  projectId: string
  projectName: string
  retentionMonths: RetentionMonths
  status: 'live' | 'idle'
  lastEventAt: string | null
}

export interface WorkspaceSettingsResponse {
  generatedAt: string
  workspace: {
    id: string
    name: string
    roleModel: 'workspace_scoped'
    defaultRetentionMonths: RetentionMonths
    allowedRetentionMonths: RetentionMonths[]
  }
  roles: WorkspaceRoleDefinition[]
  projects: WorkspaceProjectSetting[]
  controls: Array<{
    title: string
    body: string
    bullets: string[]
  }>
  operations: {
    healthStatus: 'ok' | 'degraded'
    corsOrigin: string
    maxBatchSize: number
    maxBodyBytes: number
    rateLimitWindowMs: number
    rateLimitMaxRequests: number
    rollupIntervalMs: number
    retentionIntervalMs: number
    lastRollupAt: string | null
    lastRetentionAt: string | null
  }
}
