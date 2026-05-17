# Pulse Access And Operations

This document defines the MVP access model and operating model for Pulse as a self-serve product.

## Product Posture

Pulse is software users operate themselves. It is not an analytics agency, managed onboarding service, or ongoing reporting service.

### What Users Can Expect

- A working hosted product
- Self-serve setup documentation
- In-app configuration
- In-app alerts
- Export and reporting features

### What Users Should Not Expect

- Hands-on implementation help as a standard service
- Custom event taxonomy design by the operator
- Manual dashboard QA by the operator
- Ongoing report interpretation or analytics consulting
- A staffed support desk

### Operator Responsibilities

The operator is responsible for:

- Keeping the service available
- Fixing product bugs
- Handling serious account-access issues
- Handling billing or subscription issues
- Responding to service-level incidents

The operator is not responsible for:

- Deciding what a customer should track
- Validating a customer's event plan
- Interpreting business performance for the customer

## Workspace Model

The workspace is the primary account boundary in MVP.

Rules:

- Roles are workspace-scoped only
- Project-level permissions are not supported in MVP
- A user can belong to multiple workspaces
- Every workspace must have at least one owner

## Roles

### Viewer

Can:

- View dashboards
- View project pages
- View reports
- View alerts

Cannot:

- Change settings
- Configure exports
- Edit alert rules
- Invite users

### Editor

Can:

- Do everything a viewer can do
- Manage project settings
- Configure event allowlists
- Create and manage reports
- Create and manage alert rules
- Trigger manual exports

Cannot:

- Invite users
- Change retention settings
- Transfer ownership

### Owner

Can:

- Do everything an editor can do
- Invite and remove users
- Change workspace roles
- Configure retention within product limits
- Configure scheduled exports
- Manage subscription-facing settings

## Membership Model

MVP membership should be simple and self-serve.

Rules:

- Membership is invite-based
- Invites are sent by workspace owners
- No operator approval is required for ordinary workspace access
- Domain-based auto-join is out of scope for MVP

## Authentication

The current mock app uses Continental ID, but the product model should treat authentication as an interchangeable identity provider layer.

Requirements:

- Authentication must prove user identity to the product
- Authorization must be enforced by workspace role
- Product behavior must not depend on a staffed internal admin team

## Retention Controls

Retention is user-visible and user-configurable within product-defined limits.

MVP rules:

- Default retention: 13 months
- Allowed project retention options: 6 months, 12 months, 13 months
- Only owners can change retention
- Editors and viewers can see the active retention setting

## Exports

MVP exports are self-serve.

### Manual Exports

- Format: CSV
- Initiated by editors or owners
- Scope: report or filtered dataset visible in the UI

### Scheduled Exports

- Format: PDF summary
- Created and managed by owners
- Delivered to configured recipients

### Export Safeguards

- Every scheduled export has an owner
- Export failures surface in-app
- Export delays can raise in-app alerts

## Alerts

Alerts are in-app only in MVP.

Rules:

- No email delivery
- No Slack delivery
- Alert rules belong to the workspace
- Editors and owners may manage alert rules
- Viewers may read active and historical alerts

## Documentation And Onboarding

Because Pulse is self-serve, documentation is part of the product, not an optional extra.

MVP expectations:

- Installation instructions must be enough for an independent user to get started
- Event naming guidance must be explicit
- Consent behavior must be documented clearly
- Metric limitations must be explained in plain language

## Copy Rewrite Guidance

The current mock site contains wording that implies a staffed platform organization. Production copy should remove or rewrite phrases such as:

- Support desk
- Governance help
- Office hours
- Escalation routing
- Platform operations
- Quarterly architecture reviews
- Implementation desk
- Training on demand

Preferred framing:

- Self-serve setup
- Documentation
- In-app guidance
- Product settings
- Service status
- Contact for service issues

## MVP Operational Boundaries

Pulse should aim to be low-touch to operate.

That means:

- No required manual workspace provisioning for normal users
- No required manual event review before launch
- No required manual report generation
- No required operator action for ordinary alerting
- No required operator action for normal exports

If a feature requires regular human intervention from the operator, it should be treated as a poor fit for MVP.
