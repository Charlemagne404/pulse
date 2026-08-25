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

The collector persists accepted events in SQLite with WAL mode, duplicate protection, daily
rollups, retention enforcement, rejection records, and health metadata. The original NDJSON file
sink remains a migration input for older installations.

## Configuration

The collector supports environment configuration for:

- Host and port
- Allowed project IDs
- Allowed event names
- Max request body size
- Max batch size
- Dashboard CORS origins
- Public collector CORS origins
- SQLite database path
- Export artifact directory

Defaults are conservative: project and event allowlists are empty until a deployment configures them,
while local development can opt into the seeded project set used by the test harness.

## Reliability Improvements

The current collector implementation now includes:

- Structured client vs server error responses
- `413` handling for oversized request bodies
- Duplicate detection within a request and across previously stored events
- Health degradation reporting when stored event lines are malformed
- Automated server tests for duplicate rejection, corrupted-line tolerance, project validation, and path sanitization

## Next Steps After This Slice

The next backend-focused steps are:

1. Add configurable project-level event policies where the product needs them.
2. Tune indexes and rollup coverage for larger event volumes.
3. Add browser-level collection and installation smoke coverage.
