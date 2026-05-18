import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { createContinentalAuthResolver, type AuthResolver } from './auth.js'
import { badRequest, isHttpError, notFound, payloadTooLarge, tooManyRequests } from './errors.js'
import { buildAlertsResponse, buildExportsResponse, buildWorkspaceSettingsResponse } from './operations.js'
import { SqliteEventStore } from './store.js'
import type { CollectorConfig, CreateProjectRequestBody, StoredPulseEvent } from './types.js'
import { validateEvent } from './validation.js'

const buildJsonHeaders = (corsOrigin: string) =>
  ({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': corsOrigin,
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'authorization,content-type',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'same-origin',
  }) as const

const send = (
  response: ServerResponse<IncomingMessage>,
  corsOrigin: string,
  statusCode: number,
  payload: unknown,
) => {
  response.writeHead(statusCode, buildJsonHeaders(corsOrigin))
  response.end(JSON.stringify(payload))
}

const sendError = (
  response: ServerResponse<IncomingMessage>,
  corsOrigin: string,
  error: unknown,
  fallbackMessage: string,
) => {
  if (isHttpError(error)) {
    send(response, corsOrigin, error.statusCode, {
      error: error.code,
      message: error.message,
    })
    return
  }

  send(response, corsOrigin, 500, {
    error: 'internal_error',
    message: fallbackMessage,
  })
}

const readJsonBody = async (request: IncomingMessage, maxBodyBytes: number) => {
  const chunks: Buffer[] = []
  let size = 0

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length

    if (size > maxBodyBytes) {
      throw payloadTooLarge(`request body exceeded ${maxBodyBytes} bytes`)
    }

    chunks.push(buffer)
  }

  if (!chunks.length) {
    return {}
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>
  } catch {
    throw badRequest('Body must contain valid JSON.')
  }
}

const getClientAddress = (request: IncomingMessage) => {
  const forwardedFor = request.headers['x-forwarded-for']
  if (typeof forwardedFor === 'string') {
    return forwardedFor.split(',')[0]?.trim() || 'unknown'
  }

  return request.socket.remoteAddress || 'unknown'
}

const enforceRateLimit = (
  bucketStore: Map<string, { startedAtMs: number; count: number }>,
  request: IncomingMessage,
  config: CollectorConfig,
) => {
  if (config.rateLimitMaxRequests <= 0 || config.rateLimitWindowMs <= 0) {
    return
  }

  const nowMs = Date.now()
  const clientKey = getClientAddress(request)
  const current = bucketStore.get(clientKey)

  if (!current || nowMs - current.startedAtMs >= config.rateLimitWindowMs) {
    bucketStore.set(clientKey, { startedAtMs: nowMs, count: 1 })
    return
  }

  if (current.count >= config.rateLimitMaxRequests) {
    throw tooManyRequests(
      `Rate limit exceeded for ${clientKey}. Try again after ${Math.ceil(config.rateLimitWindowMs / 1000)} seconds.`,
    )
  }

  current.count += 1
}

const PROJECT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,47}$/

const readTrimmedString = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

const normalizeProjectHost = (value: string, fallbackProjectId: string) => {
  if (!value) {
    return fallbackProjectId
  }

  try {
    const url = new URL(value.includes('://') ? value : `https://${value}`)
    return url.host || fallbackProjectId
  } catch {
    return value.replace(/^\/+|\/+$/g, '') || fallbackProjectId
  }
}

const parseCreateProjectBody = (body: Record<string, unknown>) => {
  const payload = body as CreateProjectRequestBody
  const projectName = readTrimmedString(payload.name)
  const projectId = readTrimmedString(payload.projectId)
  const domain = readTrimmedString(payload.domain)
  const integrationPreset = readTrimmedString(payload.integrationPreset)

  if (!projectName) {
    throw badRequest('Project name is required.')
  }

  if (!PROJECT_ID_PATTERN.test(projectId)) {
    throw badRequest('projectId must be lowercase letters, numbers, and hyphens only.')
  }

  if (integrationPreset !== 'website' && integrationPreset !== 'spa') {
    throw badRequest('integrationPreset must be either "website" or "spa".')
  }

  return {
    projectId,
    projectName,
    siteHost: normalizeProjectHost(domain, projectId),
    integrationPreset: integrationPreset as 'website' | 'spa',
  }
}

const applyDuplicateGuards = (acceptedEvents: StoredPulseEvent[], existingEventIds: Set<string>) => {
  const seenInRequest = new Set<string>()

  return acceptedEvents.map((event) => {
    if (existingEventIds.has(event.eventId)) {
      return {
        event,
        accepted: false,
        reason: 'eventId already exists',
        field: 'eventId',
      }
    }

    if (seenInRequest.has(event.eventId)) {
      return {
        event,
        accepted: false,
        reason: 'eventId duplicated within request',
        field: 'eventId',
      }
    }

    seenInRequest.add(event.eventId)
    return {
      event,
      accepted: true,
    }
  })
}

export const createPulseServer = (
  config: CollectorConfig,
  store = new SqliteEventStore(config),
  authResolver: AuthResolver = createContinentalAuthResolver(config),
): Server => {
  const requestBuckets = new Map<string, { startedAtMs: number; count: number }>()
  const server = createServer(async (request, response) => {
    const method = request.method || 'GET'
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`)

    if (method === 'OPTIONS') {
      response.writeHead(204, buildJsonHeaders(config.corsOrigin))
      response.end()
      return
    }

    if (method === 'GET' && url.pathname === '/api/health') {
      try {
        send(response, config.corsOrigin, 200, await store.readHealthSnapshot())
      } catch (error) {
        sendError(response, config.corsOrigin, error, 'Health check failed.')
      }
      return
    }

    if (method === 'POST' && url.pathname === '/v1/collect') {
      try {
        enforceRateLimit(requestBuckets, request, config)
        const body = await readJsonBody(request, config.maxBodyBytes)
        const events = Array.isArray(body.events) ? body.events : null

        if (!events) {
          throw badRequest('Body must be a JSON object with an events array.')
        }

        if (events.length === 0) {
          throw badRequest('events array must not be empty.')
        }

        if (events.length > config.maxBatchSize) {
          throw badRequest(`events array exceeds max batch size of ${config.maxBatchSize}.`)
        }

        const candidateAcceptedEvents: StoredPulseEvent[] = []
        const preliminaryResults = events.map((candidate, index) => {
          const result = validateEvent(candidate, config)

          if (result.ok) {
            candidateAcceptedEvents.push(result.event)
            return {
              index,
              status: 'accepted' as const,
              eventId: result.event.eventId,
              warnings: result.warnings,
            }
          }

          return {
            index,
            status: 'rejected' as const,
            reason: result.reason,
            ...(result.field ? { field: result.field } : {}),
          }
        })

        const projectOwnership = await store.getProjectOwnershipMap(
          Array.from(new Set(candidateAcceptedEvents.map((event) => event.projectId))),
        )
        const ownedEvents = preliminaryResults.map((item) => {
          if (item.status === 'rejected') {
            return item
          }

          const matchedEvent = candidateAcceptedEvents.find((event) => event.eventId === item.eventId)
          const project = matchedEvent ? projectOwnership.get(matchedEvent.projectId) : null

          if (!matchedEvent || !project) {
            return {
              index: item.index,
              status: 'rejected' as const,
              reason: `Unknown project: ${matchedEvent?.projectId || 'missing'}.`,
              field: 'projectId',
            }
          }

          return {
            ...item,
            event: {
              ...matchedEvent,
              accountId: project.ownerAccountId,
            },
          }
        })
        const resolvedAcceptedEvents = ownedEvents
          .filter((item): item is (typeof item & { status: 'accepted'; event: StoredPulseEvent }) => item.status === 'accepted' && 'event' in item)
          .map((item) => item.event)

        const duplicateChecks = applyDuplicateGuards(
          resolvedAcceptedEvents,
          await store.getExistingEventIds(resolvedAcceptedEvents.map((event) => event.eventId)),
        )
        const acceptedById = new Set(duplicateChecks.filter((item) => item.accepted).map((item) => item.event.eventId))
        const acceptedEvents = duplicateChecks.filter((item) => item.accepted).map((item) => item.event)
        const duplicateFailures = new Map(
          duplicateChecks
            .filter((item) => !item.accepted)
            .map((item) => [item.event.eventId, item] as const),
        )

        const ownershipFailures = new Map(
          ownedEvents
            .filter((item) => item.status === 'rejected' && 'field' in item && item.field === 'projectId')
            .map((item) => [item.index, item] as const),
        )

        const results = preliminaryResults.map((item) => {
          if (item.status === 'rejected') {
            return item
          }

          const ownershipFailure = ownershipFailures.get(item.index)
          if (ownershipFailure) {
            return ownershipFailure
          }

          if (acceptedById.has(item.eventId)) {
            return item
          }

          const failure = duplicateFailures.get(item.eventId)
          return {
            index: item.index,
            status: 'rejected' as const,
            reason: failure?.reason || 'event rejected during duplicate check',
            ...(failure?.field ? { field: failure.field } : {}),
          }
        })

        await store.append(acceptedEvents)

        send(response, config.corsOrigin, acceptedEvents.length > 0 ? 202 : 400, {
          receivedAt: new Date().toISOString(),
          received: results.length,
          accepted: acceptedEvents.length,
          rejected: results.length - acceptedEvents.length,
          results,
        })
      } catch (error) {
        sendError(response, config.corsOrigin, error, 'Unexpected collector error.')
      }
      return
    }

    const requiresAccount = url.pathname.startsWith('/v1/')
    let account = null

    if (requiresAccount) {
      try {
        account = await authResolver.authenticate(request)
        await store.bootstrapAccountProjects(account)
      } catch (error) {
        sendError(response, config.corsOrigin, error, 'Sign in with Continental ID to open Pulse.')
        return
      }
    }

    if (method === 'GET' && url.pathname === '/v1/alerts') {
      try {
        send(response, config.corsOrigin, 200, await buildAlertsResponse(store, config, account!))
      } catch (error) {
        sendError(response, config.corsOrigin, error, 'Unexpected alerts error.')
      }
      return
    }

    if (method === 'GET' && url.pathname === '/v1/exports') {
      try {
        send(response, config.corsOrigin, 200, await buildExportsResponse(store, config, account!))
      } catch (error) {
        sendError(response, config.corsOrigin, error, 'Unexpected export pipeline error.')
      }
      return
    }

    if (method === 'GET' && url.pathname === '/v1/workspace') {
      try {
        send(response, config.corsOrigin, 200, await buildWorkspaceSettingsResponse(store, config, account!))
      } catch (error) {
        sendError(response, config.corsOrigin, error, 'Unexpected workspace settings error.')
      }
      return
    }

    if (method === 'POST' && url.pathname === '/v1/projects') {
      try {
        const body = await readJsonBody(request, config.maxBodyBytes)
        const project = await store.createProject(account!, parseCreateProjectBody(body))
        send(response, config.corsOrigin, 201, project)
      } catch (error) {
        sendError(response, config.corsOrigin, error, 'Unexpected project creation error.')
      }
      return
    }

    if (method === 'GET' && url.pathname === '/v1/analytics/overview') {
      try {
        send(
          response,
          config.corsOrigin,
          200,
          await store.getOverviewAnalytics(
            account!.accountId,
            url.searchParams.get('from'),
            url.searchParams.get('to'),
            url.searchParams.get('granularity'),
          ),
        )
      } catch (error) {
        sendError(response, config.corsOrigin, error, 'Unexpected analytics error.')
      }
      return
    }

    const projectOverviewMatch = url.pathname.match(/^\/v1\/analytics\/projects\/([^/]+)\/overview$/)
    if (method === 'GET' && projectOverviewMatch) {
      try {
        const projectId = decodeURIComponent(projectOverviewMatch[1] || '')
        const project = await store.getProjectRecordForAccount(account!.accountId, projectId)
        if (!project) {
          throw notFound(`Unknown project: ${projectId || 'missing'}.`)
        }
        send(
          response,
          config.corsOrigin,
          200,
          await store.getProjectOverviewAnalytics(
            account!.accountId,
            projectId,
            url.searchParams.get('from'),
            url.searchParams.get('to'),
            url.searchParams.get('granularity'),
          ),
        )
      } catch (error) {
        sendError(response, config.corsOrigin, error, 'Unexpected analytics error.')
      }
      return
    }

    if (method === 'GET' && url.pathname === '/v1/analytics/reports/pages') {
      try {
        const projectId = url.searchParams.get('projectId') || undefined
        if (projectId) {
          const project = await store.getProjectRecordForAccount(account!.accountId, projectId)
          if (!project) {
            throw notFound(`Unknown project: ${projectId}.`)
          }
        }

        send(
          response,
          config.corsOrigin,
          200,
          await store.getPagesReport(
            account!.accountId,
            url.searchParams.get('from'),
            url.searchParams.get('to'),
            url.searchParams.get('granularity'),
            projectId,
          ),
        )
      } catch (error) {
        sendError(response, config.corsOrigin, error, 'Unexpected analytics error.')
      }
      return
    }

    if (method === 'GET' && url.pathname === '/v1/analytics/reports/referrers') {
      try {
        const projectId = url.searchParams.get('projectId') || undefined
        if (projectId) {
          const project = await store.getProjectRecordForAccount(account!.accountId, projectId)
          if (!project) {
            throw notFound(`Unknown project: ${projectId}.`)
          }
        }

        send(
          response,
          config.corsOrigin,
          200,
          await store.getReferrersReport(
            account!.accountId,
            url.searchParams.get('from'),
            url.searchParams.get('to'),
            url.searchParams.get('granularity'),
            projectId,
          ),
        )
      } catch (error) {
        sendError(response, config.corsOrigin, error, 'Unexpected analytics error.')
      }
      return
    }

    if (method === 'GET' && url.pathname === '/v1/analytics/events/recent') {
      try {
        const projectId = url.searchParams.get('projectId') || undefined
        if (projectId) {
          const project = await store.getProjectRecordForAccount(account!.accountId, projectId)
          if (!project) {
            throw notFound(`Unknown project: ${projectId}.`)
          }
        }

        const eventName = url.searchParams.get('eventName') || undefined
        if (eventName && config.allowedEventNames.size > 0 && !config.allowedEventNames.has(eventName)) {
          throw badRequest(`Unknown eventName filter: ${eventName}.`)
        }

        const recentEventsQuery = {
          fromRaw: url.searchParams.get('from'),
          toRaw: url.searchParams.get('to'),
          granularityRaw: url.searchParams.get('granularity'),
          limitRaw: url.searchParams.get('limit'),
          cursorRaw: url.searchParams.get('cursor'),
        }

        send(
          response,
          config.corsOrigin,
          200,
          await store.getRecentEventsPage(account!.accountId, {
            ...recentEventsQuery,
            ...(projectId ? { projectId } : {}),
            ...(eventName ? { eventName } : {}),
            ...(url.searchParams.get('deviceType') ? { deviceType: url.searchParams.get('deviceType') || undefined } : {}),
            ...(url.searchParams.get('countryCode') ? { countryCode: url.searchParams.get('countryCode') || undefined } : {}),
            ...(url.searchParams.get('pathPrefix') ? { pathPrefix: url.searchParams.get('pathPrefix') || undefined } : {}),
          }),
        )
      } catch (error) {
        sendError(response, config.corsOrigin, error, 'Unexpected analytics error.')
      }
      return
    }

    send(response, config.corsOrigin, 404, {
      error: 'not_found',
      message: `No route for ${method} ${url.pathname}.`,
    })
  })

  server.on('close', () => {
    void store.close()
  })

  return server
}
