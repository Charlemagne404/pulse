import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createPulseServer } from './app.js'
import type { CollectorConfig, RetentionMonths } from './types.js'

const createConfig = (
  dir: string,
  overrides: Partial<
    Pick<
      CollectorConfig,
      'defaultRetentionMonths' | 'projectRetentionMonths' | 'rollupIntervalMs' | 'retentionIntervalMs'
    >
  > = {},
): CollectorConfig => ({
  host: '127.0.0.1',
  port: 0,
  corsOrigin: '*',
  maxBatchSize: 25,
  maxBodyBytes: 262_144,
  databasePath: join(dir, 'pulse.sqlite'),
  legacySinkPath: join(dir, 'events.ndjson'),
  rollupIntervalMs: overrides.rollupIntervalMs ?? 25,
  retentionIntervalMs: overrides.retentionIntervalMs ?? 25,
  defaultRetentionMonths: overrides.defaultRetentionMonths ?? 13,
  projectRetentionMonths: overrides.projectRetentionMonths ?? new Map<string, RetentionMonths>(),
  allowedProjectIds: new Set(['aegis', 'contitech', 'vdo-fleet', 'contitrade']),
  allowedEventNames: new Set([
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
  ]),
})

const startServer = async (config: CollectorConfig) => {
  const server = createPulseServer(config)

  await new Promise<void>((resolve) => {
    server.listen(config.port, config.host, () => resolve())
  })

  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Could not resolve server address.')
  }

  const baseUrl = `http://${config.host}:${address.port}`
  return { server, baseUrl }
}

const stopServer = async (server: ReturnType<typeof createPulseServer>) => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}

test('collector rejects duplicate event ids across requests', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pulse-server-test-'))
  const { server, baseUrl } = await startServer(createConfig(dir))

  try {
    const payload = {
      events: [
        {
          eventId: 'event_duplicate_0001',
          eventName: 'page_view',
          occurredAt: '2026-05-17T10:00:00.000Z',
          projectId: 'aegis',
          page: { path: '/pricing' },
          consent: { state: 'granted', mode: 'standard' },
          identity: { sessionId: 'sess_dup_0001', visitorKey: 'visitor_dup_0001' },
        },
      ],
    }

    const firstResponse = await fetch(`${baseUrl}/v1/collect`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    assert.equal(firstResponse.status, 202)

    const secondResponse = await fetch(`${baseUrl}/v1/collect`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    assert.equal(secondResponse.status, 400)

    const body = (await secondResponse.json()) as {
      accepted: number
      rejected: number
      results: Array<{ status: string; reason?: string }>
    }
    assert.equal(body.accepted, 0)
    assert.equal(body.rejected, 1)
    assert.equal(body.results[0]?.status, 'rejected')
    assert.match(body.results[0]?.reason || '', /already exists/i)
  } finally {
    await stopServer(server)
  }
})

test('legacy NDJSON migrates into sqlite and preserves invalid-line health signals', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pulse-server-test-'))
  const config = createConfig(dir)

  await writeFile(
    config.legacySinkPath,
    [
      JSON.stringify({
        schemaVersion: 1,
        receivedAt: '2026-05-17T10:00:00.000Z',
        eventId: 'event_valid_0001',
        eventName: 'page_view',
        occurredAt: '2026-05-17T10:00:00.000Z',
        projectId: 'aegis',
        page: { path: '/pricing' },
        consent: { state: 'unknown', mode: 'strict' },
      }),
      '{"broken": ',
      JSON.stringify({
        schemaVersion: 1,
        receivedAt: '2026-05-17T10:05:00.000Z',
        eventId: 'event_valid_0001',
        eventName: 'page_view',
        occurredAt: '2026-05-17T10:05:00.000Z',
        projectId: 'aegis',
        page: { path: '/pricing' },
        consent: { state: 'unknown', mode: 'strict' },
      }),
    ].join('\n'),
    'utf8',
  )

  const { server, baseUrl } = await startServer(config)

  try {
    const healthResponse = await fetch(`${baseUrl}/api/health`)
    assert.equal(healthResponse.status, 200)
    const health = (await healthResponse.json()) as {
      status: string
      storage: string
      storedEvents: number
      invalidLines: number
      duplicateEventIds: number
    }
    assert.equal(health.status, 'degraded')
    assert.equal(health.storage, 'sqlite')
    assert.equal(health.storedEvents, 1)
    assert.equal(health.invalidLines, 1)
    assert.equal(health.duplicateEventIds, 1)

    const overviewResponse = await fetch(
      `${baseUrl}/v1/analytics/overview?from=2026-05-17T00:00:00.000Z&to=2026-05-17T23:59:59.000Z`,
    )
    assert.equal(overviewResponse.status, 200)
    const overview = (await overviewResponse.json()) as {
      totals: { acceptedEvents: number }
      metrics: Array<{ key: string; value: number }>
    }
    assert.equal(overview.totals.acceptedEvents, 1)
    assert.equal(overview.metrics.find((metric) => metric.key === 'page_views')?.value, 1)
  } finally {
    await stopServer(server)
  }
})

test('analytics rejects unknown project filters', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pulse-server-test-'))
  const { server, baseUrl } = await startServer(createConfig(dir))

  try {
    const response = await fetch(`${baseUrl}/v1/analytics/projects/unknown-project/overview`)
    assert.equal(response.status, 404)
    const body = (await response.json()) as { error: string }
    assert.equal(body.error, 'not_found')
  } finally {
    await stopServer(server)
  }
})

test('collector stores sanitized paths and recent events expose the normalized value', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pulse-server-test-'))
  const { server, baseUrl } = await startServer(createConfig(dir))

  try {
    const response = await fetch(`${baseUrl}/v1/collect`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        events: [
          {
            eventName: 'page_view',
            occurredAt: '2026-05-17T10:00:00.000Z',
            projectId: 'aegis',
            page: { path: 'https://example.com/pricing?email=test@example.com#hero', title: 'Pricing' },
            consent: { state: 'unknown', mode: 'standard' },
          },
        ],
      }),
    })
    assert.equal(response.status, 202)

    const recentResponse = await fetch(
      `${baseUrl}/v1/analytics/events/recent?projectId=aegis&from=2026-05-17T00:00:00.000Z&to=2026-05-17T23:59:59.000Z&limit=1`,
    )
    assert.equal(recentResponse.status, 200)

    const recent = (await recentResponse.json()) as {
      rows: Array<{ path: string }>
    }
    assert.equal(recent.rows[0]?.path, '/pricing')
  } finally {
    await stopServer(server)
  }
})

test('retention enforcement removes events outside the configured project window', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pulse-server-test-'))
  const { server, baseUrl } = await startServer(
    createConfig(dir, {
      defaultRetentionMonths: 6,
      retentionIntervalMs: 1,
    }),
  )

  try {
    const response = await fetch(`${baseUrl}/v1/collect`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        events: [
          {
            eventId: 'event_old_0001',
            eventName: 'page_view',
            occurredAt: '2020-01-01T10:00:00.000Z',
            projectId: 'aegis',
            page: { path: '/retired' },
            consent: { state: 'granted', mode: 'standard' },
            identity: { sessionId: 'sess_retention_old_0001', visitorKey: 'visitor_retention_old_0001' },
          },
          {
            eventId: 'event_fresh_0001',
            eventName: 'page_view',
            occurredAt: '2026-05-17T10:00:00.000Z',
            projectId: 'aegis',
            page: { path: '/active' },
            consent: { state: 'granted', mode: 'standard' },
            identity: { sessionId: 'sess_retention_new_0001', visitorKey: 'visitor_retention_new_0001' },
          },
        ],
      }),
    })
    assert.equal(response.status, 202)

    const healthResponse = await fetch(`${baseUrl}/api/health`)
    assert.equal(healthResponse.status, 200)
    const health = (await healthResponse.json()) as {
      storedEvents: number
      retentionDeletedEvents: number
    }
    assert.equal(health.storedEvents, 1)
    assert.equal(health.retentionDeletedEvents, 1)
  } finally {
    await stopServer(server)
  }
})

test('recent events pagination and filtering work with cursor-based reads', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pulse-server-test-'))
  const { server, baseUrl } = await startServer(createConfig(dir))

  try {
    const response = await fetch(`${baseUrl}/v1/collect`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        events: [
          {
            eventId: 'event_recent_0001',
            eventName: 'page_view',
            occurredAt: '2026-05-17T10:00:00.000Z',
            projectId: 'aegis',
            page: { path: '/docs/install' },
            consent: { state: 'granted', mode: 'standard' },
            context: { deviceType: 'desktop', countryCode: 'SE' },
            identity: { sessionId: 'sess_recent_0001', visitorKey: 'visitor_recent_0001' },
          },
          {
            eventId: 'event_recent_0002',
            eventName: 'button_click',
            occurredAt: '2026-05-17T10:01:00.000Z',
            projectId: 'aegis',
            page: { path: '/docs/install' },
            consent: { state: 'granted', mode: 'standard' },
            context: { deviceType: 'desktop', countryCode: 'SE' },
            identity: { sessionId: 'sess_recent_0001', visitorKey: 'visitor_recent_0001' },
          },
          {
            eventId: 'event_recent_0003',
            eventName: 'page_view',
            occurredAt: '2026-05-17T10:02:00.000Z',
            projectId: 'aegis',
            page: { path: '/docs/api' },
            consent: { state: 'granted', mode: 'standard' },
            context: { deviceType: 'mobile', countryCode: 'DE' },
            identity: { sessionId: 'sess_recent_0002', visitorKey: 'visitor_recent_0002' },
          },
        ],
      }),
    })
    assert.equal(response.status, 202)

    const firstPageResponse = await fetch(
      `${baseUrl}/v1/analytics/events/recent?projectId=aegis&eventName=page_view&pathPrefix=/docs&limit=1&from=2026-05-17T00:00:00.000Z&to=2026-05-17T23:59:59.000Z`,
    )
    assert.equal(firstPageResponse.status, 200)

    const firstPage = (await firstPageResponse.json()) as {
      rows: Array<{ path: string; eventName: string }>
      page: { hasMore: boolean; nextCursor: string | null }
    }
    assert.equal(firstPage.rows.length, 1)
    assert.equal(firstPage.rows[0]?.path, '/docs/api')
    assert.equal(firstPage.rows[0]?.eventName, 'page_view')
    assert.equal(firstPage.page.hasMore, true)
    assert.ok(firstPage.page.nextCursor)

    const secondPageResponse = await fetch(
      `${baseUrl}/v1/analytics/events/recent?projectId=aegis&eventName=page_view&pathPrefix=/docs&limit=1&cursor=${encodeURIComponent(firstPage.page.nextCursor || '')}&from=2026-05-17T00:00:00.000Z&to=2026-05-17T23:59:59.000Z`,
    )
    assert.equal(secondPageResponse.status, 200)

    const secondPage = (await secondPageResponse.json()) as {
      rows: Array<{ path: string }>
      page: { hasMore: boolean }
    }
    assert.equal(secondPage.rows.length, 1)
    assert.equal(secondPage.rows[0]?.path, '/docs/install')
    assert.equal(secondPage.page.hasMore, false)

    const filteredResponse = await fetch(
      `${baseUrl}/v1/analytics/events/recent?projectId=aegis&deviceType=mobile&countryCode=DE&from=2026-05-17T00:00:00.000Z&to=2026-05-17T23:59:59.000Z`,
    )
    assert.equal(filteredResponse.status, 200)

    const filtered = (await filteredResponse.json()) as {
      rows: Array<{ path: string; countryCode: string; deviceType: string }>
    }
    assert.equal(filtered.rows.length, 1)
    assert.equal(filtered.rows[0]?.path, '/docs/api')
    assert.equal(filtered.rows[0]?.countryCode, 'DE')
    assert.equal(filtered.rows[0]?.deviceType, 'mobile')
  } finally {
    await stopServer(server)
  }
})
