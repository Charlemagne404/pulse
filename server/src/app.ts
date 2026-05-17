import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { buildOverviewResponse, buildPagesReportResponse, buildProjectOverviewResponse, buildReferrersReportResponse, filterEventsByRange, resolveRange } from './analytics.js'
import { badRequest, isHttpError, notFound, payloadTooLarge } from './errors.js'
import { FileEventStore } from './store.js'
import type { CollectRequestBody, CollectorConfig, StoredPulseEvent } from './types.js'
import { validateEvent } from './validation.js'

const buildJsonHeaders = (corsOrigin: string) =>
  ({
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': corsOrigin,
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
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

  const message = fallbackMessage
  send(response, corsOrigin, 500, {
    error: 'internal_error',
    message,
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

  const raw = Buffer.concat(chunks).toString('utf8')

  try {
    return JSON.parse(raw) as CollectRequestBody
  } catch {
    throw badRequest('Body must contain valid JSON.')
  }
}

const ensureKnownProjectId = (config: CollectorConfig, projectId: string) => {
  if (!projectId || !config.allowedProjectIds.has(projectId)) {
    throw notFound(`Unknown project: ${projectId || 'missing'}.`)
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

export const createPulseServer = (config: CollectorConfig, store = new FileEventStore(config.sinkPath)): Server =>
  createServer(async (request, response) => {
    const method = request.method || 'GET'
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`)

    if (method === 'OPTIONS') {
      response.writeHead(204, buildJsonHeaders(config.corsOrigin))
      response.end()
      return
    }

    if (method === 'GET' && url.pathname === '/api/health') {
      try {
        const snapshot = await store.readSnapshot()
        send(response, config.corsOrigin, 200, {
          service: 'pulse-collector',
          status: snapshot.invalidLines > 0 ? 'degraded' : 'ok',
          timestamp: new Date().toISOString(),
          storage: 'ndjson-file',
          allowedProjects: Array.from(config.allowedProjectIds),
          allowedEvents: Array.from(config.allowedEventNames),
          storedEvents: snapshot.events.length,
          invalidLines: snapshot.invalidLines,
          duplicateEventIds: snapshot.duplicateEventIds,
        })
      } catch (error) {
        sendError(response, config.corsOrigin, error, 'Health check failed.')
      }
      return
    }

    if (method === 'POST' && url.pathname === '/v1/collect') {
      try {
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

        const snapshot = await store.readSnapshot()
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

        const duplicateChecks = applyDuplicateGuards(candidateAcceptedEvents, snapshot.eventIds)
        const acceptedById = new Set(
          duplicateChecks.filter((item) => item.accepted).map((item) => item.event.eventId),
        )

        const acceptedEvents = duplicateChecks.filter((item) => item.accepted).map((item) => item.event)
        const duplicateFailures = new Map(
          duplicateChecks
            .filter((item) => !item.accepted)
            .map((item) => [item.event.eventId, item] as const),
        )

        const results = preliminaryResults.map((item) => {
          if (item.status === 'rejected') {
            return item
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

        const rejectedCount = results.length - acceptedEvents.length
        const statusCode = acceptedEvents.length > 0 ? 202 : 400

        send(response, config.corsOrigin, statusCode, {
          receivedAt: new Date().toISOString(),
          received: results.length,
          accepted: acceptedEvents.length,
          rejected: rejectedCount,
          results,
        })
      } catch (error) {
        sendError(response, config.corsOrigin, error, 'Unexpected collector error.')
      }
      return
    }

    if (method === 'GET' && url.pathname === '/v1/analytics/overview') {
      try {
        const snapshot = await store.readSnapshot()
        const { range, fromMs, toMs } = resolveRange(
          snapshot.events,
          url.searchParams.get('from'),
          url.searchParams.get('to'),
          url.searchParams.get('granularity'),
        )
        const filteredEvents = filterEventsByRange(snapshot.events, fromMs, toMs)
        send(response, config.corsOrigin, 200, buildOverviewResponse(filteredEvents, range))
      } catch (error) {
        sendError(response, config.corsOrigin, error, 'Unexpected analytics error.')
      }
      return
    }

    const projectOverviewMatch = url.pathname.match(/^\/v1\/analytics\/projects\/([^/]+)\/overview$/)
    if (method === 'GET' && projectOverviewMatch) {
      try {
        const projectId = decodeURIComponent(projectOverviewMatch[1] || '')
        ensureKnownProjectId(config, projectId)
        const snapshot = await store.readSnapshot()
        const { range, fromMs, toMs } = resolveRange(
          snapshot.events,
          url.searchParams.get('from'),
          url.searchParams.get('to'),
          url.searchParams.get('granularity'),
        )
        const filteredEvents = filterEventsByRange(snapshot.events, fromMs, toMs, projectId)
        send(response, config.corsOrigin, 200, buildProjectOverviewResponse(filteredEvents, range, projectId))
      } catch (error) {
        sendError(response, config.corsOrigin, error, 'Unexpected analytics error.')
      }
      return
    }

    if (method === 'GET' && url.pathname === '/v1/analytics/reports/pages') {
      try {
        const projectId = url.searchParams.get('projectId') || undefined
        if (projectId) {
          ensureKnownProjectId(config, projectId)
        }

        const snapshot = await store.readSnapshot()
        const { range, fromMs, toMs } = resolveRange(
          snapshot.events,
          url.searchParams.get('from'),
          url.searchParams.get('to'),
          url.searchParams.get('granularity'),
        )
        const filteredEvents = filterEventsByRange(snapshot.events, fromMs, toMs, projectId)
        send(response, config.corsOrigin, 200, buildPagesReportResponse(filteredEvents, range))
      } catch (error) {
        sendError(response, config.corsOrigin, error, 'Unexpected analytics error.')
      }
      return
    }

    if (method === 'GET' && url.pathname === '/v1/analytics/reports/referrers') {
      try {
        const projectId = url.searchParams.get('projectId') || undefined
        if (projectId) {
          ensureKnownProjectId(config, projectId)
        }

        const snapshot = await store.readSnapshot()
        const { range, fromMs, toMs } = resolveRange(
          snapshot.events,
          url.searchParams.get('from'),
          url.searchParams.get('to'),
          url.searchParams.get('granularity'),
        )
        const filteredEvents = filterEventsByRange(snapshot.events, fromMs, toMs, projectId)
        send(response, config.corsOrigin, 200, buildReferrersReportResponse(filteredEvents, range))
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
