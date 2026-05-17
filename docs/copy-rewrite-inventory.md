# Pulse Copy Rewrite Inventory

This document lists current product copy that conflicts with the intended Pulse operating model: self-serve product, solo operator, reactive service help only.

Use this as a later rewrite pass checklist. It does not change product behavior by itself.

## Rewrite Principles

Prefer:

- Self-serve setup
- Documentation
- In-app configuration
- In-app alerts
- Service status
- Contact for service issues

Avoid:

- Dedicated support desk language
- Governance-team language
- Platform-operations language
- Office-hours or training promises
- Review or consulting promises

## High-Priority Pages

### Support Page

Current issue:

- The entire `/support` page is framed like a staffed service organization

Primary references:

- [src/data/content.ts](/Users/charliearnerstal/Documents/GitHub/pulse/src/data/content.ts:113)

Rewrite direction:

- Replace with `Help`, `Docs`, or `Service Help`
- Frame it as self-serve docs first, contact only for service problems
- Remove implementation desk, operational support, and governance review positioning

### Settings And Docs CTAs

Current issue:

- Multiple pages route users toward human support for ordinary setup work

References:

- [src/pages/SettingsPage.tsx](/Users/charliearnerstal/Documents/GitHub/pulse/src/pages/SettingsPage.tsx:12)
- [src/pages/EventsPage.tsx](/Users/charliearnerstal/Documents/GitHub/pulse/src/pages/EventsPage.tsx:24)
- [src/pages/ReportDetailPage.tsx](/Users/charliearnerstal/Documents/GitHub/pulse/src/pages/ReportDetailPage.tsx:46)
- [src/pages/ProjectSectionPage.tsx](/Users/charliearnerstal/Documents/GitHub/pulse/src/pages/ProjectSectionPage.tsx:41)
- [src/pages/ProjectSectionPage.tsx](/Users/charliearnerstal/Documents/GitHub/pulse/src/pages/ProjectSectionPage.tsx:128)
- [src/pages/DocsPage.tsx](/Users/charliearnerstal/Documents/GitHub/pulse/src/pages/DocsPage.tsx:244)
- [src/pages/DocsPage.tsx](/Users/charliearnerstal/Documents/GitHub/pulse/src/pages/DocsPage.tsx:430)
- [src/pages/DocsPage.tsx](/Users/charliearnerstal/Documents/GitHub/pulse/src/pages/DocsPage.tsx:475)
- [src/pages/DocsSearchPage.tsx](/Users/charliearnerstal/Documents/GitHub/pulse/src/pages/DocsSearchPage.tsx:128)
- [src/pages/AlertsPage.tsx](/Users/charliearnerstal/Documents/GitHub/pulse/src/pages/AlertsPage.tsx:43)

Rewrite direction:

- Change `Support`, `Ask Support`, `Governance Help`, and `Escalation path` to `Docs`, `Help`, `Troubleshooting`, `Service status`, or `Contact`
- Reserve contact language for service issues, not setup coaching

## Content Areas To Reframe

### Staffed Support Language

References:

- [src/data/content.ts](/Users/charliearnerstal/Documents/GitHub/pulse/src/data/content.ts:113)
- [src/data/content.ts](/Users/charliearnerstal/Documents/GitHub/pulse/src/data/content.ts:161)
- [src/pages/StaticPage.tsx](/Users/charliearnerstal/Documents/GitHub/pulse/src/pages/StaticPage.tsx:33)

Rewrite direction:

- Position docs as the primary path
- Mention contacting Pulse only for product malfunction or account issues

### Governance / Platform Team Language

References:

- [src/data/content.ts](/Users/charliearnerstal/Documents/GitHub/pulse/src/data/content.ts:845)
- [src/data/content.ts](/Users/charliearnerstal/Documents/GitHub/pulse/src/data/content.ts:851)
- [src/data/content.ts](/Users/charliearnerstal/Documents/GitHub/pulse/src/data/content.ts:883)
- [src/data/content.ts](/Users/charliearnerstal/Documents/GitHub/pulse/src/data/content.ts:886)
- [src/pages/SettingsPage.tsx](/Users/charliearnerstal/Documents/GitHub/pulse/src/pages/SettingsPage.tsx:21)

Rewrite direction:

- Replace internal-function labels with product settings terminology
- Replace `Platform Operations` and `Governance` ownership labels with workspace-owner language or system labels

### Training / Review / Managed-Service Language

References:

- [src/data/content.ts](/Users/charliearnerstal/Documents/GitHub/pulse/src/data/content.ts:106)
- [src/data/content.ts](/Users/charliearnerstal/Documents/GitHub/pulse/src/data/content.ts:939)

Rewrite direction:

- Remove phrases that imply advisory services, regular review cadences, or managed reporting help

## Data Model Labels To Rename

### `team`

Current issue:

- The mock project model still exposes a `team` field, which reads like an internal organizational dependency

References:

- [src/data/content.ts](/Users/charliearnerstal/Documents/GitHub/pulse/src/data/content.ts:418)
- [src/data/content.ts](/Users/charliearnerstal/Documents/GitHub/pulse/src/data/content.ts:433)
- [src/data/content.ts](/Users/charliearnerstal/Documents/GitHub/pulse/src/data/content.ts:446)
- [src/data/content.ts](/Users/charliearnerstal/Documents/GitHub/pulse/src/data/content.ts:459)
- [src/data/content.ts](/Users/charliearnerstal/Documents/GitHub/pulse/src/data/content.ts:472)
- [src/pages/ProjectsPage.tsx](/Users/charliearnerstal/Documents/GitHub/pulse/src/pages/ProjectsPage.tsx:36)

Rewrite direction:

- Rename to `owner`, `project owner`, `workspace`, `segment`, or `label` depending on intended meaning

### Alert Owners

Current issue:

- Alert ownership is currently assigned to internal-looking functions

References:

- [src/data/content.ts](/Users/charliearnerstal/Documents/GitHub/pulse/src/data/content.ts:839)
- [src/data/content.ts](/Users/charliearnerstal/Documents/GitHub/pulse/src/data/content.ts:845)
- [src/data/content.ts](/Users/charliearnerstal/Documents/GitHub/pulse/src/data/content.ts:851)

Rewrite direction:

- Use workspace user ownership, project ownership, or system-generated ownership labels

## Copy That Already Aligns Reasonably Well

These areas are mostly compatible with the new direction:

- Privacy-first positioning
- Docs-led installation
- In-app alerts as a product feature
- Service status as a product surface
- Workspace/project/report structure

## Recommended Order For Later Copy Pass

1. Replace the `/support` page and all support CTAs.
2. Rename `team` and internal-owner labels in mock data and project cards.
3. Rewrite settings and alerts copy to remove governance-team language.
4. Rewrite status and legal/support-adjacent copy to avoid implying a staffed organization.
