import { getAccessToken } from '../auth/accessToken'

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
  retentionMonths: 6 | 12 | 13
  status: 'live' | 'idle'
  lastEventAt: string | null
}

export interface WorkspaceSettingsResponse {
  generatedAt: string
  workspace: {
    id: string
    name: string
    roleModel: 'workspace_scoped'
    defaultRetentionMonths: 6 | 12 | 13
    allowedRetentionMonths: Array<6 | 12 | 13>
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

export interface CreateProjectRequest {
  name: string
  domain: string
  projectId: string
  integrationPreset: 'website' | 'spa'
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

interface ApiErrorPayload {
  message?: string
}

const configuredApiBase = (import.meta.env.VITE_PULSE_API_BASE_URL || '').trim().replace(/\/+$/, '')
const JSON_CONTENT_TYPE = 'application/json'

const buildRequestUrl = (path: string) => {
  const baseUrl = configuredApiBase || window.location.origin
  return new URL(path, baseUrl)
}

const buildNonJsonResponseMessage = (response: Response) => {
  const contentType = response.headers.get('content-type') || 'unknown content type'
  return `Product API returned ${contentType} instead of JSON. Check that /v1 is routed to the Pulse backend.`
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

  return `Request failed with status ${response.status}.`
}

const requestJson = async <T>(path: string, signal?: AbortSignal, init?: RequestInit): Promise<T> => {
  const accessToken = getAccessToken()
  const response = await fetch(buildRequestUrl(path), {
    ...init,
    signal,
    headers: {
      accept: 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(init?.headers || {}),
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
    throw new Error('Product API returned invalid JSON. Check that the backend is reachable and not serving HTML.')
  }
}

export const fetchAlerts = (signal?: AbortSignal) => requestJson<AlertsResponse>('/v1/alerts', signal)

export const fetchExports = (signal?: AbortSignal) => requestJson<ExportsResponse>('/v1/exports', signal)

export const fetchWorkspaceSettings = (signal?: AbortSignal) =>
  requestJson<WorkspaceSettingsResponse>('/v1/workspace', signal)

export const createProject = (payload: CreateProjectRequest, signal?: AbortSignal) =>
  requestJson<ProjectRecord>('/v1/projects', signal, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
