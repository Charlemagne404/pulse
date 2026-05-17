# Pulse Phase 2 Collector

This document defines the first implementation slice for Phase 2: browser event intake, validation, privacy enforcement, and raw event persistence.

It is paired with the runnable collector scaffold in [server/src/server.ts](/Users/charliearnerstal/Documents/GitHub/pulse/server/src/server.ts:1).

## Phase 2 Scope

This phase covers:

- Browser-facing ingestion API
- Event request validation
- Consent-aware collection rules
- PII rejection
- Anonymous identifier handling
- Raw event persistence
- Duplicate event rejection by `eventId`
- Corruption-tolerant raw event reads
- Health endpoint for deployment and auth-adjacent integration

This phase does not yet cover:

- Dashboard query APIs
- Metric aggregation jobs
- Report generation
- Alert evaluation
- Workspace/project admin APIs

## Architecture Choice

The current repo is a TypeScript frontend without a backend workspace. For now, Pulse should add a minimal Node-based collector rather than a larger service platform.

Reasons:

- Matches the current repo language and toolchain
- Keeps Phase 2 narrow and shippable
- Lets the collector become real without deciding the full product backend architecture too early
- Preserves flexibility for later migration to a database-backed ingestion service

## Initial Endpoints

### `GET /api/health`

Purpose:

- Liveness checks
- Simple deployment validation
- Runtime configuration visibility at a safe level

Returns:

- Service name
- Timestamp
- Storage mode
- Config summary
- Stored event count
- Invalid line count
- Duplicate event count

### `POST /v1/collect`

Purpose:

- Accept batched browser events

Request body:

```json
{
  "events": []
}
```

Response behavior:

- `202` when at least one event was accepted
- `400` when all events are rejected or the request shape is invalid

Response body includes:

- Received count
- Accepted count
- Rejected count
- Per-event results

## Privacy Enforcement In Phase 2

The collector implements the following policy:

- Denied-consent analytics events are rejected
- Unknown-consent events are limited to strict anonymous `page_view`
- Granted-consent standard mode allows approved analytics events
- Raw PII patterns are rejected in properties
- Query strings and URL fragments are stripped from stored paths
- Referrers are stored as hostnames, not full URLs
- Duplicate `eventId` values are rejected

## Anonymous Identifier Policy

The collector accepts:

- `sessionId` for granted-consent standard mode
- `visitorKey` for approximate uniques in granted-consent standard mode

The collector rejects:

- Identity-oriented fields
- Missing `sessionId` when standard granted-consent collection is used
- Invalid identifier formats

## Storage Strategy For This Slice

The initial collector writes accepted events to newline-delimited JSON in a local file sink.

Why this is acceptable right now:

- It proves the intake contract
- It lets you inspect real collected payloads
- It keeps the service dependency-light
- It avoids locking Phase 2 to an early database decision

Why it is not the final architecture:

- Querying is limited
- Retention enforcement is not automated yet
- Aggregation jobs do not exist yet
- Horizontal scaling is not solved

## Configuration

The collector supports environment configuration for:

- Host and port
- Allowed project IDs
- Allowed event names
- Max request body size
- Max batch size
- CORS origin
- File sink path

Defaults are intentionally aligned with the current mock projects so the scaffold is usable immediately.

## Reliability Improvements

The current collector implementation now includes:

- Structured client vs server error responses
- `413` handling for oversized request bodies
- Duplicate detection within a request and across previously stored events
- Health degradation reporting when stored event lines are malformed
- Automated server tests for duplicate rejection, corrupted-line tolerance, project validation, and path sanitization

## Next Steps After This Slice

The next backend-focused steps after collector intake are:

1. Replace the file sink with a database-backed raw event store.
2. Add project metadata storage with event allowlists per project.
3. Add aggregation jobs for page, referrer, device, browser, and session metrics.
4. Add query APIs for the dashboard and report surfaces.
5. Add retention enforcement and event deletion jobs.
