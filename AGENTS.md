# AGENTS.md — Pulse

## Project Summary

Pulse is a privacy-first analytics product for websites and web apps.

The main goal is simple:

**A user should be able to create a project, add one script to their site, and understand their traffic without confusion.**

Pulse is part of the Continental ecosystem, but it should work as a general product for other people too.

## Core Product Idea

Pulse should be:

* Easy to set up
* Easy to understand
* Privacy-first
* Self-serve
* Clean and polished
* Useful for small projects, indie builders, and small teams

Pulse should not feel like enterprise analytics software.

Avoid:

* Complicated setup flows
* Bloated dashboards
* Corporate support/team language
* Features that require manual operator work
* Invasive tracking
* User profiling
* Fingerprinting

## Product Model

The core product objects are:

* **Workspace** — account/team container
* **Project** — one website or app being tracked
* **Event** — something that happened, like a page view or button click
* **Report** — saved analytics view
* **Export** — downloaded or scheduled report/data
* **Alert** — in-app warning about traffic or collection issues

Keep this model simple.

## MVP User Flow

The most important flow is:

1. User creates a project
2. User copies a tracking script
3. User adds it to their site
4. Pulse starts collecting page views
5. User sees simple analytics in the dashboard

Everything else is secondary.

## SDK Scope

MVP browser SDK methods:

* `pulse.init(...)`
* `pulse.page(...)`
* `pulse.track(...)`

Do not build `pulse.identify(...)` for MVP.

Pulse should support:

* Normal websites
* SPAs with route changes
* Basic custom events

## Default Events

Initial global events:

* `page_view`
* `button_click`
* `form_submit`
* `file_download`
* `video_play`

Event names should use lowercase `snake_case`.

Example:

```ts
pulse.track("button_click", {
  button: "learn_more",
  location: "hero"
});
```

Avoid UI-code-style event names like:

```ts
pulse.track("HeroBlueButtonClicked");
```

## Privacy Rules

Pulse must stay privacy-first.

Allowed:

* Anonymous first-party session IDs
* Rotating anonymous visitor keys
* Country-level location
* Consent-aware collection

Not allowed:

* User identity tracking
* Fingerprinting
* Advertising IDs
* Cross-site tracking
* Long-term profiling
* Raw personal data in event properties

Do not collect emails, phone numbers, full names, addresses, payment info, or freeform form messages in analytics events.

## Consent Rules

Pulse uses one analytics consent state in MVP:

* `unknown`
* `denied`
* `granted`

Before consent, Pulse may only collect minimal anonymous `page_view` data if strict mode allows it.

If consent is denied, analytics collection should stop by default.

Keep consent behavior simple and easy to explain.

## Metrics

Pulse should clearly define and consistently calculate:

* Page views
* Unique visitors
* Live visitors
* Bounce rate
* Average engagement time
* Top pages
* Top referrers
* Device mix
* Browser mix
* Country mix
* Conversion rate
* Exit rate

Important: unique visitors are approximate because Pulse avoids long-term identity tracking.

Do not pretend the metrics are more exact than they are.

## Access Model

MVP roles are workspace-level only:

* **Viewer** — can view dashboards, reports, and alerts
* **Editor** — can manage projects, events, reports, alerts, and manual exports
* **Owner** — can manage members, roles, retention, scheduled exports, and billing-facing settings

Do not add project-level permissions unless explicitly requested.

## Exports and Alerts

MVP exports:

* Manual exports: CSV
* Scheduled exports: PDF summaries

MVP alerts:

* In-app only
* No email, Slack, Discord, or webhook alerts unless explicitly requested

Keep alerts simple. Prefer basic threshold rules over complex anomaly detection.

## Copywriting Rules

Pulse copy should sound simple, clear, and self-serve.

Prefer:

* “Create a project”
* “Install the script”
* “View your analytics”
* “Configure events”
* “Read the docs”
* “Check service status”

Avoid:

* “Support desk”
* “Governance team”
* “Platform operations”
* “Implementation review”
* “Quarterly architecture review”
* “Training on demand”
* “Escalation routing”

Pulse is mostly solo-operated, so do not write copy that implies a staffed support or consulting team.

## UI Principles

Pulse should feel:

* Fast
* Calm
* Clean
* Trustworthy
* Easy
* Modern

A new user should not need to understand analytics theory to use the product.

Prefer simple dashboards over advanced clutter.

## Development Rules

When working on Pulse:

* Keep changes focused
* Do not rewrite unrelated code
* Do not add large dependencies without a good reason
* Do not add fake UI for backend features that do not exist
* Keep privacy rules in mind when touching events, tracking, metrics, or exports
* Keep terminology consistent
* Prefer reliability over more features

## Build Priority

Build the core loop first:

1. Create project
2. Install script
3. Collect `page_view`
4. Validate events
5. Show dashboard
6. Add custom events
7. Add basic sessions
8. Add exports
9. Add roles
10. Add alerts

Do not overbuild before the basic tracking loop works.

## Non-Goals For MVP

Do not build unless explicitly requested:

* User profiles
* Identity graph
* Revenue attribution
* Multi-touch attribution
* Warehouse sync
* Mobile-native SDK
* Managed onboarding
* Operator review queues
* Enterprise support features
* Complex billing
* Advanced alert integrations

## Main Rule

When in doubt, choose the option that makes Pulse:

1. Easier to use
2. Easier to understand
3. More privacy-friendly
4. More reliable
5. Simpler to maintain
