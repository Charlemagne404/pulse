import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { createContinentalAuthResolver, type AuthResolver } from './auth.js'
import { badRequest, forbidden, isHttpError, notFound, payloadTooLarge, tooManyRequests } from './errors.js'
import { buildAlertsResponse, buildExportsResponse, buildWorkspaceSettingsResponse } from './operations.js'
import { SqliteEventStore } from './store.js'
import type {
  CollectorConfig,
  CreateExportRequest,
  CreateProjectRequestBody,
  StoredPulseEvent,
  WorkspaceRole,
} from './types.js'
import { validateEvent } from './validation.js'

const buildJsonHeaders = (corsOrigin: string | null) =>
  ({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'authorization,content-type',
    vary: 'Origin',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'same-origin',
    ...(corsOrigin ? { 'access-control-allow-origin': corsOrigin } : {}),
  }) as const

const resolveCorsOrigin = (request: IncomingMessage, config: CollectorConfig, isCollectorRequest = false) => {
  const allowedOrigins = isCollectorRequest ? config.collectorCorsOrigins : config.corsOrigins
  const fallbackOrigin = isCollectorRequest ? '*' : config.corsOrigin
  const requestOrigin = request.headers.origin
  if (!requestOrigin || allowedOrigins.has('*')) {
    return allowedOrigins.has('*') ? '*' : fallbackOrigin
  }

  return allowedOrigins.has(requestOrigin) ? requestOrigin : null
}

const send = (
  response: ServerResponse<IncomingMessage>,
  corsOrigin: string | null,
  statusCode: number,
  payload: unknown,
) => {
  response.writeHead(statusCode, buildJsonHeaders(corsOrigin))
  response.end(JSON.stringify(payload))
}

const sendError = (
  response: ServerResponse<IncomingMessage>,
  corsOrigin: string | null,
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

const sendArtifact = (
  response: ServerResponse<IncomingMessage>,
  corsOrigin: string | null,
  artifact: { body: Buffer; fileName: string; contentType: string },
) => {
  response.writeHead(200, {
    'content-type': artifact.contentType,
    'cache-control': 'no-store',
    'content-disposition': `attachment; filename="${artifact.fileName}"`,
    'x-content-type-options': 'nosniff',
    vary: 'Origin',
    ...(corsOrigin ? { 'access-control-allow-origin': corsOrigin } : {}),
  })
  response.end(artifact.body)
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

const readOptionalString = (value: unknown) => {
  const trimmed = readTrimmedString(value)
  return trimmed || null
}

const readNestedOptionalString = (value: unknown, path: string[]) => {
  let current = value

  for (const segment of path) {
    if (!current || typeof current !== 'object' || !(segment in current)) {
      return null
    }

    current = (current as Record<string, unknown>)[segment]
  }

  return readOptionalString(current)
}

const buildRejectionRecord = (
  candidate: unknown,
  index: number,
  receivedAt: string,
  result: {
    reason: string
    field?: string
  },
  projectOwnership: Map<string, { ownerAccountId: string }>,
) => {
  const projectId = readNestedOptionalString(candidate, ['projectId'])
  const project = projectId ? projectOwnership.get(projectId) : null
  const occurredAt = readNestedOptionalString(candidate, ['occurredAt'])
  const occurredAtMs = occurredAt ? Date.parse(occurredAt) : Number.NaN

  return {
    accountId: project?.ownerAccountId || '',
    receivedAt,
    receivedAtMs: Date.parse(receivedAt),
    eventId: readNestedOptionalString(candidate, ['eventId']),
    eventName: readNestedOptionalString(candidate, ['eventName']),
    projectId,
    occurredAt,
    occurredAtMs: Number.isFinite(occurredAtMs) ? occurredAtMs : null,
    path: readNestedOptionalString(candidate, ['page', 'path']),
    deviceType: readNestedOptionalString(candidate, ['context', 'deviceType']),
    browserName: readNestedOptionalString(candidate, ['context', 'browserName']),
    countryCode: readNestedOptionalString(candidate, ['context', 'countryCode']),
    consentState: readNestedOptionalString(candidate, ['consent', 'state']),
    consentMode: readNestedOptionalString(candidate, ['consent', 'mode']),
    reason: result.reason,
    field: result.field || null,
    requestIndex: index,
    payloadJson: JSON.stringify(candidate),
  }
}

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

const parseCreateExportBody = (body: Record<string, unknown>): CreateExportRequest => {
  const reportSlug = readTrimmedString(body.reportSlug)
  const format = readTrimmedString(body.format)
  const projectId = readOptionalString(body.projectId)
  const from = readOptionalString(body.from)
  const to = readOptionalString(body.to)
  const granularity = readOptionalString(body.granularity)

  if (reportSlug !== 'executive' && reportSlug !== 'pages' && reportSlug !== 'referrers') {
    throw badRequest('reportSlug must be executive, pages, or referrers.')
  }

  if (format !== 'csv' && format !== 'pdf_summary') {
    throw badRequest('format must be csv or pdf_summary.')
  }

  if (granularity && granularity !== 'day' && granularity !== 'week' && granularity !== 'month') {
    throw badRequest('granularity must be day, week, or month.')
  }

  for (const [label, value] of [['from', from], ['to', to]] as const) {
    if (value && Number.isNaN(Date.parse(value))) {
      throw badRequest(`${label} must be a valid ISO timestamp.`)
    }
  }

  const resolvedGranularity = granularity === 'day' || granularity === 'week' || granularity === 'month' ? granularity : undefined

  return {
    reportSlug,
    format,
    ...(projectId ? { projectId } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(resolvedGranularity ? { granularity: resolvedGranularity } : {}),
  }
}

const parseWorkspaceMemberBody = (body: Record<string, unknown>) => {
  const email = readTrimmedString(body.email).toLowerCase()
  const displayName = readTrimmedString(body.displayName) || email
  const role = readTrimmedString(body.role) as WorkspaceRole

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    throw badRequest('email must be a valid workspace member email.')
  }

  if (role !== 'viewer' && role !== 'editor' && role !== 'owner') {
    throw badRequest('role must be viewer, editor, or owner.')
  }

  return { email, displayName, role }
}

const parseMemberRoleBody = (body: Record<string, unknown>) => {
  const role = readTrimmedString(body.role) as WorkspaceRole
  if (role !== 'viewer' && role !== 'editor' && role !== 'owner') {
    throw badRequest('role must be viewer, editor, or owner.')
  }
  return role
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
    const isCollectorRequest = url.pathname === '/v1/collect'
    const corsOrigin = resolveCorsOrigin(request, config, isCollectorRequest)

    if (method === 'OPTIONS') {
      response.writeHead(204, buildJsonHeaders(corsOrigin))
      response.end()
      return
    }

    if (method === 'GET' && url.pathname === '/api/health') {
      try {
        send(response, corsOrigin, 200, await store.readHealthSnapshot())
      } catch (error) {
        sendError(response, corsOrigin, error, 'Health check failed.')
      }
      return
    }

    if (method === 'POST' && url.pathname === '/v1/collect') {
      try {
        enforceRateLimit(requestBuckets, request, config)
        const body = await readJsonBody(request, config.maxBodyBytes)
        const events = Array.isArray(body.events) ? body.events : null
        const receivedAt = new Date().toISOString()

        if (!events) {
          throw badRequest('Body must be a JSON object with an events array.')
        }

        if (events.length === 0) {
          throw badRequest('events array must not be empty.')
        }

        if (events.length > config.maxBatchSize) {
          throw badRequest(`events array exceeds max batch size of ${config.maxBatchSize}.`)
        }

        const candidateProjectIds = Array.from(
          new Set(
            events
              .map((candidate) => readNestedOptionalString(candidate, ['projectId']))
              .filter((projectId): projectId is string => Boolean(projectId)),
          ),
        )
        const projectOwnership = await store.getProjectOwnershipMap(candidateProjectIds)
        const preliminaryResults = events.map((candidate, index) => {
          const result = validateEvent(candidate, config)

          if (result.ok) {
            return {
              index,
              candidate,
              event: result.event,
              status: 'accepted' as const,
              eventId: result.event.eventId,
              warnings: result.warnings,
            }
          }

          return {
            index,
            candidate,
            status: 'rejected' as const,
            reason: result.reason,
            ...(result.field ? { field: result.field } : {}),
          }
        })

        const ownedEvents = preliminaryResults.map((item) => {
          if (item.status === 'rejected') {
            return item
          }

          const matchedEvent = item.event
          const project = matchedEvent ? projectOwnership.get(matchedEvent.projectId) : null

          if (!matchedEvent || !project) {
            return {
              index: item.index,
              candidate: item.candidate,
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
            candidate: item.candidate,
            status: 'rejected' as const,
            reason: failure?.reason || 'event rejected during duplicate check',
            ...(failure?.field ? { field: failure.field } : {}),
          }
        })

        const responseResults = results.map((item) =>
          item.status === 'accepted'
            ? {
                index: item.index,
                status: 'accepted' as const,
                eventId: item.eventId,
                warnings: item.warnings,
              }
            : {
                index: item.index,
                status: 'rejected' as const,
                reason: item.reason,
                ...('field' in item && item.field ? { field: item.field } : {}),
              },
        )

        const rejectionRecords = results
          .filter((item) => item.status === 'rejected')
          .map((item) =>
            buildRejectionRecord(
              item.candidate,
              item.index,
              receivedAt,
              {
                reason: item.reason,
                ...('field' in item && item.field ? { field: item.field } : {}),
              },
              projectOwnership,
            ),
          )

        await store.logRejections(rejectionRecords)
        await store.append(acceptedEvents)

        send(response, corsOrigin, acceptedEvents.length > 0 ? 202 : 400, {
          receivedAt,
          received: responseResults.length,
          accepted: acceptedEvents.length,
          rejected: responseResults.length - acceptedEvents.length,
          results: responseResults,
        })
      } catch (error) {
        sendError(response, corsOrigin, error, 'Unexpected collector error.')
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
        sendError(response, corsOrigin, error, 'Sign in with Continental ID to open Pulse.')
        return
      }
    }

    const requireRole = async (minimumRole: WorkspaceRole) => {
      if (!account || !(await store.hasMinimumRole(account.accountId, minimumRole))) {
        throw forbidden(`This action requires ${minimumRole} workspace access.`)
      }
    }

    if (method === 'GET' && url.pathname === '/v1/alerts') {
      try {
        send(response, corsOrigin, 200, await buildAlertsResponse(store, config, account!))
      } catch (error) {
        sendError(response, corsOrigin, error, 'Unexpected alerts error.')
      }
      return
    }

    if (method === 'GET' && url.pathname === '/v1/exports') {
      try {
        send(response, corsOrigin, 200, await buildExportsResponse(store, config, account!))
      } catch (error) {
        sendError(response, corsOrigin, error, 'Unexpected export pipeline error.')
      }
      return
    }

    if (method === 'POST' && url.pathname === '/v1/exports/manual') {
      try {
        await requireRole('editor')
        const body = await readJsonBody(request, config.maxBodyBytes)
        const run = await store.createManualExport(account!, parseCreateExportBody(body))
        send(response, corsOrigin, 201, run)
      } catch (error) {
        sendError(response, corsOrigin, error, 'Unexpected manual export error.')
      }
      return
    }

    const exportDownloadMatch = url.pathname.match(/^\/v1\/exports\/runs\/([^/]+)\/download$/)
    if (method === 'GET' && exportDownloadMatch) {
      try {
        const runId = decodeURIComponent(exportDownloadMatch[1] || '')
        const artifact = await store.readExportArtifact(account!.accountId, runId)
        if (!artifact) {
          throw notFound(`Unknown export run: ${runId || 'missing'}.`)
        }
        sendArtifact(response, corsOrigin, artifact)
      } catch (error) {
        sendError(response, corsOrigin, error, 'Unexpected export download error.')
      }
      return
    }

    if (method === 'GET' && url.pathname === '/v1/workspace') {
      try {
        send(response, corsOrigin, 200, await buildWorkspaceSettingsResponse(store, config, account!))
      } catch (error) {
        sendError(response, corsOrigin, error, 'Unexpected workspace settings error.')
      }
      return
    }

    if (method === 'POST' && url.pathname === '/v1/workspace/members') {
      try {
        await requireRole('owner')
        const body = await readJsonBody(request, config.maxBodyBytes)
        const member = await store.inviteWorkspaceMember(account!.accountId, parseWorkspaceMemberBody(body))
        send(response, corsOrigin, 201, member)
      } catch (error) {
        sendError(response, corsOrigin, error, 'Unexpected workspace invitation error.')
      }
      return
    }

    const memberMatch = url.pathname.match(/^\/v1\/workspace\/members\/(\d+)$/)
    if (memberMatch && (method === 'PATCH' || method === 'DELETE')) {
      try {
        await requireRole('owner')
        const memberId = Number(memberMatch[1])
        if (method === 'PATCH') {
          const body = await readJsonBody(request, config.maxBodyBytes)
          const member = await store.updateWorkspaceMemberRole(account!.accountId, memberId, parseMemberRoleBody(body))
          if (!member) {
            throw notFound(`Unknown workspace member: ${memberId}.`)
          }
          send(response, corsOrigin, 200, member)
        } else {
          const member = await store.removeWorkspaceMember(account!.accountId, memberId)
          if (!member) {
            throw notFound(`Unknown workspace member: ${memberId}.`)
          }
          send(response, corsOrigin, 200, member)
        }
      } catch (error) {
        sendError(response, corsOrigin, error, 'Unexpected workspace member change.')
      }
      return
    }

    if (method === 'POST' && url.pathname === '/v1/projects') {
      try {
        await requireRole('editor')
        const body = await readJsonBody(request, config.maxBodyBytes)
        const project = await store.createProject(account!, parseCreateProjectBody(body))
        send(response, corsOrigin, 201, project)
      } catch (error) {
        sendError(response, corsOrigin, error, 'Unexpected project creation error.')
      }
      return
    }

    const projectVerificationMatch = url.pathname.match(/^\/v1\/projects\/([^/]+)\/verification$/)
    if (method === 'GET' && projectVerificationMatch) {
      try {
        const projectId = decodeURIComponent(projectVerificationMatch[1] || '')
        const verification = await store.getProjectVerification(account!.accountId, projectId)
        if (!verification) {
          throw notFound(`Unknown project: ${projectId || 'missing'}.`)
        }

        send(response, corsOrigin, 200, verification)
      } catch (error) {
        sendError(response, corsOrigin, error, 'Unexpected project verification error.')
      }
      return
    }

    const projectDeleteMatch = url.pathname.match(/^\/v1\/projects\/([^/]+)$/)
    if (method === 'DELETE' && projectDeleteMatch) {
      try {
        await requireRole('editor')
        const projectId = decodeURIComponent(projectDeleteMatch[1] || '')
        const project = await store.deleteProjectForAccount(account!.accountId, projectId)
        if (!project) {
          throw notFound(`Unknown project: ${projectId || 'missing'}.`)
        }
        send(response, corsOrigin, 200, project)
      } catch (error) {
        sendError(response, corsOrigin, error, 'Unexpected project deletion error.')
      }
      return
    }

    if (method === 'GET' && url.pathname === '/v1/analytics/overview') {
      try {
        send(
          response,
          corsOrigin,
          200,
          await store.getOverviewAnalytics(
            account!.accountId,
            url.searchParams.get('from'),
            url.searchParams.get('to'),
            url.searchParams.get('granularity'),
          ),
        )
      } catch (error) {
        sendError(response, corsOrigin, error, 'Unexpected analytics error.')
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
          corsOrigin,
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
        sendError(response, corsOrigin, error, 'Unexpected analytics error.')
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
          corsOrigin,
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
        sendError(response, corsOrigin, error, 'Unexpected analytics error.')
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
          corsOrigin,
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
        sendError(response, corsOrigin, error, 'Unexpected analytics error.')
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
          corsOrigin,
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
        sendError(response, corsOrigin, error, 'Unexpected analytics error.')
      }
      return
    }

    if (method === 'GET' && url.pathname === '/v1/analytics/events/rejected') {
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
          corsOrigin,
          200,
          await store.getRejectedEventsPage(account!.accountId, {
            fromRaw: url.searchParams.get('from'),
            toRaw: url.searchParams.get('to'),
            granularityRaw: url.searchParams.get('granularity'),
            limitRaw: url.searchParams.get('limit'),
            cursorRaw: url.searchParams.get('cursor'),
            ...(projectId ? { projectId } : {}),
            ...(url.searchParams.get('eventName') ? { eventName: url.searchParams.get('eventName') || undefined } : {}),
            ...(url.searchParams.get('pathPrefix') ? { pathPrefix: url.searchParams.get('pathPrefix') || undefined } : {}),
          }),
        )
      } catch (error) {
        sendError(response, corsOrigin, error, 'Unexpected rejected event debug error.')
      }
      return
    }

    const eventDetailMatch = url.pathname.match(/^\/v1\/analytics\/events\/([^/]+)$/)
    if (method === 'GET' && eventDetailMatch) {
      try {
        const eventId = decodeURIComponent(eventDetailMatch[1] || '')
        const detail = await store.getEventDebugDetail(account!.accountId, eventId)
        if (!detail) {
          throw notFound(`Unknown event: ${eventId || 'missing'}.`)
        }

        send(response, corsOrigin, 200, detail)
      } catch (error) {
        sendError(response, corsOrigin, error, 'Unexpected event detail error.')
      }
      return
    }

    send(response, corsOrigin, 404, {
      error: 'not_found',
      message: `No route for ${method} ${url.pathname}.`,
    })
  })

  server.on('close', () => {
    void store.close()
  })

  return server
}
