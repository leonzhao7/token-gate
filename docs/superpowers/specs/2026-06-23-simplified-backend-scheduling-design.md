# Token Gate Simplified Backend Scheduling Design

Date: 2026-06-23

## Overview

This spec replaces Token Gate's current policy-based scheduler with a simpler backend-first scheduler.

The new model is:

- Match the request against backend endpoint/model capability
- Only consider backends in `normal` status
- Sort candidates by `weight` descending
- Try them in order until one upstream returns `2xx`
- Persist backend failure state in SQLite
- Automatically quarantine repeatedly failing backends as `abnormal`
- Allow administrators to manually disable a backend with `disabled`

This change also removes the legacy routing concepts completely:

- Delete `model_policies`
- Delete `client_keys.route_mode_override`
- Delete `client_keys.route_group`
- Delete `backends.pool`

This removal applies to:

- Go domain types
- SQLite schema
- store layer
- scheduler logic
- admin HTTP API
- embedded admin frontend
- tests

## Goals

- Make backend scheduling deterministic and simple
- Persist backend runtime state across process restarts
- Expose backend runtime state as first-class admin data
- Return `503 Service Unavailable` when there is no usable upstream
- Remove obsolete routing abstractions instead of leaving them dead in code

## Non-Goals

- No compatibility migration for existing SQLite files
- No background health-check loop
- No active-request load balancing
- No retention of old policy, route-group, route-mode, or pool API contracts
- No cross-vendor protocol conversion beyond what the proxy already supports

## Existing State Summary

Current code has these characteristics:

- `internal/scheduler` selects backends through `model_policies`, `placement_policy`, `backend_pool`, and client route overrides
- `ClientKey` stores `route_mode_override` and `route_group`
- `Backend` stores `pool` and `enabled`
- `UsageLog` stores route and policy fields
- Admin UI exposes a full `Model Policies` page and related dashboard/search/detail concepts
- Backend cooldown state currently lives in scheduler memory, not SQLite

The new design removes all of those routing abstractions and moves backend failure state into the `backends` table.

## Operational Constraint

The implementation will update schema creation code directly and will not include compatibility migration logic.

Accepted operational consequence:

- Existing old SQLite files are not expected to remain usable
- After implementation, local development/runtime testing must use a freshly created database file

This matches the accepted requirement: code can drop old schema support; the local SQLite file will be deleted manually after development is complete.

## Target Data Model

### Backend Status

`backends` becomes the source of truth for both administrative availability and runtime quarantine state.

New backend status enum:

- `normal`
  - backend is eligible for scheduling
- `abnormal`
  - backend has failed repeatedly and is temporarily quarantined
- `disabled`
  - backend is manually disabled by an administrator and is never scheduled

### Backend Runtime Fields

Add these fields to `backends`:

- `status TEXT NOT NULL`
- `consecutive_failures INTEGER NOT NULL DEFAULT 0`
- `recover_at TEXT NOT NULL DEFAULT ''`

Semantics:

- `status='normal'`
  - backend may be scheduled
- `status='abnormal'`
  - backend is not scheduled
  - it becomes schedulable again once `recover_at <= now`
- `status='disabled'`
  - backend is not scheduled
  - it only becomes schedulable again when an admin changes it back to `normal`
- `consecutive_failures`
  - persisted failure streak used for thresholding
- `recover_at`
  - UTC timestamp string for automatic recovery
  - empty string means no pending recovery timer

### Backend Creation and Manual Status Updates

- New backend default:
  - `status = normal`
  - `consecutive_failures = 0`
  - `recover_at = ''`
- Backend create API does not accept `status`
- Backend update API accepts only admin-controlled statuses:
  - `normal`
  - `disabled`
- Backend update API rejects `abnormal` as a user-supplied value

When an admin manually sets a backend to `normal` or `disabled`:

- clear `consecutive_failures`
- clear `recover_at`

This prevents stale runtime failure state from leaking across manual administrative changes.

## Schema Changes

### `backends`

Remove:

- `pool`
- `enabled`

Add:

- `status`
- `consecutive_failures`
- `recover_at`

Keep:

- `name`
- `protocol`
- `base_url`
- `api_key`
- `proxy_id`
- `weight`
- `model_list`
- `model_mapping`
- `endpoint_list`
- timestamps

### `client_keys`

Remove:

- `route_mode_override`
- `route_group`

Keep:

- `name`
- `token_hash`
- `token`
- `token_prefix`
- `enabled`
- timestamps

### `model_policies`

Delete the table entirely.

### `usage_logs`

Remove columns tied to deleted routing concepts:

- `route_mode_override`
- `route_group`
- `policy_id`
- `policy_name`

Keep the rest of the request/response and backend-attempt observability fields.

### Other Tables

No routing-related change is required for:

- `socks_proxies`
- `audit_events`

## Domain Model Changes

### `internal/domain/types.go`

Remove:

- `PlacementSticky`
- `PlacementPack`
- `PlacementSpread`
- `ModelPolicy`
- `ClientKey.RouteModeOverride`
- `ClientKey.RouteGroup`
- `Backend.Pool`
- `Backend.Enabled`
- `UsageLog.RouteModeOverride`
- `UsageLog.RouteGroup`
- `UsageLog.PolicyID`
- `UsageLog.PolicyName`

Add backend status constants:

- `BackendStatusNormal`
- `BackendStatusAbnormal`
- `BackendStatusDisabled`

Add `Backend` fields:

- `Status string`
- `ConsecutiveFailures int`
- `RecoverAt *time.Time`

`UsageLog` keeps backend identity and attempt/result fields, but no longer records removed routing concepts.

## Scheduling Design

### Selection Rules

For each public proxy request:

1. Extract endpoint from path
2. Extract model from request JSON
3. Refresh expired abnormal backends
4. Load backend list
5. Keep only backends where:
   - `status == normal`
   - backend supports the request endpoint
   - backend supports the client-requested model through `Models` or `ModelMapping`
6. Sort by:
   - `weight DESC`
   - `id ASC`
7. Try backends in that order until success

This keeps endpoint capability checks even though the user phrased the rule as “according to client model”, because the proxy still supports multiple endpoint families and must not route a request to a backend that lacks the current endpoint.

### Success and Failure Definition

Agreed success rule:

- success only when upstream returns `2xx`

Failure cases:

- network failure
- dial failure
- timeout
- request write/read failure
- upstream returns any non-`2xx` status

### Request Attempt Loop

For each candidate backend:

- rewrite request `model` if `ModelMapping` defines a client-model -> upstream-model override
- send request upstream
- if upstream returns `2xx`
  - reset backend runtime state
  - ensure backend status is `normal`
  - proxy response to client
  - stop
- otherwise
  - persist backend failure
  - try the next candidate

If there are no `normal` candidates or all candidates fail:

- return `503 Service Unavailable`

The proxy no longer exposes the last upstream non-`2xx` directly to the client as success/failover metadata. The public failure contract becomes a simple `503` when no usable backend succeeds.

### Automatic Quarantine

Config inputs remain environment-driven:

- `TG_BACKEND_FAILS`
- `TG_BACKEND_COOLDOWN`

Behavior:

- on each backend failure:
  - increment `consecutive_failures`
- when `consecutive_failures >= TG_BACKEND_FAILS`:
  - set `status = abnormal`
  - set `recover_at = now + TG_BACKEND_COOLDOWN`

Once `status = abnormal`, the backend is excluded from scheduling.

### Automatic Recovery

No background worker is introduced.

Recovery is lazy:

- before scheduling and before backend admin reads that need current truth
- if `status = abnormal` and `recover_at <= now`
- set:
  - `status = normal`
  - `consecutive_failures = 0`
  - `recover_at = ''`

This keeps the system simple and preserves the project constraint that Token Gate does not actively probe upstream health in the background.

## Scheduler Package Refactor

`internal/scheduler` stays, but its role narrows substantially.

### Remove From Scheduler

- in-memory rendezvous scoring
- placement policy logic
- route-key generation
- client route-group handling
- policy selection
- backend pool filtering
- active-request bias
- in-memory cooldown ownership as the source of truth

### Keep In Scheduler

- endpoint/model backend capability matching helpers
- ordered candidate selection
- failure/success state transitions
- lazy abnormal recovery orchestration

### Internal State Strategy

The scheduler will no longer own a runtime `states map[int64]*runtimeState`.

Preferred new shape:

- scheduler becomes effectively stateless except for config and store dependency
- persisted backend fields are the source of truth

This removes the mismatch where backend health survives only until process restart.

## Store Layer Design

### Schema Setup

`store.Open` will create only the new schema.

No compatibility fallback is required for old local databases.

### Backend CRUD

`CreateBackend`:

- no `pool`
- no `enabled`
- sets:
  - `status = normal`
  - `consecutive_failures = 0`
  - `recover_at = ''`

`UpdateBackend`:

- accepts admin-editable status `normal|disabled`
- rejects invalid statuses and `abnormal`
- clears runtime failure state on manual status change

`scanBackend` helpers must decode:

- `status`
- `consecutive_failures`
- `recover_at`

### Runtime State Methods

Add explicit store helpers for runtime transitions instead of overloading generic update paths.

Required helpers:

- refresh expired abnormal backends
- mark backend success
- mark backend failure

Behavioral requirements:

- success clears failure counters and recovery timestamp
- failure increments counter and conditionally transitions to `abnormal`
- failure transition logic must be centralized so app code does not duplicate SQL mutation rules

### Delete Policy Storage

Remove:

- model policy count/list/page/create/update/get/delete helpers
- policy summary helpers
- policy detail helpers
- pool-based backend helpers that only exist for policy support

### Client Storage

Remove route-group and route-mode fields from create/update/select/scan logic.

### Usage Log Storage

Remove deleted routing columns from:

- insert statements
- page/detail/stats scans
- filter/options logic

## App Layer Design

### Route Registration

Delete all admin policy routes:

- `GET /admin/api/model-policies`
- `GET /admin/api/model-policies/{id}/detail`
- `POST /admin/api/model-policies`
- `PUT /admin/api/model-policies/{id}`
- `DELETE /admin/api/model-policies/{id}`

### Public Proxy Handler

`handleProxy` changes:

- stop asking scheduler for a selected policy
- request candidate list directly from the simplified scheduler
- remove policy fields from logs and events
- treat all upstream non-`2xx` statuses as failed attempts
- final failure response becomes `503`

Status codes:

- unsupported endpoint: keep `404`
- invalid request body: keep `400`
- no usable backend or all attempts failed: `503`

### `/v1/models`

Only expose models from backends that are currently `normal`.

This keeps the public model catalog aligned with actual schedulable capacity.

### Backend Admin API

Create payload keeps:

- `name`
- `protocol`
- `base_url`
- `api_key`
- `proxy_id`
- `weight`
- `models`
- `model_mapping`
- `endpoints`

Remove from create/update payloads:

- `pool`
- `enabled`

Add to update payload:

- `status`

Backend detail/overview payloads will expose:

- `status`
- `consecutive_failures`
- `recover_at`

### Client Admin API

Remove from create/update/detail payloads:

- `route_mode_override`
- `route_group`

Client keys become plain auth credentials plus `enabled`.

### Dashboard / Overview / Search / Options APIs

Remove policy-based aggregates and fields:

- no `model_policies` count
- no policy search result group
- no policy usage-log filter option
- no policy detail references

Backend-focused summaries will reflect the new three-state backend model.

Recommended backend counts:

- total backends
- normal backends
- abnormal backends
- disabled backends

## Frontend Design

### Navigation and Page Removal

Delete the `Model Policies` page entirely:

- sidebar nav entry
- dashboard quick action
- page section
- policy modal
- drawer support
- search navigation to policy pages

### Backend UI

Backend forms:

- remove `Pool`
- remove `Enabled`
- create form has no status selector
- edit form shows `Status` selector with:
  - `normal`
  - `disabled`

Backend rows/cards/drawers must display:

- `status`
- `weight`
- `proxy`
- endpoint/model coverage
- `consecutive_failures`
- `recover_at`

Backend list filters will become status-aware:

- `all`
- `normal`
- `abnormal`
- `disabled`

### Client UI

Client forms and details remove:

- route mode
- route group

Client list sorting/searching must stop depending on deleted route fields.

### Dashboard / Settings / Search

Remove policy concepts from:

- dashboard text
- settings summaries
- search sections
- empty states
- helper copy

Where the UI previously summarized `enabled / disabled` backends, update wording to reflect:

- `normal`
- `abnormal`
- `disabled`

### Observability UI

Usage log policy filter and related policy references are removed because the underlying data no longer exists.

Events may still mention backend failures and recoveries, but not policy decisions.

## Audit and Event Model

Audit events remain useful and will continue recording:

- backend create/update/delete
- client create/update/delete
- backend failover attempts
- backend quarantine transition
- backend auto-recovery transition

Policy-related audit concepts are removed.

Recommended backend runtime event types:

- `backend_failure`
- `backend_quarantined`
- `backend_recovered`

Exact naming can follow existing event naming style, but these state transitions must remain visible in observability.

## Error Handling Rules

- invalid backend update status -> `400`
- missing/invalid proxy reference -> existing `400` behavior remains
- unsupported endpoint -> `404`
- invalid request JSON / missing model -> `400`
- no `normal` backend candidates -> `503`
- all candidates fail -> `503`

`disabled` and `abnormal` backends are not considered fallback candidates.

## File Impact

Primary backend files expected to change:

- `internal/domain/types.go`
- `internal/store/store.go`
- `internal/scheduler/scheduler.go`
- `internal/scheduler/scheduler_test.go`
- `internal/app/app.go`
- `internal/app/app_test.go`

Primary frontend files expected to change:

- `internal/app/web/index.html`
- `internal/app/web/app.js`
- `internal/app/web/resource-state.js`
- `internal/app/web/resource-view.js`
- `internal/app/web/resource-crud.js`
- `internal/app/web/resource-data-runtime.js`
- `internal/app/web/renderers.js`
- `internal/app/web/display-utils.js`
- `internal/app/web/drawer.js`
- `internal/app/web/drawer-view.js`
- `internal/app/web/settings.js`
- `internal/app/web/search.js`
- related `*.test.mjs` files

## Testing Strategy

### Scheduler Tests

Cover:

- select only `normal` backends
- exclude `disabled`
- exclude `abnormal`
- order by `weight DESC, id ASC`
- model mapping still allows selection
- failure threshold transitions backend to `abnormal`
- expired `recover_at` restores backend to `normal`

### App Tests

Cover:

- backend create defaults to `normal`
- backend update accepts `normal|disabled` and rejects `abnormal`
- removed policy endpoints return `404` because they are no longer registered
- client create/update no longer accept route fields
- `/v1/models` only includes models from `normal` backends
- upstream `500`, `429`, `401`, `404`, and network failures all count as failed attempts
- final client response is `503` when all candidates fail
- success on a later backend clears its failure state
- repeated failures persist across app restart because they live in SQLite

### Store Tests

If direct store package tests are added during implementation, cover:

- schema default values
- backend status scan/serialization
- manual status reset clearing runtime state
- failure increment persistence
- abnormal recovery persistence

### Frontend Tests

Update Node tests to reflect:

- no policy page or policy navigation
- no route-group / route-mode fields
- backend status is three-state instead of enabled/disabled
- backend filters/search/detail formatting use `status`, `consecutive_failures`, and `recover_at`
- settings/search/dashboard summaries no longer depend on policies

## Design Summary

The final system becomes:

- simpler to reason about
- explicit about backend state
- persistent across restarts
- free of dead routing abstractions

The tradeoff is intentional:

- old SQLite files are not preserved
- admin/API/frontend contracts change in a breaking way

That tradeoff is acceptable for this change because the requirement is to remove the obsolete concepts completely and rebuild the local database after development is complete.
