package store

import (
	"context"
	"database/sql"
	"reflect"
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

func TestBackendConsoleStateRoundTrips(t *testing.T) {
	st := openTestStore(t)
	defer st.Close()
	ctx := context.Background()

	backend, err := st.CreateBackend(ctx, domain.Backend{
		Name:               "edge-new-api",
		Protocol:           domain.BackendProtocolOpenAI,
		BackendType:        domain.BackendTypeNewAPI,
		BaseURL:            "https://edge-new-api.local/v1",
		APIKey:             "edge-key",
		ConsoleURL:         "https://console.edge-new-api.local",
		ConsoleUsername:    "tom",
		ConsolePassword:    "tom_passwd",
		ConsoleCookie:      "session=initial",
		ConsoleAccountJSON: `{"id":1929,"quota":248540,"used_quota":3250000,"username":"tom"}`,
		ConsolePricingJSON: `{"success":true,"data":{"vendors":[]}}`,
		Models:             []string{"gpt-4o"},
		Endpoints:          []string{domain.EndpointChat},
	})
	if err != nil {
		t.Fatalf("CreateBackend returned error: %v", err)
	}

	if backend.BackendType != domain.BackendTypeNewAPI {
		t.Fatalf("expected backend_type to round-trip, got %q", backend.BackendType)
	}
	if backend.ConsoleCookie != "session=initial" {
		t.Fatalf("expected console cookie to round-trip, got %q", backend.ConsoleCookie)
	}
	if backend.ConsoleAccountJSON != `{"id":1929,"quota":248540,"used_quota":3250000,"username":"tom"}` {
		t.Fatalf("expected console account json to round-trip, got %q", backend.ConsoleAccountJSON)
	}
	if backend.ConsolePricingJSON != `{"success":true,"data":{"vendors":[]}}` {
		t.Fatalf("expected console pricing json to round-trip, got %q", backend.ConsolePricingJSON)
	}

	backend.ConsoleCookie = "session=rotated"
	backend.ConsoleAccountJSON = `{"id":1930,"quota":100,"used_quota":50,"username":"tom2"}`
	backend.ConsolePricingJSON = `{"success":true,"data":{"pricing_version":"2026-07-03"}}`
	updated, err := st.UpdateBackend(ctx, backend)
	if err != nil {
		t.Fatalf("UpdateBackend returned error: %v", err)
	}

	if updated.ConsoleCookie != "session=rotated" || updated.ConsoleAccountJSON != backend.ConsoleAccountJSON || updated.ConsolePricingJSON != backend.ConsolePricingJSON {
		t.Fatalf("expected updated console state, got %#v", updated)
	}

	listed, err := st.ListBackends(ctx)
	if err != nil {
		t.Fatalf("ListBackends returned error: %v", err)
	}
	if len(listed) != 1 {
		t.Fatalf("expected one backend, got %#v", listed)
	}
	if listed[0].BackendType != domain.BackendTypeNewAPI || listed[0].ConsoleCookie != "session=rotated" {
		t.Fatalf("expected listed backend console state, got %#v", listed[0])
	}
}

func TestBackendSub2APIAuthorizationRoundTrips(t *testing.T) {
	st := openTestStore(t)
	defer st.Close()
	ctx := context.Background()

	backend, err := st.CreateBackend(ctx, domain.Backend{
		Name:                 "edge-sub2api",
		Protocol:             domain.BackendProtocolOpenAI,
		BackendType:          domain.BackendTypeSub2API,
		BaseURL:              "https://edge-sub2api.local/v1",
		APIKey:               "edge-key",
		ConsoleURL:           "https://console.edge-sub2api.local",
		ConsoleAuthorization: "Bearer initial-sub2api-token",
		Models:               []string{"gpt-4o"},
		Endpoints:            []string{domain.EndpointChat},
	})
	if err != nil {
		t.Fatalf("CreateBackend returned error: %v", err)
	}

	if backend.BackendType != domain.BackendTypeSub2API {
		t.Fatalf("expected backend_type to round-trip, got %q", backend.BackendType)
	}
	if backend.ConsoleAuthorization != "Bearer initial-sub2api-token" {
		t.Fatalf("expected console authorization to round-trip, got %q", backend.ConsoleAuthorization)
	}

	backend.ConsoleAuthorization = "Bearer rotated-sub2api-token"
	updated, err := st.UpdateBackend(ctx, backend)
	if err != nil {
		t.Fatalf("UpdateBackend returned error: %v", err)
	}
	if updated.ConsoleAuthorization != "Bearer rotated-sub2api-token" {
		t.Fatalf("expected updated console authorization, got %#v", updated)
	}

	listed, err := st.ListBackends(ctx)
	if err != nil {
		t.Fatalf("ListBackends returned error: %v", err)
	}
	if len(listed) != 1 {
		t.Fatalf("expected one listed backend, got %#v", listed)
	}
	if listed[0].BackendType != domain.BackendTypeSub2API || listed[0].ConsoleAuthorization != "Bearer rotated-sub2api-token" {
		t.Fatalf("expected listed sub2api backend with authorization, got %#v", listed[0])
	}
}

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

func TestAppendUsageLogAggregatesBackendHourlyModelStats(t *testing.T) {
	st := openTestStore(t)
	defer st.Close()
	ctx := context.Background()

	createdAt := time.Date(2026, 6, 26, 7, 23, 0, 0, time.UTC)
	for _, entry := range []domain.UsageLog{
		{
			RequestID:        "agg-success",
			BackendID:        11,
			BackendName:      "alpha",
			Model:            "gpt-4o",
			StatusCode:       200,
			DurationMS:       120,
			RequestBytes:     100,
			ResponseBytes:    300,
			InputTokens:      100,
			OutputTokens:     25,
			InputCacheTokens: 40,
			CreatedAt:        createdAt,
		},
		{
			RequestID:        "agg-failure",
			BackendID:        11,
			BackendName:      "alpha",
			Model:            "gpt-4o",
			StatusCode:       502,
			DurationMS:       999,
			InputTokens:      999,
			OutputTokens:     999,
			InputCacheTokens: 999,
			CreatedAt:        createdAt.Add(5 * time.Minute),
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
	if row.SuccessInputTokens != 100 || row.SuccessOutputTokens != 25 || row.SuccessInputCacheTokens != 40 {
		t.Fatalf("unexpected token sums: %#v", row)
	}
	if row.HourStart != time.Date(2026, 6, 26, 7, 0, 0, 0, time.UTC) {
		t.Fatalf("unexpected hour bucket %s", row.HourStart)
	}
}

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

func TestOpenMigratesLegacyBackendsBeforeCreatingStatusIndex(t *testing.T) {
	dbPath := t.TempDir() + "/legacy.db"
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		t.Fatalf("open legacy sqlite: %v", err)
	}
	_, err = db.Exec(`
		CREATE TABLE backends (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL UNIQUE,
			base_url TEXT NOT NULL,
			api_key TEXT NOT NULL,
			weight INTEGER NOT NULL DEFAULT 1,
			model_list TEXT NOT NULL,
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
		t.Fatalf("Open should migrate legacy backend table before indexing status: %v", err)
	}
	defer st.Close()

	backend, err := st.CreateBackend(context.Background(), domain.Backend{
		Name:      "edge-legacy",
		Protocol:  domain.BackendProtocolOpenAI,
		BaseURL:   "https://edge-legacy.local/v1",
		APIKey:    "edge-key",
		Models:    []string{"gpt-4o"},
		Endpoints: []string{domain.EndpointChat},
	})
	if err != nil {
		t.Fatalf("CreateBackend after migration returned error: %v", err)
	}
	if backend.Status != domain.BackendStatusNormal {
		t.Fatalf("expected migrated backend status support, got %q", backend.Status)
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
		Name:               "edge-legacy",
		Protocol:           domain.BackendProtocolOpenAI,
		BackendType:        domain.BackendTypeNewAPI,
		BaseURL:            "https://edge-legacy.local/v1",
		APIKey:             "edge-key",
		ConsoleURL:         "https://console.edge-legacy.local",
		Tags:               []string{"legacy"},
		ConsoleUsername:    "admin-legacy",
		ConsolePassword:    "secret-legacy",
		ConsoleCookie:      "session=legacy",
		ConsoleAccountJSON: `{"username":"legacy","id":7,"quota":10,"used_quota":1}`,
		ConsolePricingJSON: `{"success":true,"data":{"vendors":[]}}`,
		Notes:              "migrated db",
		Models:             []string{"gpt-4o"},
		Endpoints:          []string{domain.EndpointChat},
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
	if backend.BackendType != domain.BackendTypeNewAPI || backend.ConsoleCookie != "session=legacy" {
		t.Fatalf("expected migrated console state support, got %#v", backend)
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
