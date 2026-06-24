# AGENTS.md

## 1. Project Overview
- `token-gate` is a Go-based AI gateway with a static admin console.
- It authenticates client keys, routes one public API surface to upstream LLM backends, records usage logs/audit events, and lets admins manage backends, client keys, and SOCKS5 proxies.
- Current routing model is backend-centric only: there are no model policies, route groups, route modes, or backend pools.

## 2. Tech Stack
- Languages: Go, JavaScript, HTML, CSS
- Backend: Go `net/http`, `database/sql`, `log/slog`
- Storage: SQLite via `github.com/mattn/go-sqlite3`
- Frontend: browser-native vanilla JS, no bundler/framework
- Tests:
  - `go test ./...`
  - `node --test internal/app/web/*.test.mjs`

## 3. Repository Structure
- `cmd/token-gate/`
  - process entrypoint
- `internal/config/`
  - env-driven runtime config
- `internal/domain/`
  - core types/constants (`Backend`, `ClientKey`, `UsageLog`, `AuditEvent`, endpoint/status constants)
- `internal/store/`
  - SQLite schema creation, compatibility column/index migrations, CRUD, detail queries, search, stats
- `internal/scheduler/`
  - backend candidate selection and backend failure/success bookkeeping hooks
- `internal/proxy/`
  - upstream forwarding and protocol/auth handling
- `internal/app/`
  - HTTP routes, admin APIs, proxy handler, logging
- `internal/app/web/`
  - embedded admin UI (`index.html`, JS modules, `*.test.mjs`)
- `docs/`
  - design/spec notes, not guaranteed current
- `start.sh`
  - local runner with default envs and local Go cache

## 4. Architecture Summary
- Public request flow:
  - client auth
  - detect endpoint from request path
  - extract model from request body
  - scheduler loads backends from SQLite and selects ordered candidates
  - app forwards request to backends in order until one succeeds
  - usage log + audit events are persisted around the attempt sequence
- Scheduler behavior:
  - only `normal` backends are eligible
  - backend must support both requested endpoint and requested model
  - candidates are sorted by `weight DESC`, tie-break `id ASC`
  - any upstream/network failure advances to the next candidate
  - if all candidates fail, client gets `503`
- Backend runtime state:
  - persisted in SQLite on `backends.status`, `backends.consecutive_failures`, `backends.recover_at`
  - statuses: `normal`, `abnormal`, `disabled`
  - repeated failures mark backend `abnormal`
  - cooldown expiry moves `abnormal -> normal` and clears failure counters
  - manual admin edits may set backend to `normal` or `disabled`; `abnormal` remains scheduler-managed
- Admin console architecture:
  - static embedded files served from `internal/app/web`
  - no build step
  - modules expose `*Utils` globals and are also testable via `module.exports`

## 5. Development Conventions
- Go:
  - standard library HTTP stack, no web framework
  - request JSON decoding uses `DisallowUnknownFields`
  - small helper functions around handlers; main integration remains in `internal/app/app.go`
- Frontend:
  - module pattern is IIFE + `module.exports` + global export
  - forms submit directly to admin APIs; no client-side framework state library
- Important constraints:
  - preserve auth/header redaction in observability code
  - do not reintroduce removed concepts: `policies`, `route_group`, `route_mode_override`, backend `pool`, backend `enabled`
  - schema is managed inline in `store.Open`; there is no standalone migration tool

## 6. Current State
- Implemented:
  - public proxy endpoints for OpenAI-style and Anthropic-style upstreams
  - admin CRUD for SOCKS proxies, backends, client keys
  - persisted backend scheduling state in SQLite
  - backend manual status edits for `normal` and `disabled`
  - backend console metadata fields end-to-end: `console_url`, `tags`, `console_username`, `console_password`, `notes`
  - backend list payload metrics for `hourly_requests`, `hourly_failures`, average latency, and detail drawer metadata sections
  - dashboard, search, usage logs, events, settings, resource drawers
- Completed in recent sessions:
  - removed policy routing model end-to-end from backend API, frontend, and schema
  - removed backend `pool`/`enabled` from backend management model
  - removed usage-log policy filter remnants from frontend
  - fixed legacy SQLite startup failure by creating `idx_backends_status` only after `status` migration is ensured
  - added regression coverage for legacy backend-table migration
  - adjusted backend edit submission so an `abnormal` backend is not accidentally coerced to `normal` when the edit form has no explicit status value
  - added backend API regression coverage for manual `normal` / `disabled` status updates
  - added backend console-metadata persistence + legacy-column migrations
  - added backend admin API coverage for console metadata, hourly counters, and backend detail payloads
  - updated backend admin UI modal/search/list/quick-detail rendering for relay-station-oriented metadata
  - completed the backend console-metadata spec end-to-end, including:
    - backend search text and toolbar copy for console URL / tags / notes
    - backend expanded-row recent usage snapshot
    - backend detail proxy + API-key presence fields
    - masked backend detail/raw secret presentation for `api_key` and `console_password`
  - fixed `listBackendsByProxyID` to select the expanded backend column set so proxy drawer detail works again
  - rewrote `docs/DESIGN.md` and `docs/SCHEDULING.md` so they match the current backend-only routing model and relay-station-oriented admin UI
  - usage logs row expansion now uses the same SVG chevron pattern as other admin tables instead of the broken text toggle
  - verified locally with:
    - `GOCACHE=/root/workspace/token-gate/.gocache go test ./...`
    - `node --test internal/app/web/*.test.mjs`

## 7. In Progress
- No known feature work is currently in progress in project memory; next work should start from active tasks.

## 8. Known Issues
- `internal/app/app.go` is still large and high-churn; behavior changes there need narrow diffs and targeted tests.
- `docs/` is stale relative to current code:
  - other docs outside `DESIGN.md` / `SCHEDULING.md` may still lag the current code
- Local `./start.sh` can fail in shared/dev environments if `:4000` is already occupied; this is environmental, not an app-init/schema issue.

## 9. Active Tasks
- 1. If more backend-admin changes are made, preserve the current verification bar: `go test ./...` and `node --test internal/app/web/*.test.mjs`.
- 2. Keep adding targeted tests around:
  - scheduler failure threshold/cooldown behavior
  - admin backend update semantics
  - legacy SQLite compatibility when opening old local DB files
  - proxy-detail and related backend/proxy join queries that depend on the expanded backend scan shape

## 10. Architecture Notes
- Policy routing architecture is gone. Routing now depends only on:
  - endpoint support
  - model support / exact `ModelMapping` key match
  - backend status
  - backend weight ordering
- Backend status is now a first-class persisted runtime concern, not in-memory only.
- Frontend backend edit handling must preserve current `abnormal` state unless the user explicitly changes status to `normal` or `disabled`.

## 11. Key Commands
- Run locally:
  - `./start.sh`
  - or `TG_ADMIN_TOKEN=... TG_DB_PATH=./token-gate.db go run ./cmd/token-gate`
- Build:
  - `GOCACHE=/root/workspace/token-gate/.gocache go build ./...`
- Go tests:
  - `GOCACHE=/root/workspace/token-gate/.gocache go test ./...`
- Frontend tests:
  - `node --test internal/app/web/*.test.mjs`
- Useful env vars:
  - `TG_LISTEN_ADDR`
  - `TG_DB_PATH`
  - `TG_ADMIN_TOKEN`
  - `TG_LOG_LEVEL`
  - `TG_BACKEND_COOLDOWN`
  - `TG_BACKEND_FAILS`
  - `TG_REQUEST_TIMEOUT`
  - `TG_SHUTDOWN_TIMEOUT`

## 12. Git / Commit Guidance
- Always inspect `git status --short` first; the worktree may already contain unrelated user changes.
- Do not mix these categories in one commit:
  - backend scheduling / API semantics
  - config default changes
  - docs cleanup
  - frontend rendering cleanup
- Behavior changes should ship with tests in the same commit.
- If `internal/config/config.go` is still dirty, treat it as a separate decision unless the task explicitly includes config defaults.

## 13. AI Agent Rules
- Read code before trusting old docs.
- Make minimal changes and keep removed concepts removed.
- Summarize outputs; do not store raw logs/diffs in memory files.
- Verify before claiming completion:
  - targeted tests first
  - then broader `go test ./...` / `node --test ...` when change scope warrants it

## 14. Session Boot Instructions
> Read `AGENTS.md` -> run `git status --short` -> check whether `internal/config/config.go` is still intentionally dirty -> continue from **Active Tasks** -> run targeted tests before and after edits.
