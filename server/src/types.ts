export type ConsentState = 'unknown' | 'denied' | 'granted'
export type ConsentMode = 'strict' | 'standard'
export type DeviceType = 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown'
export type Scalar = string | number | boolean | null

export interface PulseEventInput {
  eventId?: unknown
  eventName?: unknown
  occurredAt?: unknown
  projectId?: unknown
  page?: {
    path?: unknown
    title?: unknown
    referrer?: unknown
  }
  context?: {
    deviceType?: unknown
    browserName?: unknown
    countryCode?: unknown
    language?: unknown
  }
  consent?: {
    state?: unknown
    mode?: unknown
  }
  identity?: {
    sessionId?: unknown
    visitorKey?: unknown
  }
  properties?: Record<string, unknown>
}

export interface StoredPulseEvent {
  schemaVersion: 1
  receivedAt: string
  eventId: string
  eventName: string
  occurredAt: string
  projectId: string
  page: {
    path: string
    title?: string
    referrer?: string
  }
  context?: {
    deviceType?: DeviceType
    browserName?: string
    countryCode?: string
    language?: string
  }
  consent: {
    state: ConsentState
    mode: ConsentMode
  }
  identity?: {
    sessionId?: string
    visitorKey?: string
  }
  properties?: Record<string, Scalar>
}

export interface CollectRequestBody {
  events?: unknown
}

export interface ValidationSuccess {
  ok: true
  event: StoredPulseEvent
  warnings: string[]
}

export interface ValidationFailure {
  ok: false
  reason: string
  field?: string
}

export type ValidationResult = ValidationSuccess | ValidationFailure

export interface CollectorConfig {
  host: string
  port: number
  corsOrigin: string
  maxBatchSize: number
  maxBodyBytes: number
  sinkPath: string
  allowedProjectIds: Set<string>
  allowedEventNames: Set<string>
}
