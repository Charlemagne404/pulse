import type { IncomingMessage } from 'node:http'
import { unauthorized } from './errors.js'
import type { AuthenticatedAccount, CollectorConfig } from './types.js'

interface ContinentalUserPayload {
  userId?: unknown
  continentalId?: unknown
  email?: unknown
  username?: unknown
  displayName?: unknown
}

interface ContinentalAuthPayload {
  user?: ContinentalUserPayload
}

export interface AuthResolver {
  authenticate: (request: IncomingMessage) => Promise<AuthenticatedAccount>
}

const readTrimmedString = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

const parseBearerToken = (request: IncomingMessage) => {
  const header = request.headers.authorization
  if (typeof header !== 'string') {
    throw unauthorized('Sign in with Continental ID to open this Pulse workspace.')
  }

  const [scheme, token] = header.split(/\s+/, 2)
  if (scheme?.toLowerCase() !== 'bearer' || !token?.trim()) {
    throw unauthorized('Pulse requires a valid Bearer token for product requests.')
  }

  return token.trim()
}

const normalizeAccount = (payload: ContinentalUserPayload): AuthenticatedAccount => {
  const accountId = readTrimmedString(payload.userId)
  const email = readTrimmedString(payload.email)

  if (!accountId || !email) {
    throw unauthorized('Continental ID returned an incomplete account profile for this request.')
  }

  return {
    accountId,
    continentalId: readTrimmedString(payload.continentalId) || accountId,
    email,
    username: readTrimmedString(payload.username),
    displayName: readTrimmedString(payload.displayName) || readTrimmedString(payload.username) || email,
  }
}

const parseAuthResponse = async (response: Response) => {
  const text = await response.text()
  if (!text) {
    return {}
  }

  try {
    return JSON.parse(text) as ContinentalAuthPayload
  } catch {
    return {}
  }
}

export const createContinentalAuthResolver = (config: CollectorConfig): AuthResolver => ({
  async authenticate(request: IncomingMessage) {
    const accessToken = parseBearerToken(request)
    const response = await fetch(`${config.authApiBaseUrl}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        accept: 'application/json',
      },
    })
    const payload = await parseAuthResponse(response)

    if (!response.ok) {
      throw unauthorized('Pulse could not verify this Continental ID session.')
    }

    const userPayload =
      payload.user && typeof payload.user === 'object'
        ? (payload.user as ContinentalUserPayload)
        : (payload as ContinentalUserPayload)

    return normalizeAccount(userPayload)
  },
})
