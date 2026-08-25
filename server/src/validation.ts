import { randomUUID } from 'node:crypto'
import type {
  CollectorConfig,
  ConsentMode,
  ConsentState,
  DeviceType,
  PulseEventInput,
  Scalar,
  StoredPulseEvent,
  ValidationFailure,
  ValidationResult,
} from './types.js'

const EVENT_NAME_PATTERN = /^[a-z][a-z0-9_]{1,63}$/
const PROPERTY_KEY_PATTERN = /^[a-z][a-z0-9_]{0,63}$/
const ID_PATTERN = /^[a-zA-Z0-9_-]{8,128}$/
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
const PHONE_PATTERN = /(?:\+\d[\d\s().-]{7,}\d|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b|\b\d{2,4}(?:[\s.-]\d{2,4}){3,4}\b)/
const MAX_TEXT_LENGTH = 255
const MAX_PROPERTY_COUNT = 20
const REDACTED_VALUE = '[redacted]'
const SENSITIVE_KEY_NAMES = new Set([
  'email',
  'emailaddress',
  'phone',
  'phonenumber',
  'mobile',
  'mobilephone',
  'mobilenumber',
  'fullname',
  'firstname',
  'lastname',
  'address',
  'streetaddress',
  'postalcode',
  'message',
  'body',
  'comments',
  'freeform',
  'token',
  'password',
  'secret',
  'authorization',
  'cardnumber',
  'payment',
  'iban',
  'ssn',
])
const CONSENT_STATES = new Set<ConsentState>(['unknown', 'denied', 'granted'])
const CONSENT_MODES = new Set<ConsentMode>(['strict', 'standard'])
const DEVICE_TYPES = new Set<DeviceType>(['desktop', 'mobile', 'tablet', 'bot', 'unknown'])

const failure = (reason: string, field?: string): ValidationFailure =>
  field ? { ok: false, reason, field } : { ok: false, reason }

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const readTrimmedString = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

const hasPiiPattern = (value: string) => EMAIL_PATTERN.test(value) || PHONE_PATTERN.test(value)

const isIsoTimestamp = (value: string) =>
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/.test(value)

const sanitizePath = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }

  try {
    const url = new URL(trimmed)
    const pathname = url.pathname || '/'
    return pathname.startsWith('/') ? pathname : ''
  } catch {
    const withoutHash = trimmed.split('#', 1)[0] || ''
    const withoutQuery = withoutHash.split('?', 1)[0] || ''
    return withoutQuery.startsWith('/') ? withoutQuery || '/' : ''
  }
}

const sanitizeReferrer = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) {
    return undefined
  }

  try {
    const url = new URL(trimmed)
    return url.hostname || undefined
  } catch {
    return undefined
  }
}

const sanitizeScalar = (value: unknown): Scalar | undefined => {
  if (value === null) {
    return null
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return ''
    }
    return trimmed
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  return undefined
}

const isSensitiveKey = (key: string) => SENSITIVE_KEY_NAMES.has(key.toLowerCase().replace(/[^a-z0-9]/g, ''))

const redactValue = (value: unknown, key = '', depth = 0): unknown => {
  if (isSensitiveKey(key)) {
    return REDACTED_VALUE
  }

  if (typeof value === 'string') {
    if (hasPiiPattern(value) || value.length > MAX_TEXT_LENGTH) {
      return REDACTED_VALUE
    }

    return value
  }

  if (Array.isArray(value)) {
    if (depth >= 6) {
      return REDACTED_VALUE
    }

    return value.slice(0, MAX_PROPERTY_COUNT).map((item) => redactValue(item, key, depth + 1))
  }

  if (isPlainObject(value)) {
    if (depth >= 6) {
      return REDACTED_VALUE
    }

    return Object.fromEntries(
      Object.entries(value)
        .slice(0, MAX_PROPERTY_COUNT)
        .map(([entryKey, entryValue]) => [entryKey, redactValue(entryValue, entryKey, depth + 1)]),
    )
  }

  return value === null || typeof value === 'number' || typeof value === 'boolean' ? value : REDACTED_VALUE
}

export const redactPayloadForStorage = (value: unknown) => redactValue(value)

const sanitizeProperties = (value: unknown) => {
  if (value === undefined) {
    return { ok: true as const, properties: undefined }
  }

  if (!isPlainObject(value)) {
    return failure('properties must be an object', 'properties')
  }

  const entries = Object.entries(value)
  if (entries.length > MAX_PROPERTY_COUNT) {
    return failure(`properties cannot contain more than ${MAX_PROPERTY_COUNT} keys`, 'properties')
  }

  const properties: Record<string, Scalar> = {}

  for (const [key, rawValue] of entries) {
    if (!PROPERTY_KEY_PATTERN.test(key)) {
      return failure('property keys must be lowercase snake_case', `properties.${key}`)
    }

    const scalar = sanitizeScalar(rawValue)
    if (scalar === undefined) {
      return failure('property values must be strings, numbers, booleans, or null', `properties.${key}`)
    }

    if (typeof scalar === 'string') {
      if (scalar.length > MAX_TEXT_LENGTH) {
        return failure(`property text must be <= ${MAX_TEXT_LENGTH} characters`, `properties.${key}`)
      }

      if (hasPiiPattern(scalar)) {
        return failure('property value appears to contain personal data', `properties.${key}`)
      }
    }

    properties[key] = scalar
  }

  return { ok: true as const, properties }
}

const sanitizeConsent = (value: unknown) => {
  if (!isPlainObject(value)) {
    return failure('consent is required', 'consent')
  }

  const state = readTrimmedString(value.state) as ConsentState
  const mode = readTrimmedString(value.mode) as ConsentMode

  if (!CONSENT_STATES.has(state)) {
    return failure('consent.state must be one of unknown, denied, or granted', 'consent.state')
  }

  if (!CONSENT_MODES.has(mode)) {
    return failure('consent.mode must be strict or standard', 'consent.mode')
  }

  return { ok: true as const, consent: { state, mode } }
}

const sanitizeContext = (value: unknown) => {
  if (value === undefined) {
    return { ok: true as const, context: undefined }
  }

  if (!isPlainObject(value)) {
    return failure('context must be an object', 'context')
  }

  const deviceTypeRaw = readTrimmedString(value.deviceType)
  const browserName = readTrimmedString(value.browserName)
  const countryCode = readTrimmedString(value.countryCode).toUpperCase()
  const language = readTrimmedString(value.language)

  const context: StoredPulseEvent['context'] = {}

  if (deviceTypeRaw) {
    if (!DEVICE_TYPES.has(deviceTypeRaw as DeviceType)) {
      return failure('context.deviceType is invalid', 'context.deviceType')
    }

    context.deviceType = deviceTypeRaw as DeviceType
  }

  if (browserName) {
    if (browserName.length > 64) {
      return failure('context.browserName is too long', 'context.browserName')
    }

    context.browserName = browserName
  }

  if (countryCode) {
    if (!/^[A-Z]{2}$/.test(countryCode)) {
      return failure('context.countryCode must be a 2-letter code', 'context.countryCode')
    }

    context.countryCode = countryCode
  }

  if (language) {
    if (!/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})?$/.test(language)) {
      return failure('context.language is invalid', 'context.language')
    }

    context.language = language
  }

  return { ok: true as const, context: Object.keys(context).length ? context : undefined }
}

const sanitizeIdentity = (value: unknown) => {
  if (value === undefined) {
    return { ok: true as const, identity: undefined }
  }

  if (!isPlainObject(value)) {
    return failure('identity must be an object', 'identity')
  }

  const sessionId = readTrimmedString(value.sessionId)
  const visitorKey = readTrimmedString(value.visitorKey)
  const identity: StoredPulseEvent['identity'] = {}

  if (sessionId) {
    if (!ID_PATTERN.test(sessionId)) {
      return failure('identity.sessionId has an invalid format', 'identity.sessionId')
    }

    identity.sessionId = sessionId
  }

  if (visitorKey) {
    if (!ID_PATTERN.test(visitorKey)) {
      return failure('identity.visitorKey has an invalid format', 'identity.visitorKey')
    }

    identity.visitorKey = visitorKey
  }

  return { ok: true as const, identity: Object.keys(identity).length ? identity : undefined }
}

export const validateEvent = (input: unknown, config: CollectorConfig): ValidationResult => {
  if (!isPlainObject(input)) {
    return failure('event must be an object')
  }

  const event = input as PulseEventInput

  const eventName = readTrimmedString(event.eventName)
  if (!EVENT_NAME_PATTERN.test(eventName)) {
    return failure('eventName must be lowercase snake_case', 'eventName')
  }

  if (config.allowedEventNames.size > 0 && !config.allowedEventNames.has(eventName)) {
    return failure('eventName is not allowed by the collector configuration', 'eventName')
  }

  const projectId = readTrimmedString(event.projectId)
  if (!projectId) {
    return failure('projectId is required', 'projectId')
  }

  const occurredAt = readTrimmedString(event.occurredAt)
  if (!occurredAt || !isIsoTimestamp(occurredAt) || Number.isNaN(Date.parse(occurredAt))) {
    return failure('occurredAt must be a valid ISO timestamp', 'occurredAt')
  }

  if (!isPlainObject(event.page)) {
    return failure('page is required', 'page')
  }

  const path = sanitizePath(readTrimmedString(event.page.path))
  if (!path) {
    return failure('page.path must be a path or URL', 'page.path')
  }

  if (hasPiiPattern(path)) {
    return failure('page.path appears to contain personal data', 'page.path')
  }

  const title = readTrimmedString(event.page.title)
  if (title.length > MAX_TEXT_LENGTH) {
    return failure(`page.title must be <= ${MAX_TEXT_LENGTH} characters`, 'page.title')
  }

  if (title && hasPiiPattern(title)) {
    return failure('page.title appears to contain personal data', 'page.title')
  }

  const consentResult = sanitizeConsent(event.consent)
  if (!consentResult.ok) {
    return consentResult
  }

  const contextResult = sanitizeContext(event.context)
  if (!contextResult.ok) {
    return contextResult
  }

  const propertiesResult = sanitizeProperties(event.properties)
  if (!propertiesResult.ok) {
    return propertiesResult
  }

  const identityResult = sanitizeIdentity(event.identity)
  if (!identityResult.ok) {
    return identityResult
  }

  const referrer = sanitizeReferrer(readTrimmedString(event.page.referrer))
  const eventId = readTrimmedString(event.eventId) || randomUUID()
  if (!ID_PATTERN.test(eventId)) {
    return failure('eventId has an invalid format', 'eventId')
  }

  const warnings: string[] = []
  const consent = { ...consentResult.consent }
  let identity = identityResult.identity
  let properties = propertiesResult.properties

  if (consent.state === 'denied') {
    return failure('analytics collection denied by consent state', 'consent.state')
  }

  if (consent.state === 'unknown') {
    if (eventName !== 'page_view') {
      return failure('only page_view is allowed before consent is granted', 'eventName')
    }

    consent.mode = 'strict'
    identity = undefined
    properties = undefined
    warnings.push('accepted in strict anonymous mode')
  }

  if (consent.state === 'granted' && consent.mode === 'strict') {
    if (eventName !== 'page_view') {
      return failure('strict mode only allows page_view events', 'consent.mode')
    }

    identity = undefined
    properties = undefined
    warnings.push('granted consent event accepted in strict mode without persistent identifiers')
  }

  if (consent.state === 'granted' && consent.mode === 'standard' && !identity?.sessionId) {
    return failure('identity.sessionId is required for granted standard collection', 'identity.sessionId')
  }

  const storedEvent: StoredPulseEvent = {
    schemaVersion: 1,
    receivedAt: new Date().toISOString(),
    eventId,
    eventName,
    occurredAt: new Date(occurredAt).toISOString(),
    projectId,
    page: {
      path,
      ...(title ? { title } : {}),
      ...(referrer ? { referrer } : {}),
    },
    ...(contextResult.context ? { context: contextResult.context } : {}),
    consent,
    ...(identity ? { identity } : {}),
    ...(properties && Object.keys(properties).length ? { properties } : {}),
  }

  return { ok: true, event: storedEvent, warnings }
}
