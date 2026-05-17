import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { loadConfig } from './config.js'
import { FileEventStore } from './store.js'
import type { CollectRequestBody, StoredPulseEvent } from './types.js'
import { validateEvent } from './validation.js'

const config = loadConfig()
const store = new FileEventStore(config.sinkPath)

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': config.corsOrigin,
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type',
} as const

const send = (response: ServerResponse<IncomingMessage>, statusCode: number, payload: unknown) => {
  response.writeHead(statusCode, jsonHeaders)
  response.end(JSON.stringify(payload))
}

const readJsonBody = async (request: IncomingMessage) => {
  const chunks: Buffer[] = []
  let size = 0

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length

    if (size > config.maxBodyBytes) {
      throw new Error(`request body exceeded ${config.maxBodyBytes} bytes`)
    }

    chunks.push(buffer)
  }

  if (!chunks.length) {
    return {}
  }

  const raw = Buffer.concat(chunks).toString('utf8')
  return JSON.parse(raw) as CollectRequestBody
}

createServer(async (request, response) => {
  const method = request.method || 'GET'
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`)

  if (method === 'OPTIONS') {
    response.writeHead(204, jsonHeaders)
    response.end()
    return
  }

  if (method === 'GET' && url.pathname === '/api/health') {
    send(response, 200, {
      service: 'pulse-collector',
      status: 'ok',
      timestamp: new Date().toISOString(),
      storage: 'ndjson-file',
      sinkPath: config.sinkPath,
      allowedProjects: Array.from(config.allowedProjectIds),
      allowedEvents: Array.from(config.allowedEventNames),
    })
    return
  }

  if (method === 'POST' && url.pathname === '/v1/collect') {
    try {
      const body = await readJsonBody(request)
      const events = Array.isArray(body.events) ? body.events : null

      if (!events) {
        send(response, 400, {
          error: 'invalid_request',
          message: 'Body must be a JSON object with an events array.',
        })
        return
      }

      if (events.length === 0) {
        send(response, 400, {
          error: 'invalid_request',
          message: 'events array must not be empty.',
        })
        return
      }

      if (events.length > config.maxBatchSize) {
        send(response, 400, {
          error: 'invalid_request',
          message: `events array exceeds max batch size of ${config.maxBatchSize}.`,
        })
        return
      }

      const acceptedEvents: StoredPulseEvent[] = []
      const results = events.map((candidate, index) => {
        const result = validateEvent(candidate, config)

        if (result.ok) {
          acceptedEvents.push(result.event)
          return {
            index,
            status: 'accepted',
            eventId: result.event.eventId,
            warnings: result.warnings,
          }
        }

        return {
          index,
          status: 'rejected',
          reason: result.reason,
          ...(result.field ? { field: result.field } : {}),
        }
      })

      await store.append(acceptedEvents)

      const rejectedCount = results.length - acceptedEvents.length
      const statusCode = acceptedEvents.length > 0 ? 202 : 400

      send(response, statusCode, {
        receivedAt: new Date().toISOString(),
        received: results.length,
        accepted: acceptedEvents.length,
        rejected: rejectedCount,
        results,
      })
      return
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected collector error.'
      send(response, 400, {
        error: 'invalid_request',
        message,
      })
      return
    }
  }

  send(response, 404, {
    error: 'not_found',
    message: `No route for ${method} ${url.pathname}.`,
  })
}).listen(config.port, config.host, () => {
  console.log(`Pulse collector listening on http://${config.host}:${config.port}`)
})
