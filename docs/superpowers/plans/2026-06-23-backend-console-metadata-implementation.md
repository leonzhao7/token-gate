# Backend Console Metadata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing `Backends` resource so it stores console metadata, shows relay-station-oriented list columns, and preserves existing proxy/scheduler behavior.

**Architecture:** Add backend metadata fields end-to-end through `domain.Backend`, SQLite inline migrations, store CRUD/list/detail paths, and admin HTTP payloads. Reuse the current embedded admin page structure, but change backend list rendering to show console URL, tags, models, hourly request/failure counters, and average latency while moving the rest into expanded detail and drawer payloads.

**Tech Stack:** Go 1.25, `net/http`, SQLite via `database/sql`, embedded vanilla JS modules, Node test runner, Go test

---

### Task 1: Add store-level backend metadata persistence

**Files:**
- Modify: `internal/domain/types.go`
- Modify: `internal/store/store.go`
- Test: `internal/store/store_test.go`

- [ ] **Step 1: Write the failing store tests**

Add these tests to `internal/store/store_test.go`:

```go
func TestCreateBackendPersistsConsoleMetadata(t *testing.T) {
	st := openTestStore(t)
	defer st.Close()

	backend, err := st.CreateBackend(context.Background(), domain.Backend{
		Name:            "edge-a",
		Protocol:        domain.BackendProtocolOpenAI,
		BaseURL:         "https://edge-a.local/v1",
		APIKey:          "edge-a-key",
		ConsoleURL:      "https://console.edge-a.local",
		Tags:            []string{"hk", "priority"},
		ConsoleUsername: "admin-a",
		ConsolePassword: "secret-a",
		Notes:           "primary relay station",
		Weight:          9,
		Models:          []string{"gpt-4o"},
		Endpoints:       []string{domain.EndpointChat},
	})
	if err != nil {
		t.Fatalf("CreateBackend returned error: %v", err)
	}

	if backend.ConsoleURL != "https://console.edge-a.local" {
		t.Fatalf("expected console url to round-trip, got %q", backend.ConsoleURL)
	}
	if !reflect.DeepEqual(backend.Tags, []string{"hk", "priority"}) {
		t.Fatalf("expected tags to round-trip, got %#v", backend.Tags)
	}
	if backend.ConsoleUsername != "admin-a" {
		t.Fatalf("expected console username to round-trip, got %q", backend.ConsoleUsername)
	}
	if backend.ConsolePassword != "secret-a" {
		t.Fatalf("expected console password to round-trip, got %q", backend.ConsolePassword)
	}
	if backend.Notes != "primary relay station" {
		t.Fatalf("expected notes to round-trip, got %q", backend.Notes)
	}
}

func TestOpenMigratesLegacyBackendsConsoleMetadataColumns(t *testing.T) {
	dbPath := t.TempDir() + "/legacy-console.db"
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		t.Fatalf("open legacy sqlite: %v", err)
	}
	_, err = db.Exec(`
		CREATE TABLE backends (
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
		);
	`)
	if closeErr := db.Close(); closeErr != nil {
		t.Fatalf("close legacy sqlite: %v", closeErr)
	}
	if err != nil {
		t.Fatalf("create legacy backends table: %v", err)
	}

	st, err := Open(context.Background(), dbPath)
	if err != nil {
		t.Fatalf("Open should migrate legacy console metadata columns: %v", err)
	}
	defer st.Close()

	backend, err := st.CreateBackend(context.Background(), domain.Backend{
		Name:            "edge-legacy",
		Protocol:        domain.BackendProtocolOpenAI,
		BaseURL:         "https://edge-legacy.local/v1",
		APIKey:          "edge-key",
		ConsoleURL:      "https://console.edge-legacy.local",
		Tags:            []string{"legacy"},
		ConsoleUsername: "admin-legacy",
		ConsolePassword: "secret-legacy",
		Notes:           "migrated db",
		Models:          []string{"gpt-4o"},
		Endpoints:       []string{domain.EndpointChat},
	})
	if err != nil {
		t.Fatalf("CreateBackend after migration returned error: %v", err)
	}

	if backend.ConsoleURL != "https://console.edge-legacy.local" || backend.ConsoleUsername != "admin-legacy" {
		t.Fatalf("expected migrated metadata support, got %#v", backend)
	}
	if !reflect.DeepEqual(backend.Tags, []string{"legacy"}) {
		t.Fatalf("expected migrated tags support, got %#v", backend.Tags)
	}
}
```

- [ ] **Step 2: Run the targeted store tests to verify they fail**

Run:

```bash
GOCACHE=/root/workspace/token-gate/.gocache go test ./internal/store -run 'Test(CreateBackendPersistsConsoleMetadata|OpenMigratesLegacyBackendsConsoleMetadataColumns)$'
```

Expected: FAIL with unknown `Backend` fields and/or missing migrated columns.

- [ ] **Step 3: Write the minimal store/domain implementation**

Update `internal/domain/types.go` to extend `Backend`:

```go
type Backend struct {
	ID                  int64             `json:"id"`
	Name                string            `json:"name"`
	Protocol            string            `json:"protocol"`
	BaseURL             string            `json:"base_url"`
	APIKey              string            `json:"api_key,omitempty"`
	ConsoleURL          string            `json:"console_url"`
	Tags                []string          `json:"tags"`
	ConsoleUsername     string            `json:"console_username"`
	ConsolePassword     string            `json:"console_password,omitempty"`
	Notes               string            `json:"notes"`
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

Update `internal/store/store.go`:

```go
// In backends table schema:
console_url TEXT NOT NULL DEFAULT '',
tag_list TEXT NOT NULL DEFAULT '[]',
console_username TEXT NOT NULL DEFAULT '',
console_password TEXT NOT NULL DEFAULT '',
notes TEXT NOT NULL DEFAULT '',
```

```go
// In Open migrations:
if err := ensureColumn(ctx, db, "backends", "console_url", "TEXT NOT NULL DEFAULT ''"); err != nil {
	return nil, fmt.Errorf("migrate backends console_url: %w", err)
}
if err := ensureColumn(ctx, db, "backends", "tag_list", "TEXT NOT NULL DEFAULT '[]'"); err != nil {
	return nil, fmt.Errorf("migrate backends tag_list: %w", err)
}
if err := ensureColumn(ctx, db, "backends", "console_username", "TEXT NOT NULL DEFAULT ''"); err != nil {
	return nil, fmt.Errorf("migrate backends console_username: %w", err)
}
if err := ensureColumn(ctx, db, "backends", "console_password", "TEXT NOT NULL DEFAULT ''"); err != nil {
	return nil, fmt.Errorf("migrate backends console_password: %w", err)
}
if err := ensureColumn(ctx, db, "backends", "notes", "TEXT NOT NULL DEFAULT ''"); err != nil {
	return nil, fmt.Errorf("migrate backends notes: %w", err)
}
```

```go
// In backend INSERT/UPDATE SELECTs, add:
console_url, tag_list, console_username, console_password, notes
```

```go
// Normalize when writing:
strings.TrimSpace(backend.ConsoleURL)
mustEncodeList(cleanList(backend.Tags))
strings.TrimSpace(backend.ConsoleUsername)
strings.TrimSpace(backend.ConsolePassword)
strings.TrimSpace(backend.Notes)
```

```go
// Decode when scanning:
backend.ConsoleURL = strings.TrimSpace(consoleURL)
backend.Tags = decodeList(tagList)
backend.ConsoleUsername = strings.TrimSpace(consoleUsername)
backend.ConsolePassword = strings.TrimSpace(consolePassword)
backend.Notes = strings.TrimSpace(notes)
```

Add the helper only if needed:

```go
func cleanList(values []string) []string {
	out := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value != "" {
			out = append(out, value)
		}
	}
	return out
}
```

- [ ] **Step 4: Run the targeted store tests to verify they pass**

Run:

```bash
GOCACHE=/root/workspace/token-gate/.gocache go test ./internal/store -run 'Test(CreateBackendPersistsConsoleMetadata|OpenMigratesLegacyBackendsConsoleMetadataColumns)$'
```

Expected: PASS

- [ ] **Step 5: Commit the store/domain metadata changes**

```bash
git add internal/domain/types.go internal/store/store.go internal/store/store_test.go
git commit -m "feat: persist backend console metadata"
```

### Task 2: Extend backend admin API and hourly counters

**Files:**
- Modify: `internal/app/app.go`
- Modify: `internal/store/store.go`
- Test: `internal/app/app_test.go`

- [ ] **Step 1: Write the failing backend API tests**

Add these tests to `internal/app/app_test.go`:

```go
func TestAdminBackendCreateUpdateAndListIncludeConsoleMetadata(t *testing.T) {
	application := newTestApp(t)

	createReq := httptest.NewRequest(http.MethodPost, "/admin/api/backends", strings.NewReader(`{
		"name":"relay-a",
		"base_url":"https://relay-a.local/v1",
		"api_key":"relay-key",
		"console_url":"https://console.relay-a.local",
		"tags":["hk","priority"],
		"console_username":"admin-a",
		"console_password":"secret-a",
		"notes":"primary relay",
		"weight":1,
		"models":["gpt-4o","claude-sonnet-4"],
		"endpoints":["chat","messages"]
	}`))
	createReq.Header.Set("Authorization", "Bearer test-admin")
	createRecorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(createRecorder, createReq)
	if createRecorder.Code != http.StatusCreated {
		t.Fatalf("expected create status 201, got %d body=%s", createRecorder.Code, createRecorder.Body.String())
	}

	var created domain.Backend
	if err := json.Unmarshal(createRecorder.Body.Bytes(), &created); err != nil {
		t.Fatalf("unmarshal create backend: %v", err)
	}
	if created.ConsoleURL != "https://console.relay-a.local" || created.ConsoleUsername != "admin-a" {
		t.Fatalf("expected created backend metadata, got %#v", created)
	}
	if !reflect.DeepEqual(created.Tags, []string{"hk", "priority"}) {
		t.Fatalf("expected created backend tags, got %#v", created.Tags)
	}
	if created.Notes != "primary relay" {
		t.Fatalf("expected created backend notes, got %#v", created)
	}

	updateReq := httptest.NewRequest(http.MethodPut, "/admin/api/backends/"+strconv.FormatInt(created.ID, 10), strings.NewReader(`{
		"name":"relay-a",
		"protocol":"openai",
		"base_url":"https://relay-a.local/v1",
		"api_key":"relay-key",
		"proxy_id":0,
		"status":"normal",
		"console_url":"https://console.relay-a-2.local",
		"tags":["priority","vip"],
		"console_username":"admin-b",
		"console_password":"secret-b",
		"notes":"updated relay",
		"weight":1,
		"models":["gpt-4o","claude-sonnet-4"],
		"model_mapping":{},
		"endpoints":["chat","messages"]
	}`))
	updateReq.Header.Set("Authorization", "Bearer test-admin")
	updateRecorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(updateRecorder, updateReq)
	if updateRecorder.Code != http.StatusOK {
		t.Fatalf("expected update status 200, got %d body=%s", updateRecorder.Code, updateRecorder.Body.String())
	}

	listReq := httptest.NewRequest(http.MethodGet, "/admin/api/backends", nil)
	listReq.Header.Set("Authorization", "Bearer test-admin")
	listRecorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(listRecorder, listReq)
	if listRecorder.Code != http.StatusOK {
		t.Fatalf("expected list status 200, got %d body=%s", listRecorder.Code, listRecorder.Body.String())
	}

	var payload struct {
		Items []struct {
			ID              int64    `json:"id"`
			ConsoleURL      string   `json:"console_url"`
			Tags            []string `json:"tags"`
			ConsoleUsername string   `json:"console_username"`
			ConsolePassword string   `json:"console_password"`
			Notes           string   `json:"notes"`
		} `json:"items"`
	}
	if err := json.Unmarshal(listRecorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal backend list: %v", err)
	}
	if len(payload.Items) != 1 {
		t.Fatalf("expected one backend item, got %#v", payload.Items)
	}
	item := payload.Items[0]
	if item.ID != created.ID || item.ConsoleURL != "https://console.relay-a-2.local" {
		t.Fatalf("expected updated console url in list payload, got %#v", item)
	}
	if !reflect.DeepEqual(item.Tags, []string{"priority", "vip"}) {
		t.Fatalf("expected updated tags in list payload, got %#v", item)
	}
	if item.ConsoleUsername != "admin-b" || item.ConsolePassword != "secret-b" || item.Notes != "updated relay" {
		t.Fatalf("expected updated console metadata in list payload, got %#v", item)
	}
}

func TestBackendListIncludesHourlyCountersAndDetailMetadata(t *testing.T) {
	application := newTestApp(t)
	ctx := context.Background()

	backend := createTestBackend(t, application, domain.Backend{
		Name:            "relay-hourly",
		BaseURL:         "https://relay-hourly.local/v1",
		APIKey:          "hourly-key",
		ConsoleURL:      "https://console.relay-hourly.local",
		Tags:            []string{"night"},
		ConsoleUsername: "console-user",
		ConsolePassword: "console-pass",
		Notes:           "night shift",
		Weight:          1,
		Models:          []string{"gpt-4o"},
		Endpoints:       []string{domain.EndpointChat},
	})

	now := time.Now().UTC()
	for index, statusCode := range []int{http.StatusOK, http.StatusBadGateway} {
		if err := application.store.AppendUsageLog(ctx, domain.UsageLog{
			RequestID:         fmt.Sprintf("hourly-%d", index),
			ClientID:          1,
			ClientName:        "hourly-client",
			ClientTokenPrefix: "hour",
			Method:            http.MethodPost,
			Path:              "/v1/chat/completions",
			Endpoint:          domain.EndpointChat,
			Model:             "gpt-4o",
			BackendID:         backend.ID,
			BackendName:       backend.Name,
			Attempts:          1,
			StatusCode:        statusCode,
			DurationMS:        90,
			CreatedAt:         now.Add(-30 * time.Minute),
		}); err != nil {
			t.Fatalf("append hourly usage log %d: %v", index, err)
		}
	}
	if err := application.store.AppendUsageLog(ctx, domain.UsageLog{
		RequestID:         "outside-window",
		ClientID:          1,
		ClientName:        "hourly-client",
		ClientTokenPrefix: "hour",
		Method:            http.MethodPost,
		Path:              "/v1/chat/completions",
		Endpoint:          domain.EndpointChat,
		Model:             "gpt-4o",
		BackendID:         backend.ID,
		BackendName:       backend.Name,
		Attempts:          1,
		StatusCode:        http.StatusBadGateway,
		DurationMS:        90,
		CreatedAt:         now.Add(-2 * time.Hour),
	}); err != nil {
		t.Fatalf("append stale usage log: %v", err)
	}

	listReq := httptest.NewRequest(http.MethodGet, "/admin/api/backends", nil)
	listReq.Header.Set("Authorization", "Bearer test-admin")
	listRecorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(listRecorder, listReq)
	if listRecorder.Code != http.StatusOK {
		t.Fatalf("expected backend list status 200, got %d body=%s", listRecorder.Code, listRecorder.Body.String())
	}

	var listPayload struct {
		Items []struct {
			ID             int64   `json:"id"`
			HourlyRequests int     `json:"hourly_requests"`
			HourlyFailures int     `json:"hourly_failures"`
			AvgLatencyMS   float64 `json:"avg_latency_ms"`
		} `json:"items"`
	}
	if err := json.Unmarshal(listRecorder.Body.Bytes(), &listPayload); err != nil {
		t.Fatalf("unmarshal backend list: %v", err)
	}
	if len(listPayload.Items) != 1 {
		t.Fatalf("expected one backend item, got %#v", listPayload.Items)
	}
	if listPayload.Items[0].HourlyRequests != 2 || listPayload.Items[0].HourlyFailures != 1 {
		t.Fatalf("expected hourly counters 2/1, got %#v", listPayload.Items[0])
	}

	detailReq := httptest.NewRequest(http.MethodGet, "/admin/api/backends/"+strconv.FormatInt(backend.ID, 10)+"/detail", nil)
	detailReq.Header.Set("Authorization", "Bearer test-admin")
	detailRecorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(detailRecorder, detailReq)
	if detailRecorder.Code != http.StatusOK {
		t.Fatalf("expected detail status 200, got %d body=%s", detailRecorder.Code, detailRecorder.Body.String())
	}

	var detailPayload struct {
		Overview      []resourceDetailEntry `json:"overview"`
		Configuration []resourceDetailEntry `json:"configuration"`
		Raw           domain.Backend        `json:"raw"`
	}
	if err := json.Unmarshal(detailRecorder.Body.Bytes(), &detailPayload); err != nil {
		t.Fatalf("unmarshal backend detail: %v", err)
	}
	overview := detailEntriesToMap(detailPayload.Overview)
	configuration := detailEntriesToMap(detailPayload.Configuration)
	if overview["console_url"] != "https://console.relay-hourly.local" {
		t.Fatalf("expected console url in overview, got %#v", overview)
	}
	if overview["console_username"] != "console-user" || overview["console_password"] != "console-pass" {
		t.Fatalf("expected console credentials in overview, got %#v", overview)
	}
	if configuration["notes"] != "night shift" {
		t.Fatalf("expected notes in configuration, got %#v", configuration)
	}
	if detailPayload.Raw.ConsoleURL != "https://console.relay-hourly.local" || detailPayload.Raw.Notes != "night shift" {
		t.Fatalf("expected raw console metadata, got %#v", detailPayload.Raw)
	}
}
```

- [ ] **Step 2: Run the targeted backend API tests to verify they fail**

Run:

```bash
GOCACHE=/root/workspace/token-gate/.gocache go test ./internal/app -run 'Test(AdminBackendCreateUpdateAndListIncludeConsoleMetadata|BackendListIncludesHourlyCountersAndDetailMetadata)$'
```

Expected: FAIL with missing JSON fields and missing hourly counters/detail fields.

- [ ] **Step 3: Write the minimal admin/store implementation**

In `internal/app/app.go`, extend the backend view and payload handling:

```go
type backendView struct {
	domain.Backend
	RequestCount   int                `json:"request_count"`
	AvgLatencyMS   float64            `json:"avg_latency_ms"`
	LastUsedAt     *time.Time         `json:"last_used_at,omitempty"`
	ModelCount     int                `json:"model_count"`
	EndpointCount  int                `json:"endpoint_count"`
	HourlyRequests int                `json:"hourly_requests"`
	HourlyFailures int                `json:"hourly_failures"`
	RecentStats    backendRecentStats `json:"recent_stats"`
}
```

Add the new payload fields in backend create/update handlers:

```go
ConsoleURL      string   `json:"console_url"`
Tags            []string `json:"tags"`
ConsoleUsername string   `json:"console_username"`
ConsolePassword string   `json:"console_password"`
Notes           string   `json:"notes"`
```

Validate the console URL only when present:

```go
if strings.TrimSpace(payload.ConsoleURL) != "" {
	if err := validateURL(payload.ConsoleURL); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
}
```

Pass the metadata through create/update:

```go
ConsoleURL:      payload.ConsoleURL,
Tags:            payload.Tags,
ConsoleUsername: payload.ConsoleUsername,
ConsolePassword: payload.ConsolePassword,
Notes:           payload.Notes,
```

Add a small hourly counter lookup in `internal/store/store.go`:

```go
type BackendHourlyStats struct {
	Requests int
	Failures int
}

func (s *Store) BackendHourlyStatsByIDs(ctx context.Context, ids []int64, since time.Time) (map[int64]BackendHourlyStats, error) {
	if len(ids) == 0 {
		return map[int64]BackendHourlyStats{}, nil
	}
	query := `SELECT backend_id, status_code FROM usage_logs WHERE backend_id IN (` + placeholders(len(ids)) + `) AND created_at >= ?`
	args := make([]any, 0, len(ids)+1)
	for _, id := range ids {
		args = append(args, id)
	}
	args = append(args, formatTime(since.UTC()))
	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	stats := make(map[int64]BackendHourlyStats, len(ids))
	for rows.Next() {
		var backendID int64
		var statusCode int
		if err := rows.Scan(&backendID, &statusCode); err != nil {
			return nil, err
		}
		item := stats[backendID]
		item.Requests++
		if domain.IsBackendFailureStatus(statusCode) {
			item.Failures++
		}
		stats[backendID] = item
	}
	return stats, rows.Err()
}
```

In `handleListBackends`, fetch the hourly window and merge it into the view:

```go
hourlyStats, err := a.store.BackendHourlyStatsByIDs(r.Context(), backendIDs(backends), time.Now().UTC().Add(-1*time.Hour))
if err != nil {
	writeError(w, http.StatusInternalServerError, err.Error())
	return
}
response := buildBackendViews(backends, summaries, stats, hourlyStats)
```

Extend the backend detail payload:

```go
Overview: []resourceDetailEntry{
	detailEntry("name", "Name", detail.Backend.Name),
	detailEntry("console_url", "Console URL", detail.Backend.ConsoleURL),
	detailEntry("console_username", "Console Username", detail.Backend.ConsoleUsername),
	detailEntry("console_password", "Console Password", detail.Backend.ConsolePassword),
	detailEntry("status", "Status", detail.Backend.Status),
	...
},
Configuration: []resourceDetailEntry{
	detailEntry("tags", "Tags", detail.Backend.Tags),
	detailEntry("notes", "Notes", detail.Backend.Notes),
	detailEntry("models", "Models", detail.Backend.Models),
	...
},
```

- [ ] **Step 4: Run the targeted backend API tests to verify they pass**

Run:

```bash
GOCACHE=/root/workspace/token-gate/.gocache go test ./internal/app -run 'Test(AdminBackendCreateUpdateAndListIncludeConsoleMetadata|BackendListIncludesHourlyCountersAndDetailMetadata)$'
```

Expected: PASS

- [ ] **Step 5: Commit the backend API changes**

```bash
git add internal/app/app.go internal/app/app_test.go internal/store/store.go
git commit -m "feat: expose backend console metadata"
```

### Task 3: Update backend frontend state, CRUD, and list/detail rendering

**Files:**
- Modify: `internal/app/web/app.js`
- Modify: `internal/app/web/index.html`
- Modify: `internal/app/web/resource-state.js`
- Modify: `internal/app/web/resource-view.js`
- Modify: `internal/app/web/renderers.js`
- Test: `internal/app/web/resource-state.test.mjs`
- Test: `internal/app/web/resource-view.test.mjs`
- Test: `internal/app/web/renderers.test.mjs`
- Test: `internal/app/web/resource-crud.test.mjs`

- [ ] **Step 1: Write the failing frontend tests**

Add or update these test cases:

`internal/app/web/resource-state.test.mjs`

```js
test("applyResourceView searches backend console metadata fields", () => {
  const items = [
    {
      id: 11,
      name: "edge-east",
      console_url: "https://console.east.example",
      tags: ["hk", "priority"],
      console_username: "east-admin",
      notes: "night shift",
      status: "normal",
      models: ["gpt-5.4"],
      updated_at: "2026-06-18T12:00:00Z",
    },
    {
      id: 12,
      name: "edge-west",
      console_url: "https://console.west.example",
      tags: ["us"],
      console_username: "west-admin",
      notes: "day shift",
      status: "disabled",
      models: ["claude-sonnet-4"],
      updated_at: "2026-06-19T12:00:00Z",
    },
  ];

  assert.deepEqual(
    applyResourceView("backends", items, {
      backends: { query: "night shift", filter: "normal", sort: "updated_desc" },
    }).map((item) => item.id),
    [11],
  );

  assert.deepEqual(
    applyResourceView("backends", items, {
      backends: { query: "console.west", filter: "disabled", sort: "updated_desc" },
    }).map((item) => item.id),
    [12],
  );
});
```

`internal/app/web/resource-view.test.mjs`

```js
test("renderBackendRow shows console url, tags, models, hourly counters, and average latency", () => {
  const backendRow = renderBackendRow({
    backend: {
      id: 2,
      name: "edge-a",
      console_url: "https://console.edge-a.example",
      status: "normal",
      tags: ["hk", "priority"],
      models: ["gpt-4o", "claude-sonnet-4"],
      hourly_requests: 19,
      hourly_failures: 2,
      avg_latency_ms: 41,
    },
    expanded: false,
    editing: true,
    quickDetails: "",
    statusPill() {
      return "<span>normal</span>";
    },
    formatTagList() {
      return "hk, priority";
    },
    formatModelList() {
      return "gpt-4o, claude-sonnet-4";
    },
    formatHourlyCount(value) {
      return `${value}`;
    },
    formatLatency() {
      return "41 ms";
    },
    tableActions() {
      return "<div>actions</div>";
    },
  });

  assert.match(backendRow, /https:\/\/console\.edge-a\.example/);
  assert.match(backendRow, /hk, priority/);
  assert.match(backendRow, /gpt-4o, claude-sonnet-4/);
  assert.match(backendRow, />19</);
  assert.match(backendRow, />2</);
  assert.match(backendRow, /41 ms/);
});
```

`internal/app/web/renderers.test.mjs`

```js
test("createQuickDetailSections surfaces backend console metadata in inline expansion", () => {
  const sections = createQuickDetailSections("backends", {
    console_username: "console-user",
    console_password: "console-pass",
    notes: "night shift",
    proxy: { name: "tokyo-egress" },
    base_url: "https://edge.example.com/v1",
    model_mapping: { "gpt-4o": "gpt-4o-prod" },
    endpoints: ["chat", "responses"],
  });

  assert.deepEqual(sections, [
    {
      title: "Console Access",
      tone: "primary",
      items: [
        { label: "Username", value: "console-user" },
        { label: "Password", value: "set" },
        { label: "Notes", value: "night shift" },
      ],
    },
    {
      title: "Routing",
      tone: "success",
      items: [
        { label: "Proxy", value: "tokyo-egress" },
        { label: "Base URL", value: "https://edge.example.com/v1" },
      ],
    },
    {
      title: "Capabilities",
      tone: "neutral",
      items: [
        { label: "Endpoints", value: "chat, responses" },
        { label: "Mapping", value: '"gpt-4o":"gpt-4o-prod"' },
      ],
    },
  ]);
});
```

`internal/app/web/resource-crud.test.mjs`

```js
test("createResourceCrud assigns backend console metadata fields during edit and reset", () => {
  // Extend the existing backend harness expectations:
  // - form.elements.console_url
  // - form.elements.tags
  // - form.elements.console_username
  // - form.elements.console_password
  // - form.elements.notes
  // and assert those values are filled on startEdit and cleared/restored on reset.
});
```

- [ ] **Step 2: Run the targeted frontend tests to verify they fail**

Run:

```bash
node --test internal/app/web/resource-state.test.mjs internal/app/web/resource-view.test.mjs internal/app/web/renderers.test.mjs internal/app/web/resource-crud.test.mjs
```

Expected: FAIL with missing backend metadata search/render/form support.

- [ ] **Step 3: Write the minimal frontend implementation**

In `internal/app/web/index.html`, extend the backend modal:

```html
<label class="field">
  <span>Console URL</span>
  <input name="console_url" placeholder="https://console.example.com" />
</label>
<label class="field">
  <span>Tags</span>
  <input name="tags" placeholder="hk, priority, vip" />
</label>
<div class="field-grid two-col">
  <label class="field">
    <span>Console Username</span>
    <input name="console_username" placeholder="optional" />
  </label>
  <label class="field">
    <span>Console Password</span>
    <input name="console_password" type="password" placeholder="optional" />
  </label>
</div>
<label class="field">
  <span>Notes</span>
  <textarea name="notes" rows="3" placeholder="Operator notes"></textarea>
</label>
```

In `internal/app/web/app.js`, update backend headers and form mapping:

```js
headers: ["Name", "Console URL", "Status", "Tags", "Models", "Requests 1h", "Failures 1h", "Avg Latency", "Actions"],
```

```js
defaults: {
  protocol: "openai",
  api_key: { placeholder: "Backend API key" },
  proxy_id: "0",
  model_mapping: "",
  weight: 1,
  status: "normal",
  console_url: "",
  tags: "",
  console_username: "",
  console_password: "",
  notes: "",
},
assignEditValues(form, backend, helpers) {
  form.elements.name.value = backend.name || "";
  form.elements.status.value = backend.status || "normal";
  form.elements.protocol.value = backend.protocol || "openai";
  form.elements.base_url.value = backend.base_url || "";
  form.elements.api_key.value = backend.api_key || "";
  form.elements.console_url.value = backend.console_url || "";
  form.elements.tags.value = (backend.tags || []).join(", ");
  form.elements.console_username.value = backend.console_username || "";
  form.elements.console_password.value = backend.console_password || "";
  form.elements.notes.value = backend.notes || "";
  form.elements.proxy_id.value = String(backend.proxy_id || 0);
  form.elements.models.value = (backend.models || []).join(", ");
  form.elements.model_mapping.value = helpers.formatModelMappingInput(backend.model_mapping);
  form.elements.endpoints.value = (backend.endpoints || []).join(", ");
  form.elements.weight.value = backend.weight || 1;
},
```

When submitting backend create/update payloads:

```js
console_url: String(formValues.console_url || "").trim(),
tags: splitList(formValues.tags),
console_username: String(formValues.console_username || "").trim(),
console_password: String(formValues.console_password || "").trim(),
notes: String(formValues.notes || "").trim(),
```

In `resource-state.js`, extend backend search text:

```js
parts.push(
  source.name,
  source.base_url,
  source.console_url,
  source.status,
  source.console_username,
  source.notes,
  ...ensureArray(source.tags),
  ...ensureArray(source.models),
  ...ensureArray(source.endpoints),
);
```

In `renderers.js`, change backend quick sections to metadata-focused expansion:

```js
return compactSections([
  detailSection("Console Access", "primary", [
    detailItem("Username", source.console_username),
    detailItem("Password", source.console_password ? "set" : ""),
    detailItem("Notes", source.notes),
  ]),
  detailSection("Routing", "success", [
    detailItem("Proxy", source.proxy?.name),
    detailItem("Base URL", source.base_url),
  ]),
  detailSection("Capabilities", "neutral", [
    detailItem("Endpoints", ensureArray(source.endpoints).join(", ")),
    detailItem("Mapping", objectPreview(source.model_mapping)),
  ]),
]);
```

In `resource-view.js`, reshape the backend row renderer to use the new list columns and helper inputs:

```js
function renderBackendRow({
  backend,
  expanded,
  editing,
  quickDetails,
  statusPill,
  formatTagList,
  formatModelList,
  formatHourlyCount,
  formatLatency,
  tableActions,
  escapeHTML = defaultEscapeHTML,
}) {
  return `
    <tr class="${editing ? "is-editing" : ""} clickable-row" data-row-open="backend" data-row-id="${escapeHTML(backend.id)}" data-row-title="${escapeHTML(backend.name)}">
      <td>
        <button class="row-title" data-toggle-backend="${backend.id}" type="button" aria-expanded="${String(Boolean(expanded))}">
          ${renderRowChevron(expanded)}
          <span>${escapeHTML(backend.name)}</span>
        </button>
      </td>
      <td>${escapeHTML(backend.console_url || "-")}</td>
      <td>${statusPill(backend.status || "normal", backend.status || "normal", "unknown")}</td>
      <td>${escapeHTML(formatTagList(backend.tags))}</td>
      <td>${escapeHTML(formatModelList(backend.models))}</td>
      <td>${escapeHTML(formatHourlyCount(backend.hourly_requests))}</td>
      <td>${escapeHTML(formatHourlyCount(backend.hourly_failures))}</td>
      <td>${escapeHTML(formatLatency(backend.avg_latency_ms))}</td>
      <td>${tableActions("backend", backend.id)}</td>
    </tr>
    ${expanded ? `
      <tr class="detail-row">
        <td colspan="9">
          ${quickDetails}
        </td>
      </tr>
    ` : ""}
  `;
}
```

- [ ] **Step 4: Run the targeted frontend tests to verify they pass**

Run:

```bash
node --test internal/app/web/resource-state.test.mjs internal/app/web/resource-view.test.mjs internal/app/web/renderers.test.mjs internal/app/web/resource-crud.test.mjs
```

Expected: PASS

- [ ] **Step 5: Commit the frontend backend page changes**

```bash
git add internal/app/web/app.js internal/app/web/index.html internal/app/web/resource-state.js internal/app/web/resource-view.js internal/app/web/renderers.js internal/app/web/resource-state.test.mjs internal/app/web/resource-view.test.mjs internal/app/web/renderers.test.mjs internal/app/web/resource-crud.test.mjs
git commit -m "feat: redesign backend relay station list"
```

### Task 4: Wire backend row delegation helpers and full verification

**Files:**
- Modify: `internal/app/web/display-utils.js`
- Modify: `internal/app/web/resource-render-runtime.js`
- Test: `internal/app/web/resource-render-runtime.test.mjs`
- Test: `internal/app/web/resource-runtime.test.mjs`

- [ ] **Step 1: Write the failing runtime/delegation tests**

Add these tests:

`internal/app/web/resource-render-runtime.test.mjs`

```js
test("renderBackendRow forwards tag/model/hourly helpers for backend relay list rows", () => {
  const calls = [];
  ResourceRenderRuntimeUtils.renderBackendRow({
    backend: { id: 11, tags: ["hk"], models: ["gpt-4o"], hourly_requests: 2, hourly_failures: 1 },
    state: { expandedBackends: new Set(["11"]), editingBackendID: "11" },
    buildQuickDetailMarkup(resourceKey, record) {
      calls.push(["quick", resourceKey, record.id]);
      return "<quick:backends:11>";
    },
    resourceViewUtils: {
      renderBackendRow(input) {
        calls.push([
          "backend",
          input.formatTagList(input.backend.tags),
          input.formatModelList(input.backend.models),
          input.formatHourlyCount(input.backend.hourly_requests),
          input.formatHourlyCount(input.backend.hourly_failures),
        ]);
        return "<backend />";
      },
    },
    displayUtils: {
      statusPill() {},
      formatTagList(value) {
        return value.join(", ");
      },
      formatModelList(value) {
        return value.join(", ");
      },
      formatHourlyCount(value) {
        return String(value || 0);
      },
      formatLatency() {},
      tableActions() {},
      escapeHTML(value) {
        return String(value);
      },
    },
  });

  assert.deepEqual(calls, [
    ["quick", "backends", 11],
    ["backend", "hk", "gpt-4o", "2", "1"],
  ]);
});
```

`internal/app/web/resource-runtime.test.mjs`

```js
test("requireDisplayUtils accepts backend relay list helper methods", () => {
  const display = requireDisplayUtils(createDisplayUtilsStub({
    formatTagList(value) {
      return Array.isArray(value) ? value.join(", ") : "-";
    },
    formatModelList(value) {
      return Array.isArray(value) ? value.join(", ") : "-";
    },
    formatHourlyCount(value) {
      return String(value || 0);
    },
  }));

  assert.equal(typeof display.formatTagList, "function");
  assert.equal(typeof display.formatModelList, "function");
  assert.equal(typeof display.formatHourlyCount, "function");
});
```

- [ ] **Step 2: Run the targeted runtime tests to verify they fail**

Run:

```bash
node --test internal/app/web/resource-render-runtime.test.mjs internal/app/web/resource-runtime.test.mjs
```

Expected: FAIL with missing display-helper contract wiring.

- [ ] **Step 3: Write the minimal runtime/display implementation**

In `display-utils.js`, add:

```js
function formatTagList(values) {
  const tags = ensureArray(values).filter(Boolean);
  return tags.length ? tags.join(", ") : "-";
}

function formatModelList(values) {
  const models = ensureArray(values).filter(Boolean);
  return models.length ? models.join(", ") : "-";
}

function formatHourlyCount(value) {
  const count = Number(value || 0);
  if (!Number.isFinite(count) || count <= 0) {
    return "0";
  }
  return String(Math.floor(count));
}
```

Export them in the display utils API.

In `resource-render-runtime.js`, pass the new helpers into backend row rendering:

```js
formatTagList: displayUtils.formatTagList,
formatModelList: displayUtils.formatModelList,
formatHourlyCount: displayUtils.formatHourlyCount,
```

In `resource-runtime.js`, add the required display helper names:

```js
"formatTagList",
"formatModelList",
"formatHourlyCount",
```

- [ ] **Step 4: Run the targeted runtime tests to verify they pass**

Run:

```bash
node --test internal/app/web/resource-render-runtime.test.mjs internal/app/web/resource-runtime.test.mjs
```

Expected: PASS

- [ ] **Step 5: Run full verification and commit**

Run:

```bash
GOCACHE=/root/workspace/token-gate/.gocache go test ./...
node --test internal/app/web/*.test.mjs
```

Expected: PASS for both suites.

Commit:

```bash
git add internal/app/web/display-utils.js internal/app/web/resource-render-runtime.js internal/app/web/resource-render-runtime.test.mjs internal/app/web/resource-runtime.test.mjs
git commit -m "test: verify backend console metadata integration"
```
