# Pulse Phases Overview

This document is the high-level roadmap for Pulse. It explains what each phase is, what its purpose is, and where the detailed specs or implementation live.

## Summary

Pulse has been broken into phases so the product can move from visual mockup to usable self-serve analytics product in a controlled way.

The phases are:

1. Phase 1: Product definition and operating model
2. Phase 2: Event collection and ingestion
3. Phase 3: Read-side analytics and query APIs
4. Phase 4: Frontend integration with live backend data
5. Phase 5: Performance, rollups, and background processing
6. Phase 6: Production readiness and full product surfaces

## Phase 1

### What it is

Phase 1 defines what Pulse actually is as a product.

It covers:

- Product scope
- Privacy model
- Consent model
- Event schema decisions
- Metric definitions
- Access model
- Self-serve operating model
- Copy direction for the product

### Why it exists

Before building backend or frontend behavior, Pulse needed a real contract instead of marketing copy and mock UI assumptions.

### Outputs

- [phase-1-foundation.md](/Users/charliearnerstal/Documents/GitHub/pulse/docs/phase-1-foundation.md:1)
- [event-schema.md](/Users/charliearnerstal/Documents/GitHub/pulse/docs/event-schema.md:1)
- [metric-definitions.md](/Users/charliearnerstal/Documents/GitHub/pulse/docs/metric-definitions.md:1)
- [access-and-operations.md](/Users/charliearnerstal/Documents/GitHub/pulse/docs/access-and-operations.md:1)
- [copy-rewrite-inventory.md](/Users/charliearnerstal/Documents/GitHub/pulse/docs/copy-rewrite-inventory.md:1)

### Status

- Complete as an initial definition pass

## Phase 2

### What it is

Phase 2 is the event intake layer.

It covers:

- Browser-facing collection API
- Event validation
- Privacy enforcement
- Consent-aware acceptance rules
- Anonymous identifier handling
- Raw event persistence

### Why it exists

Pulse needed a real collector before any dashboard could become real.

### Outputs

- [phase-2-collector.md](/Users/charliearnerstal/Documents/GitHub/pulse/docs/phase-2-collector.md:1)
- [server/src/app.ts](/Users/charliearnerstal/Documents/GitHub/pulse/server/src/app.ts:1)
- [server/src/server.ts](/Users/charliearnerstal/Documents/GitHub/pulse/server/src/server.ts:1)
- [server/src/validation.ts](/Users/charliearnerstal/Documents/GitHub/pulse/server/src/validation.ts:1)
- [server/src/store.ts](/Users/charliearnerstal/Documents/GitHub/pulse/server/src/store.ts:1)

### Status

- Implemented as a working collector scaffold
- Hardened with duplicate rejection, corruption tolerance, and automated tests

## Phase 3

### What it is

Phase 3 is the first query and aggregation layer.

It covers:

- Loading raw events back from storage
- On-demand aggregation
- Overview analytics API
- Project overview analytics API
- Report APIs for pages and referrers

### Why it exists

Once events can be collected, the next step is making them queryable in shapes the product UI can use.

### Outputs

- [phase-3-query-layer.md](/Users/charliearnerstal/Documents/GitHub/pulse/docs/phase-3-query-layer.md:1)
- [server/src/analytics.ts](/Users/charliearnerstal/Documents/GitHub/pulse/server/src/analytics.ts:1)
- [server/src/projects.ts](/Users/charliearnerstal/Documents/GitHub/pulse/server/src/projects.ts:1)

### Status

- Implemented as a working read-side layer over the raw file sink
- Good enough for integration and validation
- Not yet the final performance architecture

## Phase 4

### What it is

Phase 4 connects the current frontend to the live backend.

It should cover:

- Replacing mock dashboard data with API reads
- Replacing mock project pages with API reads
- Replacing mock report pages with API reads
- Loading states, empty states, and error states
- API client and response mapping in the frontend

### Why it exists

At this point the backend can collect and query data, but the product UI is still mostly rendering mock data.

### Expected outputs

- Frontend API client utilities
- Live dashboard and project pages
- Live report pages
- Reduced or removed dependence on `src/data/mockData.ts`

### Status

- Not started

## Phase 5

### What it is

Phase 5 improves performance and moves Pulse away from on-demand computation over a flat file.

It should cover:

- Database-backed raw event storage
- Rollup/materialized aggregates
- Background jobs for metric computation
- Retention enforcement
- Query performance improvements
- Better recent-event pagination and filtering

### Why it exists

Phases 2 and 3 prove the product behavior, but they are not efficient enough for a larger real workload.

### Expected outputs

- Real storage backend
- Rollup pipeline
- Faster analytics endpoints
- Retention jobs

### Status

- Complete

## Phase 6

### What it is

Phase 6 finishes the remaining product surfaces and production concerns.

It should cover:

- Alerts backed by real evaluation logic
- Scheduled exports and report generation
- Workspace/project management APIs
- Production deployment hardening
- Observability and failure monitoring
- Security and abuse controls
- Final copy rewrite from mock/staffed language to self-serve product language

### Why it exists

Pulse needs more than collection and dashboard reads to become a complete product people can rely on.

### Expected outputs

- Real alert engine
- Real export pipeline
- Admin/config APIs
- Production hardening
- Finalized product copy

### Status

- Complete

## Current Position

Pulse now has an end-to-end product path in place:

- The collector accepts validated events into SQLite-backed storage
- Rollups, retention enforcement, health snapshots, and recent-event pagination run on the backend
- The frontend reads live analytics on the dashboard, projects, events, reports, alerts, and workspace-settings surfaces
- Alerts, export visibility, and workspace operations are exposed through stable product APIs
- The remaining work is iterative product expansion rather than finishing the initial functional surface set

## Recommended Next Move

The next milestone is no longer basic frontend completion. The product can now move into follow-on work such as:

- richer filtering and drill-down controls on live analytics surfaces
- authentication and authorization hardening beyond the current shell
- real export job execution instead of visibility-only export state
- deployment and observability improvements around the live collector
