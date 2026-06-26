# Backend Hourly Model Stats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist hourly request stats by `backend + model + UTC hour` and expose a new admin API that filters by backend, model, and optional UTC hour range while returning result rows plus aggregated backend/model/time scope metadata.

**Architecture:** Extend `store.Open` with a new SQLite stats table, move `AppendUsageLog` to a transaction that writes both the raw usage log and an upsert into the hourly stats table, then add a store query and app handler for `GET /admin/api/backend-hourly-model-stats`. Keep the write path single-source-of-truth at `AppendUsageLog` so proxy attempts and direct usage-log inserts in tests automatically populate the aggregate table.

**Tech Stack:** Go, `database/sql`, SQLite (`github.com/mattn/go-sqlite3`), `net/http`, existing app/store test helpers

---

### Task 1: Add store types and schema for hourly model stats

**Files:**
- Modify: `internal/store/store.go`
- Test: `internal/store/store_test.go`

- [ ] **Step 1: Write the failing store migration test**

```go
func TestOpenCreatesBackendHourlyModelStatsTable(t *testing.T) {
	st := openTestStore(t)
	defer st.Close()

	row := st.db.QueryRow(`
		SELECT name
		FROM sqlite_master
		WHERE type = 'table' AND name = 'backend_hourly_model_stats'
	`)

	var name string
	if err := row.Scan(&name); err != nil {
		t.Fatalf("expected backend_hourly_model_stats table to exist: %v", err)
	}
	if name != "backend_hourly_model_stats" {
		t.Fatalf("unexpected table name %q", name)
	}
}
```

- [ ] **Step 2: Run the store test to verify it fails**

Run: `GOCACHE=/root/workspace/token-gate/.gocache go test ./internal/store -run TestOpenCreatesBackendHourlyModelStatsTable -v`

Expected: FAIL with missing table / `sql: no rows in result set`

- [ ] **Step 3: Add the stats structs and schema**

Add these type definitions near the other store structs in `internal/store/store.go`:

```go
type BackendHourlyModelStatsFilter struct {
	BackendName string
	Model       string
	StartHour   time.Time
	EndHour     time.Time
}

type BackendRef struct {
	ID   int64
	Name string
}

type BackendHourlyModelStatsRow struct {
	BackendID               int64
	BackendName             string
	Model                   string
	HourStart               time.Time
	Successes               int
	Failures                int
	SuccessDurationMSSum    int64
	SuccessRequestBytes     int64
	SuccessResponseBytes    int64
}

type BackendHourlyModelStatsResult struct {
	Rows       []BackendHourlyModelStatsRow
	Backends   []BackendRef
	Models     []string
	RangeStart *time.Time
	RangeEnd   *time.Time
}
```

Add this schema block in `Open` after the `usage_logs` table and before `settings`:

```sql
CREATE TABLE IF NOT EXISTS backend_hourly_model_stats (
	backend_id INTEGER NOT NULL,
	backend_name TEXT NOT NULL DEFAULT '',
	model TEXT NOT NULL,
	hour_start_utc TEXT NOT NULL,
	success_count INTEGER NOT NULL DEFAULT 0,
	failure_count INTEGER NOT NULL DEFAULT 0,
	success_duration_ms_sum INTEGER NOT NULL DEFAULT 0,
	success_request_bytes_sum INTEGER NOT NULL DEFAULT 0,
	success_response_bytes_sum INTEGER NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	PRIMARY KEY (backend_id, model, hour_start_utc)
);
```

Add these indexes in the same schema list:

```sql
CREATE INDEX IF NOT EXISTS idx_backend_hourly_model_stats_hour
	ON backend_hourly_model_stats(hour_start_utc DESC);

CREATE INDEX IF NOT EXISTS idx_backend_hourly_model_stats_model_hour
	ON backend_hourly_model_stats(model, hour_start_utc DESC);
```

- [ ] **Step 4: Run the store test to verify it passes**

Run: `GOCACHE=/root/workspace/token-gate/.gocache go test ./internal/store -run TestOpenCreatesBackendHourlyModelStatsTable -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add internal/store/store.go internal/store/store_test.go
git commit -m "feat: add backend hourly model stats schema"
```

### Task 2: Aggregate hourly stats inside AppendUsageLog

**Files:**
- Modify: `internal/store/store.go`
- Test: `internal/store/store_test.go`

- [ ] **Step 1: Write the failing aggregation test for success/failure totals**

```go
func TestAppendUsageLogAggregatesBackendHourlyModelStats(t *testing.T) {
	st := openTestStore(t)
	defer st.Close()
	ctx := context.Background()

	createdAt := time.Date(2026, 6, 26, 7, 23, 0, 0, time.UTC)
	for _, entry := range []domain.UsageLog{
		{
			RequestID:     "agg-success",
			BackendID:     11,
			BackendName:   "alpha",
			Model:         "gpt-4o",
			StatusCode:    200,
			DurationMS:    120,
			RequestBytes:  100,
			ResponseBytes: 300,
			CreatedAt:     createdAt,
		},
		{
			RequestID:   "agg-failure",
			BackendID:   11,
			BackendName: "alpha",
			Model:       "gpt-4o",
			StatusCode:  502,
			DurationMS:  999,
			CreatedAt:   createdAt.Add(5 * time.Minute),
		},
	} {
		if err := st.AppendUsageLog(ctx, entry); err != nil {
			t.Fatalf("AppendUsageLog(%s): %v", entry.RequestID, err)
		}
	}

	result, err := st.ListBackendHourlyModelStats(ctx, BackendHourlyModelStatsFilter{
		BackendName: "alpha",
		Model:       "gpt-4o",
	})
	if err != nil {
		t.Fatalf("ListBackendHourlyModelStats: %v", err)
	}
	if len(result.Rows) != 1 {
		t.Fatalf("expected 1 row, got %d", len(result.Rows))
	}
	row := result.Rows[0]
	if row.Successes != 1 || row.Failures != 1 {
		t.Fatalf("unexpected counts: %#v", row)
	}
	if row.SuccessDurationMSSum != 120 {
		t.Fatalf("expected success duration sum 120, got %d", row.SuccessDurationMSSum)
	}
	if row.SuccessRequestBytes != 100 || row.SuccessResponseBytes != 300 {
		t.Fatalf("unexpected byte sums: %#v", row)
	}
	if row.HourStart != time.Date(2026, 6, 26, 7, 0, 0, 0, time.UTC) {
		t.Fatalf("unexpected hour bucket %s", row.HourStart)
	}
}
```

- [ ] **Step 2: Run the store test to verify it fails**

Run: `GOCACHE=/root/workspace/token-gate/.gocache go test ./internal/store -run TestAppendUsageLogAggregatesBackendHourlyModelStats -v`

Expected: FAIL because `ListBackendHourlyModelStats` does not exist or rows are empty

- [ ] **Step 3: Convert AppendUsageLog to a transaction and add the upsert helper**

In `internal/store/store.go`, refactor `AppendUsageLog` to:

```go
func (s *Store) AppendUsageLog(ctx context.Context, log domain.UsageLog) error {
	createdAt := log.CreatedAt
	if createdAt.IsZero() {
		createdAt = time.Now().UTC()
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	if _, err = tx.ExecContext(ctx, `
		INSERT INTO usage_logs(
			request_id, client_id, client_name, client_token_prefix,
			method, path, query, endpoint, model, backend_id, backend_name, proxy_id, proxy_name,
			attempts, status_code, status_family, duration_ms, error_message, client_ip, user_agent, trace_id,
			request_bytes, response_bytes, request_headers_json, request_body_preview, response_headers_json, response_body_preview,
			preview_truncated, is_stream, created_at
		)
		VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		strings.TrimSpace(log.RequestID),
		log.ClientID,
		log.ClientName,
		log.ClientTokenPrefix,
		strings.TrimSpace(log.Method),
		strings.TrimSpace(log.Path),
		strings.TrimSpace(log.Query),
		strings.TrimSpace(log.Endpoint),
		strings.TrimSpace(log.Model),
		log.BackendID,
		log.BackendName,
		log.ProxyID,
		strings.TrimSpace(log.ProxyName),
		log.Attempts,
		log.StatusCode,
		nonEmpty(log.StatusFamily, statusFamily(log.StatusCode)),
		log.DurationMS,
		strings.TrimSpace(log.ErrorMessage),
		strings.TrimSpace(log.ClientIP),
		strings.TrimSpace(log.UserAgent),
		strings.TrimSpace(log.TraceID),
		log.RequestBytes,
		log.ResponseBytes,
		nonEmpty(log.RequestHeadersJSON, "{}"),
		log.RequestBodyPreview,
		nonEmpty(log.ResponseHeadersJSON, "{}"),
		log.ResponseBodyPreview,
		boolToInt(log.PreviewTruncated),
		boolToInt(log.IsStream),
		formatTime(createdAt.UTC()),
	); err != nil {
		return err
	}

	if err = upsertBackendHourlyModelStats(ctx, tx, log, createdAt); err != nil {
		return err
	}

	return tx.Commit()
}
```

Add helpers:

```go
func upsertBackendHourlyModelStats(ctx context.Context, tx *sql.Tx, log domain.UsageLog, createdAt time.Time) error
func backendHourlyBucketUTC(createdAt time.Time) time.Time
func isSuccessStatus(statusCode int) bool
```

Implement the bucket helper as:

```go
func backendHourlyBucketUTC(createdAt time.Time) time.Time {
	return createdAt.UTC().Truncate(time.Hour)
}
```

Implement the stats upsert as:

```go
successes := 0
failures := 0
successDuration := int64(0)
successRequestBytes := int64(0)
successResponseBytes := int64(0)
if isSuccessStatus(log.StatusCode) {
	successes = 1
	successDuration = log.DurationMS
	successRequestBytes = log.RequestBytes
	successResponseBytes = log.ResponseBytes
} else {
	failures = 1
}
```

Skip the upsert when any of these are true:

```go
log.BackendID <= 0
strings.TrimSpace(log.BackendName) == ""
strings.TrimSpace(log.Model) == ""
```

Use this SQL:

```sql
INSERT INTO backend_hourly_model_stats(
	backend_id, backend_name, model, hour_start_utc,
	success_count, failure_count, success_duration_ms_sum,
	success_request_bytes_sum, success_response_bytes_sum,
	created_at, updated_at
)
VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(backend_id, model, hour_start_utc) DO UPDATE SET
	backend_name = excluded.backend_name,
	success_count = backend_hourly_model_stats.success_count + excluded.success_count,
	failure_count = backend_hourly_model_stats.failure_count + excluded.failure_count,
	success_duration_ms_sum = backend_hourly_model_stats.success_duration_ms_sum + excluded.success_duration_ms_sum,
	success_request_bytes_sum = backend_hourly_model_stats.success_request_bytes_sum + excluded.success_request_bytes_sum,
	success_response_bytes_sum = backend_hourly_model_stats.success_response_bytes_sum + excluded.success_response_bytes_sum,
	updated_at = excluded.updated_at
```

- [ ] **Step 4: Add a query method stub so the test can read the aggregate**

Add this signature in `internal/store/store.go`:

```go
func (s *Store) ListBackendHourlyModelStats(ctx context.Context, filter BackendHourlyModelStatsFilter) (BackendHourlyModelStatsResult, error)
```

Temporary minimal implementation for the current test:

```go
func (s *Store) ListBackendHourlyModelStats(ctx context.Context, filter BackendHourlyModelStatsFilter) (BackendHourlyModelStatsResult, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT backend_id, backend_name, model, hour_start_utc,
			success_count, failure_count, success_duration_ms_sum,
			success_request_bytes_sum, success_response_bytes_sum
		FROM backend_hourly_model_stats
		WHERE backend_name = ? AND model = ?
	`, filter.BackendName, filter.Model)
	if err != nil {
		return BackendHourlyModelStatsResult{}, err
	}
	defer rows.Close()

	result := BackendHourlyModelStatsResult{}
	for rows.Next() {
		var row BackendHourlyModelStatsRow
		var hourStart string
		if err := rows.Scan(
			&row.BackendID,
			&row.BackendName,
			&row.Model,
			&hourStart,
			&row.Successes,
			&row.Failures,
			&row.SuccessDurationMSSum,
			&row.SuccessRequestBytes,
			&row.SuccessResponseBytes,
		); err != nil {
			return BackendHourlyModelStatsResult{}, err
		}
		row.HourStart = parseTime(hourStart)
		result.Rows = append(result.Rows, row)
	}
	return result, rows.Err()
}
```

- [ ] **Step 5: Run the store test to verify it passes**

Run: `GOCACHE=/root/workspace/token-gate/.gocache go test ./internal/store -run TestAppendUsageLogAggregatesBackendHourlyModelStats -v`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add internal/store/store.go internal/store/store_test.go
git commit -m "feat: aggregate hourly model stats on usage log append"
```

### Task 3: Finish the aggregate query API in the store layer

**Files:**
- Modify: `internal/store/store.go`
- Test: `internal/store/store_test.go`

- [ ] **Step 1: Write the failing query/filter/scope test**

```go
func TestListBackendHourlyModelStatsFiltersAndBuildsScope(t *testing.T) {
	st := openTestStore(t)
	defer st.Close()
	ctx := context.Background()

	entries := []domain.UsageLog{
		{
			RequestID:     "scope-1",
			BackendID:     11,
			BackendName:   "alpha",
			Model:         "gpt-4o",
			StatusCode:    200,
			DurationMS:    100,
			RequestBytes:  10,
			ResponseBytes: 20,
			CreatedAt:     time.Date(2026, 6, 26, 7, 10, 0, 0, time.UTC),
		},
		{
			RequestID:   "scope-2",
			BackendID:   11,
			BackendName: "alpha",
			Model:       "gpt-4.1",
			StatusCode:  502,
			CreatedAt:   time.Date(2026, 6, 26, 8, 5, 0, 0, time.UTC),
		},
		{
			RequestID:     "scope-3",
			BackendID:     22,
			BackendName:   "beta",
			Model:         "gpt-4o",
			StatusCode:    200,
			DurationMS:    200,
			RequestBytes:  30,
			ResponseBytes: 40,
			CreatedAt:     time.Date(2026, 6, 26, 9, 15, 0, 0, time.UTC),
		},
	}
	for _, entry := range entries {
		if err := st.AppendUsageLog(ctx, entry); err != nil {
			t.Fatalf("AppendUsageLog(%s): %v", entry.RequestID, err)
		}
	}

	result, err := st.ListBackendHourlyModelStats(ctx, BackendHourlyModelStatsFilter{
		StartHour: time.Date(2026, 6, 26, 8, 0, 0, 0, time.UTC),
		EndHour:   time.Date(2026, 6, 26, 9, 0, 0, 0, time.UTC),
	})
	if err != nil {
		t.Fatalf("ListBackendHourlyModelStats: %v", err)
	}

	if len(result.Rows) != 2 {
		t.Fatalf("expected 2 rows, got %d", len(result.Rows))
	}
	if !reflect.DeepEqual(result.Backends, []BackendRef{
		{ID: 11, Name: "alpha"},
		{ID: 22, Name: "beta"},
	}) {
		t.Fatalf("unexpected backends: %#v", result.Backends)
	}
	if !reflect.DeepEqual(result.Models, []string{"gpt-4.1", "gpt-4o"}) {
		t.Fatalf("unexpected models: %#v", result.Models)
	}
	if result.RangeStart == nil || !result.RangeStart.Equal(time.Date(2026, 6, 26, 8, 0, 0, 0, time.UTC)) {
		t.Fatalf("unexpected range start: %v", result.RangeStart)
	}
	if result.RangeEnd == nil || !result.RangeEnd.Equal(time.Date(2026, 6, 26, 9, 0, 0, 0, time.UTC)) {
		t.Fatalf("unexpected range end: %v", result.RangeEnd)
	}
}
```

- [ ] **Step 2: Run the store test to verify it fails**

Run: `GOCACHE=/root/workspace/token-gate/.gocache go test ./internal/store -run TestListBackendHourlyModelStatsFiltersAndBuildsScope -v`

Expected: FAIL because the temporary query implementation ignores time range and scope metadata

- [ ] **Step 3: Implement the full filtered aggregate query**

Replace the temporary `ListBackendHourlyModelStats` with a full implementation:

```go
func (s *Store) ListBackendHourlyModelStats(ctx context.Context, filter BackendHourlyModelStatsFilter) (BackendHourlyModelStatsResult, error) {
	where, args := backendHourlyModelStatsFilterClause(filter)
	rows, err := s.db.QueryContext(ctx, `
		SELECT backend_id, backend_name, model, hour_start_utc,
			success_count, failure_count, success_duration_ms_sum,
			success_request_bytes_sum, success_response_bytes_sum
		FROM backend_hourly_model_stats
	`+where+`
		ORDER BY hour_start_utc ASC, backend_name ASC, model ASC
	`, args...)
	if err != nil {
		return BackendHourlyModelStatsResult{}, err
	}
	defer rows.Close()

	result := BackendHourlyModelStatsResult{
		Rows:     []BackendHourlyModelStatsRow{},
		Backends: []BackendRef{},
		Models:   []string{},
	}
	backendSeen := make(map[int64]string)
	modelSeen := make(map[string]struct{})

	for rows.Next() {
		var row BackendHourlyModelStatsRow
		var hourStart string
		if err := rows.Scan(
			&row.BackendID,
			&row.BackendName,
			&row.Model,
			&hourStart,
			&row.Successes,
			&row.Failures,
			&row.SuccessDurationMSSum,
			&row.SuccessRequestBytes,
			&row.SuccessResponseBytes,
		); err != nil {
			return BackendHourlyModelStatsResult{}, err
		}
		row.HourStart = parseTime(hourStart)
		result.Rows = append(result.Rows, row)

		if _, ok := backendSeen[row.BackendID]; !ok {
			backendSeen[row.BackendID] = row.BackendName
		}
		modelSeen[row.Model] = struct{}{}
		if result.RangeStart == nil || row.HourStart.Before(*result.RangeStart) {
			hour := row.HourStart
			result.RangeStart = &hour
		}
		if result.RangeEnd == nil || row.HourStart.After(*result.RangeEnd) {
			hour := row.HourStart
			result.RangeEnd = &hour
		}
	}
	if err := rows.Err(); err != nil {
		return BackendHourlyModelStatsResult{}, err
	}

	for id, name := range backendSeen {
		result.Backends = append(result.Backends, BackendRef{ID: id, Name: name})
	}
	slices.SortFunc(result.Backends, func(a, b BackendRef) int {
		if a.Name != b.Name {
			return strings.Compare(a.Name, b.Name)
		}
		return cmp.Compare(a.ID, b.ID)
	})
	for model := range modelSeen {
		result.Models = append(result.Models, model)
	}
	slices.Sort(result.Models)
	return result, nil
}
```

Add the filter builder:

```go
func backendHourlyModelStatsFilterClause(filter BackendHourlyModelStatsFilter) (string, []any) {
	var (
		clauses []string
		args    []any
	)
	if value := strings.TrimSpace(filter.BackendName); value != "" {
		clauses = append(clauses, `backend_name = ?`)
		args = append(args, value)
	}
	if value := strings.TrimSpace(filter.Model); value != "" {
		clauses = append(clauses, `model = ?`)
		args = append(args, value)
	}
	if !filter.StartHour.IsZero() {
		clauses = append(clauses, `hour_start_utc >= ?`)
		args = append(args, formatTime(filter.StartHour.UTC()))
	}
	if !filter.EndHour.IsZero() {
		clauses = append(clauses, `hour_start_utc <= ?`)
		args = append(args, formatTime(filter.EndHour.UTC()))
	}
	if len(clauses) == 0 {
		return "", nil
	}
	return " WHERE " + strings.Join(clauses, " AND "), args
}
```

Update imports as needed:

```go
import (
	"cmp"
	"slices"
)
```

- [ ] **Step 4: Add an empty-result test**

```go
func TestListBackendHourlyModelStatsReturnsEmptyScopeWhenNoRowsMatch(t *testing.T) {
	st := openTestStore(t)
	defer st.Close()

	result, err := st.ListBackendHourlyModelStats(context.Background(), BackendHourlyModelStatsFilter{
		BackendName: "missing",
	})
	if err != nil {
		t.Fatalf("ListBackendHourlyModelStats: %v", err)
	}
	if len(result.Rows) != 0 || len(result.Backends) != 0 || len(result.Models) != 0 {
		t.Fatalf("expected empty result, got %#v", result)
	}
	if result.RangeStart != nil || result.RangeEnd != nil {
		t.Fatalf("expected nil range for empty result, got %v %v", result.RangeStart, result.RangeEnd)
	}
}
```

- [ ] **Step 5: Run the store tests to verify they pass**

Run: `GOCACHE=/root/workspace/token-gate/.gocache go test ./internal/store -run 'Test(ListBackendHourlyModelStats|AppendUsageLogAggregatesBackendHourlyModelStats)' -v`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add internal/store/store.go internal/store/store_test.go
git commit -m "feat: add backend hourly model stats store query"
```

### Task 4: Add the admin API handler and UTC hour parsing

**Files:**
- Modify: `internal/app/app.go`
- Test: `internal/app/app_test.go`

- [ ] **Step 1: Write the failing handler success test**

```go
func TestBackendHourlyModelStatsEndpointReturnsRowsAndScope(t *testing.T) {
	application := newTestApp(t)
	ctx := context.Background()

	for _, entry := range []domain.UsageLog{
		{
			RequestID:     "api-1",
			BackendID:     11,
			BackendName:   "alpha",
			Model:         "gpt-4o",
			StatusCode:    200,
			DurationMS:    100,
			RequestBytes:  10,
			ResponseBytes: 20,
			CreatedAt:     time.Date(2026, 6, 26, 7, 15, 0, 0, time.UTC),
		},
		{
			RequestID:   "api-2",
			BackendID:   22,
			BackendName: "beta",
			Model:       "gpt-4.1",
			StatusCode:  502,
			CreatedAt:   time.Date(2026, 6, 26, 8, 15, 0, 0, time.UTC),
		},
	} {
		if err := application.store.AppendUsageLog(ctx, entry); err != nil {
			t.Fatalf("AppendUsageLog(%s): %v", entry.RequestID, err)
		}
	}

	req := httptest.NewRequest(http.MethodGet, "/admin/api/backend-hourly-model-stats?start_hour=2026-06-26T07:00:00Z&end_hour=2026-06-26T08:00:00Z", nil)
	recorder := httptest.NewRecorder()

	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	var payload struct {
		Query struct {
			Backend   string `json:"backend"`
			Model     string `json:"model"`
			StartHour string `json:"start_hour"`
			EndHour   string `json:"end_hour"`
		} `json:"query"`
		Scope struct {
			Backends []struct {
				ID   int64  `json:"id"`
				Name string `json:"name"`
			} `json:"backends"`
			Models []string `json:"models"`
			TimeRange struct {
				StartHour string `json:"start_hour"`
				EndHour   string `json:"end_hour"`
				Timezone  string `json:"timezone"`
			} `json:"time_range"`
		} `json:"scope"`
		Items []struct {
			BackendID            int64   `json:"backend_id"`
			Backend              string  `json:"backend"`
			Model                string  `json:"model"`
			Hour                 string  `json:"hour"`
			Requests             int     `json:"requests"`
			Successes            int     `json:"successes"`
			Failures             int     `json:"failures"`
			SuccessAvgDurationMS float64 `json:"success_avg_duration_ms"`
			SuccessRequestBytes  int64   `json:"success_request_bytes"`
			SuccessResponseBytes int64   `json:"success_response_bytes"`
		} `json:"items"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal payload: %v", err)
	}
	if payload.Query.StartHour != "2026-06-26T07:00:00Z" || payload.Query.EndHour != "2026-06-26T08:00:00Z" {
		t.Fatalf("unexpected query echo: %#v", payload.Query)
	}
	if len(payload.Scope.Backends) != 2 || len(payload.Scope.Models) != 2 {
		t.Fatalf("unexpected scope: %#v", payload.Scope)
	}
	if payload.Scope.TimeRange.Timezone != "UTC" {
		t.Fatalf("expected UTC timezone, got %#v", payload.Scope.TimeRange)
	}
	if len(payload.Items) != 2 {
		t.Fatalf("expected 2 items, got %d", len(payload.Items))
	}
	if payload.Items[0].Requests != payload.Items[0].Successes+payload.Items[0].Failures {
		t.Fatalf("requests should equal successes + failures: %#v", payload.Items[0])
	}
}
```

- [ ] **Step 2: Run the app test to verify it fails**

Run: `GOCACHE=/root/workspace/token-gate/.gocache go test ./internal/app -run TestBackendHourlyModelStatsEndpointReturnsRowsAndScope -v`

Expected: FAIL with 404 or missing handler

- [ ] **Step 3: Register the route and add response structs**

In `internal/app/app.go`, register the route near the other admin usage endpoints:

```go
a.mux.Handle("GET /admin/api/backend-hourly-model-stats", http.HandlerFunc(a.handleBackendHourlyModelStats))
```

Add response structs near the other JSON payload types:

```go
type backendHourlyModelStatsResponse struct {
	Query backendHourlyModelStatsQuery `json:"query"`
	Scope backendHourlyModelStatsScope `json:"scope"`
	Items []backendHourlyModelStatsItem `json:"items"`
}

type backendHourlyModelStatsQuery struct {
	Backend   string  `json:"backend"`
	Model     string  `json:"model"`
	StartHour *string `json:"start_hour"`
	EndHour   *string `json:"end_hour"`
}

type backendHourlyModelStatsScope struct {
	Backends  []backendHourlyModelStatsBackendRef `json:"backends"`
	Models    []string                            `json:"models"`
	TimeRange backendHourlyModelStatsTimeRange    `json:"time_range"`
}

type backendHourlyModelStatsBackendRef struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

type backendHourlyModelStatsTimeRange struct {
	StartHour *string `json:"start_hour"`
	EndHour   *string `json:"end_hour"`
	Timezone  string  `json:"timezone"`
}

type backendHourlyModelStatsItem struct {
	BackendID            int64   `json:"backend_id"`
	Backend              string  `json:"backend"`
	Model                string  `json:"model"`
	Hour                 string  `json:"hour"`
	Requests             int     `json:"requests"`
	Successes            int     `json:"successes"`
	Failures             int     `json:"failures"`
	SuccessAvgDurationMS float64 `json:"success_avg_duration_ms"`
	SuccessRequestBytes  int64   `json:"success_request_bytes"`
	SuccessResponseBytes int64   `json:"success_response_bytes"`
}
```

- [ ] **Step 4: Implement UTC hour parsing and the handler**

Add helpers:

```go
func parseOptionalUTCHourQuery(value string) (time.Time, error)
func formatOptionalUTCTime(value *time.Time) *string
```

Use this parsing logic:

```go
func parseOptionalUTCHourQuery(value string) (time.Time, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return time.Time{}, nil
	}
	parsed, err := time.Parse(time.RFC3339, value)
	if err != nil {
		return time.Time{}, fmt.Errorf("invalid utc hour %q", value)
	}
	parsed = parsed.UTC()
	if parsed.Minute() != 0 || parsed.Second() != 0 || parsed.Nanosecond() != 0 {
		return time.Time{}, fmt.Errorf("utc hour must be aligned to whole hour: %q", value)
	}
	return parsed, nil
}

func formatOptionalUTCTime(value *time.Time) *string {
	if value == nil {
		return nil
	}
	formatted := value.UTC().Format(time.RFC3339)
	return &formatted
}
```

Implement the handler:

```go
func (a *App) handleBackendHourlyModelStats(w http.ResponseWriter, r *http.Request) {
	startHour, err := parseOptionalUTCHourQuery(r.URL.Query().Get("start_hour"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	endHour, err := parseOptionalUTCHourQuery(r.URL.Query().Get("end_hour"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if !startHour.IsZero() && !endHour.IsZero() && startHour.After(endHour) {
		writeError(w, http.StatusBadRequest, "start_hour must be before or equal to end_hour")
		return
	}

	filter := store.BackendHourlyModelStatsFilter{
		BackendName: strings.TrimSpace(r.URL.Query().Get("backend")),
		Model:       strings.TrimSpace(r.URL.Query().Get("model")),
		StartHour:   startHour,
		EndHour:     endHour,
	}
	result, err := a.store.ListBackendHourlyModelStats(r.Context(), filter)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	items := make([]backendHourlyModelStatsItem, 0, len(result.Rows))
	for _, row := range result.Rows {
		avg := 0.0
		if row.Successes > 0 {
			avg = float64(row.SuccessDurationMSSum) / float64(row.Successes)
		}
		items = append(items, backendHourlyModelStatsItem{
			BackendID:            row.BackendID,
			Backend:              row.BackendName,
			Model:                row.Model,
			Hour:                 row.HourStart.UTC().Format(time.RFC3339),
			Requests:             row.Successes + row.Failures,
			Successes:            row.Successes,
			Failures:             row.Failures,
			SuccessAvgDurationMS: avg,
			SuccessRequestBytes:  row.SuccessRequestBytes,
			SuccessResponseBytes: row.SuccessResponseBytes,
		})
	}

	backendRefs := make([]backendHourlyModelStatsBackendRef, 0, len(result.Backends))
	for _, backend := range result.Backends {
		backendRefs = append(backendRefs, backendHourlyModelStatsBackendRef{
			ID:   backend.ID,
			Name: backend.Name,
		})
	}

	writeJSON(w, http.StatusOK, backendHourlyModelStatsResponse{
		Query: backendHourlyModelStatsQuery{
			Backend:   filter.BackendName,
			Model:     filter.Model,
			StartHour: formatOptionalUTCTime(optionalTimeValue(startHour)),
			EndHour:   formatOptionalUTCTime(optionalTimeValue(endHour)),
		},
		Scope: backendHourlyModelStatsScope{
			Backends: backendRefs,
			Models:   result.Models,
			TimeRange: backendHourlyModelStatsTimeRange{
				StartHour: formatOptionalUTCTime(result.RangeStart),
				EndHour:   formatOptionalUTCTime(result.RangeEnd),
				Timezone:  "UTC",
			},
		},
		Items: items,
	})
}
```

Add a tiny helper to take an optional value address:

```go
func optionalTimeValue(value time.Time) *time.Time {
	if value.IsZero() {
		return nil
	}
	copy := value
	return &copy
}
```

- [ ] **Step 5: Run the app test to verify it passes**

Run: `GOCACHE=/root/workspace/token-gate/.gocache go test ./internal/app -run TestBackendHourlyModelStatsEndpointReturnsRowsAndScope -v`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add internal/app/app.go internal/app/app_test.go
git commit -m "feat: add backend hourly model stats admin api"
```

### Task 5: Add validation and filter coverage for the new endpoint

**Files:**
- Modify: `internal/app/app_test.go`
- Test: `internal/app/app_test.go`

- [ ] **Step 1: Write the failing validation test**

```go
func TestBackendHourlyModelStatsEndpointRejectsInvalidHours(t *testing.T) {
	application := newTestApp(t)

	for _, path := range []string{
		"/admin/api/backend-hourly-model-stats?start_hour=not-a-time",
		"/admin/api/backend-hourly-model-stats?start_hour=2026-06-26T07:30:00Z",
		"/admin/api/backend-hourly-model-stats?start_hour=2026-06-26T08:00:00Z&end_hour=2026-06-26T07:00:00Z",
	} {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		recorder := httptest.NewRecorder()

		application.Handler().ServeHTTP(recorder, req)

		if recorder.Code != http.StatusBadRequest {
			t.Fatalf("%s expected 400, got %d body=%s", path, recorder.Code, recorder.Body.String())
		}
	}
}
```

- [ ] **Step 2: Write the failing backend/model filter test**

```go
func TestBackendHourlyModelStatsEndpointAppliesBackendAndModelFilters(t *testing.T) {
	application := newTestApp(t)
	ctx := context.Background()

	for _, entry := range []domain.UsageLog{
		{
			RequestID:     "filter-1",
			BackendID:     11,
			BackendName:   "alpha",
			Model:         "gpt-4o",
			StatusCode:    200,
			DurationMS:    50,
			RequestBytes:  1,
			ResponseBytes: 2,
			CreatedAt:     time.Date(2026, 6, 26, 7, 0, 0, 0, time.UTC),
		},
		{
			RequestID:   "filter-2",
			BackendID:   22,
			BackendName: "beta",
			Model:       "gpt-4.1",
			StatusCode:  200,
			DurationMS:  70,
			CreatedAt:   time.Date(2026, 6, 26, 7, 0, 0, 0, time.UTC),
		},
	} {
		if err := application.store.AppendUsageLog(ctx, entry); err != nil {
			t.Fatalf("AppendUsageLog(%s): %v", entry.RequestID, err)
		}
	}

	req := httptest.NewRequest(http.MethodGet, "/admin/api/backend-hourly-model-stats?backend=alpha&model=gpt-4o", nil)
	recorder := httptest.NewRecorder()

	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	var payload struct {
		Items []struct {
			Backend string `json:"backend"`
			Model   string `json:"model"`
		} `json:"items"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal payload: %v", err)
	}
	if len(payload.Items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(payload.Items))
	}
	if payload.Items[0].Backend != "alpha" || payload.Items[0].Model != "gpt-4o" {
		t.Fatalf("unexpected filtered item: %#v", payload.Items[0])
	}
}
```

- [ ] **Step 3: Run the app tests to verify they fail first**

Run: `GOCACHE=/root/workspace/token-gate/.gocache go test ./internal/app -run 'TestBackendHourlyModelStatsEndpoint(RejectsInvalidHours|AppliesBackendAndModelFilters)' -v`

Expected: FAIL until validation messages and filtering behavior are correct

- [ ] **Step 4: Adjust the handler/helpers until the tests pass**

Use the existing `writeError` style and keep the validations exact:

```go
if parsed.Minute() != 0 || parsed.Second() != 0 || parsed.Nanosecond() != 0 {
	return time.Time{}, fmt.Errorf("utc hour must be aligned to whole hour: %q", value)
}
```

Keep filter propagation exact:

```go
filter := store.BackendHourlyModelStatsFilter{
	BackendName: strings.TrimSpace(r.URL.Query().Get("backend")),
	Model:       strings.TrimSpace(r.URL.Query().Get("model")),
	StartHour:   startHour,
	EndHour:     endHour,
}
```

- [ ] **Step 5: Run the focused app tests to verify they pass**

Run: `GOCACHE=/root/workspace/token-gate/.gocache go test ./internal/app -run 'TestBackendHourlyModelStatsEndpoint(ReturnsRowsAndScope|RejectsInvalidHours|AppliesBackendAndModelFilters)' -v`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add internal/app/app.go internal/app/app_test.go
git commit -m "test: cover backend hourly model stats validation"
```

### Task 6: Run broader verification and clean up

**Files:**
- Modify: `internal/store/store.go`
- Modify: `internal/app/app.go`
- Test: `internal/store/store_test.go`
- Test: `internal/app/app_test.go`

- [ ] **Step 1: Run package-scoped tests for store and app**

Run: `GOCACHE=/root/workspace/token-gate/.gocache go test ./internal/store ./internal/app -v`

Expected: PASS

- [ ] **Step 2: Run the full Go test suite**

Run: `GOCACHE=/root/workspace/token-gate/.gocache go test ./...`

Expected: PASS

- [ ] **Step 3: Inspect the diff for accidental scope creep**

Run: `git diff -- internal/store/store.go internal/store/store_test.go internal/app/app.go internal/app/app_test.go`

Expected: only schema, aggregate write/query, route/handler, and related tests

- [ ] **Step 4: Commit the final verification-aligned changes if needed**

```bash
git add internal/store/store.go internal/store/store_test.go internal/app/app.go internal/app/app_test.go
git commit -m "feat: finalize backend hourly model stats support"
```
