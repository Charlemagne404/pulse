export interface ContinentalIdUser {
  userId: string
  continentalId: string
  email: string
  username: string
  displayName: string
  authority?: {
    isOwner?: boolean
    status?: string
  }
}

interface RuntimeWindow extends Window {
  __API_BASE_URL__?: string
  __LOGIN_POPUP_URL__?: string
}

interface RefreshSessionResult {
  authenticated: boolean
  accessToken: string
  message: string
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1'])
const TRUSTED_API_ORIGINS = new Set([
  'https://auth.continental-hub.com',
  'https://login.continental-hub.com',
  'https://continental-hub.com',
  'https://api.continental-hub.com',
  'https://id.continental-hub.com',
  'https://backend.continental-hub.com',
  'https://mpmc.ddns.net',
])
const DEFAULT_LOGIN_POPUP_URL = 'https://login.continental-hub.com/popup.html'
const HOSTED_API_BASE_URL = 'https://auth.continental-hub.com'
const API_BASE_STORAGE_KEY = 'pulse.continentalId.apiBaseUrl'
const REQUEST_TIMEOUT_MS = 8000

let resolvedApiBaseUrl = ''
let apiBaseValidated = false
let apiBaseResolutionPromise: Promise<string> | null = null

const getRuntimeWindow = () => window as RuntimeWindow

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '')

const safeText = (value: unknown) => String(value ?? '').trim()

const isLocalOrigin = (origin: string) => {
  try {
    return LOCAL_HOSTS.has(new URL(origin).hostname)
  } catch {
    return false
  }
}

const resolveTrustedApiBaseUrl = (value: string) => {
  if (!value) {
    return ''
  }

  try {
    const resolved = new URL(value, window.location.origin)
    if (isLocalOrigin(resolved.origin)) {
      return trimTrailingSlash(resolved.origin)
    }

    return TRUSTED_API_ORIGINS.has(resolved.origin) ? trimTrailingSlash(resolved.origin) : ''
  } catch {
    return ''
  }
}

const readStoredApiBaseUrl = () => {
  try {
    return resolveTrustedApiBaseUrl(window.localStorage.getItem(API_BASE_STORAGE_KEY) || '')
  } catch {
    return ''
  }
}

const rememberApiBaseUrl = (value: string) => {
  try {
    if (value) {
      window.localStorage.setItem(API_BASE_STORAGE_KEY, trimTrailingSlash(value))
    }
  } catch {
    // Ignore storage failures in restricted browser contexts.
  }
}

export const rememberContinentalApiBaseUrl = (value: string) => {
  const resolved = resolveTrustedApiBaseUrl(value)
  if (!resolved) {
    return ''
  }

  resolvedApiBaseUrl = resolved
  apiBaseValidated = true
  apiBaseResolutionPromise = null
  rememberApiBaseUrl(resolved)
  return resolved
}

const getApiBaseCandidates = () => {
  const params = new URLSearchParams(window.location.search)
  const runtimeWindow = getRuntimeWindow()
  const rawCandidates = [
    params.get('apiBaseUrl') || '',
    runtimeWindow.__API_BASE_URL__ || '',
    readStoredApiBaseUrl(),
  ]

  if (LOCAL_HOSTS.has(window.location.hostname)) {
    rawCandidates.push(window.location.origin, 'http://localhost:5000', 'http://127.0.0.1:5000')
  } else {
    rawCandidates.push(HOSTED_API_BASE_URL, 'https://login.continental-hub.com', 'https://id.continental-hub.com')
  }

  const uniqueCandidates: string[] = []

  for (const candidate of rawCandidates) {
    const resolved = resolveTrustedApiBaseUrl(candidate)
    if (resolved && !uniqueCandidates.includes(resolved)) {
      uniqueCandidates.push(resolved)
    }
  }

  return uniqueCandidates
}

const parseResponseBody = async (response: Response) => {
  const text = await response.text()
  if (!text) {
    return {}
  }

  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return { message: text }
  }
}

const fetchWithTimeout = async (input: RequestInfo | URL, init?: RequestInit) => {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    })
  } finally {
    window.clearTimeout(timeoutId)
  }
}

const looksLikeAuthHealthPayload = (payload: Record<string, unknown>) => {
  const status = safeText(payload.status).toLowerCase()
  const timestamp = safeText(payload.timestamp)
  const service = safeText(payload.service).toLowerCase()

  if (!timestamp || !['ok', 'degraded'].includes(status)) {
    return false
  }

  return !service || service.includes('auth') || service.includes('continental') || service.includes('id')
}

const probeApiBaseUrl = async (candidate: string) => {
  try {
    const response = await fetchWithTimeout(`${candidate}/api/health`, {
      cache: 'no-store',
    })
    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null

    return response.ok && Boolean(payload && looksLikeAuthHealthPayload(payload))
  } catch {
    return false
  }
}

export const ensureContinentalApiBaseUrl = async () => {
  if (apiBaseValidated && resolvedApiBaseUrl) {
    return resolvedApiBaseUrl
  }

  if (apiBaseResolutionPromise) {
    return apiBaseResolutionPromise
  }

  apiBaseResolutionPromise = (async () => {
    const candidates = getApiBaseCandidates()

    for (const candidate of candidates) {
      if (await probeApiBaseUrl(candidate)) {
        resolvedApiBaseUrl = candidate
        apiBaseValidated = true
        rememberApiBaseUrl(candidate)
        return candidate
      }
    }

    throw new Error(
      candidates.length
        ? `No reachable Continental ID auth API was found. Checked: ${candidates.join(', ')}.`
        : 'No trusted Continental ID auth API was configured.'
    )
  })()

  try {
    return await apiBaseResolutionPromise
  } catch (error) {
    apiBaseResolutionPromise = null
    throw error
  }
}

const getConfiguredLoginPopupUrl = () => {
  const runtimeWindow = getRuntimeWindow()
  return safeText(runtimeWindow.__LOGIN_POPUP_URL__) || DEFAULT_LOGIN_POPUP_URL
}

export const getContinentalLoginPopupOrigin = () => {
  try {
    return new URL(getConfiguredLoginPopupUrl(), window.location.href).origin
  } catch {
    return ''
  }
}

export const isTrustedContinentalMessageOrigin = (origin: string) => {
  if (!origin) {
    return false
  }

  if (origin === window.location.origin) {
    return true
  }

  if (origin === getContinentalLoginPopupOrigin()) {
    return true
  }

  if (TRUSTED_API_ORIGINS.has(origin)) {
    return true
  }

  return LOCAL_HOSTS.has(window.location.hostname) && isLocalOrigin(origin)
}

const getDefaultPopupApiBaseUrl = () => {
  if (apiBaseValidated && resolvedApiBaseUrl) {
    return resolvedApiBaseUrl
  }

  return resolveTrustedApiBaseUrl(getRuntimeWindow().__API_BASE_URL__ || '') || HOSTED_API_BASE_URL
}

export const buildContinentalLoginUrl = (redirectTo = window.location.href) => {
  const popupUrl = new URL(getConfiguredLoginPopupUrl(), window.location.href)
  popupUrl.searchParams.set('origin', window.location.origin)
  popupUrl.searchParams.set('redirect', redirectTo)
  popupUrl.searchParams.set('apiBaseUrl', getDefaultPopupApiBaseUrl())
  return popupUrl.toString()
}

export const refreshContinentalSession = async (): Promise<RefreshSessionResult> => {
  const apiBaseUrl = await ensureContinentalApiBaseUrl()
  const response = await fetchWithTimeout(`${apiBaseUrl}/api/auth/refresh_token`, {
    method: 'POST',
    credentials: 'include',
  })
  const payload = await parseResponseBody(response)

  if (!response.ok || !(payload.accessToken || payload.token)) {
    return {
      authenticated: false,
      accessToken: '',
      message: safeText(payload.message) || 'No active Continental ID session.',
    }
  }

  return {
    authenticated: true,
    accessToken: safeText(payload.accessToken || payload.token),
    message: safeText(payload.message),
  }
}

export const fetchContinentalUser = async (accessToken: string): Promise<ContinentalIdUser> => {
  const apiBaseUrl = await ensureContinentalApiBaseUrl()
  const response = await fetchWithTimeout(`${apiBaseUrl}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: 'include',
  })
  const payload = await parseResponseBody(response)

  if (!response.ok) {
    throw new Error(safeText(payload.message) || 'Could not load your Continental ID profile.')
  }

  const user = (payload.user || payload) as Partial<ContinentalIdUser>

  if (!user.userId || !user.email) {
    throw new Error('Continental ID returned an incomplete profile payload.')
  }

  return {
    userId: user.userId,
    continentalId: user.continentalId || user.userId,
    email: user.email,
    username: user.username || '',
    displayName: user.displayName || user.username || user.email,
    authority: user.authority,
  }
}

export const logoutContinentalSession = async () => {
  const apiBaseUrl = await ensureContinentalApiBaseUrl()
  await fetchWithTimeout(`${apiBaseUrl}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  })
}

export const stripContinentalAuthParams = () => {
  const params = new URLSearchParams(window.location.search)
  const trackedParams = ['apiBaseUrl', 'token', 'userId', 'continentalId', 'email', 'username']
  let changed = false

  for (const key of trackedParams) {
    if (params.has(key)) {
      params.delete(key)
      changed = true
    }
  }

  if (!changed) {
    return
  }

  const nextQuery = params.toString()
  const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`
  window.history.replaceState({}, '', nextUrl)
}

export const describeContinentalError = (error: unknown, fallback: string) => {
  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return 'The Continental ID service took too long to respond.'
    }

    if (error instanceof TypeError) {
      return fallback
    }

    if (safeText(error.message)) {
      return error.message
    }
  }

  return fallback
}

export const getUserInitials = (user: Pick<ContinentalIdUser, 'displayName' | 'email' | 'username'> | null) => {
  const label = safeText(user?.displayName) || safeText(user?.username) || safeText(user?.email)
  if (!label) {
    return 'CI'
  }

  const parts = label.split(/[\s@._-]+/).filter(Boolean)
  const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('')
  return initials || label.slice(0, 2).toUpperCase()
}
