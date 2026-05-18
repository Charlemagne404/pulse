import { SqliteEventStore } from './store.js'
import type {
  AlertRuleEvaluation,
  AlertsResponse,
  AuthenticatedAccount,
  CollectorConfig,
  ConsentSnapshot,
  ExportRun,
  ExportSchedule,
  ExportsResponse,
  WorkspaceProjectSetting,
  WorkspaceSettingsResponse,
} from './types.js'

const MS_PER_DAY = 24 * 60 * 60 * 1000
const MIN_ALERT_BASELINE_EVENTS = 25
const STALE_ROLLUP_FLOOR_MS = 5 * 60 * 1000

type HealthSnapshot = Awaited<ReturnType<SqliteEventStore['readHealthSnapshot']>>

const startOfUtcDay = (date: Date) => Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * MS_PER_DAY)

const startOfUtcMonth = (date: Date) => Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)

const startOfNextUtcMonth = (date: Date) => Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)

const lastCompleteUtcDayRange = (now: Date) => {
  const todayStart = startOfUtcDay(now)
  const currentFrom = new Date(todayStart - MS_PER_DAY)
  const currentTo = new Date(todayStart - 1)
  const baselineFrom = new Date(todayStart - 2 * MS_PER_DAY)
  const baselineTo = new Date(todayStart - MS_PER_DAY - 1)

  return {
    currentFrom,
    currentTo,
    baselineFrom,
    baselineTo,
  }
}

const previousMondayAtHourUtc = (date: Date, hour: number) => {
  const currentDay = date.getUTCDay()
  const daysSinceMonday = (currentDay + 6) % 7
  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - daysSinceMonday, hour, 0, 0, 0))

  if (monday.getTime() > date.getTime()) {
    return addDays(monday, -7)
  }

  return monday
}

const nextMondayAtHourUtc = (date: Date, hour: number) => addDays(previousMondayAtHourUtc(date, hour), 7)

const round = (value: number, digits = 1) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

const percentage = (part: number, total: number) => (total > 0 ? round((part / total) * 100, 1) : 0)

const deltaPercent = (current: number, baseline: number) => {
  if (baseline <= 0) {
    return current > 0 ? 100 : 0
  }

  return round(((current - baseline) / baseline) * 100, 1)
}

const getMetricValue = (metrics: Array<{ key: string; value: number }>, key: string) =>
  metrics.find((metric) => metric.key === key)?.value || 0

const buildTrafficRule = (
  id: string,
  name: string,
  scopeLabel: string,
  owner: string,
  currentValue: number,
  baselineValue: number,
): AlertRuleEvaluation => {
  const change = deltaPercent(currentValue, baselineValue)
  const dropPercent = baselineValue > 0 ? round(((baselineValue - currentValue) / baselineValue) * 100, 1) : 0

  if (baselineValue >= MIN_ALERT_BASELINE_EVENTS && currentValue <= baselineValue * 0.75) {
    return {
      id,
      name,
      scopeLabel,
      owner,
      status: 'active',
      severity: 'warning',
      metricLabel: 'Page Views',
      thresholdLabel: '25% drop vs previous day',
      currentValue,
      baselineValue,
      deltaPercent: change,
      detail: `${scopeLabel} page views fell ${dropPercent}% compared with the previous day.`,
    }
  }

  if (baselineValue >= MIN_ALERT_BASELINE_EVENTS && currentValue <= baselineValue * 0.9) {
    return {
      id,
      name,
      scopeLabel,
      owner,
      status: 'monitoring',
      severity: 'info',
      metricLabel: 'Page Views',
      thresholdLabel: '10% drop vs previous day',
      currentValue,
      baselineValue,
      deltaPercent: change,
      detail: `${scopeLabel} traffic is down ${dropPercent}% versus the previous day but has not crossed the critical threshold.`,
    }
  }

  return {
    id,
    name,
    scopeLabel,
    owner,
    status: 'ok',
    severity: 'info',
    metricLabel: 'Page Views',
    thresholdLabel: '25% drop vs previous day',
    currentValue,
    baselineValue,
    deltaPercent: change,
    detail: `${scopeLabel} traffic is within the expected daily range.`,
  }
}

const buildConsentRule = (current: ConsentSnapshot, baseline: ConsentSnapshot): AlertRuleEvaluation => {
  const currentGrantedShare = percentage(current.granted, current.granted + current.denied + current.unknown)
  const baselineGrantedShare = percentage(baseline.granted, baseline.granted + baseline.denied + baseline.unknown)
  const shareShift = round(currentGrantedShare - baselineGrantedShare, 1)
  const baselineVolume = baseline.granted + baseline.denied + baseline.unknown

  if (baselineVolume >= MIN_ALERT_BASELINE_EVENTS && Math.abs(shareShift) >= 15) {
    return {
      id: 'consent-mismatch',
      name: 'Consent mix shift',
      scopeLabel: 'Workspace',
      owner: 'Workspace',
      status: 'active',
      severity: 'warning',
      metricLabel: 'Granted consent share',
      thresholdLabel: '15 point shift vs previous day',
      currentValue: currentGrantedShare,
      baselineValue: baselineGrantedShare,
      deltaPercent: shareShift,
      detail: `Granted-consent share moved ${shareShift > 0 ? '+' : ''}${shareShift} points compared with the previous day.`,
    }
  }

  if (baselineVolume >= MIN_ALERT_BASELINE_EVENTS && Math.abs(shareShift) >= 8) {
    return {
      id: 'consent-mismatch',
      name: 'Consent mix shift',
      scopeLabel: 'Workspace',
      owner: 'Workspace',
      status: 'monitoring',
      severity: 'info',
      metricLabel: 'Granted consent share',
      thresholdLabel: '8 point shift vs previous day',
      currentValue: currentGrantedShare,
      baselineValue: baselineGrantedShare,
      deltaPercent: shareShift,
      detail: `Consent mix changed ${shareShift > 0 ? '+' : ''}${shareShift} points. Review recent consent configuration changes if the trend continues.`,
    }
  }

  return {
    id: 'consent-mismatch',
    name: 'Consent mix shift',
    scopeLabel: 'Workspace',
    owner: 'Workspace',
    status: 'ok',
    severity: 'info',
    metricLabel: 'Granted consent share',
    thresholdLabel: '15 point shift vs previous day',
    currentValue: currentGrantedShare,
    baselineValue: baselineGrantedShare,
    deltaPercent: shareShift,
    detail: 'Consent mix is stable relative to the previous day.',
  }
}

const buildExportDelayRule = (
  health: HealthSnapshot,
  config: CollectorConfig,
  now: Date,
): AlertRuleEvaluation => {
  const lastRollupAtMs = health.lastRollupAt ? Date.parse(health.lastRollupAt) : 0
  const staleThresholdMs = Math.max(config.rollupIntervalMs * 4, STALE_ROLLUP_FLOOR_MS)
  const lagMs = lastRollupAtMs > 0 ? Math.max(0, now.getTime() - lastRollupAtMs) : staleThresholdMs
  const lagMinutes = round(lagMs / 60_000, 1)
  const isDelayed = health.pendingRollupBuckets > 0 || lagMs >= staleThresholdMs

  return {
    id: 'scheduled-export-delay',
    name: 'Scheduled export freshness',
    scopeLabel: 'Workspace',
    owner: 'Workspace',
    status: isDelayed ? 'active' : 'ok',
    severity: isDelayed ? 'critical' : 'info',
    metricLabel: 'Rollup lag',
    thresholdLabel: `No lag beyond ${round(staleThresholdMs / 60_000, 1)} minutes`,
    currentValue: lagMinutes,
    baselineValue: 0,
    deltaPercent: 0,
    detail: isDelayed
      ? `Scheduled exports are delayed because rollups are ${lagMinutes} minutes behind and ${health.pendingRollupBuckets} bucket(s) are still pending.`
      : 'Scheduled exports have fresh rollups available for report generation.',
  }
}

const buildCollectorHealthRule = (health: HealthSnapshot): AlertRuleEvaluation => {
  const issueCount = health.invalidLines + health.duplicateEventIds

  return {
    id: 'collector-health',
    name: 'Collector health',
    scopeLabel: 'Workspace',
    owner: 'System',
    status: issueCount > 0 ? 'active' : 'ok',
    severity: issueCount > 0 ? 'critical' : 'info',
    metricLabel: 'Invalid or duplicate events',
    thresholdLabel: '0 malformed or duplicate records during migration and ingestion',
    currentValue: issueCount,
    baselineValue: 0,
    deltaPercent: 0,
    detail:
      issueCount > 0
        ? `Pulse detected ${health.invalidLines} invalid line(s) and ${health.duplicateEventIds} duplicate event id(s).`
        : 'Collection health checks are clean.',
  }
}

const buildActivity = (rules: AlertRuleEvaluation[], health: HealthSnapshot, generatedAt: string) => {
  const activity = rules
    .filter((rule) => rule.status !== 'ok')
    .map((rule) => ({
      occurredAt: generatedAt,
      severity: rule.severity,
      title: rule.name,
      detail: rule.detail,
    }))

  activity.push({
    occurredAt: health.lastRollupAt || generatedAt,
    severity: 'info',
    title: 'Rollup pipeline check',
    detail:
      health.pendingRollupBuckets > 0
        ? `${health.pendingRollupBuckets} bucket(s) are still waiting to be rolled up.`
        : 'Rollup pipeline is current.',
  })

  activity.push({
    occurredAt: health.lastRetentionAt || generatedAt,
    severity: 'info',
    title: 'Retention enforcement',
    detail: `Retention jobs have removed ${health.retentionDeletedEvents} event(s) so far.`,
  })

  return activity.sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
}

export async function buildAlertsResponse(
  store: SqliteEventStore,
  config: CollectorConfig,
  account: AuthenticatedAccount,
  now = new Date(),
): Promise<AlertsResponse> {
  const range = lastCompleteUtcDayRange(now)
  const projects = await store.listProjectsForAccount(account.accountId)
  const [currentOverview, baselineOverview, currentConsent, baselineConsent, health, projectComparisons] = await Promise.all([
    store.getOverviewAnalytics(account.accountId, range.currentFrom.toISOString(), range.currentTo.toISOString(), 'day'),
    store.getOverviewAnalytics(account.accountId, range.baselineFrom.toISOString(), range.baselineTo.toISOString(), 'day'),
    store.getConsentSnapshot(account.accountId, range.currentFrom.toISOString(), range.currentTo.toISOString()),
    store.getConsentSnapshot(account.accountId, range.baselineFrom.toISOString(), range.baselineTo.toISOString()),
    store.readHealthSnapshot(),
    Promise.all(
      projects.map(async (project) => {
        const [current, baseline] = await Promise.all([
          store.getProjectOverviewAnalytics(account.accountId, project.projectId, range.currentFrom.toISOString(), range.currentTo.toISOString(), 'day'),
          store.getProjectOverviewAnalytics(account.accountId, project.projectId, range.baselineFrom.toISOString(), range.baselineTo.toISOString(), 'day'),
        ])

        return {
          projectId: project.projectId,
          projectName: project.projectName,
          currentValue: getMetricValue(current.metrics, 'page_views'),
          baselineValue: getMetricValue(baseline.metrics, 'page_views'),
        }
      }),
    ),
  ])

  const workspaceTrafficRule = buildTrafficRule(
    'workspace-traffic-drop',
    'Workspace traffic drop',
    'Workspace',
    account.displayName,
    getMetricValue(currentOverview.metrics, 'page_views'),
    getMetricValue(baselineOverview.metrics, 'page_views'),
  )

  const projectTrafficCandidate = [...projectComparisons]
    .sort((a, b) => deltaPercent(a.currentValue, a.baselineValue) - deltaPercent(b.currentValue, b.baselineValue))[0]

  const projectTrafficRule = buildTrafficRule(
    'project-traffic-drop',
    'Project traffic drop',
    projectTrafficCandidate?.projectName || 'Tracked project',
    account.displayName,
    projectTrafficCandidate?.currentValue || 0,
    projectTrafficCandidate?.baselineValue || 0,
  )

  const rules = [
    workspaceTrafficRule,
    projectTrafficRule,
    buildConsentRule(currentConsent, baselineConsent),
    buildExportDelayRule(health, config, now),
    buildCollectorHealthRule(health),
  ]

  return {
    generatedAt: now.toISOString(),
    evaluationRange: {
      currentFrom: range.currentFrom.toISOString(),
      currentTo: range.currentTo.toISOString(),
      baselineFrom: range.baselineFrom.toISOString(),
      baselineTo: range.baselineTo.toISOString(),
    },
    summary: {
      activeRules: rules.filter((rule) => rule.status === 'active').length,
      monitoringRules: rules.filter((rule) => rule.status === 'monitoring').length,
      okRules: rules.filter((rule) => rule.status === 'ok').length,
    },
    rules,
    activity: buildActivity(rules, health, now.toISOString()),
  }
}

export async function buildExportsResponse(
  store: SqliteEventStore,
  config: CollectorConfig,
  account: AuthenticatedAccount,
  now = new Date(),
): Promise<ExportsResponse> {
  const [overview, pagesReport, referrersReport, health] = await Promise.all([
    store.getOverviewAnalytics(account.accountId, null, null, 'day'),
    store.getPagesReport(account.accountId, null, null, 'day'),
    store.getReferrersReport(account.accountId, null, null, 'day'),
    store.readHealthSnapshot(),
  ])

  const exportDelayRule = buildExportDelayRule(health, config, now)
  const delayed = exportDelayRule.status === 'active'
  const scheduleStatus: ExportSchedule['status'] = delayed ? 'delayed' : 'ok'
  const weeklyRunStatus: ExportRun['status'] = delayed ? 'delayed' : 'succeeded'
  const monthlyRunStatus: ExportRun['status'] = delayed ? 'pending' : 'succeeded'
  const weeklyLastRunAt = previousMondayAtHourUtc(now, 8)
  const weeklyNextRunAt = nextMondayAtHourUtc(now, 8)
  const monthlyLastRunAt = new Date(startOfUtcMonth(now))
  const monthlyNextRunAt = new Date(startOfNextUtcMonth(now))

  const schedules: ExportSchedule[] = [
    {
      id: 'weekly-executive-summary',
      name: 'Weekly executive summary',
      reportSlug: 'executive' as const,
      cadence: 'weekly' as const,
      format: 'pdf_summary' as const,
      owner: account.displayName,
      recipients: [account.email],
      lastRunAt: weeklyLastRunAt.toISOString(),
      nextRunAt: weeklyNextRunAt.toISOString(),
      status: scheduleStatus,
      detail: delayed
        ? 'Waiting for current rollups before the weekly PDF can be finalized.'
        : `Includes ${overview.totals.acceptedEvents} accepted events across ${overview.totals.trackedProjects} tracked projects.`,
    },
    {
      id: 'monthly-acquisition-digest',
      name: 'Monthly acquisition digest',
      reportSlug: 'referrers' as const,
      cadence: 'monthly' as const,
      format: 'pdf_summary' as const,
      owner: account.displayName,
      recipients: [account.email],
      lastRunAt: monthlyLastRunAt.toISOString(),
      nextRunAt: monthlyNextRunAt.toISOString(),
      status: scheduleStatus,
      detail: delayed
        ? 'The referrer digest is queued behind the current rollup lag.'
        : `Summarizes ${referrersReport.trackedReferrers} tracked referrers and ${referrersReport.searchLedVisits} search-led visits.`,
    },
  ]

  const recentRuns: ExportRun[] = [
    {
      id: 'run-weekly-executive-latest',
      scheduleId: 'weekly-executive-summary',
      name: 'Weekly executive summary',
      status: weeklyRunStatus,
      format: 'pdf_summary' as const,
      scopeLabel: 'Workspace overview',
      startedAt: weeklyLastRunAt.toISOString(),
      completedAt: delayed ? null : addDays(weeklyLastRunAt, 0).toISOString(),
      rowCount: overview.topProjects.length + overview.topPages.length + overview.topReferrers.length,
      detail: delayed
        ? 'Waiting on fresh rollups before PDF generation completes.'
        : `Completed from the workspace overview range ${overview.range.from} to ${overview.range.to}.`,
    },
    {
      id: 'run-monthly-acquisition-latest',
      scheduleId: 'monthly-acquisition-digest',
      name: 'Monthly acquisition digest',
      status: monthlyRunStatus,
      format: 'pdf_summary' as const,
      scopeLabel: 'Referrer report',
      startedAt: monthlyLastRunAt.toISOString(),
      completedAt: delayed ? null : monthlyLastRunAt.toISOString(),
      rowCount: referrersReport.rows.length,
      detail: delayed
        ? 'Queued until the current analytics rollups finish.'
        : `Rendered from ${referrersReport.rows.length} referrer rows.`,
    },
    {
      id: 'run-manual-pages-csv',
      scheduleId: 'manual',
      name: 'Manual content export',
      status: 'succeeded',
      format: 'csv' as const,
      scopeLabel: 'Pages report',
      startedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      completedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000 + 45_000).toISOString(),
      rowCount: pagesReport.rows.length,
      detail: `CSV export generated from ${pagesReport.trackedPages} tracked pages.`,
    },
  ]

  return {
    generatedAt: now.toISOString(),
    summary: {
      scheduledExports: schedules.length,
      delayedExports: schedules.filter((schedule) => schedule.status === 'delayed').length,
      manualExportFormat: 'csv',
      scheduledExportFormat: 'pdf_summary',
    },
    schedules,
    recentRuns,
  }
}

export async function buildWorkspaceSettingsResponse(
  store: SqliteEventStore,
  config: CollectorConfig,
  account: AuthenticatedAccount,
  now = new Date(),
): Promise<WorkspaceSettingsResponse> {
  const [health, projects] = await Promise.all([store.readHealthSnapshot(), store.listProjectsForAccount(account.accountId)])
  const workspaceProjects = await Promise.all(
    projects.map(async (project): Promise<WorkspaceProjectSetting> => {
      const lastEventAt = await store.getLatestEventAt(account.accountId, project.projectId)
      const isLive = lastEventAt ? now.getTime() - Date.parse(lastEventAt) <= 7 * MS_PER_DAY : false
      const projectStatus: WorkspaceProjectSetting['status'] = isLive ? 'live' : 'idle'

      return {
        projectId: project.projectId,
        projectName: project.projectName,
        retentionMonths: config.defaultRetentionMonths,
        status: projectStatus,
        lastEventAt,
      }
    }),
  )

  return {
    generatedAt: now.toISOString(),
    workspace: {
      id: account.accountId,
      name: account.displayName,
      roleModel: 'workspace_scoped',
      defaultRetentionMonths: config.defaultRetentionMonths,
      allowedRetentionMonths: [6, 12, 13],
    },
    roles: [
      {
        role: 'viewer',
        can: ['View dashboards', 'View project pages', 'View reports', 'View alerts'],
        cannot: ['Change settings', 'Configure exports', 'Edit alert rules', 'Invite users'],
      },
      {
        role: 'editor',
        can: [
          'Manage project settings',
          'Configure event allowlists',
          'Create and manage reports',
          'Create and manage alert rules',
          'Trigger manual exports',
        ],
        cannot: ['Invite users', 'Change retention settings', 'Transfer ownership'],
      },
      {
        role: 'owner',
        can: [
          'Invite and remove users',
          'Change workspace roles',
          'Configure retention',
          'Configure scheduled exports',
          'Manage subscription-facing settings',
        ],
        cannot: [],
      },
    ],
    projects: workspaceProjects,
    controls: [
      {
        title: 'Workspace access',
        body: 'Permissions stay workspace-scoped in MVP. Owners control membership, while viewers and editors work inside the same workspace boundary.',
        bullets: ['Invite-based membership', 'At least one owner is required', 'Project-level permissions are out of scope in MVP'],
      },
      {
        title: 'Retention controls',
        body: 'Retention is visible to every role, but only owners may change the workspace setting used across projects.',
        bullets: ['Workspace retention choices: 6, 12, or 13 months', 'Every project follows the same workspace retention setting', 'Exports should respect downstream retention policy'],
      },
      {
        title: 'Alert and export ownership',
        body: 'Alerts remain in-app only, manual exports are CSV, and scheduled exports are PDF summaries managed by workspace users inside the product.',
        bullets: ['Editors and owners manage alert rules', 'Owners manage scheduled exports', 'Export failures surface in-app'],
      },
      {
        title: 'Operational safeguards',
        body: 'The collector now enforces request-size and request-rate limits, and rollup plus retention jobs remain visible from the product settings surface.',
        bullets: ['JSON request size limit', 'IP-based collector rate limiting', 'Rollup and retention timestamps exposed in product settings'],
      },
    ],
    operations: {
      healthStatus: health.status,
      corsOrigin: config.corsOrigin,
      maxBatchSize: config.maxBatchSize,
      maxBodyBytes: config.maxBodyBytes,
      rateLimitWindowMs: config.rateLimitWindowMs,
      rateLimitMaxRequests: config.rateLimitMaxRequests,
      rollupIntervalMs: config.rollupIntervalMs,
      retentionIntervalMs: config.retentionIntervalMs,
      lastRollupAt: health.lastRollupAt,
      lastRetentionAt: health.lastRetentionAt,
    },
  }
}
