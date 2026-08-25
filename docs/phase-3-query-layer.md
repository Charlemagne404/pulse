# Pulse Phase 3 Query Layer

This document defines the first read-side analytics layer for Pulse.

It is implemented by:

- [server/src/analytics.ts](/Users/charliearnerstal/Documents/GitHub/pulse/server/src/analytics.ts:1)
- [server/src/server.ts](/Users/charliearnerstal/Documents/GitHub/pulse/server/src/server.ts:1)

## Phase 3 Scope

Phase 3 adds:

- Raw-event loading from the Phase 2 sink
- On-demand aggregation
- Overview analytics API
- Project overview analytics API
- Page report API
- Referrer report API
- Query-time tolerance for malformed or duplicate raw event lines

It does not yet add:

- Materialized rollup tables
- Background aggregation jobs
- Database-backed query storage
- Alert evaluation workers
- Frontend API integration

## Architecture Choice

The query layer currently computes rollups on demand from the raw NDJSON event sink.

This is acceptable for the next slice because:

- It keeps Phase 3 buildable without picking a database prematurely
- It validates the API contract against real collected event shapes
- It creates a clear upgrade path toward materialized rollups later

This is not the final performance architecture.

## Endpoints

### `GET /v1/analytics/overview`

Returns:

- Workspace-level metrics
- Visits-over-time series
- Top projects
- Top pages
- Top referrers
- Device mix
- Browser mix
- Recent events

Supported query parameters:

- `from`
- `to`
- `granularity=day|week|month`

### `GET /v1/analytics/projects/:projectId/overview`

Returns:

- Project-level metrics
- Visits-over-time series
- Top pages
- Top referrers
- Event table
- Country mix
- Recent events

### `GET /v1/analytics/reports/pages`

Returns:

- Tracked page count
- Top landing page count
- Average exit rate
- Top pages with volume and exit-rate share

Supports optional `projectId`.

### `GET /v1/analytics/reports/referrers`

Returns:

- Tracked referrer count
- Owned share
- Search-led visit count
- Top referrer rows

Supports optional `projectId`.

## Metric Behavior

The API follows [docs/metric-definitions.md](/Users/charliearnerstal/Documents/GitHub/pulse/docs/metric-definitions.md:1).

Important current behaviors:

- Unique visitors are approximate and based on anonymous `visitorKey`
- Live visitors are based on recent anonymous `sessionId` activity
- Session-based metrics exclude strict-mode pre-consent traffic when there is no session continuity
- Page views may include strict-mode `page_view` events
- Unknown projects are rejected instead of silently returning empty analytics

## Known Limits

- Query speed will need further indexing and rollup work as raw event volume grows
- SQLite is the current source of truth, with daily rollups used for read-side aggregation
- Referrer ownership and search-host lists are static in code
- No distributed caching layer exists yet
- Recent events use cursor pagination; larger installations may need additional read-model tuning

Note:
The original NDJSON sink is retained only as a migration input. New events are stored in SQLite,
with rollups, retention enforcement, rejection records, and health metadata maintained by the collector.

## Next Steps After Phase 3

1. Tune SQLite indexes and rollup coverage for larger event volumes.
2. Add configurable retention and alert-management APIs.
3. Add browser-level installation and dashboard smoke coverage.
4. Evaluate a queue or separate read model only when measured workload requires it.
