export class HttpError extends Error {
  statusCode: number
  code: string
  expose: boolean

  constructor(statusCode: number, code: string, message: string, expose = true) {
    super(message)
    this.name = 'HttpError'
    this.statusCode = statusCode
    this.code = code
    this.expose = expose
  }
}

export const isHttpError = (error: unknown): error is HttpError => error instanceof HttpError

export const badRequest = (message: string) => new HttpError(400, 'invalid_request', message)
export const payloadTooLarge = (message: string) => new HttpError(413, 'payload_too_large', message)
export const notFound = (message: string) => new HttpError(404, 'not_found', message)
