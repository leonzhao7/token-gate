# New API Backend Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add manual new-api backend check-in and pricing sync actions with persisted cookie, balance, and model plaza JSON.

**Architecture:** Extend `domain.Backend` and SQLite scan/CRUD paths with console fields. Add a focused console client in the handler layer for new-api HTTP calls, then expose two admin action endpoints and two static UI buttons.

**Tech Stack:** Go `net/http`, SQLite via `database/sql`, vanilla browser JavaScript tests with `node --test`.

---

## File Map

- Modify `internal/domain/types.go`: backend fields and `backend_type` normalization.
- Modify `internal/store/store.go`: schema and compatibility migrations.
- Modify `internal/store/store_backend.go`: select/insert/update/import/scan helpers.
- Modify `internal/store/store_test.go`: persistence and legacy migration tests.
- Modify `internal/handler/handle_backend.go`: admin payload fields, detail masking, new console action handlers.
- Modify `internal/app/app.go`: route registration.
- Modify `internal/app/app_test.go`: new-api action tests with `httptest.Server`.
- Modify `internal/app/web/index.html`: backend form field for type/cookie.
- Modify `internal/app/web/app.js`: form defaults, edit hydration, submit payload.
- Modify `internal/app/web/resource-view.js`: backend row action buttons.
- Modify `internal/app/web/resource-list-runtime.js`: click binding for action buttons.
- Modify `internal/app/web/resource-*.test.mjs`: static UI behavior tests.

## Tasks

### Task 1: Persist Console Fields

- [ ] Write failing store tests for create/update/list round-trip and legacy migration of `backend_type`, `console_cookie`, `console_account_json`, and `console_pricing_json`.
- [ ] Run `GOCACHE=/root/workspace/token-gate/.gocache go test ./internal/store -run 'TestBackendConsole|TestOpenMigrates'`.
- [ ] Add fields to `domain.Backend`.
- [ ] Add schema columns and `ensureColumn` migrations.
- [ ] Update all backend SELECT column lists, INSERTs, UPDATEs, imports, exports, and `scanBackend`.
- [ ] Re-run the targeted store tests and confirm they pass.

### Task 2: Add New-API Console Actions

- [ ] Write failing app tests for check-in with valid cookie, check-in with login retry, and pricing sync.
- [ ] Run `GOCACHE=/root/workspace/token-gate/.gocache go test ./internal/app -run 'TestAdminBackendNewAPIConsole'`.
- [ ] Implement a small new-api console client inside `internal/handler/handle_backend.go` or a focused helper file.
- [ ] Add `HandleBackendConsoleCheckin` and `HandleBackendConsolePricing`.
- [ ] Register `POST /admin/api/backends/{id}/console/checkin` and `POST /admin/api/backends/{id}/console/pricing`.
- [ ] Re-run the targeted app tests and confirm they pass.

### Task 3: Wire Static Admin UI

- [ ] Write failing JS tests showing backend rows render check-in and model plaza buttons, and form payload preserves `backend_type` and `console_cookie`.
- [ ] Run `node --test internal/app/web/resource-view.test.mjs internal/app/web/resource-list-runtime.test.mjs internal/app/web/resource-runtime.test.mjs`.
- [ ] Add backend form controls for `backend_type` and `console_cookie`.
- [ ] Hydrate and submit the new fields from `app.js`.
- [ ] Render only two new manual action buttons on backend rows and bind them to the new admin endpoints.
- [ ] Re-run targeted JS tests and confirm they pass.

### Task 4: Verification

- [ ] Run `GOCACHE=/root/workspace/token-gate/.gocache go test ./internal/store ./internal/app ./internal/handler`.
- [ ] Run `node --test internal/app/web/*.test.mjs`.
- [ ] Run `GOCACHE=/root/workspace/token-gate/.gocache go test ./...` and record whether unrelated `internal/utils` still blocks full verification.
- [ ] Inspect `git diff --stat` and `git diff --check`.
