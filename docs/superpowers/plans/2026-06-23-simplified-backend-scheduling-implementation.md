# Simplified Backend Scheduling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace policy-based scheduling with persisted three-state backend scheduling, weight-ordered failover, and full removal of policy/route-group/route-mode/pool concepts from the backend, API, SQLite schema, and admin UI.

**Architecture:** Keep the current Go-served vanilla admin app, but collapse routing decisions into a simplified scheduler that only works with backend capability and persisted backend runtime state. Backend status transitions move into SQLite-backed store helpers; the frontend removes the policy page entirely and updates backend/client views to the new data model.

**Tech Stack:** Go, net/http, SQLite, embedded static web assets, vanilla HTML/CSS/JS, Node built-in test runner.

---

## File Structure

### Existing files to modify

- `internal/domain/types.go`
  - Remove `ModelPolicy`, route/group fields, placement constants
  - Add backend status constants and persisted runtime fields
- `internal/store/store.go`
  - Replace schema creation
  - Remove policy CRUD/query code
  - Add backend runtime persistence helpers
  - Remove route/policy fields from usage logs
- `internal/scheduler/scheduler.go`
  - Remove rendezvous/policy/pool logic
  - Keep endpoint/model filtering + weight ordering + persisted state transitions
- `internal/scheduler/scheduler_test.go`
  - Replace scheduler tests with normal/abnormal/disabled coverage
- `internal/app/app.go`
  - Remove policy routes and handlers
  - Simplify proxy attempt loop
  - Return `503` on no usable upstream
  - Update backend/client APIs and overview/detail payloads
- `internal/app/app_test.go`
  - Rewrite policy and route-related tests
  - Add backend status and `503` behavior coverage
- `internal/app/web/index.html`
  - Remove policy page/nav/action
  - Update backend/client forms
- `internal/app/web/app.js`
  - Remove policy state and handlers
  - Update backend/client form submission and page config
- `internal/app/web/resource-state.js`
  - Replace backend filter/search/sort behavior
  - Remove client route-field and policy view logic
- `internal/app/web/resource-view.js`
  - Remove policy rows
  - Update backend/client rows
- `internal/app/web/resource-crud.js`
  - Keep generic CRUD helpers, but align call sites with new fields
- `internal/app/web/resource-data-runtime.js`
  - Stop fetching policies
- `internal/app/web/display-utils.js`
  - Add backend three-state display helpers
  - Remove pool/policy formatting helpers
- `internal/app/web/renderers.js`
  - Remove policy detail cards
  - Update backend/client quick details
- `internal/app/web/drawer.js`
  - Remove policy drawer resource definition and backend chips based on `pool/enabled`
- `internal/app/web/drawer-view.js`
  - Remove policy- and route-related overview/highlight keys
- `internal/app/web/search.js`
  - Remove policy navigation assumptions if present
- `internal/app/web/settings.js`
  - Remove policy summaries
  - Switch backend summaries to `normal/abnormal/disabled`
- `internal/app/web/console-data-runtime.js`
  - Stop loading policies
- `internal/app/web/*.test.mjs`
  - Update fixtures/assertions for removed fields and page removal

### New files to create

- `internal/store/store_test.go`
  - Direct store coverage for schema defaults and persisted backend runtime transitions

### Validation commands used throughout

- Backend tests:
  - `GOCACHE=/root/workspace/token-gate/.gocache go test ./internal/store ./internal/scheduler ./internal/app -v`
- Focused backend package tests:
  - `GOCACHE=/root/workspace/token-gate/.gocache go test ./internal/store -run 'TestCreateBackendDefaultsToNormalStatus|TestBackendFailureLifecyclePersistsInSQLite' -v`
  - `GOCACHE=/root/workspace/token-gate/.gocache go test ./internal/scheduler -run 'TestSelectBackendOnlyReturnsNormalBackendsOrderedByWeight|TestSelectBackendRefreshesExpiredAbnormalBackends|TestSelectBackendMatchesMappedClientModel' -v`
  - `GOCACHE=/root/workspace/token-gate/.gocache go test ./internal/app -run 'TestProxyReturns503WhenAllCandidatesFail|TestProxyRetriesOnAnyNon2xxAndReturnsSuccessFromLaterBackend|TestPublicModelsListsOnlyNormalBackends|TestCreateBackendDefaultsToNormalStatus|TestUpdateBackendRejectsAbnormalStatus|TestPolicyRoutesRemoved' -v`
- Frontend tests:
  - `node --test internal/app/web/*.test.mjs`
- Full verification:
  - `GOCACHE=/root/workspace/token-gate/.gocache go test ./...`
  - `GOCACHE=/root/workspace/token-gate/.gocache go build ./...`

## Task 1: Reshape Domain Types and SQLite Persistence

**Files:**
- Create: `internal/store/store_test.go`
- Modify: `internal/domain/types.go`
- Modify: `internal/store/store.go`
- Test: `internal/store/store_test.go`

- [ ] **Step 1: Write the failing store tests**

Create `internal/store/store_test.go` with direct coverage for backend defaults and persisted failure lifecycle:

```go
package store

import (
	"context"
	"testing"
	"time"

	"token-gate/internal/domain"
)

func openTestStore(t *testing.T) *Store {
	t.Helper()

	st, err := Open(context.Background(), t.TempDir()+"/test.db")
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	return st
}

func TestCreateBackendDefaultsToNormalStatus(t *testing.T) {
	st := openTestStore(t)
	defer st.Close()

	backend, err := st.CreateBackend(context.Background(), domain.Backend{
		Name:      "edge-a",
		Protocol:  domain.BackendProtocolOpenAI,
		BaseURL:   "https://edge-a.local/v1",
		APIKey:    "edge-a-key",
		Weight:    9,
		Models:    []string{"gpt-4o"},
		Endpoints: []string{domain.EndpointChat},
	})
	if err != nil {
		t.Fatalf("CreateBackend returned error: %v", err)
	}

	if backend.Status != domain.BackendStatusNormal {
		t.Fatalf("expected normal status, got %q", backend.Status)
	}
	if backend.ConsecutiveFailures != 0 {
		t.Fatalf("expected zero consecutive failures, got %d", backend.ConsecutiveFailures)
	}
	if backend.RecoverAt != nil {
		t.Fatalf("expected nil recover_at, got %v", backend.RecoverAt)
	}
}

func TestBackendFailureLifecyclePersistsInSQLite(t *testing.T) {
	st := openTestStore(t)
	defer st.Close()
	ctx := context.Background()

	backend, err := st.CreateBackend(ctx, domain.Backend{
		Name:      "edge-b",
		Protocol:  domain.BackendProtocolOpenAI,
		BaseURL:   "https://edge-b.local/v1",
		APIKey:    "edge-b-key",
		Weight:    5,
		Models:    []string{"gpt-4o"},
		Endpoints: []string{domain.EndpointChat},
	})
	if err != nil {
		t.Fatalf("CreateBackend returned error: %v", err)
	}

	first, err := st.MarkBackendFailure(ctx, backend.ID, 2, 2*time.Minute, time.Date(2026, 6, 23, 9, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatalf("MarkBackendFailure first call returned error: %v", err)
	}
	if first.Status != domain.BackendStatusNormal || first.ConsecutiveFailures != 1 {
		t.Fatalf("unexpected first failure state: %#v", first)
	}

	second, err := st.MarkBackendFailure(ctx, backend.ID, 2, 2*time.Minute, time.Date(2026, 6, 23, 9, 1, 0, 0, time.UTC))
	if err != nil {
		t.Fatalf("MarkBackendFailure second call returned error: %v", err)
	}
	if second.Status != domain.BackendStatusAbnormal {
		t.Fatalf("expected abnormal status after threshold, got %q", second.Status)
	}
	if second.RecoverAt == nil {
		t.Fatal("expected recover_at after threshold")
	}

	if err := st.RecoverExpiredBackends(ctx, time.Date(2026, 6, 23, 9, 4, 0, 0, time.UTC)); err != nil {
		t.Fatalf("RecoverExpiredBackends returned error: %v", err)
	}

	recovered, err := st.GetBackend(ctx, backend.ID)
	if err != nil {
		t.Fatalf("GetBackend returned error: %v", err)
	}
	if recovered.Status != domain.BackendStatusNormal || recovered.ConsecutiveFailures != 0 || recovered.RecoverAt != nil {
		t.Fatalf("unexpected recovered state: %#v", recovered)
	}
}
```

- [ ] **Step 2: Run the store tests to verify they fail**

Run:

```bash
GOCACHE=/root/workspace/token-gate/.gocache go test ./internal/store -run 'TestCreateBackendDefaultsToNormalStatus|TestBackendFailureLifecyclePersistsInSQLite' -v
```

Expected:

- FAIL because `domain.BackendStatusNormal`, `Backend.Status`, `Backend.ConsecutiveFailures`, `Backend.RecoverAt`, `MarkBackendFailure`, and `RecoverExpiredBackends` do not exist yet

- [ ] **Step 3: Implement the domain and store schema changes**

Update `internal/domain/types.go` to remove deleted routing concepts and add backend status fields:

```go
const (
	EndpointChat       = "chat"
	EndpointResponses  = "responses"
	EndpointEmbeddings = "embeddings"
	EndpointImages     = "images"
	EndpointMessages   = "messages"
	EndpointModels     = "models"

	BackendStatusNormal   = "normal"
	BackendStatusAbnormal = "abnormal"
	BackendStatusDisabled = "disabled"

	BackendProtocolOpenAI    = "openai"
	BackendProtocolAnthropic = "anthropic"
)

type ClientKey struct {
	ID          int64     `json:"id"`
	Name        string    `json:"name"`
	TokenHash   string    `json:"-"`
	Token       string    `json:"token,omitempty"`
	TokenPrefix string    `json:"token_prefix"`
	Enabled     bool      `json:"enabled"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Backend struct {
	ID                  int64             `json:"id"`
	Name                string            `json:"name"`
	Protocol            string            `json:"protocol"`
	BaseURL             string            `json:"base_url"`
	APIKey              string            `json:"api_key,omitempty"`
	ProxyID             int64             `json:"proxy_id"`
	Proxy               *SocksProxy       `json:"proxy,omitempty"`
	Status              string            `json:"status"`
	ConsecutiveFailures int               `json:"consecutive_failures"`
	RecoverAt           *time.Time        `json:"recover_at,omitempty"`
	Weight              int               `json:"weight"`
	Models              []string          `json:"models"`
	ModelMapping        map[string]string `json:"model_mapping"`
	Endpoints           []string          `json:"endpoints"`
	CreatedAt           time.Time         `json:"created_at"`
	UpdatedAt           time.Time         `json:"updated_at"`
}
```

Update `internal/store/store.go` schema and backend helpers:

```go
`CREATE TABLE IF NOT EXISTS client_keys (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL,
	token_hash TEXT NOT NULL UNIQUE,
	token TEXT NOT NULL DEFAULT '',
	token_prefix TEXT NOT NULL,
	enabled INTEGER NOT NULL DEFAULT 1,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);`,
`CREATE TABLE IF NOT EXISTS backends (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL UNIQUE,
	protocol TEXT NOT NULL DEFAULT 'openai',
	base_url TEXT NOT NULL,
	api_key TEXT NOT NULL,
	proxy_id INTEGER NOT NULL DEFAULT 0,
	status TEXT NOT NULL DEFAULT 'normal',
	consecutive_failures INTEGER NOT NULL DEFAULT 0,
	recover_at TEXT NOT NULL DEFAULT '',
	weight INTEGER NOT NULL DEFAULT 1,
	model_list TEXT NOT NULL,
	model_mapping TEXT NOT NULL DEFAULT '{}',
	endpoint_list TEXT NOT NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);`,
`CREATE TABLE IF NOT EXISTS usage_logs (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	request_id TEXT NOT NULL,
	client_id INTEGER NOT NULL DEFAULT 0,
	client_name TEXT NOT NULL DEFAULT '',
	client_token_prefix TEXT NOT NULL DEFAULT '',
	method TEXT NOT NULL DEFAULT '',
	path TEXT NOT NULL DEFAULT '',
	query TEXT NOT NULL DEFAULT '',
	endpoint TEXT NOT NULL DEFAULT '',
	model TEXT NOT NULL DEFAULT '',
	backend_id INTEGER NOT NULL DEFAULT 0,
	backend_name TEXT NOT NULL DEFAULT '',
	proxy_id INTEGER NOT NULL DEFAULT 0,
	proxy_name TEXT NOT NULL DEFAULT '',
	attempts INTEGER NOT NULL DEFAULT 0,
	status_code INTEGER NOT NULL DEFAULT 0,
	status_family TEXT NOT NULL DEFAULT '',
	duration_ms INTEGER NOT NULL DEFAULT 0,
	error_message TEXT NOT NULL DEFAULT '',
	client_ip TEXT NOT NULL DEFAULT '',
	user_agent TEXT NOT NULL DEFAULT '',
	trace_id TEXT NOT NULL DEFAULT '',
	request_bytes INTEGER NOT NULL DEFAULT 0,
	response_bytes INTEGER NOT NULL DEFAULT 0,
	request_headers_json TEXT NOT NULL DEFAULT '{}',
	request_body_preview TEXT NOT NULL DEFAULT '',
	response_headers_json TEXT NOT NULL DEFAULT '{}',
	response_body_preview TEXT NOT NULL DEFAULT '',
	preview_truncated INTEGER NOT NULL DEFAULT 0,
	is_stream INTEGER NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL
);`,
```

Add persisted backend runtime helpers:

```go
func (s *Store) MarkBackendSuccess(ctx context.Context, backendID int64) (domain.Backend, error) {
	_, err := s.db.ExecContext(ctx, `
		UPDATE backends
		SET status = ?, consecutive_failures = 0, recover_at = '', updated_at = ?
		WHERE id = ?
	`, domain.BackendStatusNormal, formatTime(time.Now().UTC()), backendID)
	if err != nil {
		return domain.Backend{}, err
	}
	return s.GetBackend(ctx, backendID)
}

func (s *Store) MarkBackendFailure(ctx context.Context, backendID int64, threshold int, cooldown time.Duration, now time.Time) (domain.Backend, error) {
	current, err := s.GetBackend(ctx, backendID)
	if err != nil {
		return domain.Backend{}, err
	}
	failures := current.ConsecutiveFailures + 1
	status := current.Status
	recoverAt := ""
	if threshold < 1 {
		threshold = 1
	}
	if failures >= threshold {
		status = domain.BackendStatusAbnormal
		recoverAt = formatTime(now.UTC().Add(cooldown))
	}
	_, err = s.db.ExecContext(ctx, `
		UPDATE backends
		SET status = ?, consecutive_failures = ?, recover_at = ?, updated_at = ?
		WHERE id = ?
	`, status, failures, recoverAt, formatTime(now.UTC()), backendID)
	if err != nil {
		return domain.Backend{}, err
	}
	return s.GetBackend(ctx, backendID)
}

func (s *Store) RecoverExpiredBackends(ctx context.Context, now time.Time) error {
	_, err := s.db.ExecContext(ctx, `
		UPDATE backends
		SET status = ?, consecutive_failures = 0, recover_at = '', updated_at = ?
		WHERE status = ? AND recover_at != '' AND recover_at <= ?
	`, domain.BackendStatusNormal, formatTime(now.UTC()), domain.BackendStatusAbnormal, formatTime(now.UTC()))
	return err
}
```

- [ ] **Step 4: Run the store tests to verify they pass**

Run:

```bash
GOCACHE=/root/workspace/token-gate/.gocache go test ./internal/store -run 'TestCreateBackendDefaultsToNormalStatus|TestBackendFailureLifecyclePersistsInSQLite' -v
```

Expected:

- PASS for both new store tests

- [ ] **Step 5: Commit**

```bash
git add internal/domain/types.go internal/store/store.go internal/store/store_test.go
git commit -m "refactor: persist backend runtime state"
```

## Task 2: Replace Policy-Based Scheduler with Weight-Ordered Backend Selection

**Files:**
- Modify: `internal/scheduler/scheduler.go`
- Modify: `internal/scheduler/scheduler_test.go`
- Test: `internal/scheduler/scheduler_test.go`

- [ ] **Step 1: Write the failing scheduler tests**

Replace the existing policy/route-based scheduler coverage with explicit status- and weight-based tests:

```go
func TestSelectBackendOnlyReturnsNormalBackendsOrderedByWeight(t *testing.T) {
	ctx := context.Background()
	st := openTestStore(t)
	defer st.Close()

	disabled := createBackend(t, st, domain.Backend{
		Name:      "disabled",
		Protocol:  domain.BackendProtocolOpenAI,
		BaseURL:   "https://disabled.local/v1",
		APIKey:    "disabled-key",
		Weight:    100,
		Models:    []string{"gpt-4o"},
		Endpoints: []string{domain.EndpointChat},
	})
	disabled.Status = domain.BackendStatusDisabled
	if _, err := st.UpdateBackend(ctx, disabled); err != nil {
		t.Fatalf("disable backend: %v", err)
	}
	high := createBackend(t, st, domain.Backend{
		Name:      "high",
		Protocol:  domain.BackendProtocolOpenAI,
		BaseURL:   "https://high.local/v1",
		APIKey:    "high-key",
		Weight:    9,
		Models:    []string{"gpt-4o"},
		Endpoints: []string{domain.EndpointChat},
	})
	low := createBackend(t, st, domain.Backend{
		Name:      "low",
		Protocol:  domain.BackendProtocolOpenAI,
		BaseURL:   "https://low.local/v1",
		APIKey:    "low-key",
		Weight:    3,
		Models:    []string{"gpt-4o"},
		Endpoints: []string{domain.EndpointChat},
	})

	service := New(st, time.Minute, 2)
	selection, err := service.SelectBackend(ctx, domain.EndpointChat, "gpt-4o")
	if err != nil {
		t.Fatalf("SelectBackend returned error: %v", err)
	}
	if len(selection.Candidates) != 2 {
		t.Fatalf("expected two normal candidates, got %d", len(selection.Candidates))
	}
	if selection.Candidates[0].ID != high.ID || selection.Candidates[1].ID != low.ID {
		t.Fatalf("unexpected candidate order: %#v", selection.Candidates)
	}
}

func TestSelectBackendRefreshesExpiredAbnormalBackends(t *testing.T) {
	ctx := context.Background()
	st := openTestStore(t)
	defer st.Close()

	backend := createBackend(t, st, domain.Backend{
		Name:      "recoverable",
		Protocol:  domain.BackendProtocolOpenAI,
		BaseURL:   "https://recover.local/v1",
		APIKey:    "recover-key",
		Weight:    4,
		Models:    []string{"gpt-4o"},
		Endpoints: []string{domain.EndpointChat},
	})
	if _, err := st.MarkBackendFailure(ctx, backend.ID, 1, time.Second, time.Now().UTC().Add(-time.Minute)); err != nil {
		t.Fatalf("mark backend abnormal: %v", err)
	}

	service := New(st, time.Minute, 2)
	selection, err := service.SelectBackend(ctx, domain.EndpointChat, "gpt-4o")
	if err != nil {
		t.Fatalf("SelectBackend returned error: %v", err)
	}
	if len(selection.Candidates) != 1 || selection.Candidates[0].ID != backend.ID {
		t.Fatalf("expected recovered backend to be schedulable, got %#v", selection.Candidates)
	}
}

func TestSelectBackendMatchesMappedClientModel(t *testing.T) {
	ctx := context.Background()
	st := openTestStore(t)
	defer st.Close()

	backend := createBackend(t, st, domain.Backend{
		Name:         "mapped",
		Protocol:     domain.BackendProtocolOpenAI,
		BaseURL:      "https://mapped.local/v1",
		APIKey:       "mapped-key",
		Weight:       5,
		Models:       []string{"gpt-5.4-test"},
		ModelMapping: map[string]string{"gpt-5.4": "gpt-5.4-test"},
		Endpoints:    []string{domain.EndpointChat},
	})

	service := New(st, time.Minute, 2)
	selection, err := service.SelectBackend(ctx, domain.EndpointChat, "gpt-5.4")
	if err != nil {
		t.Fatalf("SelectBackend returned error: %v", err)
	}
	if len(selection.Candidates) != 1 || selection.Candidates[0].ID != backend.ID {
		t.Fatalf("expected mapped backend to match client model, got %#v", selection.Candidates)
	}
}
```

- [ ] **Step 2: Run the scheduler tests to verify they fail**

Run:

```bash
GOCACHE=/root/workspace/token-gate/.gocache go test ./internal/scheduler -run 'TestSelectBackendOnlyReturnsNormalBackendsOrderedByWeight|TestSelectBackendRefreshesExpiredAbnormalBackends|TestSelectBackendMatchesMappedClientModel' -v
```

Expected:

- FAIL because `SelectBackend` still requires a client key and still depends on policies/placement/pool state

- [ ] **Step 3: Implement the simplified scheduler**

Replace the current scheduler core with a persisted-state, weight-ordered selector:

```go
type Selection struct {
	Candidates []domain.Backend `json:"candidates"`
}

type Service struct {
	store           *store.Store
	backendCooldown time.Duration
	backendFails    int
}

func New(store *store.Store, backendCooldown time.Duration, backendFails int) *Service {
	if backendFails < 1 {
		backendFails = 1
	}
	return &Service{
		store:           store,
		backendCooldown: backendCooldown,
		backendFails:    backendFails,
	}
}

func (s *Service) SelectBackend(ctx context.Context, endpoint, model string) (Selection, error) {
	if err := s.store.RecoverExpiredBackends(ctx, time.Now().UTC()); err != nil {
		return Selection{}, err
	}
	backends, err := s.store.ListBackends(ctx)
	if err != nil {
		return Selection{}, err
	}

	var candidates []domain.Backend
	for _, backend := range backends {
		if backend.Status != domain.BackendStatusNormal {
			continue
		}
		if !supportsEndpoint(backend.Endpoints, endpoint) {
			continue
		}
		if !supportsBackendModel(backend, model) {
			continue
		}
		candidates = append(candidates, backend)
	}

	sort.SliceStable(candidates, func(i, j int) bool {
		if candidates[i].Weight == candidates[j].Weight {
			return candidates[i].ID < candidates[j].ID
		}
		return candidates[i].Weight > candidates[j].Weight
	})

	if len(candidates) == 0 {
		return Selection{}, ErrNoBackendAvailable
	}
	return Selection{Candidates: candidates}, nil
}

func (s *Service) MarkSuccess(ctx context.Context, backendID int64) error {
	_, err := s.store.MarkBackendSuccess(ctx, backendID)
	return err
}

func (s *Service) MarkFailure(ctx context.Context, backendID int64, cause error) error {
	_, err := s.store.MarkBackendFailure(ctx, backendID, s.backendFails, s.backendCooldown, time.Now().UTC())
	return err
}
```

Delete:

- `pickPolicy`
- `effectivePlacement`
- `buildRouteKey`
- rendezvous hashing
- `Acquire`
- in-memory runtime state map
- pool filtering

- [ ] **Step 4: Run the scheduler tests to verify they pass**

Run:

```bash
GOCACHE=/root/workspace/token-gate/.gocache go test ./internal/scheduler -run 'TestSelectBackendOnlyReturnsNormalBackendsOrderedByWeight|TestSelectBackendRefreshesExpiredAbnormalBackends|TestSelectBackendMatchesMappedClientModel' -v
```

Expected:

- PASS for all three scheduler tests

- [ ] **Step 5: Commit**

```bash
git add internal/scheduler/scheduler.go internal/scheduler/scheduler_test.go
git commit -m "refactor: simplify backend scheduler"
```

## Task 3: Rewrite Public Proxy Flow Around `2xx` Success and `503` Exhaustion

**Files:**
- Modify: `internal/app/app.go`
- Modify: `internal/app/app_test.go`
- Test: `internal/app/app_test.go`

- [ ] **Step 1: Write the failing proxy/app tests**

Add app-layer tests that enforce the new public behavior:

```go
func TestProxyRetriesOnAnyNon2xxAndReturnsSuccessFromLaterBackend(t *testing.T) {
	application := newTestApp(t)
	client := createTestClient(t, application, "client-secret")
	backends := []domain.Backend{
		createTestBackend(t, application, domain.Backend{
			Name:      "alpha",
			Protocol:  domain.BackendProtocolOpenAI,
			BaseURL:   "https://alpha.local/v1",
			APIKey:    "alpha-key",
			Status:    domain.BackendStatusNormal,
			Weight:    9,
			Models:    []string{"gpt-4o"},
			Endpoints: []string{domain.EndpointChat},
		}),
		createTestBackend(t, application, domain.Backend{
			Name:      "beta",
			Protocol:  domain.BackendProtocolOpenAI,
			BaseURL:   "https://beta.local/v1",
			APIKey:    "beta-key",
			Status:    domain.BackendStatusNormal,
			Weight:    3,
			Models:    []string{"gpt-4o"},
			Endpoints: []string{domain.EndpointChat},
		}),
	}
	fixture := newFailoverFixture(t, backends)
	fixture.statusByName["alpha"] = http.StatusUnauthorized
	fixture.statusByName["beta"] = http.StatusOK
	application.proxy = proxy.NewWithHTTPClient(&http.Client{Transport: fixture})

	req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(`{"model":"gpt-4o","messages":[{"role":"user","content":"hello"}]}`))
	req.Header.Set("Authorization", "Bearer "+client.Token)
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200 from fallback backend, got %d body=%s", recorder.Code, recorder.Body.String())
	}
}

func TestProxyReturns503WhenAllCandidatesFail(t *testing.T) {
	application := newTestApp(t)
	client := createTestClient(t, application, "client-secret")
	backends := []domain.Backend{
		createTestBackend(t, application, domain.Backend{
			Name:      "alpha",
			Protocol:  domain.BackendProtocolOpenAI,
			BaseURL:   "https://alpha.local/v1",
			APIKey:    "alpha-key",
			Status:    domain.BackendStatusNormal,
			Weight:    9,
			Models:    []string{"gpt-4o"},
			Endpoints: []string{domain.EndpointChat},
		}),
		createTestBackend(t, application, domain.Backend{
			Name:      "beta",
			Protocol:  domain.BackendProtocolOpenAI,
			BaseURL:   "https://beta.local/v1",
			APIKey:    "beta-key",
			Status:    domain.BackendStatusNormal,
			Weight:    3,
			Models:    []string{"gpt-4o"},
			Endpoints: []string{domain.EndpointChat},
		}),
	}
	fixture := newFailoverFixture(t, backends)
	fixture.statusByName["alpha"] = http.StatusTooManyRequests
	fixture.statusByName["beta"] = http.StatusBadGateway
	application.proxy = proxy.NewWithHTTPClient(&http.Client{Transport: fixture})

	req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(`{"model":"gpt-4o","messages":[{"role":"user","content":"hello"}]}`))
	req.Header.Set("Authorization", "Bearer "+client.Token)
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 when all backends fail, got %d body=%s", recorder.Code, recorder.Body.String())
	}
}

func TestPublicModelsListsOnlyNormalBackends(t *testing.T) {
	application := newTestApp(t)
	createTestClient(t, application, "client-secret")
	createTestBackend(t, application, domain.Backend{
		Name:      "normal",
		Protocol:  domain.BackendProtocolOpenAI,
		BaseURL:   "https://normal.local/v1",
		APIKey:    "normal-key",
		Status:    domain.BackendStatusNormal,
		Weight:    1,
		Models:    []string{"gpt-4o"},
		Endpoints: []string{domain.EndpointChat},
	})
	createTestBackend(t, application, domain.Backend{
		Name:      "disabled",
		Protocol:  domain.BackendProtocolOpenAI,
		BaseURL:   "https://disabled.local/v1",
		APIKey:    "disabled-key",
		Status:    domain.BackendStatusDisabled,
		Weight:    1,
		Models:    []string{"gpt-4.1"},
		Endpoints: []string{domain.EndpointChat},
	})

	req := httptest.NewRequest(http.MethodGet, "/v1/models", nil)
	req.Header.Set("Authorization", "Bearer client-secret")
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}
	if strings.Contains(recorder.Body.String(), "gpt-4.1") {
		t.Fatalf("disabled backend model should not appear: %s", recorder.Body.String())
	}
}
```

- [ ] **Step 2: Run the app tests to verify they fail**

Run:

```bash
GOCACHE=/root/workspace/token-gate/.gocache go test ./internal/app -run 'TestProxyRetriesOnAnyNon2xxAndReturnsSuccessFromLaterBackend|TestProxyReturns503WhenAllCandidatesFail|TestPublicModelsListsOnlyNormalBackends' -v
```

Expected:

- FAIL because the current app still calls the old scheduler signature, still uses policy fields, and still treats failures with `502` semantics

- [ ] **Step 3: Implement the simplified proxy selection loop**

Update `internal/app/app.go`:

```go
selection, err := a.scheduler.SelectBackend(r.Context(), endpoint, model)
if err != nil {
	usageLog.StatusCode = http.StatusServiceUnavailable
	usageLog.ErrorMessage = err.Error()
	writeError(w, http.StatusServiceUnavailable, "no backend available")
	return
}

for _, backend := range selection.Candidates {
	upstreamModel := mappedBackendModel(backend, model)
	requestBody := body
	if upstreamModel != model {
		requestBody, err = proxy.RewriteModel(body, upstreamModel)
		if err != nil {
			usageLog.StatusCode = http.StatusServiceUnavailable
			usageLog.ErrorMessage = "rewrite model failed: " + err.Error()
			writeError(w, http.StatusServiceUnavailable, "no backend available")
			return
		}
	}

	resp, err := a.proxy.Do(a.withBackendTrace(r.Context(), backend, attempt), r, backend, requestBody)
	if err != nil {
		_ = a.scheduler.MarkFailure(r.Context(), backend.ID, err)
		lastErr = err
		continue
	}

	if resp.StatusCode/100 != 2 {
		_ = a.scheduler.MarkFailure(r.Context(), backend.ID, errors.New(resp.Status))
		_, _ = io.Copy(io.Discard, resp.Body)
		_ = resp.Body.Close()
		lastStatus = resp.StatusCode
		continue
	}

	_ = a.scheduler.MarkSuccess(r.Context(), backend.ID)
	usageLog.StatusCode = resp.StatusCode
	usageLog.StatusFamily = statusFamily(resp.StatusCode)
	return proxy.WriteResponse(w, resp)
}

usageLog.StatusCode = http.StatusServiceUnavailable
usageLog.StatusFamily = statusFamily(http.StatusServiceUnavailable)
if lastErr != nil {
	usageLog.ErrorMessage = lastErr.Error()
} else {
	usageLog.ErrorMessage = "all candidate backends failed"
}
writeError(w, http.StatusServiceUnavailable, "no backend available")
```

Also update `/v1/models` filtering:

```go
for _, backend := range backends {
	if backend.Status != domain.BackendStatusNormal {
		continue
	}
	// existing model collection logic
}
```

Remove all usage-log assignments and logging fields tied to deleted routing concepts:

```go
usageLog := domain.UsageLog{
	RequestID:          requestIDFromContext(r.Context()),
	TraceID:            requestIDFromContext(r.Context()),
	ClientID:           client.ID,
	ClientName:         client.Name,
	ClientTokenPrefix:  client.TokenPrefix,
	Method:             r.Method,
	Path:               r.URL.Path,
	Query:              r.URL.RawQuery,
	ClientIP:           clientIP(r),
	UserAgent:          r.UserAgent(),
	RequestHeadersJSON: marshalHeaders(redactedHeaders(r.Header)),
}
```

- [ ] **Step 4: Run the app tests to verify they pass**

Run:

```bash
GOCACHE=/root/workspace/token-gate/.gocache go test ./internal/app -run 'TestProxyRetriesOnAnyNon2xxAndReturnsSuccessFromLaterBackend|TestProxyReturns503WhenAllCandidatesFail|TestPublicModelsListsOnlyNormalBackends' -v
```

Expected:

- PASS for all three new app tests

- [ ] **Step 5: Commit**

```bash
git add internal/app/app.go internal/app/app_test.go
git commit -m "fix: use weight-based backend failover"
```

## Task 4: Remove Policy and Route Concepts from Admin API

**Files:**
- Modify: `internal/app/app.go`
- Modify: `internal/app/app_test.go`
- Modify: `internal/store/store.go`
- Test: `internal/app/app_test.go`

- [ ] **Step 1: Write the failing admin API tests**

Add tests that lock down removed endpoints and new backend/client payload semantics:

```go
func TestCreateBackendDefaultsToNormalStatus(t *testing.T) {
	application := newTestApp(t)

	req := httptest.NewRequest(http.MethodPost, "/admin/api/backends", strings.NewReader(`{
		"name":"edge-a",
		"protocol":"openai",
		"base_url":"https://edge-a.local/v1",
		"api_key":"edge-a-key",
		"proxy_id":0,
		"weight":7,
		"models":["gpt-4o"],
		"model_mapping":{"gpt-5.4":"gpt-5.4-test"},
		"endpoints":["chat"]
	}`))
	req.Header.Set("Authorization", "Bearer "+application.cfg.AdminToken)
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), `"status":"normal"`) {
		t.Fatalf("expected backend status normal, got %s", recorder.Body.String())
	}
}

func TestUpdateBackendRejectsAbnormalStatus(t *testing.T) {
	application := newTestApp(t)
	backend := createTestBackend(t, application, domain.Backend{
		Name:      "edge-a",
		Protocol:  domain.BackendProtocolOpenAI,
		BaseURL:   "https://edge-a.local/v1",
		APIKey:    "edge-a-key",
		Status:    domain.BackendStatusNormal,
		Weight:    7,
		Models:    []string{"gpt-4o"},
		Endpoints: []string{domain.EndpointChat},
	})

	req := httptest.NewRequest(http.MethodPut, fmt.Sprintf("/admin/api/backends/%d", backend.ID), strings.NewReader(`{
		"name":"edge-a",
		"protocol":"openai",
		"base_url":"https://edge-a.local/v1",
		"api_key":"edge-a-key",
		"proxy_id":0,
		"status":"abnormal",
		"weight":7,
		"models":["gpt-4o"],
		"model_mapping":{},
		"endpoints":["chat"]
	}`))
	req.SetPathValue("id", strconv.FormatInt(backend.ID, 10))
	req.Header.Set("Authorization", "Bearer "+application.cfg.AdminToken)
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d body=%s", recorder.Code, recorder.Body.String())
	}
}

func TestPolicyRoutesRemoved(t *testing.T) {
	application := newTestApp(t)

	req := httptest.NewRequest(http.MethodGet, "/admin/api/model-policies/1/detail", nil)
	req.Header.Set("Authorization", "Bearer "+application.cfg.AdminToken)
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for removed policy route, got %d", recorder.Code)
	}
}

func TestCreateClientKeyRejectsLegacyRouteFields(t *testing.T) {
	application := newTestApp(t)

	req := httptest.NewRequest(http.MethodPost, "/admin/api/client-keys", strings.NewReader(`{
		"name":"legacy-client",
		"enabled":true,
		"route_mode_override":"sticky"
	}`))
	req.Header.Set("Authorization", "Bearer "+application.cfg.AdminToken)
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for removed route fields, got %d body=%s", recorder.Code, recorder.Body.String())
	}
}
```

- [ ] **Step 2: Run the admin API tests to verify they fail**

Run:

```bash
GOCACHE=/root/workspace/token-gate/.gocache go test ./internal/app -run 'TestCreateBackendDefaultsToNormalStatus|TestUpdateBackendRejectsAbnormalStatus|TestPolicyRoutesRemoved|TestCreateClientKeyRejectsLegacyRouteFields' -v
```

Expected:

- FAIL because backend payloads still use `pool/enabled`, policy routes are still registered, and client payloads still accept route fields

- [ ] **Step 3: Implement the admin API removals and payload updates**

Delete policy route registration and handler functions from `internal/app/app.go`.

Update backend create/update payloads:

```go
var payload struct {
	Name         string            `json:"name"`
	Protocol     string            `json:"protocol"`
	BaseURL      string            `json:"base_url"`
	APIKey       string            `json:"api_key"`
	ProxyID      int64             `json:"proxy_id"`
	Status       string            `json:"status"`
	Weight       int               `json:"weight"`
	Models       []string          `json:"models"`
	ModelMapping map[string]string `json:"model_mapping"`
	Endpoints    []string          `json:"endpoints"`
}
```

Backend create writes no user-supplied status:

```go
backend, err := a.store.CreateBackend(r.Context(), domain.Backend{
	Name:         payload.Name,
	Protocol:     domain.NormalizeBackendProtocol(payload.Protocol),
	BaseURL:      payload.BaseURL,
	APIKey:       payload.APIKey,
	ProxyID:      payload.ProxyID,
	Weight:       payload.Weight,
	Models:       payload.Models,
	ModelMapping: payload.ModelMapping,
	Endpoints:    payload.Endpoints,
})
```

Backend update validates admin-controlled status:

```go
switch payload.Status {
case domain.BackendStatusNormal, domain.BackendStatusDisabled:
	current.Status = payload.Status
case "":
	// keep existing status
default:
	writeError(w, http.StatusBadRequest, "invalid backend status")
	return
}
```

Client payloads remove route fields completely:

```go
var payload struct {
	Name    string `json:"name"`
	Token   string `json:"token"`
	Enabled bool   `json:"enabled"`
}
```

Remove policy overview/detail/search references and backend detail fields:

```go
Overview: []resourceDetailEntry{
	detailEntry("name", "Name", detail.Backend.Name),
	detailEntry("status", "Status", detail.Backend.Status),
	detailEntry("consecutive_failures", "Consecutive Failures", detail.Backend.ConsecutiveFailures),
	detailEntry("recover_at", "Recover At", detail.Backend.RecoverAt),
	detailEntry("proxy_id", "Proxy ID", detail.Backend.ProxyID),
	detailEntry("protocol", "Protocol", detail.Backend.Protocol),
	detailEntry("weight", "Weight", detail.Backend.Weight),
},
```

- [ ] **Step 4: Run the admin API tests to verify they pass**

Run:

```bash
GOCACHE=/root/workspace/token-gate/.gocache go test ./internal/app -run 'TestCreateBackendDefaultsToNormalStatus|TestUpdateBackendRejectsAbnormalStatus|TestPolicyRoutesRemoved|TestCreateClientKeyRejectsLegacyRouteFields' -v
```

Expected:

- PASS for all four admin API tests

- [ ] **Step 5: Commit**

```bash
git add internal/app/app.go internal/app/app_test.go internal/store/store.go
git commit -m "refactor: remove policy and route admin APIs"
```

## Task 5: Remove Policy Page and Update Backend/Client UI to the New Model

**Files:**
- Modify: `internal/app/web/index.html`
- Modify: `internal/app/web/app.js`
- Modify: `internal/app/web/resource-state.js`
- Modify: `internal/app/web/resource-view.js`
- Modify: `internal/app/web/display-utils.js`
- Modify: `internal/app/web/renderers.js`
- Modify: `internal/app/web/drawer.js`
- Modify: `internal/app/web/drawer-view.js`
- Modify: `internal/app/web/settings.js`
- Modify: `internal/app/web/resource-data-runtime.js`
- Modify: `internal/app/web/console-data-runtime.js`
- Modify: `internal/app/web/*.test.mjs`
- Test: `internal/app/web/*.test.mjs`

- [ ] **Step 1: Write the failing frontend tests**

Update and add Node tests that lock down the deleted page and new backend/client rendering:

```js
test("applyResourceView filters backends by three-state status and weight", () => {
  const items = [
    { id: 1, name: "alpha", status: "normal", weight: 9, base_url: "https://alpha.local/v1", models: ["gpt-4o"], endpoints: ["chat"] },
    { id: 2, name: "beta", status: "abnormal", weight: 4, base_url: "https://beta.local/v1", models: ["gpt-4o"], endpoints: ["chat"] },
    { id: 3, name: "gamma", status: "disabled", weight: 7, base_url: "https://gamma.local/v1", models: ["gpt-4o"], endpoints: ["chat"] },
  ];
  const output = applyResourceView("backends", items, {
    backends: { query: "", filter: "normal", sort: "weight_desc" },
  });
  assert.deepEqual(output.map((item) => item.id), [1]);
});

test("renderBackendRow shows backend status instead of enabled and pool", () => {
  const html = renderBackendRow({
    backend: {
      id: 7,
      name: "edge-a",
      status: "abnormal",
      consecutive_failures: 3,
      recover_at: "2026-06-23T09:10:00Z",
      base_url: "https://edge-a.local/v1",
      weight: 9,
      model_count: 1,
      endpoint_count: 1,
      proxy_id: 0,
      protocol: "openai",
    },
    expanded: false,
    editing: false,
    quickDetails: "",
    statusPill: () => "",
    backendStatusPill: (status) => `<span>${status}</span>`,
    formatBackendRouting: () => "direct",
    formatBackendCoverage: () => "1 models / 1 endpoints",
    backendProtocolLabel: () => "OpenAI",
    formatUsageCount: () => "0 requests",
    formatLatency: () => "-",
    formatDateTime: (value) => value || "-",
    formatBackendRecentStats: () => "-",
    tableActions: () => "",
  });
  assert.match(html, /abnormal/);
  assert.doesNotMatch(html, /enabled/);
  assert.doesNotMatch(html, /pool/);
});

test("shell layout no longer includes model policies navigation", () => {
  assert.doesNotMatch(indexHTML, /model-policies/);
  assert.doesNotMatch(indexHTML, /Edit Policies/);
});

test("settings summary uses backend status counts instead of policies", () => {
  const model = createSettingsViewModel({
    adminTokenPresent: true,
    backends: [
      { status: "normal" },
      { status: "normal" },
      { status: "abnormal" },
      { status: "disabled" },
    ],
    clients: [{ enabled: true }],
    proxies: [{ enabled: true }],
    usageLogStats: {},
    usageLogMeta: {},
    eventSummary: {},
  });
  assert.equal(model.summaryCards[0].detail, "2 normal / 1 abnormal / 1 disabled");
});
```

- [ ] **Step 2: Run the frontend tests to verify they fail**

Run:

```bash
node --test internal/app/web/*.test.mjs
```

Expected:

- FAIL because the current frontend still has a policies page, backend `enabled/pool` assumptions, and client route-field rendering

- [ ] **Step 3: Implement the frontend removals and status updates**

Update `internal/app/web/index.html`:

```html
<!-- Remove the Policies nav item and dashboard quick action entirely -->

<div class="field-grid two-col">
  <label class="field">
    <span>Name</span>
    <input name="name" placeholder="edge-openai-1" required />
  </label>
  <label class="field">
    <span>Protocol</span>
    <select name="protocol">
      <option value="openai">OpenAI compatible</option>
      <option value="anthropic">Claude / Anthropic</option>
    </select>
  </label>
</div>

<!-- In backend edit mode only, expose admin-controlled status -->
<label class="field">
  <span>Status</span>
  <select name="status">
    <option value="normal">normal</option>
    <option value="disabled">disabled</option>
  </select>
</label>
```

Update `internal/app/web/app.js` resource config and handlers:

```js
const RESOURCE_VIEW_CONFIG = {
  proxies: { /* unchanged */ },
  backends: {
    searchPlaceholder: "Search backends, base URL, models",
    filterOptions: [
      { value: "all", label: "All status" },
      { value: "normal", label: "Normal" },
      { value: "abnormal", label: "Abnormal" },
      { value: "disabled", label: "Disabled" },
    ],
    sortOptions: [
      { value: "updated_desc", label: "Updated" },
      { value: "name_asc", label: "Name" },
      { value: "weight_desc", label: "Weight" },
    ],
  },
  clients: {
    searchPlaceholder: "Search client keys and token prefixes",
    filterOptions: [
      { value: "all", label: "All status" },
      { value: "enabled", label: "Enabled" },
      { value: "disabled", label: "Disabled" },
    ],
    sortOptions: [
      { value: "updated_desc", label: "Updated" },
      { value: "name_asc", label: "Name" },
    ],
  },
};
```

Normalize backend/client payloads:

```js
function normalizeBackendFormData(data, editing) {
  data.weight = Number.parseInt(data.weight, 10) || 1;
  data.proxy_id = Number.parseInt(data.proxy_id, 10) || 0;
  data.models = ResourceCrudUtils.splitList(data.models);
  data.endpoints = ResourceCrudUtils.splitList(data.endpoints);
  data.model_mapping = ResourceCrudUtils.parseModelMapping(data.model_mapping);
  if (!editing) {
    delete data.status;
  }
  return data;
}

function normalizeClientFormData(data) {
  data.enabled = Boolean(data.enabled);
  return data;
}
```

Update `resource-state.js`, `display-utils.js`, and `resource-view.js`:

```js
function resourceFilterPredicate(resourceKey, item, filter) {
  if (filter === "all" || !filter) {
    return true;
  }
  if (resourceKey === "backends") {
    return String(item?.status || "").toLowerCase() === filter;
  }
  return filter === "enabled" ? Boolean(item?.enabled) : !item?.enabled;
}

function resourceSearchText(resourceKey, item) {
  if (resourceKey === "backends") {
    return [item?.name, item?.base_url, ...(item?.models || []), ...(item?.endpoints || [])].filter(Boolean).join(" ").toLowerCase();
  }
  if (resourceKey === "clients") {
    return [item?.name, item?.token_prefix].filter(Boolean).join(" ").toLowerCase();
  }
  return "";
}

function backendStatusPill(status) {
  const value = String(status || "").toLowerCase();
  const tone = value === "normal" ? "ok" : value === "abnormal" ? "" : "off";
  return `<span class="status-pill ${tone}">${escapeHTML(value || "unknown")}</span>`;
}
```

Remove policy page support from:

- `index.html`
- `app.js`
- `drawer.js`
- `resource-data-runtime.js`
- `console-data-runtime.js`
- `settings.js`
- `renderers.js`
- `drawer-view.js`

- [ ] **Step 4: Run the frontend tests to verify they pass**

Run:

```bash
node --test internal/app/web/*.test.mjs
```

Expected:

- PASS for the updated frontend suite

- [ ] **Step 5: Commit**

```bash
git add internal/app/web/index.html internal/app/web/app.js internal/app/web/resource-state.js internal/app/web/resource-view.js internal/app/web/resource-crud.js internal/app/web/resource-data-runtime.js internal/app/web/console-data-runtime.js internal/app/web/display-utils.js internal/app/web/renderers.js internal/app/web/drawer.js internal/app/web/drawer-view.js internal/app/web/settings.js internal/app/web/*.test.mjs
git commit -m "refactor: remove policy page from admin UI"
```

## Task 6: End-to-End Verification and Fresh-DB Smoke Check

**Files:**
- Modify: `AGENTS.md`
- Modify: `README.md`
- Test: repo-wide verification commands

- [ ] **Step 1: Update the agent memory and runtime docs**

Update `AGENTS.md` and `README.md` to reflect the new scheduling model and removed concepts:

```md
- Backends now have persisted `normal`, `abnormal`, and `disabled` status.
- Scheduler uses endpoint/model filtering plus `weight DESC` failover.
- `model_policies`, `route_group`, `route_mode_override`, and `backend.pool` no longer exist.
- Existing old SQLite files are not compatible with the new schema; recreate the local DB file after pulling the change.
```

- [ ] **Step 2: Run the full automated verification**

Run:

```bash
GOCACHE=/root/workspace/token-gate/.gocache go test ./...
```

Expected:

- PASS for all Go packages

Run:

```bash
node --test internal/app/web/*.test.mjs
```

Expected:

- PASS for the full frontend suite

Run:

```bash
GOCACHE=/root/workspace/token-gate/.gocache go build ./...
```

Expected:

- exit `0`

- [ ] **Step 3: Recreate the local SQLite database and do a runtime smoke test**

Because the new schema intentionally drops old columns/tables with no compatibility migration, remove the local dev database before first runtime check:

```bash
rm -f /root/workspace/token-gate/token-gate.db
```

Start the app:

```bash
TG_ADMIN_TOKEN=dev-admin-token TG_DB_PATH=/root/workspace/token-gate/token-gate.db ./start.sh
```

Expected:

- app starts cleanly
- new DB file is created
- `/admin/` loads without policy navigation
- backend create form shows no `pool` and no create-time `enabled`

- [ ] **Step 4: Spot-check the new scheduling behavior manually**

Use the admin API or UI to create:

- one `normal` backend with higher weight
- one `normal` backend with lower weight
- one `disabled` backend

Verify:

- the disabled backend is not used
- the higher-weight normal backend is attempted first
- a non-`2xx` on the first backend causes a retry to the next backend
- repeated failures move a backend to `abnormal`
- after `TG_BACKEND_COOLDOWN`, the backend returns to `normal`

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md README.md
git commit -m "docs: update scheduling and schema guidance"
```
