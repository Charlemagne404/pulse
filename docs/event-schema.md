# Pulse Event Schema

This document defines the MVP event contract for Pulse based on the Phase 1 product decisions in [docs/phase-1-foundation.md](/Users/charliearnerstal/Documents/GitHub/pulse/docs/phase-1-foundation.md:1).

## Design Goals

- Preserve strong privacy defaults
- Keep enough anonymous state for usable analytics
- Stay self-serve and predictable for implementers
- Keep the schema stable and easy to validate

## Identity Strategy

Pulse does not support user identity in MVP.

Pulse may use two anonymous first-party identifiers internally for measurement:

- `sessionId`: short-lived identifier for grouping events into a browsing session
- `visitorKey`: rotating anonymous identifier for approximate unique counting across sessions in a short time window

Constraints:

- Both identifiers must be first-party only
- Neither identifier may contain user identity or account identity
- Neither identifier may be shared across unrelated sites
- Neither identifier may be used for advertising or profiling
- `visitorKey` must rotate at least every 24 hours
- `sessionId` expires after 30 minutes of inactivity or 24 hours maximum

## Consent Modes

Pulse supports two effective collection modes in MVP:

- `strict`: minimal collection, suitable before consent is granted
- `standard`: full anonymous analytics collection allowed by the project's consent policy

Consent state values:

- `unknown`
- `denied`
- `granted`

## Collection Rules By Consent State

### Unknown

Allowed:

- `page_view` only
- No persistent storage
- Minimal page context
- No custom event properties beyond product-safe defaults

Blocked:

- Custom events
- Session continuity across page loads
- Visitor-level deduplication

### Denied

Allowed:

- No analytics event collection by default

Blocked:

- All tracked analytics events

Note:
If a project has a legal basis for strictly necessary telemetry outside analytics consent, that should be specified separately. It is out of scope for MVP analytics behavior.

### Granted

Allowed:

- `page_view`
- Approved custom events
- Anonymous `sessionId`
- Rotating anonymous `visitorKey`
- Standard metric computation

## Event Envelope

Every accepted event must conform to this logical structure:

```ts
type ConsentState = 'unknown' | 'denied' | 'granted'
type ConsentMode = 'strict' | 'standard'

interface PulseEvent {
  eventId: string
  eventName: string
  occurredAt: string
  projectId: string
  page: {
    path: string
    title?: string
    referrer?: string
  }
  context: {
    deviceType?: 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown'
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
  properties?: Record<string, string | number | boolean | null>
}
```

## Required Fields

Required for every accepted event:

- `eventId`
- `eventName`
- `occurredAt`
- `projectId`
- `page.path`
- `consent.state`
- `consent.mode`

Required when consent state is `granted` and standard collection is active:

- `identity.sessionId`

Required for metrics that count anonymous unique visitors:

- `identity.visitorKey`

## Event Validation Rules

- `eventName` must be lowercase snake_case
- `projectId` must match a known project
- `occurredAt` must be a valid ISO-8601 timestamp
- `page.path` must start with `/` or be a full canonical URL normalized by the collector
- `countryCode` must be a derived country code, not user-supplied free text
- `properties` keys must be lowercase snake_case
- `properties` values must be scalar
- Nested objects and arrays are rejected in MVP
- Freeform text fields longer than 255 characters are rejected in MVP
- Known PII patterns should be rejected server-side

## PII Rules

The collector must reject or strip payloads containing:

- Email addresses
- Phone numbers
- Full names in dedicated fields
- Postal addresses
- Government identifiers
- Payment information
- Freeform message bodies from forms

MVP safe alternatives:

- `button: "learn_more"`
- `asset: "product_sheet"`
- `form: "contact_sales"`
- `location: "hero"`
- `step: "quote_started"`

## SDK Method Contracts

### `pulse.init`

Purpose:

- Register the project
- Set endpoint configuration
- Set consent-aware defaults

Expected shape:

```ts
interface PulseInitConfig {
  projectId: string
  debug?: boolean
  consentDefault?: 'strict' | 'standard'
}
```

Rules:

- Must be called once
- Must happen before `page` or `track`
- Defaults to `strict` mode if not specified

### `pulse.page`

Purpose:

- Record a page or route transition

Expected shape:

```ts
interface PulsePagePayload {
  path: string
  title?: string
  referrer?: string
}
```

Rules:

- Used for initial page load and SPA transitions
- Safe to call multiple times within a session

### `pulse.track`

Purpose:

- Record a non-page interaction

Expected shape:

```ts
type PulseTrackProperties = Record<string, string | number | boolean | null>
```

Rules:

- Event name must exist in the project's allowlist
- Properties must match the event definition
- Calls are dropped when consent policy disallows them

## Global Event Catalog

The initial shared catalog is:

- `page_view`
- `button_click`
- `form_submit`
- `file_download`
- `video_play`

## Project-Specific Event Extensions

MVP allows project-specific events when declared in the project tracking plan.

Current examples used by the product surfaces:

- `spec_opened`
- `contact_request`
- `demo_opened`
- `appointment_started`
- `store_selected`
- `coupon_download`

## Canonical Properties By Shared Event

### `page_view`

Allowed properties:

- `page_type`
- `content_group`
- `campaign`

### `button_click`

Allowed properties:

- `button`
- `location`
- `variant`

### `form_submit`

Allowed properties:

- `form`
- `location`
- `result`

### `file_download`

Allowed properties:

- `asset`
- `asset_type`
- `location`

### `video_play`

Allowed properties:

- `video`
- `location`
- `progress_bucket`

## Ingestion Behavior

The collector must:

- Validate payloads before storage
- Reject unknown projects
- Reject disallowed events
- Reject disallowed properties
- Derive geography server-side where possible
- Normalize browser and device dimensions
- Store only the minimum anonymous identity data needed for reporting

## Storage Guidance

For raw events in MVP:

- Store anonymous identifiers separately from event properties
- Do not expose raw anonymous identifiers in exports or UI
- Apply retention deletion to raw identifiers and events together

## Implementation Notes

This schema intentionally chooses anonymous sessionization over fully stateless collection. That is the minimum concession to functionality needed to support the current promised metrics without crossing into user identity features.
