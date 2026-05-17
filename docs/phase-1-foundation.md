# Pulse Phase 1 Foundation

This document turns the current Pulse website and in-app copy into an initial Phase 1 product definition. It is intentionally limited to decisions and constraints that can be supported by the existing product surface. It also incorporates the intended operating model for Pulse: a self-serve product run by a solo operator rather than a staffed platform team.

## Purpose

The current website presents Pulse as a privacy-first analytics platform for websites and applications. It promises:

- Cookie-free, privacy-first analytics
- Website and SPA tracking
- Workspace and project views
- Event tracking and reporting
- Consent-aware collection
- Scheduled reports and exports
- Alerts for collection and reporting anomalies
- Role-based access
- EU-hosted, governance-friendly operation

Phase 1 defines the contract for those promises so backend, SDK, and reporting work can proceed without relying on mock UI assumptions.

## Phase 1 Deliverables

Phase 1 should produce:

- A product vocabulary and domain model
- A tracking and event schema contract
- A privacy and consent policy suitable for implementation
- Initial metric definitions
- Workspace, project, and role definitions
- Reporting and export requirements for MVP
- Alerting requirements for MVP
- A list of implementation constraints and resolved product decisions

Phase 1 does not include building the collector, dashboards, or storage layer. It defines them.

## Operating Model

Pulse is a self-serve software product, not a managed analytics service.

This has several Phase 1 consequences:

- Users are expected to install, configure, and maintain their own tracking setup
- Documentation and in-app product affordances must be good enough for independent setup
- There is no standing implementation desk, governance team, or reporting team behind the product
- The operator may provide reactive help for service outages, bugs, billing, or account-access issues
- Routine analytics planning, event design, and reporting interpretation remain the user's responsibility

Any existing product copy that implies a staffed support or governance organization should be treated as placeholder marketing language and should be rewritten later.

## Sources Used

This draft is derived from the current product and docs copy in:

- [src/pages/HomePage.tsx](/Users/charliearnerstal/Documents/GitHub/pulse/src/pages/HomePage.tsx:121)
- [src/data/content.ts](/Users/charliearnerstal/Documents/GitHub/pulse/src/data/content.ts:234)
- [src/data/content.ts](/Users/charliearnerstal/Documents/GitHub/pulse/src/data/content.ts:428)
- [src/data/content.ts](/Users/charliearnerstal/Documents/GitHub/pulse/src/data/content.ts:772)
- [src/data/content.ts](/Users/charliearnerstal/Documents/GitHub/pulse/src/data/content.ts:807)
- [src/data/content.ts](/Users/charliearnerstal/Documents/GitHub/pulse/src/data/content.ts:835)
- [src/data/content.ts](/Users/charliearnerstal/Documents/GitHub/pulse/src/data/content.ts:874)

## Product Vocabulary

The following terms are already implied by the website and should be treated as first-class product entities.

### Workspace

A workspace is the top-level analytics container for one customer account or one user's set of projects. It owns:

- Members and roles
- Shared reports
- Shared alert definitions
- Export settings
- Workspace-wide collection guidance

### Project

A project is the collection and reporting boundary for one digital property or closely related product surface. A project owns:

- One identifier used by the client SDK during initialization
- One or more domains or application surfaces
- Its tracking plan
- Its allowed event set
- Its consent posture
- Its reporting defaults
- Project-level alerts

### Event

An event is a single tracked observation emitted by the client SDK and accepted by Pulse collection.

Events fall into four practical groups already visible in the site:

- Core traffic: `page_view`
- Engagement: `button_click`, `video_play`
- Content interaction: `file_download`
- Conversion: `form_submit` and project-specific conversion events

### Report

A report is a saved presentation of aggregated data intended for repeated review. The current site implies:

- Workspace overview reporting
- Project-level reporting
- Content performance reporting
- Referrer reporting
- Executive weekly reporting

### Export

An export is a generated data delivery or report delivery outside the interactive UI. The site implies both:

- Scheduled exports
- Manual downloads

### Alert

An alert is an automated notification generated from changes in analytics volume, collection health, or export health.

## Initial Domain Model

The current site supports the following minimum domain relationships:

- A workspace has many projects
- A workspace has many users
- A user has one role per workspace
- A workspace has many reports
- A workspace has many alert rules
- A project has many events
- A project has many pages
- A project has many conversions
- A project may have project-specific settings for retention, reporting defaults, and alert coverage

## Tracking Contract

The docs and UI imply a browser SDK loaded by script tag and initialized once per application shell.

### Bootstrap

The current docs imply this contract:

```html
<script
  defer
  src="https://cdn.pulse.continental.com/pulse.js"
  data-site="continental.com"
  data-collect="https://api.pulse.continental.com"
></script>
```

And:

```js
window.pulse = window.pulse || [];

pulse.init({
  projectId: 'aegis',
  debug: false,
});
```

### Required Browser Methods

The docs explicitly imply:

- `pulse.init(...)`
- `pulse.page(...)`
- `pulse.track(...)`
- `pulse.identify(...)`

For Phase 1, only the first three are part of MVP. `identify` is excluded from standard setups and should not be implemented in the initial product path.

### Initialization Rules

Phase 1 should lock the following rules:

- `init` is called exactly once per page shell or app bootstrap
- Every event is associated with one `projectId`
- Collection endpoint configuration must be environment-specific
- Production must support `debug: false`
- SPA applications must be able to emit additional `page_view` events after route changes

### Event Structure

The exact payload shape is not fully defined by the current site, but the minimum contract already implied is:

- Event name
- Timestamp
- Project identifier
- Page or route context
- Device/browser context
- Country-level geography
- Consent state
- Event properties object

Recommended Phase 1 event envelope:

```ts
interface PulseEvent {
  eventName: string
  occurredAt: string
  projectId: string
  page: {
    path: string
    title?: string
    referrer?: string
  }
  context: {
    deviceType?: string
    browserName?: string
    countryCode?: string
  }
  consent: {
    state: 'unknown' | 'denied' | 'granted'
    mode: 'strict' | 'standard'
  }
  properties?: Record<string, string | number | boolean | null>
}
```

Resolved decision:
Pulse may use anonymous first-party identifiers only where needed to preserve core analytics functionality. These identifiers must be short-lived, rotation-friendly, and never used for cross-site or long-term behavioral profiling.

## Event Naming and Catalog

The current shared event set from the site should be treated as the initial global catalog:

- `page_view`
- `button_click`
- `form_submit`
- `file_download`
- `video_play`

The project pages also imply support for project-specific custom events:

- `spec_opened`
- `contact_request`
- `demo_opened`
- `appointment_started`
- `store_selected`
- `coupon_download`

### Event Naming Rules

Based on the current docs, Phase 1 should standardize:

- Lowercase snake_case event names
- Business-readable names instead of UI implementation details
- Stable names over time
- Small payloads with predictable property names
- No freeform personal data in event properties

### Event Governance Rules

A project tracking plan must define:

- Which events are allowed for the project
- Which properties are allowed per event
- Which events count as conversions
- Which events are required for launch

## Privacy Boundaries

The website makes strong privacy claims. Phase 1 needs to freeze what those claims mean operationally.

### Privacy Commitments Supported by Current Copy

- Cookie-free by default
- No fingerprinting
- Personal data should be avoided in payloads
- Collection should stay intentionally narrow
- Country-level location is acceptable
- Retention is configurable
- Consent-aware collection is supported

### Implementation-Level Interpretation for Phase 1

The Phase 1 privacy position is:

- No third-party advertising identifiers
- No device fingerprinting logic
- No collection of raw freeform PII in event properties
- No `identify` support in MVP
- Geography should be derived and stored at country level only
- Projects may define stricter collection choices than the workspace default

Resolved decision:
Pulse may use an anonymous session identifier and a rotating anonymous visitor key for measurement, but it must not expose identity features, user profiling features, or long-lived tracking by default. This is the chosen tradeoff because removing all anonymous identifiers would damage core metrics too severely.

## Consent Model

The current docs are clear enough to define an initial model but not the edge cases.

### Explicitly Implied Behavior

- The client can start in a strict mode
- Optional tracking is disabled until consent is known
- Consent assumptions must be documented during project setup
- Consent changes can affect collection behavior

### Phase 1 MVP Contract

- Consent state must be supplied or updated by the host site/application
- The SDK must support an initial restrictive mode
- Events should carry the consent state active at time of collection
- Projects should be able to declare whether consent is required for standard event collection

Resolved decisions:

- Pulse uses a single analytics consent state, not a multi-category consent model, in MVP
- `page_view` may be collected before consent only in strict anonymous mode with no persistent storage and minimal page-context payload
- Persistent first-party analytics cookies are not required and should not be the default implementation choice

## Metrics That Need Canonical Definitions

The UI already displays these metrics and therefore requires formal definitions:

- Page views
- Unique visitors
- Live visitors
- Bounce rate
- Average engagement time
- Top pages
- Top referrers
- Device mix
- Browser mix
- Country mix
- Conversion rate
- Exit rate

### Metrics That Can Be Defined From Current Product Intent

These are straightforward enough to define now:

- Page views: count of accepted `page_view` events
- Top pages: pages ranked by `page_view` count
- Top referrers: grouped count of accepted traffic by referrer source
- Device mix: grouped share of accepted traffic by device type
- Browser mix: grouped share of accepted traffic by browser
- Country mix: grouped share of accepted traffic by derived country

### Metrics That Depend On Anonymous Sessionization

These depend on the chosen anonymous identity policy:

- Unique visitors
- Live visitors
- Bounce rate
- Average engagement time
- Conversion rate, if based on user/session scope rather than event count
- Exit rate

Resolved decision:
Pulse will support anonymous sessionization because otherwise too many promised metrics become misleading or impossible. The privacy boundary is that sessionization stays first-party, anonymous, and rotation-limited.

## Reporting Requirements

The existing site implies the following MVP reporting surfaces.

### Workspace Overview

Must support:

- Date range selection
- Day, week, and month granularity
- Workspace-level totals
- Top projects
- Top pages
- Top referrers
- Device and browser breakdowns
- Recent event stream

### Project Overview

Must support:

- Project-level metrics
- Project-level top pages
- Project-level referrers
- Project-level event table
- Project-level country mix
- Project-specific range defaults

### Report Library

Must support:

- Executive weekly rollup
- Content performance report
- Acquisition sources report

### Docs Search

The current docs search is static content search. This does not require backend analytics support in Phase 1.

## Export Requirements

The product copy already implies export workflows. Phase 1 defines exports as follows.

### Required Export Capabilities

- Scheduled report delivery
- Manual export/download from reporting surfaces
- Ownership for each scheduled export
- Shared recipient list support
- Visibility into export delays or failures

### Export Governance Constraints

- Exports are explicit user actions or user-configured deliveries, not open background data replication
- Export ownership must be attributable to a workspace owner or editor
- Export permissions must be controlled inside the workspace, without requiring operator intervention

Resolved decision:
MVP exports should support both formats, but for different use cases: scheduled exports are PDF report summaries, while manual exports are CSV data extracts.

## Access Model

The settings pages and legal copy imply role-based access with least privilege. For a self-serve product, the model should stay simple.

### Workspace Roles

- Viewer: can view dashboards and reports
- Editor: can manage project settings, reports, and alert configuration
- Owner: can manage access, collection controls, exports, billing-facing settings, and retention choices

### Required Access Controls

- Report viewing permissions
- Export permissions
- Alert management permissions
- Collection settings permissions
- Membership and role management

### Authentication vs Authorization

The current app already integrates with Continental ID for authentication. Phase 1 must separately define:

- How a user becomes a workspace member
- How roles are assigned
- Whether workspace access is manual, invite-based, or domain-based

Resolved decisions:

- Roles are workspace-scoped only in MVP
- Workspace membership should be self-serve and invite-driven
- There is no dedicated support-staff role in the product model

## Retention Model

The project settings imply project-specific retention windows of 6, 12, and 13 months.

Phase 1 should define:

- Raw event retention
- Aggregated reporting retention
- Export artifact retention
- Deletion behavior for expired data
- Whether project-level overrides are allowed

Current interpretation from the site:

- Retention can vary by project
- Retention must be visible in settings
- Retention is a user-visible product setting, not an internal-only backend setting

Resolved decision:
Workspace owners may configure project retention within product-defined limits. The initial product-defined maximum is 13 months, matching the current mock settings. Editors may view retention but not change it.

## Alerting Requirements

The current site implies three initial alert classes:

- Traffic anomaly alerts
- Export delay alerts
- Consent mismatch or collection anomaly alerts

### Initial MVP Alert Rules

- Traffic drop by threshold on important pages or projects
- Export queue delay beyond a configured threshold
- Unexpected event volume shifts after consent configuration changes

### Minimum Alert Metadata

- Alert name
- Status
- Responsible workspace user
- Trigger condition
- Time opened
- Time resolved
- Resolution note

Resolved decision:
MVP alerts are in-app only.

## Project Model Derived From Current Site

The current product implies at least these project attributes:

- `slug`
- `name`
- `domain`
- `owner`
- `region`
- `status`
- `segment` or `label`
- `retention`
- `default reporting range`
- `primary market`
- `alert coverage`

Projects also appear to vary in:

- Allowed custom events
- Conversion definitions
- Reporting recipients
- Tracking strictness

## Non-Goals for Phase 1

The current site does not justify defining these yet:

- Revenue attribution modeling
- Multi-touch attribution
- User journey reconstruction beyond page/event reporting
- Identity graph behavior
- Warehouse sync contracts
- Mobile-native SDK support beyond what is implied by “apps”

These may be added later, but they should not block Phase 1.

## Resolved Phase 1 Decisions

The highest-impact decisions for implementation are now:

1. Pulse may use anonymous first-party identifiers only for short-lived measurement, not identity or profiling.
2. Anonymous sessionization is allowed and required for several dashboard metrics.
3. `page_view` may be collected pre-consent only in strict anonymous mode with minimal payload.
4. Consent is a single analytics consent state in MVP.
5. Roles are workspace-scoped only.
6. Scheduled exports use PDF summaries and manual exports use CSV extracts.
7. Alerts are in-app only in MVP.
8. Workspace owners may configure retention up to the product maximum of 13 months.

## Companion Specs

This foundation document is paired with:

- [docs/event-schema.md](/Users/charliearnerstal/Documents/GitHub/pulse/docs/event-schema.md:1)
- [docs/metric-definitions.md](/Users/charliearnerstal/Documents/GitHub/pulse/docs/metric-definitions.md:1)
- [docs/access-and-operations.md](/Users/charliearnerstal/Documents/GitHub/pulse/docs/access-and-operations.md:1)
- [docs/copy-rewrite-inventory.md](/Users/charliearnerstal/Documents/GitHub/pulse/docs/copy-rewrite-inventory.md:1)
