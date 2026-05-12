# Admin Dashboard Control Center

## Goal

Build a universal SaaS-style control center for the owner/administrator of `aikompute.com` and the customer portal. This dashboard should be the single operational surface for:

- user account management
- usage and revenue visibility
- billing and plan administration
- platform health and routing oversight
- auditability and support workflows

## Design Direction

The dashboard should feel like an operator console rather than a marketing site.

Visual priorities:

- dense but readable information hierarchy
- strong top-level KPI strip
- clear status badges and alerts
- fast access to customer actions
- high contrast, polished, and product-operator focused

The layout should avoid generic SaaS sameness. It should feel like a central command surface for the website owner.

## Recommended Universal Sections

- Overview
- Accounts
- Billing
- Usage
- Models
- Routing
- Operations
- Audit Log
- Support
- Settings

## Key Data To Populate

- total users
- active users
- verified users
- paid users
- revenue / MRR / ARR
- requests
- tokens
- estimated cost
- plan distribution
- top accounts
- top models
- failed requests
- alert count
- provider health
- routing/failover activity
- recent admin actions

## Common SaaS Features To Include

- global search
- saved filters / saved views
- bulk actions
- CSV export
- user detail drawer
- account notes
- audit log
- support shortcuts
- admin impersonation
- feature flags
- alert center
- health/status banner
- role-based staff access
- empty states and loading states
- date range selector

## Current Implementation Notes

Existing admin surfaces already in the customer portal:

- `/admin`
- `/admin/analytics`
- `/admin/forecast`
- `/admin/models`

The current dashboard work should expand these into one unified control center rather than separate feature pages.

## Phased Build Plan

### Phase 1: Foundation

- finish the overview landing page
- normalize the admin nav
- establish shared dashboard components
- keep auth gating consistent

### Phase 2: Customer Accounts

- searchable user table
- filters and sorting
- detail drawer
- lock / unlock
- plan changes
- key management actions

### Phase 3: Billing

- revenue summary
- plans and subscriptions
- failed payments
- refunds / credits
- billing status views

### Phase 4: Usage and Analytics

- customer usage trends
- global platform usage
- top users
- top models
- cost analysis

### Phase 5: Operations and Risk

- provider health
- routing health
- failover visibility
- platform alerts
- audit history

### Phase 6: Polish

- bulk actions
- exports
- responsive behavior
- reusable table and drawer components
- clear empty/loading states

## Work Log

### 2026-05-05

- Defined the dashboard as a universal owner control center.
- Identified nav structure, homepage wireframe, and phased build plan.
- Noted this file should be updated as work continues so the dashboard can be resumed later without re-discovery.

### 2026-05-05 - Implementation Pass 1

- Added the admin overview landing page as the new control-center home.
- Added canonical admin routes for Accounts, Plans, and Activity.
- Expanded the admin nav to surface the control-center sections.
- Created plans and activity pages to give the owner immediate operational visibility.

### 2026-05-05 - Implementation Pass 2

- Normalized the new admin pages to avoid effect-driven refetching.
- Removed `any` usage from the new admin pages so the focused lint pass is clean.
- Verified the new admin pages and layout lint successfully.

### 2026-05-05 - Implementation Pass 3

- Built a dedicated accounts control surface with a live user drawer, account notes, plan changes, lock/unlock actions, key revocation, and soft-delete support.
- Replaced the temporary activity feed with a real audit-log table backed by the database and an `/api/admin/audit-logs` endpoint.
- Added account/event logging for user signup and API-key create/revoke flows so the audit trail is populated by real platform activity.
- Normalized `/admin/analytics` into a redirect to the canonical accounts page so the dashboard has a single working entry point.
- Updated the Prisma schema and migration set for locked accounts, internal notes, and audit logs.
- Verified the touched admin slice with both `eslint` and `tsc --noEmit`.

### 2026-05-05 - Implementation Pass 4

- Added a billing operations page and `/api/admin/billing` endpoint for revenue, invoice-equivalent payments, customer billing snapshots, and past-due visibility.
- Added support workflows to the account drawer for impersonation, verification resend, and password-reset sends, plus the impersonation exit flow in the customer dashboard.
- Added a dedicated support center page and expanded the audit log to label support actions explicitly.
- Added bulk account selection, bulk lock/unlock, bulk key revocation, bulk plan changes, and saved account views in the customer accounts dashboard.
- Expanded the admin nav and overview shortcuts to surface Billing and Support as first-class control-center sections.
- Verified the touched dashboard slice with `eslint` and `tsc --noEmit`.

### 2026-05-05 - Implementation Pass 5

- Added persisted billing adjustments for manual credits and refunds, plus an invoice drill-down drawer and CSV export on the billing page.
- Added a persisted support ticket queue with create/update actions and a dedicated escalation workflow in the support center.
- Added CSV export for the filtered or selected customer account set on the accounts page.
- Extended audit logging and support labels to recognize billing adjustments and support ticket events.
- Re-verified the touched billing/support/accounts slice with `eslint` and `tsc --noEmit`.

### 2026-05-06 - Implementation Pass 6

- Connected billing adjustments to Stripe webhook events so successful checkouts and subscription terminations are captured in the adjustment history.
- Added support-ticket ownership and internal notes, including editable ticket detail actions from the support drawer.
- Added account CSV import alongside export, with email-based upserts and audit logging.
- Added scheduled report definitions with create/update/delete/run-now controls and surfaced them in the admin shell.
- Re-verified the touched admin slice with `eslint` and `tsc --noEmit`.

### 2026-05-06 - Implementation Pass 7

- Added a shared HTML email helper so the admin reporting stack can send formatted operator emails without duplicating Resend setup.
- Built scheduled report delivery content generation for accounts, billing, usage, and support snapshots using live platform data.
- Added a cron-safe delivery endpoint at `/api/admin/scheduled-reports/deliver` and wired report `Run` actions to actually send mail before advancing the schedule.
- Extended the audit log to track delivered and failed scheduled report runs.
- Added a manual `Deliver Due` control in the reports page so the owner can trigger the queue from the dashboard for testing or ad hoc delivery.
- Re-verified the touched reporting/admin slice with targeted `eslint` and `tsc --noEmit`.

### 2026-05-06 - Implementation Pass 8

- Added delivery history to the scheduled reports API by surfacing recent `report.sent` and `report.delivery_failed` audit events.
- Added a delivery-history panel and per-row last-delivery badges to the admin reports page so report health is visible without opening the audit log.
- Kept the scheduled report run flow intact while making delivery state more observable from the dashboard.
- Re-verified the touched reporting slice with targeted `eslint` and `tsc --noEmit`.

### 2026-05-06 - Implementation Pass 9

- Added a standalone scheduled-report worker script under `customer-portal/scripts/` that polls the delivery endpoint on a loop.
- Wired the worker into `docker-compose.unified.yml` as a dedicated `report-deliverer` service so report delivery can run automatically in the unified stack.
- Exposed the shared admin secret explicitly to the portal and worker services so report delivery and admin actions use the same credential path.
- Updated the deployment guide to mention the report-deliverer worker.
- Verified the touched slice with targeted `eslint`, `node --check`, `docker compose config --quiet`, and the existing `tsc --noEmit` pass for the portal code.

### 2026-05-06 - Implementation Pass 10

- Added a persisted global delivery toggle for scheduled reports using a lightweight `admin_settings` record.
- Added `/api/admin/scheduled-reports/config` so the dashboard can pause or resume automated report delivery without touching compose.
- Updated the worker and delivery endpoint so the pause state only affects automated runs, while manual report sends from the dashboard still work.
- Surfaced the pause/resume state in the reports page and added audit labels for delivery pause/resume events.
- Re-verified the touched reporting/admin slice with targeted `eslint`, `tsc --noEmit`, and the worker script syntax check.

### 2026-05-07 - Implementation Pass 11

- Added a compact delivery metrics strip to the reports page with automation status, due-report count, and the latest success/failure timestamps.
- Kept the metrics computed from the existing report and delivery-history payload so the page stays fast and self-contained.
- Re-verified the touched reporting slice with targeted `eslint` and `tsc --noEmit`.

### 2026-05-07 - Implementation Pass 12

- Added live usage and cost trend panels to the admin overview so the owner can see recent platform activity without leaving the control center.
- Surfaced the latest two weeks of request and spend activity alongside peak-day, rolling request, and rolling cost summaries.
- Kept the overview driven by the existing admin analytics payload so the new panels reuse the same data source as the rest of the dashboard.
- Re-verified the touched overview slice with targeted `eslint` and `tsc --noEmit`.

### 2026-05-07 - Implementation Pass 13

- Added a dedicated operations page at `/admin/operations` that pulls live OmniRoute health and provider metrics into the customer portal.
- Added a portal admin API that proxies OmniRoute monitoring health and provider metrics, plus a breaker reset action.
- Wired the operations section into the admin nav and overview shortcuts so it becomes part of the primary owner workflow.
- Re-verified the touched operations/admin slice with targeted `eslint` and `tsc --noEmit`.

### 2026-05-07 - Implementation Pass 14

- Expanded the operations page with an alert center that surfaces OmniRoute degradation state, degraded feature levels, lockouts, rate limiters, and quota pressure in one view.
- Converted the model registry page into a live model intelligence surface with admin authentication, range-based usage refresh, estimated cost allocation, request-share ranking, and registry/editor controls.
- Kept the public catalog preview and registry edit controls intact while making `/admin/models` useful as an owner-facing economics drill-down.
- Re-verified the touched model/operations slice with targeted `eslint` and `tsc --noEmit`.

### 2026-05-07 - Implementation Pass 15

- Added a dedicated `/admin/usage` page for platform-wide requests, tokens, estimated spend, top accounts, model mix, and plan distribution.
- Wired the usage section into the admin nav and overview shortcuts so usage analysis is a first-class part of the universal control center.
- Reused the existing admin analytics payload so the new usage surface stays aligned with the rest of the dashboard’s source of truth.
- Re-verified the touched usage/admin slice with targeted `eslint` and `tsc --noEmit`.

### 2026-05-07 - Implementation Pass 16

- Added a dedicated `/admin/settings` page that uses the shared `admin_settings` store for maintenance mode, support contact details, announcement banners, and scheduled report delivery controls.
- Wired the settings section into the admin nav and overview shortcuts so the universal control center now exposes the owner/operator settings surface directly.
- Added an admin settings API that persists sitewide configuration through the existing settings table and records audit events for control changes.
- Re-verified the touched settings/admin slice with targeted `eslint` and `tsc --noEmit`.

### 2026-05-07 - Implementation Pass 17

- Added a dedicated `/admin/routing` page focused on provider health, breakers, rate limiters, learned limits, lockouts, and hot sessions.
- Wired routing into the admin nav and overview shortcuts so the control center now exposes a focused failover/routing drill-down in addition to the broader operations panel.
- Kept the routing page fed by the existing OmniRoute health payload so it stays aligned with the rest of the platform’s live routing signals.
- Re-verified the touched routing/admin slice with targeted `eslint` and `tsc --noEmit`.

### 2026-05-07 - Implementation Pass 18

- Added an isolated preview stack using `docker-compose.preview.yml` plus `preview.ps1` so the dashboard can be browsed in a staging-like environment without disturbing the main runtime.
- Assigned separate preview ports and preview volumes for PostgreSQL, Redis, OmniRoute, and the customer portal so the preview can run alongside the primary compose stack.
- Documented the preview workflow in the production deployment guide with concrete browser URLs and stop/start commands.
- Verified the merged preview compose configuration with `docker compose config --quiet`.
