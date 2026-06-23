# Token Gate Backend Console Metadata Design

Date: 2026-06-23

## Overview

This spec extends the existing `Backends` resource so it can represent upstream "relay stations" more clearly in the admin console without introducing a new domain object.

The feature adds backend metadata used only by administrators:

- `console_url`
- `tags`
- `console_username`
- `console_password`
- `notes`

The `Backends` page will also change its list layout to emphasize relay-station operations:

- Name
- Console URL
- Status
- Tags
- Models
- Requests in the last hour
- Failures in the last hour
- Average latency

All other backend information remains available from the expanded detail view and drawer detail API.

## Goals

- Keep `Backends` as the single resource for upstream management
- Store console/login metadata for each backend
- Show backend operational metrics in the main list
- Keep proxy routing and upstream API authentication behavior unchanged
- Preserve compatibility with existing SQLite files through inline column migration

## Non-Goals

- No new `TransitStation` or similar domain model
- No rename of the `Backends` page or API paths
- No use of console credentials for upstream request authentication
- No change to scheduler candidate selection rules
- No change to public proxy request/response behavior

## Existing State Summary

Current backend management already stores and exposes:

- `name`
- `protocol`
- `base_url`
- `api_key`
- `proxy_id`
- `status`
- `weight`
- `models`
- `model_mapping`
- `endpoints`

Current backend list rows emphasize routing and recent usage:

- Backend name and `base_url`
- status and proxy routing label
- model/endpoint coverage
- request count
- average latency
- last used time
- recent 30-minute success/failure summary

The new design keeps the same resource but repurposes the list to better match operator expectations for relay-station inventory.

## Data Model

### Backend Fields

Add these fields to `domain.Backend` and the `backends` table:

- `ConsoleURL string`
- `Tags []string`
- `ConsoleUsername string`
- `ConsolePassword string`
- `Notes string`

Semantics:

- `console_url`
  - administrator-facing login or control-panel URL
  - shown in the main list as the row URL
- `tags`
  - lightweight backend labels for grouping and search
  - stored as a string list using the same JSON-list encoding pattern as `model_list` and `endpoint_list`
- `console_username`
  - login username for the backend console
  - not used by proxy request forwarding
- `console_password`
  - login password for the backend console
  - not used by proxy request forwarding
  - saved in SQLite with the same trust model as the existing backend `api_key`
- `notes`
  - free-form operator notes shown in detail views

### Existing Fields Kept As-Is

These fields keep their current meaning:

- `base_url`
  - actual upstream API endpoint for proxy traffic
- `api_key`
  - upstream API authentication secret
- `proxy_id`
  - SOCKS5 proxy binding for egress
- `models`
  - supported or client-facing model list
- `status`
  - scheduler eligibility state

## Schema Changes

### `backends`

Keep all existing columns and add:

- `console_url TEXT NOT NULL DEFAULT ''`
- `tag_list TEXT NOT NULL DEFAULT '[]'`
- `console_username TEXT NOT NULL DEFAULT ''`
- `console_password TEXT NOT NULL DEFAULT ''`
- `notes TEXT NOT NULL DEFAULT ''`

Migration strategy:

- Create these columns in the initial `CREATE TABLE IF NOT EXISTS backends` statement
- Use `ensureColumn` for each new field so old SQLite files remain usable
- Reuse existing JSON list encoding/decoding helpers for `tag_list`

No other table changes are required.

## Store Layer Changes

### Read/Write Paths

Extend all backend store paths so they round-trip the new metadata:

- `ListBackends`
- `ListBackendsPage`
- `GetBackend`
- `CreateBackend`
- `UpdateBackend`
- `BackendDetail`
- backend row scanners

### Validation and Normalization

- `console_url`
  - optional
  - when non-empty, it must pass the same URL validation helper used for backend URLs
- `tags`
  - trim whitespace
  - drop empty entries
- `console_username`, `console_password`, `notes`
  - trim surrounding whitespace

## Admin API Changes

### Backend Create/Update Payload

Extend backend create/update payloads with:

- `console_url`
- `tags`
- `console_username`
- `console_password`
- `notes`

Behavior:

- New fields are accepted on both create and update
- Existing backend status semantics remain unchanged
- `console_url` is validated only when non-empty
- `console_username` and `console_password` are treated as metadata, not auth configuration

### Backend List Response

Backend list items should include:

- existing backend data
- existing usage summary fields
- existing recent stats fields
- new metadata fields
- new list-focused derived fields:
  - `hourly_requests`
  - `hourly_failures`

`avg_latency_ms` remains the existing average-latency field and will be reused in the list.

### Backend Detail Response

Backend detail should surface the new metadata under the existing overview/configuration/raw activity structure so drawer detail views can show:

- console URL
- console username
- console password
- tags
- notes
- proxy
- base URL
- API key
- model mapping
- endpoints

## Backend Metrics for Main List

The main backend list will show:

- requests in the last hour
- failures in the last hour
- average latency

Metric definition:

- source table: `usage_logs`
- time window: `created_at >= now - 1 hour`
- requests:
  - count of usage logs for the backend in that window
- failures:
  - count of usage logs in that window whose `status_code` is treated as a backend failure by existing logic
- average latency:
  - reuse existing latency summary field already returned for backends
  - this remains all-time unless current implementation already scopes it differently

This intentionally avoids changing dashboard-wide latency semantics while still adding 1-hour request/failure counters.

## Frontend Changes

### Page Identity

- Keep left navigation entry as `Backends`
- Keep page ID `#backends`
- Keep API path `/admin/api/backends`

### Main List Layout

Replace current backend table columns with:

- Name
- Console URL
- Status
- Tags
- Models
- Requests 1h
- Failures 1h
- Avg Latency
- Actions

Rendering rules:

- Name column uses backend name as the clickable row title
- Console URL column shows `console_url`
  - when empty, show `-`
- Status column keeps current status pill
- Tags column shows a compact comma-separated list
- Models column shows the configured model list
- Requests 1h and Failures 1h are plain counts
- Avg Latency uses the existing latency formatter

### Expanded Row Content

The row expansion area becomes the place for remaining operator details:

- console username
- console password
- proxy
- notes
- base URL
- model mapping preview
- endpoint coverage
- recent usage snapshot

### Edit Modal

Extend the backend modal with inputs for:

- Console URL
- Tags
- Console Username
- Console Password
- Notes

Suggested input shapes:

- `console_url`: text input
- `tags`: comma-separated text input
- `console_username`: text input
- `console_password`: password input
- `notes`: textarea

### Search/Filter Behavior

Backend resource search text should include:

- `name`
- `console_url`
- `status`
- `tags`
- `models`
- `console_username`
- `notes`

Status filtering and sort behavior stay the same unless existing column ordering requires a small copy update.

## Security and Exposure Rules

- Backend console credentials are administrative metadata only
- Public proxy handlers must never read or use `console_username` or `console_password`
- Main list should not display console password in plaintext
- Expanded row and drawer detail should avoid broad plaintext exposure when possible
  - masked display is preferred
- Existing request/response log redaction rules remain unchanged

## Testing

### Go Tests

Add targeted coverage for:

- backend store create/update round-trip for console metadata
- legacy SQLite migration adding new backend metadata columns
- backend admin create/update/list handlers accepting and returning new fields
- backend list hourly request/failure counters

### Frontend Tests

Add targeted coverage for:

- backend search including `console_url`, `tags`, and `notes`
- backend row rendering with the new column set
- backend quick-detail rendering for expanded rows
- backend modal edit/create assignment for the new fields

## Risks and Mitigations

- Risk: list layout gets too dense
  - Mitigation: keep only operator-critical fields in the table and move the rest into expanded detail
- Risk: confusion between `base_url` and `console_url`
  - Mitigation: reserve the list URL column specifically for `console_url`; keep `base_url` in expanded/detail views
- Risk: new credentials accidentally affect proxy behavior
  - Mitigation: no proxy or scheduler code path reads the console credential fields
