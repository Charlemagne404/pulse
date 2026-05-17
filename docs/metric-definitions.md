# Pulse Metric Definitions

This document defines the MVP metric contract for Pulse using the anonymous session model in [docs/event-schema.md](/Users/charliearnerstal/Documents/GitHub/pulse/docs/event-schema.md:1).

## Principles

- Metrics should be understandable by self-serve users
- Privacy takes priority over perfect identity continuity
- Definitions must be stable across the UI, reports, alerts, and exports
- Metrics must degrade safely when consent blocks full measurement

## Measurement Limits

Because Pulse avoids long-lived identity:

- Unique visitor counts are approximate
- Cross-device person-level deduplication is not supported
- Denied-consent traffic may be absent from several metrics
- Pre-consent strict-mode traffic may count toward page views without contributing to session-based metrics

These limits should be documented in the product UI.

## Core Metrics

### Page Views

Definition:

- Count of accepted `page_view` events in the selected time range

Notes:

- Includes strict-mode anonymous `page_view` events when allowed
- Deduplication is not applied

### Unique Visitors

Definition:

- Count of distinct anonymous `visitorKey` values in the selected time range

Notes:

- Only includes traffic where `visitorKey` exists
- Approximate by design because `visitorKey` rotates
- Not a person-level count

### Live Visitors

Definition:

- Count of distinct `sessionId` values with at least one accepted event in the trailing 5-minute window

Notes:

- Only available for granted-consent standard collection
- Represents active anonymous sessions, not authenticated users

### Bounce Rate

Definition:

- Percentage of sessions with exactly one accepted `page_view` and no additional accepted engagement or conversion event

Formula:

```text
bounce_rate = bounced_sessions / total_sessions
```

Notes:

- Based on `sessionId`
- Strict-mode pre-consent events without session continuity are excluded

### Average Engagement Time

Definition:

- Average engaged time per session, where engaged time is the sum of measured active intervals capped by inactivity rules

MVP rule:

- Count time deltas between accepted events within the same session up to a max of 30 minutes between adjacent events
- Ignore longer gaps

Notes:

- This is an anonymous session metric, not a person-level dwell-time metric

## Content Metrics

### Top Pages

Definition:

- Pages ranked by `page_view` count

Primary grouping key:

- Normalized `page.path`

### Exit Rate

Definition:

- Percentage of sessions in which a page was the last recorded page before session end

Formula:

```text
exit_rate(page) = sessions_ending_on_page / sessions_including_page
```

Notes:

- Computed only from sessions with `sessionId`
- Pages seen only in strict pre-consent mode may appear in page views but not in exit-rate calculations

### File Downloads

Definition:

- Count of accepted `file_download` events

## Acquisition Metrics

### Top Referrers

Definition:

- Sources ranked by accepted visit volume

Primary grouping rules:

- External referrer hostname
- `direct / none` when no usable referrer exists

Notes:

- Attribution is last-touch at visit entry for MVP

### Owned Share

Definition:

- Percentage of visits whose entry referrer belongs to a configured owned-source allowlist

## Device and Platform Metrics

### Device Mix

Definition:

- Share of accepted traffic grouped by normalized `deviceType`

### Browser Mix

Definition:

- Share of accepted traffic grouped by normalized `browserName`

### Country Mix

Definition:

- Share of accepted traffic grouped by derived `countryCode`

## Conversion Metrics

### Conversion Event Count

Definition:

- Count of accepted events marked as conversion events in the project's tracking plan

### Conversion Rate

Definition:

- Percentage of eligible sessions containing at least one target conversion event

Formula:

```text
conversion_rate = sessions_with_conversion / eligible_sessions
```

Notes:

- Eligible sessions are sessions that entered the scoped journey or project during the selected time range
- If a project wants event-based conversion rate instead, that must be labeled separately

## Report-Level Metrics

### Tracked Pages

Definition:

- Count of distinct normalized page paths with at least one accepted `page_view`

### Top Landing Pages

Definition:

- Pages that were the first page in a session, ranked by number of sessions started

### Search-Led Visits

Definition:

- Visits whose entry referrer is a recognized search engine

## Alert Metrics

These are the MVP alertable measures implied by the current product.

### Traffic Drop

Definition:

- Percentage decrease in a selected metric relative to its comparison window

MVP comparison baseline:

- Previous day for daily alerts
- Previous equivalent interval for other alert rules

### Export Delay

Definition:

- Difference between expected export completion time and actual completion time

### Consent Mismatch

Definition:

- Unexpected event-volume change after a consent configuration change compared to recent baseline behavior

## UI and Reporting Consistency Rules

- The same metric name must always use the same formula
- Approximate metrics should be labeled as approximate where relevant
- Session-based metrics should not silently include strict-mode pre-consent traffic
- Exported numbers must match the UI for the same query

## Recommended User-Facing Disclosures

The product should explain:

- Pulse uses anonymous first-party measurement only
- Unique visitors are approximate
- Some metrics require granted analytics consent
- Pulse does not support person-level cross-device attribution
