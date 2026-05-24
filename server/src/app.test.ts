import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createPulseServer } from './app.js'
import type { AuthenticatedAccount, CollectorConfig } from './types.js'
import type { AuthResolver } from './auth.js'

const TEST_ACCOUNTS: Record<string, AuthenticatedAccount> = {
  'test-user-1': {
    accountId: 'user_1',
    continentalId: 'user_1',
    email: 'user1@example.com',
    username: 'user1',
    displayName: 'User One',
  },
  'test-user-2': {
    accountId: 'user_2',
    continentalId: 'user_2',
    email: 'user2@example.com',
    username: 'user2',
    displayName: 'User Two',
  },
}

const createConfig = (
  dir: string,
  overrides: Partial<
    Pick<
      CollectorConfig,
      | 'defaultRetentionMonths'
      | 'rollupIntervalMs'
      | 'retentionIntervalMs'
      | 'maxBatchSize'
      | 'rateLimitWindowMs'
      | 'rateLimitMaxRequests'
    >
  > = {},
): CollectorConfig => ({
  host: '127.0.0.1',
  port: 0,
  authApiBaseUrl: 'https://auth.continental-hub.com',
  corsOrigin: '*',
  maxBatchSize: overrides.maxBatchSize ?? 25,
  maxBodyBytes: 262_144,
  rateLimitWindowMs: overrides.rateLimitWindowMs ?? 60_000,
  rateLimitMaxRequests: overrides.rateLimitMaxRequests ?? 120,
  databasePath: join(dir, 'pulse.sqlite'),
  legacySinkPath: join(dir, 'events.ndjson'),
  rollupIntervalMs: overrides.rollupIntervalMs ?? 25,
  retentionIntervalMs: overrides.retentionIntervalMs ?? 25,
  defaultRetentionMonths: overrides.defaultRetentionMonths ?? 13,
  allowedProjectIds: new Set(['aegis', 'contitech', 'vdo-fleet', 'contitrade']),
  allowedEventNames: new Set(['page_view', 'button_click', 'form_submit', 'file_download', 'video_play']),
})

const startServer = async (config: CollectorConfig) => {
  const authResolver: AuthResolver = {
    async authenticate(request) {
      const header = request.headers.authorization || ''
      const token = header.replace(/^Bearer\s+/i, '').trim()
      const account = TEST_ACCOUNTS[token]

      if (!account) {
        throw new Error('Missing test auth token.')
      }

      return account
    },
  }
  const server = createPulseServer(config, undefined, authResolver)

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

const authHeaders = (token = 'test-user-1') => ({
  authorization: `Bearer ${token}`,
})

const bootstrapWorkspace = async (baseUrl: string, token = 'test-user-1') => {
  const response = await fetch(`${baseUrl}/v1/workspace`, {
    headers: authHeaders(token),
  })
  assert.equal(response.status, 200)
}

const buildUtcIso = (dayOffset: number, hour: number, minute = 0) => {
  const now = new Date()
  const todayStartMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return new Date(todayStartMs + dayOffset * 24 * 60 * 60 * 1000 + hour * 60 * 60 * 1000 + minute * 60 * 1000).toISOString()
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
    await bootstrapWorkspace(baseUrl)
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

test('collector accepts custom snake_case events when no allowlist is configured', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pulse-server-test-'))
  const { server, baseUrl } = await startServer({
    ...createConfig(dir),
    allowedEventNames: new Set(),
  })

  try {
    await bootstrapWorkspace(baseUrl)
    const response = await fetch(`${baseUrl}/v1/collect`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        events: [
          {
            eventId: 'custom_event_0001',
            eventName: 'signup_started',
            occurredAt: '2026-05-17T10:00:00.000Z',
            projectId: 'aegis',
            page: { path: '/pricing' },
            consent: { state: 'granted', mode: 'standard' },
            identity: { sessionId: 'sess_custom_0001', visitorKey: 'visitor_custom_0001' },
            properties: { plan: 'starter' },
          },
        ],
      }),
    })

    assert.equal(response.status, 202)
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
      { headers: authHeaders() },
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
    const response = await fetch(`${baseUrl}/v1/analytics/projects/unknown-project/overview`, {
      headers: authHeaders(),
    })
    assert.equal(response.status, 404)
    const body = (await response.json()) as { error: string }
    assert.equal(body.error, 'not_found')
  } finally {
    await stopServer(server)
  }
})

test('projects and analytics stay scoped to the owning account', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pulse-server-test-'))
  const config = createConfig(dir)
  config.allowedProjectIds = new Set()
  const { server, baseUrl } = await startServer(config)

  try {
    const createResponse = await fetch(`${baseUrl}/v1/projects`, {
      method: 'POST',
      headers: {
        ...authHeaders('test-user-1'),
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: 'My Site',
        domain: 'https://example.com',
        projectId: 'my-site',
        integrationPreset: 'website',
      }),
    })
    assert.equal(createResponse.status, 201)

    const collectResponse = await fetch(`${baseUrl}/v1/collect`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        events: [
          {
            eventId: 'account_scoped_event_0001',
            eventName: 'page_view',
            occurredAt: '2026-05-17T10:00:00.000Z',
            projectId: 'my-site',
            page: { path: '/home' },
            consent: { state: 'granted', mode: 'standard' },
            identity: { sessionId: 'sess_account_scope_0001', visitorKey: 'visitor_account_scope_0001' },
          },
        ],
      }),
    })
    assert.equal(collectResponse.status, 202)

    const ownerWorkspaceResponse = await fetch(`${baseUrl}/v1/workspace`, {
      headers: authHeaders('test-user-1'),
    })
    assert.equal(ownerWorkspaceResponse.status, 200)
    const ownerWorkspace = (await ownerWorkspaceResponse.json()) as {
      projects: Array<{ projectId: string }>
    }
    assert.deepEqual(ownerWorkspace.projects.map((project) => project.projectId), ['my-site'])

    const otherWorkspaceResponse = await fetch(`${baseUrl}/v1/workspace`, {
      headers: authHeaders('test-user-2'),
    })
    assert.equal(otherWorkspaceResponse.status, 200)
    const otherWorkspace = (await otherWorkspaceResponse.json()) as {
      projects: Array<{ projectId: string }>
    }
    assert.equal(otherWorkspace.projects.length, 0)

    const ownerOverviewResponse = await fetch(
      `${baseUrl}/v1/analytics/projects/my-site/overview?from=2026-05-17T00:00:00.000Z&to=2026-05-17T23:59:59.000Z`,
      {
        headers: authHeaders('test-user-1'),
      },
    )
    assert.equal(ownerOverviewResponse.status, 200)
    const ownerOverview = (await ownerOverviewResponse.json()) as {
      metrics: Array<{ key: string; value: number }>
    }
    assert.equal(ownerOverview.metrics.find((metric) => metric.key === 'page_views')?.value, 1)

    const otherOverviewResponse = await fetch(
      `${baseUrl}/v1/analytics/projects/my-site/overview?from=2026-05-17T00:00:00.000Z&to=2026-05-17T23:59:59.000Z`,
      {
        headers: authHeaders('test-user-2'),
      },
    )
    assert.equal(otherOverviewResponse.status, 404)
  } finally {
    await stopServer(server)
  }
})

test('owners can delete projects and their analytics while other accounts cannot', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pulse-server-test-'))
  const config = createConfig(dir)
  config.allowedProjectIds = new Set()
  const { server, baseUrl } = await startServer(config)

  try {
    const createResponse = await fetch(`${baseUrl}/v1/projects`, {
      method: 'POST',
      headers: {
        ...authHeaders('test-user-1'),
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Delete Me',
        domain: 'https://delete.example.com',
        projectId: 'delete-me',
        integrationPreset: 'website',
      }),
    })
    assert.equal(createResponse.status, 201)

    const collectResponse = await fetch(`${baseUrl}/v1/collect`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        events: [
          {
            eventId: 'delete_project_event_0001',
            eventName: 'page_view',
            occurredAt: '2026-05-17T10:00:00.000Z',
            projectId: 'delete-me',
            page: { path: '/delete-me' },
            consent: { state: 'granted', mode: 'standard' },
            identity: { sessionId: 'sess_delete_project_0001', visitorKey: 'visitor_delete_project_0001' },
          },
        ],
      }),
    })
    assert.equal(collectResponse.status, 202)

    const forbiddenDeleteResponse = await fetch(`${baseUrl}/v1/projects/delete-me`, {
      method: 'DELETE',
      headers: authHeaders('test-user-2'),
    })
    assert.equal(forbiddenDeleteResponse.status, 404)

    const deleteResponse = await fetch(`${baseUrl}/v1/projects/delete-me`, {
      method: 'DELETE',
      headers: authHeaders('test-user-1'),
    })
    assert.equal(deleteResponse.status, 200)

    const workspaceResponse = await fetch(`${baseUrl}/v1/workspace`, {
      headers: authHeaders('test-user-1'),
    })
    assert.equal(workspaceResponse.status, 200)
    const workspace = (await workspaceResponse.json()) as {
      projects: Array<{ projectId: string }>
    }
    assert.equal(workspace.projects.length, 0)

    const overviewResponse = await fetch(
      `${baseUrl}/v1/analytics/projects/delete-me/overview?from=2026-05-17T00:00:00.000Z&to=2026-05-17T23:59:59.000Z`,
      {
        headers: authHeaders('test-user-1'),
      },
    )
    assert.equal(overviewResponse.status, 404)

    const recollectResponse = await fetch(`${baseUrl}/v1/collect`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        events: [
          {
            eventId: 'delete_project_event_0002',
            eventName: 'page_view',
            occurredAt: '2026-05-17T10:05:00.000Z',
            projectId: 'delete-me',
            page: { path: '/delete-me' },
            consent: { state: 'granted', mode: 'standard' },
          },
        ],
      }),
    })
    assert.equal(recollectResponse.status, 400)
  } finally {
    await stopServer(server)
  }
})

test('collector stores sanitized paths and recent events expose the normalized value', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pulse-server-test-'))
  const { server, baseUrl } = await startServer(createConfig(dir))

  try {
    await bootstrapWorkspace(baseUrl)
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
      { headers: authHeaders() },
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
    await bootstrapWorkspace(baseUrl)
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
    await bootstrapWorkspace(baseUrl)
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
      { headers: authHeaders() },
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
      { headers: authHeaders() },
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
      { headers: authHeaders() },
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

test('project verification and event debug endpoints expose accepted payloads plus rejection reasons', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pulse-server-test-'))
  const { server, baseUrl } = await startServer(createConfig(dir))

  try {
    await bootstrapWorkspace(baseUrl)
    const collectResponse = await fetch(`${baseUrl}/v1/collect`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        events: [
          {
            eventId: 'event_verify_accepted_0001',
            eventName: 'page_view',
            occurredAt: '2026-05-17T09:59:00.000Z',
            projectId: 'aegis',
            page: { path: '/install' },
            consent: { state: 'granted', mode: 'standard' },
            context: { deviceType: 'desktop', browserName: 'Firefox', countryCode: 'SE' },
            identity: { sessionId: 'sess_verify_0001', visitorKey: 'visitor_verify_0001' },
          },
          {
            eventId: 'event_verify_rejected_0001',
            eventName: 'button_click',
            occurredAt: '2026-05-17T10:00:00.000Z',
            projectId: 'aegis',
            page: { path: '/install' },
            consent: { state: 'denied', mode: 'standard' },
            context: { deviceType: 'desktop', browserName: 'Firefox', countryCode: 'SE' },
            identity: { sessionId: 'sess_verify_0002', visitorKey: 'visitor_verify_0002' },
          },
        ],
      }),
    })
    assert.equal(collectResponse.status, 202)

    const verificationResponse = await fetch(`${baseUrl}/v1/projects/aegis/verification`, {
      headers: authHeaders(),
    })
    assert.equal(verificationResponse.status, 200)
    const verification = (await verificationResponse.json()) as {
      summary: {
        scriptInstalled: boolean
        projectIdValid: boolean
        lastPageViewAt: string | null
        latestConsentState: string | null
      }
      recentAcceptedEvents: Array<{ eventId: string }>
      recentRejectedEvents: Array<{ reason: string }>
    }
    assert.equal(verification.summary.scriptInstalled, true)
    assert.equal(verification.summary.projectIdValid, true)
    assert.equal(verification.summary.latestConsentState, 'denied')
    assert.ok(verification.summary.lastPageViewAt)
    assert.equal(verification.recentAcceptedEvents[0]?.eventId, 'event_verify_accepted_0001')
    assert.match(verification.recentRejectedEvents[0]?.reason || '', /consent/i)

    const acceptedEventsResponse = await fetch(
      `${baseUrl}/v1/analytics/events/recent?projectId=aegis&from=2026-05-17T00:00:00.000Z&to=2026-05-17T23:59:59.000Z`,
      { headers: authHeaders() },
    )
    assert.equal(acceptedEventsResponse.status, 200)
    const acceptedEvents = (await acceptedEventsResponse.json()) as {
      rows: Array<{ eventId: string; consentState: string; receivedAt: string }>
    }
    assert.equal(acceptedEvents.rows[0]?.eventId, 'event_verify_accepted_0001')
    assert.equal(acceptedEvents.rows[0]?.consentState, 'granted')
    assert.ok(acceptedEvents.rows[0]?.receivedAt)

    const acceptedDetailResponse = await fetch(`${baseUrl}/v1/analytics/events/event_verify_accepted_0001`, {
      headers: authHeaders(),
    })
    assert.equal(acceptedDetailResponse.status, 200)
    const acceptedDetail = (await acceptedDetailResponse.json()) as {
      payload: { eventId: string; page: { path: string } }
    }
    assert.equal(acceptedDetail.payload.eventId, 'event_verify_accepted_0001')
    assert.equal(acceptedDetail.payload.page.path, '/install')

    const rejectedEventsResponse = await fetch(
      `${baseUrl}/v1/analytics/events/rejected?projectId=aegis&from=2026-05-17T00:00:00.000Z&to=2026-05-17T23:59:59.000Z`,
      { headers: authHeaders() },
    )
    assert.equal(rejectedEventsResponse.status, 200)
    const rejectedEvents = (await rejectedEventsResponse.json()) as {
      rows: Array<{ reason: string; payload: { projectId: string } }>
    }
    assert.match(rejectedEvents.rows[0]?.reason || '', /consent/i)
    assert.equal(rejectedEvents.rows[0]?.payload.projectId, 'aegis')
  } finally {
    await stopServer(server)
  }
})

test('phase 6 endpoints expose live alerts, exports, and workspace settings', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pulse-server-test-'))
  const { server, baseUrl } = await startServer(
    createConfig(dir, {
      maxBatchSize: 128,
    }),
  )

  try {
    await bootstrapWorkspace(baseUrl)
    const events = [
      ...Array.from({ length: 36 }, (_, index) => ({
        eventId: `baseline_${index}`,
        eventName: 'page_view',
        occurredAt: buildUtcIso(-2, 9, index),
        projectId: 'aegis',
        page: { path: `/baseline/${index}` },
        consent: { state: 'granted', mode: 'standard' },
        identity: { sessionId: `sess_baseline_${index}`, visitorKey: `visitor_baseline_${index}` },
      })),
      ...Array.from({ length: 8 }, (_, index) => ({
        eventId: `current_${index}`,
        eventName: 'page_view',
        occurredAt: buildUtcIso(-1, 9, index),
        projectId: 'aegis',
        page: { path: `/current/${index}` },
        consent: { state: 'denied', mode: 'strict' },
        identity: { sessionId: `sess_current_${index}`, visitorKey: `visitor_current_${index}` },
      })),
    ]

    const collectResponse = await fetch(`${baseUrl}/v1/collect`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ events }),
    })
    assert.equal(collectResponse.status, 202)

    const alertsResponse = await fetch(`${baseUrl}/v1/alerts`, {
      headers: authHeaders(),
    })
    assert.equal(alertsResponse.status, 200)
    assert.equal(alertsResponse.headers.get('cache-control'), 'no-store')
    const alerts = (await alertsResponse.json()) as {
      summary: { activeRules: number }
      rules: Array<{ id: string; status: string }>
    }
    assert.ok(alerts.summary.activeRules >= 1)
    assert.equal(alerts.rules.find((rule) => rule.id === 'workspace-traffic-drop')?.status, 'active')

    const exportsResponse = await fetch(`${baseUrl}/v1/exports`, {
      headers: authHeaders(),
    })
    assert.equal(exportsResponse.status, 200)
    const exportsBody = (await exportsResponse.json()) as {
      summary: { scheduledExports: number; manualExportFormat: string }
      schedules: Array<{ id: string }>
      recentRuns: Array<{ format: string }>
    }
    assert.equal(exportsBody.summary.scheduledExports, 2)
    assert.equal(exportsBody.summary.manualExportFormat, 'csv')
    assert.equal(exportsBody.schedules.length, 2)
    assert.ok(exportsBody.recentRuns.some((run) => run.format === 'csv'))

    const workspaceResponse = await fetch(`${baseUrl}/v1/workspace`, {
      headers: authHeaders(),
    })
    assert.equal(workspaceResponse.status, 200)
    const workspace = (await workspaceResponse.json()) as {
      projects: Array<{ projectId: string; retentionMonths: number }>
      operations: { rateLimitWindowMs: number; rateLimitMaxRequests: number }
      roles: Array<{ role: string }>
    }
    assert.equal(workspace.projects.length, 4)
    assert.ok(workspace.projects.some((project) => project.projectId === 'aegis' && project.retentionMonths === 13))
    assert.equal(workspace.operations.rateLimitWindowMs, 60_000)
    assert.equal(workspace.operations.rateLimitMaxRequests, 120)
    assert.ok(workspace.roles.some((role) => role.role === 'owner'))
  } finally {
    await stopServer(server)
  }
})

test('collector enforces per-client rate limiting before processing the request body', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pulse-server-test-'))
  const { server, baseUrl } = await startServer(
    createConfig(dir, {
      rateLimitWindowMs: 60_000,
      rateLimitMaxRequests: 1,
    }),
  )

  try {
    await bootstrapWorkspace(baseUrl)
    const firstResponse = await fetch(`${baseUrl}/v1/collect`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        events: [
          {
            eventId: 'rate_limit_event_0001',
            eventName: 'page_view',
            occurredAt: buildUtcIso(0, 10),
            projectId: 'aegis',
            page: { path: '/rate-limit' },
            consent: { state: 'granted', mode: 'standard' },
            identity: { sessionId: 'sess_rate_limit_0001', visitorKey: 'visitor_rate_limit_0001' },
          },
        ],
      }),
    })
    assert.equal(firstResponse.status, 202)

    const secondResponse = await fetch(`${baseUrl}/v1/collect`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        events: [
          {
            eventId: 'rate_limit_event_0002',
            eventName: 'page_view',
            occurredAt: buildUtcIso(0, 10, 1),
            projectId: 'aegis',
            page: { path: '/rate-limit' },
            consent: { state: 'granted', mode: 'standard' },
            identity: { sessionId: 'sess_rate_limit_0002', visitorKey: 'visitor_rate_limit_0002' },
          },
        ],
      }),
    })
    assert.equal(secondResponse.status, 429)

    const body = (await secondResponse.json()) as { error: string; message: string }
    assert.equal(body.error, 'rate_limited')
    assert.match(body.message, /try again/i)
  } finally {
    await stopServer(server)
  }
})
