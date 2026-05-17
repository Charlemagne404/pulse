import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createPulseServer } from './app.js'
import type { CollectorConfig } from './types.js'

const createConfig = (sinkPath: string): CollectorConfig => ({
  host: '127.0.0.1',
  port: 0,
  corsOrigin: '*',
  maxBatchSize: 25,
  maxBodyBytes: 262_144,
  sinkPath,
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
  const sinkPath = join(dir, 'events.ndjson')
  const { server, baseUrl } = await startServer(createConfig(sinkPath))

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

test('health and analytics tolerate corrupted sink lines', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pulse-server-test-'))
  const sinkPath = join(dir, 'events.ndjson')
  await writeFile(
    sinkPath,
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

  const { server, baseUrl } = await startServer(createConfig(sinkPath))

  try {
    const healthResponse = await fetch(`${baseUrl}/api/health`)
    assert.equal(healthResponse.status, 200)
    const health = (await healthResponse.json()) as {
      status: string
      storedEvents: number
      invalidLines: number
      duplicateEventIds: number
    }
    assert.equal(health.status, 'degraded')
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
  const sinkPath = join(dir, 'events.ndjson')
  const { server, baseUrl } = await startServer(createConfig(sinkPath))

  try {
    const response = await fetch(`${baseUrl}/v1/analytics/projects/unknown-project/overview`)
    assert.equal(response.status, 404)
    const body = (await response.json()) as { error: string }
    assert.equal(body.error, 'not_found')
  } finally {
    await stopServer(server)
  }
})

test('collector stores sanitized paths without query strings', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pulse-server-test-'))
  const sinkPath = join(dir, 'events.ndjson')
  const { server, baseUrl } = await startServer(createConfig(sinkPath))

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

    const raw = await readFile(sinkPath, 'utf8')
    assert.match(raw, /"path":"\/pricing"/)
    assert.doesNotMatch(raw, /email=test@example.com/)
  } finally {
    await stopServer(server)
  }
})
