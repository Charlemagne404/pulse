import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { CollectorConfig } from './types.js'

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

export const loadConfig = (): CollectorConfig => {
  const sinkPath = resolve(process.env.PULSE_EVENT_LOG_PATH || 'server/data/events.ndjson')
  mkdirSync(dirname(sinkPath), { recursive: true })

  return {
    host: process.env.PULSE_HOST || '127.0.0.1',
    port: parseInteger(process.env.PULSE_PORT, 8787),
    corsOrigin: process.env.PULSE_CORS_ORIGIN || '*',
    maxBatchSize: parseInteger(process.env.PULSE_MAX_BATCH_SIZE, 25),
    maxBodyBytes: parseInteger(process.env.PULSE_MAX_BODY_BYTES, 262_144),
    sinkPath,
    allowedProjectIds: new Set(parseList(process.env.PULSE_PROJECT_IDS, DEFAULT_PROJECT_IDS)),
    allowedEventNames: new Set(parseList(process.env.PULSE_ALLOWED_EVENTS, DEFAULT_EVENT_NAMES)),
  }
}
