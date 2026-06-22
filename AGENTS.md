# AGENTS.md

## 1. Project Overview
- `token-gate` is a Go-based AI gateway that exposes one public API surface and routes requests to multiple upstream LLM backends.
- Supported public API families in code: OpenAI-style `chat`, `responses`, `embeddings`, `images`, `models`, plus Anthropic-style `messages` and `messages/count_tokens`.
- It also ships a static admin console at `/admin/` for managing backends, client keys, SOCKS5 proxies, policies, usage logs, and audit events.

## 2. Tech Stack
- Languages: Go, JavaScript, HTML, CSS
- Backend runtime: Go `1.25`, standard library HTTP stack (`net/http`, `httptrace`, `log/slog`, `database/sql`)
- Storage: SQLite via `github.com/mattn/go-sqlite3`
- Frontend runtime: browser-native vanilla JS; no bundler, no package manager, no framework
- Testing:
  - Go package tests with `go test`
  - Frontend module tests with Node built-in test runner on `*.test.mjs`
- Key built-in dependencies/patterns:
  - `go:embed` for admin assets
  - `httptrace` for backend connection tracing
  - `localStorage` for admin token/theme/sidebar state

## 3. Repository Structure
- `cmd/token-gate/`
  - process entrypoint
- `internal/config/`
  - env-driven runtime config
- `internal/domain/`
  - core types/constants for clients, backends, policies, events, usage logs
- `internal/store/`
  - SQLite schema creation, CRUD, reporting, search, detail queries
- `internal/scheduler/`
  - policy selection, candidate filtering, rendezvous-hash placement, cooldown runtime state
- `internal/proxy/`
  - upstream request forwarding, auth-header rewrite, SOCKS5-aware HTTP clients
- `internal/app/`
  - HTTP routes, auth middleware, proxy handler, admin APIs, logging/observability helpers
- `internal/app/web/`
  - embedded admin UI (`index.html`, `styles.css`, many small JS modules + `*.test.mjs`)
- `docs/`
  - `DESIGN.md`, `SCHEDULING.md`
  - `docs/superpowers/specs/2026-06-18-token-gate-ai-proxy-center-design.md`
  - `docs/superpowers/plans/2026-06-18-ai-proxy-center-implementation.md`
- `start.sh`
  - local run script with default envs and local Go cache

## 4. Architecture Summary
- Public request flow:
  - client auth via `Authorization: Bearer <key>` or `X-Api-Key`
  - endpoint detection from request path
  - model extraction from JSON body
  - scheduler selects one policy and ordered backend candidates
  - proxy forwards request to upstream, rewriting upstream auth headers
  - app records usage log + audit events around selection/failover/result
- Scheduler behavior:
  - policy chosen by endpoint/model match, then priority, then pattern specificity
  - placement modes in code: `sticky`, `pack`, `spread`
  - candidate ranking uses rendezvous hashing; `spread` also divides score by active requests
  - runtime state is in-memory only; failures trigger cooldowns, successes clear them
- Backend model handling:
  - selection can match either `backend.Models` or `backend.ModelMapping`
  - if a backend maps client model -> upstream model, the app rewrites the request JSON `model` field before forwarding
- Admin console architecture:
  - static assets served from embedded `internal/app/web/*`
  - root path redirects to `/admin/`
  - UI is SPA-like but framework-free; modules communicate through globals like `ThemeUtils`, `ResourceRuntimeUtils`, `ObservabilityViewUtils`
  - admin APIs provide dashboard aggregates, search, details, usage log stats/options, and CRUD endpoints
- Visible design constraints from code/docs:
  - no background backend health probing; `StartBackground` is intentionally empty
  - SOCKS5 proxy binding is per backend
  - schema is created in `store.Open`; no separate migration system

## 5. Development Conventions
- Go:
  - standard library only for HTTP/app wiring; no web framework
  - package-local tests live beside source
  - helper patterns: `writeJSON`, `writeError`, auth wrappers, small pure helpers
  - request JSON decoding uses `DisallowUnknownFields`
- Frontend:
  - each module is an IIFE that exports the same API both to `module.exports` and `globalScope.*Utils`
  - tests import browser modules with `createRequire(...)`
  - no build step; files are loaded directly by `index.html`
- Naming/patterns:
  - endpoint names use constants from `internal/domain/types.go`
  - admin list endpoints generally support `page`/`limit`; allowed limits in app code are `10`, `20`, `50`
  - list/detail/search/dashboard logic is mostly concentrated in `internal/app/app.go`
- Important constraints:
  - preserve header redaction behavior in observability paths (`Authorization`, `Api-Key`, `X-Api-Key`, `Cookie`)
  - usage/request previews are intentionally truncated; do not expand them casually
  - avoid introducing Node/npm tooling unless the repo explicitly adopts it

## 6. Current State
- Implemented:
  - public proxy endpoints for chat/responses/embeddings/images/messages/models
  - client-key auth and admin-token auth
  - backend selection with policy priority/specificity, weights, cooldowns, route-group support
  - failover on request errors and retryable upstream statuses
  - backend protocol support for OpenAI-style and Anthropic-style auth headers
  - optional backend `ModelMapping`
  - admin CRUD for SOCKS proxies, backends, client keys, and model policies
  - admin dashboard, search, usage logs, events, detail drawers, theme toggle, shell navigation
  - usage log persistence with request/response previews and event/audit storage
- Partially done / currently in progress:
  - working tree is dirty on `main`; current uncommitted edits are in:
    - `internal/app/app.go`
    - `internal/app/logging.go`
    - `internal/app/logging_test.go` (new)
    - `internal/app/web/observability-view.js`
    - `internal/app/web/observability-view.test.mjs`
    - `internal/store/store.go`
  - those edits currently do three things:
    - set `usage_logs.created_at` from request start time instead of insert time
    - remove DNS callbacks from backend `httptrace` logging
    - simplify usage-log table columns in the observability UI (replace `Method`/`Trace ID` columns with `Model`)
- Known issues / risks visible in code:
  - app-level response handling buffers the full upstream response in `cloneResponseForLogging(...)` before `proxy.WriteResponse(...)`; this conflicts with the stated streaming/SSE transparency goal and is the highest-priority architectural risk
  - docs are slightly stale relative to code: the current app can rewrite request bodies when `backend.ModelMapping` is used
  - `internal/app/app.go` is the main integration point and is very large; future edits there are high-churn and need careful scoping
  - `internal/store` has broad responsibility but no direct package tests in this repo snapshot; it is exercised mainly through app/scheduler tests

## 7. Active Tasks
- 1. Finish and commit the current dirty worktree after re-validating the logging/observability behavior it changes.
- 2. Fix or explicitly redesign streaming behavior so proxy responses are not fully buffered before client delivery; add regression coverage at the app layer.
- 3. Reconcile docs (`README.md`, `docs/DESIGN.md`) with actual request-model rewriting and current observability UI behavior.
- 4. Keep adding targeted tests around:
  - usage log timestamp semantics
  - failover + observability logging
  - admin observability rendering
  - any future streaming changes
- 5. If more admin/API work lands, consider extracting slices out of `internal/app/app.go` instead of growing it further.

## 8. Key Commands
- Install dependencies:
  - `go mod download`
- Run locally:
  - `./start.sh`
  - or `TG_ADMIN_TOKEN=replace-me TG_DB_PATH=./token-gate.db go run ./cmd/token-gate`
- Build:
  - `GOCACHE=/root/workspace/token-gate/.gocache go build ./...`
- Go tests:
  - `GOCACHE=/root/workspace/token-gate/.gocache go test ./...`
- Frontend module tests:
  - `node --test internal/app/web/*.test.mjs`
- Useful env vars from `internal/config/config.go`:
  - `TG_LISTEN_ADDR`
  - `TG_DB_PATH`
  - `TG_ADMIN_TOKEN`
  - `TG_LOG_LEVEL`
  - `TG_BACKEND_COOLDOWN`
  - `TG_BACKEND_FAILS`
  - `TG_REQUEST_TIMEOUT`
  - `TG_SHUTDOWN_TIMEOUT`

## 9. Git / Commit Guidance (for AI agents)
- Check `git status --short --branch` before editing; this repo may already contain user work.
- Do not mix unrelated subsystems in one commit:
  - proxy/scheduler behavior
  - store/query changes
  - admin UI rendering
  - docs/memory updates
- Preserve and review existing dirty changes instead of overwriting them.
- Commit tests with behavior changes, especially for proxy/failover/logging work.
- Prefer small commits with a single operational theme; this repo’s large `app.go` makes mixed commits hard to review safely.

## 10. AI Agent Rules
- Inspect before modifying:
  - start with `AGENTS.md`, `README.md`, `docs/DESIGN.md`, `git status`, then the specific package you need
- Make minimal changes:
  - avoid broad refactors unless the task is explicitly structural
  - keep edits local to the touched subsystem
- Trust code over prose:
  - docs are helpful, but source is the authority when they disagree
- Protect observability hygiene:
  - keep auth/header redaction intact
  - avoid storing more body/header data unless explicitly required
- Keep context small:
  - summarize large logs/diffs/test output
  - do not paste large generated output into memory files
- Verify before claiming success:
  - run targeted tests first
  - run broader `go test ./...` or `node --test ...` when the change scope warrants it

## 11. Session Boot Instructions
> Read `AGENTS.md` -> run `git status --short --branch` -> inspect dirty files and latest commits -> open the relevant package(s) -> continue from **Active Tasks** -> run targeted tests before and after edits.
