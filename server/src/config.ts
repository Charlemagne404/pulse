import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { CollectorConfig, RetentionMonths } from './types.js'

const DEFAULT_PROJECT_IDS = ['aegis', 'contitech', 'vdo-fleet', 'contitrade']
const DEFAULT_EVENT_NAMES = [
  'page_view',
  'button_click',
  'form_submit',
  'file_download',
  'video_play',
  'spec_opened',
  'contact_request',
  'demo_opened',
  'appointment_started',
  'store_selected',
  'coupon_download',
]
const ALLOWED_RETENTION_MONTHS = new Set<RetentionMonths>([6, 12, 13])

const parseInteger = (value: string | undefined, fallback: number) => {
  if (!value) {
    return fallback
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const parseList = (value: string | undefined, fallback: string[]) => {
  if (!value) {
    return fallback
  }

  const items = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  return items.length ? items : fallback
}

const parseRetentionMonths = (value: string | undefined, fallback: RetentionMonths) => {
  const parsed = value ? Number.parseInt(value, 10) : fallback
  return ALLOWED_RETENTION_MONTHS.has(parsed as RetentionMonths) ? (parsed as RetentionMonths) : fallback
}

const parseProjectRetentionMonths = (
  value: string | undefined,
  defaultRetentionMonths: RetentionMonths,
): Map<string, RetentionMonths> => {
  if (!value) {
    return new Map()
  }

  const entries = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  const parsed = new Map<string, RetentionMonths>()

  for (const entry of entries) {
    const [projectIdRaw, monthsRaw] = entry.split(':')
    const projectId = projectIdRaw?.trim()
    const months = parseRetentionMonths(monthsRaw?.trim(), defaultRetentionMonths)

    if (projectId) {
      parsed.set(projectId, months)
    }
  }

  return parsed
}

export const loadConfig = (): CollectorConfig => {
  const databasePath = resolve(process.env.PULSE_DB_PATH || 'server/data/pulse.sqlite')
  const legacySinkPath = resolve(process.env.PULSE_EVENT_LOG_PATH || 'server/data/events.ndjson')
  const defaultRetentionMonths = parseRetentionMonths(process.env.PULSE_DEFAULT_RETENTION_MONTHS, 13)

  mkdirSync(dirname(databasePath), { recursive: true })
  mkdirSync(dirname(legacySinkPath), { recursive: true })

  return {
    host: process.env.PULSE_HOST || '127.0.0.1',
    port: parseInteger(process.env.PULSE_PORT, 8787),
    corsOrigin: process.env.PULSE_CORS_ORIGIN || '*',
    maxBatchSize: parseInteger(process.env.PULSE_MAX_BATCH_SIZE, 25),
    maxBodyBytes: parseInteger(process.env.PULSE_MAX_BODY_BYTES, 262_144),
    rateLimitWindowMs: parseInteger(process.env.PULSE_RATE_LIMIT_WINDOW_MS, 60_000),
    rateLimitMaxRequests: parseInteger(process.env.PULSE_RATE_LIMIT_MAX_REQUESTS, 120),
    databasePath,
    legacySinkPath,
    rollupIntervalMs: parseInteger(process.env.PULSE_ROLLUP_INTERVAL_MS, 15_000),
    retentionIntervalMs: parseInteger(process.env.PULSE_RETENTION_INTERVAL_MS, 3_600_000),
    defaultRetentionMonths,
    projectRetentionMonths: parseProjectRetentionMonths(
      process.env.PULSE_PROJECT_RETENTION_MONTHS,
      defaultRetentionMonths,
    ),
    allowedProjectIds: new Set(parseList(process.env.PULSE_PROJECT_IDS, DEFAULT_PROJECT_IDS)),
    allowedEventNames: new Set(parseList(process.env.PULSE_ALLOWED_EVENTS, DEFAULT_EVENT_NAMES)),
  }
}
