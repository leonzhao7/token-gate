package app

import (
	"bytes"
	"compress/gzip"
	"compress/zlib"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"reflect"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/andybalholm/brotli"
	"github.com/klauspost/compress/zstd"

	"token-gate/internal/domain"
	"token-gate/internal/proxy"
	"token-gate/internal/store"
)

func TestProxyRetriesOnAnyNon2xxAndReturnsSuccessFromLaterBackend(t *testing.T) {
	const (
		clientToken = "client-secret"
		requestBody = `{"model":"gpt-4o","messages":[{"role":"user","content":"hello"}]}`
	)

	application := newTestApp(t)
	createTestClient(t, application, clientToken)
	backends := []domain.Backend{
		createTestBackend(t, application, domain.Backend{
			Name:      "alpha",
			BaseURL:   "https://alpha.local/root/v1",
			APIKey:    "alpha-key",
			Status:    domain.BackendStatusNormal,
			Weight:    9,
			Models:    []string{"gpt-4o"},
			Endpoints: []string{domain.EndpointChat},
		}),
		createTestBackend(t, application, domain.Backend{
			Name:      "beta",
			BaseURL:   "https://beta.local/root/v1",
			APIKey:    "beta-key",
			Status:    domain.BackendStatusNormal,
			Weight:    3,
			Models:    []string{"gpt-4o"},
			Endpoints: []string{domain.EndpointChat},
		}),
	}

	selection, err := application.scheduler.SelectBackend(context.Background(), domain.EndpointChat, "gpt-4o")
	if err != nil {
		t.Fatalf("select backend: %v", err)
	}
	if len(selection.Candidates) != 2 {
		t.Fatalf("expected two candidates, got %d", len(selection.Candidates))
	}

	fixture := newFailoverFixture(t, backends)
	fixture.statusByName[selection.Candidates[0].Name] = http.StatusInternalServerError
	fixture.statusByName[selection.Candidates[1].Name] = http.StatusOK
	application.proxy = proxy.NewWithHTTPClient(&http.Client{Transport: fixture})

	req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions?trace=1", strings.NewReader(requestBody))
	req.Header.Set("Authorization", "Bearer "+clientToken)
	req.Header.Set("X-Trace", "keep-me")
	req.Header.Set("Connection", "close")
	recorder := httptest.NewRecorder()

	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected failover response status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	if recorder.Body.String() != `{"backend":"`+selection.Candidates[1].Name+`"}` {
		t.Fatalf("response body should come from second backend, got %q", recorder.Body.String())
	}
	if recorder.Header().Get("X-Upstream") != selection.Candidates[1].Name {
		t.Fatalf("response headers should come from second backend, got %q", recorder.Header().Get("X-Upstream"))
	}

	records := fixture.recordsSnapshot()
	if len(records) != 2 {
		t.Fatalf("expected two upstream attempts, got %d: %#v", len(records), records)
	}
	if records[0].backendName != selection.Candidates[0].Name {
		t.Fatalf("first attempt should use selected primary backend, got %q want %q", records[0].backendName, selection.Candidates[0].Name)
	}
	if records[1].backendName != selection.Candidates[1].Name {
		t.Fatalf("second attempt should use failover backend, got %q want %q", records[1].backendName, selection.Candidates[1].Name)
	}

	expectedKeys := map[string]string{
		"alpha": "Bearer alpha-key",
		"beta":  "Bearer beta-key",
	}
	for _, record := range records {
		if record.method != http.MethodPost {
			t.Fatalf("method changed for %s: %q", record.backendName, record.method)
		}
		if record.path != "/root/v1/chat/completions" {
			t.Fatalf("path changed for %s: %q", record.backendName, record.path)
		}
		if record.rawQuery != "trace=1" {
			t.Fatalf("query changed for %s: %q", record.backendName, record.rawQuery)
		}
		if record.body != requestBody {
			t.Fatalf("body changed for %s: got %q want %q", record.backendName, record.body, requestBody)
		}
		if record.authorization != expectedKeys[record.backendName] {
			t.Fatalf("authorization mismatch for %s: got %q want %q", record.backendName, record.authorization, expectedKeys[record.backendName])
		}
		if record.trace != "keep-me" {
			t.Fatalf("custom header missing for %s: %q", record.backendName, record.trace)
		}
		if record.connection != "" {
			t.Fatalf("hop-by-hop header should be stripped for %s: %q", record.backendName, record.connection)
		}
	}

	events, err := application.store.ListAuditEvents(context.Background(), 10)
	if err != nil {
		t.Fatalf("list audit events: %v", err)
	}
	if len(events) != 0 {
		t.Fatalf("backend failover should not create audit events, got %#v", events)
	}
}

func TestProxyFailsOverOnUnauthorizedBackendResponse(t *testing.T) {
	const requestBody = `{"model":"gpt-4o","messages":[{"role":"user","content":"hello"}]}`

	application := newTestApp(t)
	client := createTestClient(t, application, "client-secret")
	backends := []domain.Backend{
		createTestBackend(t, application, domain.Backend{
			Name:      "alpha",
			BaseURL:   "https://alpha.local/root/v1",
			APIKey:    "alpha-key",
			Status:    domain.BackendStatusNormal,
			Weight:    9,
			Models:    []string{"gpt-4o"},
			Endpoints: []string{domain.EndpointChat},
		}),
		createTestBackend(t, application, domain.Backend{
			Name:      "beta",
			BaseURL:   "https://beta.local/root/v1",
			APIKey:    "beta-key",
			Status:    domain.BackendStatusNormal,
			Weight:    3,
			Models:    []string{"gpt-4o"},
			Endpoints: []string{domain.EndpointChat},
		}),
	}

	selection, err := application.scheduler.SelectBackend(context.Background(), domain.EndpointChat, "gpt-4o")
	if err != nil {
		t.Fatalf("select backend: %v", err)
	}
	fixture := newFailoverFixture(t, backends)
	fixture.statusByName[selection.Candidates[0].Name] = http.StatusUnauthorized
	fixture.statusByName[selection.Candidates[1].Name] = http.StatusOK
	application.proxy = proxy.NewWithHTTPClient(&http.Client{Transport: fixture})

	req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(requestBody))
	req.Header.Set("Authorization", "Bearer "+client.Token)
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected failover response status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	records := fixture.recordsSnapshot()
	if len(records) != 2 {
		t.Fatalf("expected two upstream attempts, got %d", len(records))
	}
}

func TestProxyReturns503WhenAllCandidatesFail(t *testing.T) {
	const requestBody = `{"model":"gpt-4o","messages":[{"role":"user","content":"hello"}]}`

	application := newTestApp(t)
	client := createTestClient(t, application, "client-secret")
	backends := []domain.Backend{
		createTestBackend(t, application, domain.Backend{
			Name:      "alpha",
			BaseURL:   "https://alpha.local/root/v1",
			APIKey:    "alpha-key",
			Status:    domain.BackendStatusNormal,
			Weight:    9,
			Models:    []string{"gpt-4o"},
			Endpoints: []string{domain.EndpointChat},
		}),
		createTestBackend(t, application, domain.Backend{
			Name:      "beta",
			BaseURL:   "https://beta.local/root/v1",
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

	req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(requestBody))
	req.Header.Set("Authorization", "Bearer "+client.Token)
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 when all backends fail, got %d body=%s", recorder.Code, recorder.Body.String())
	}
}

func TestProxyDoesNotPersistUsageLogWhenNoBackendAvailable(t *testing.T) {
	const requestBody = `{"model":"gpt-4o","messages":[{"role":"user","content":"hello"}]}`

	application := newTestApp(t)
	client := createTestClient(t, application, "client-secret")

	req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(requestBody))
	req.Header.Set("Authorization", "Bearer "+client.Token)
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 when no backend is available, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	total, err := application.store.CountUsageLogs(context.Background())
	if err != nil {
		t.Fatalf("count usage logs: %v", err)
	}
	if total != 0 {
		t.Fatalf("expected no usage log when no backend is available, got %d", total)
	}
}

func TestProxyFinalFailureUsageLogKeepsLastUpstreamResponse(t *testing.T) {
	const requestBody = `{"model":"gpt-4o","messages":[{"role":"user","content":"hello"}]}`

	application := newTestApp(t)
	client := createTestClient(t, application, "client-secret")
	backend := createTestBackend(t, application, domain.Backend{
		Name:      "alpha",
		BaseURL:   "https://alpha.local/root/v1",
		APIKey:    "alpha-key",
		Status:    domain.BackendStatusNormal,
		Weight:    1,
		Models:    []string{"gpt-4o"},
		Endpoints: []string{domain.EndpointChat},
	})

	fixture := newFailoverFixture(t, []domain.Backend{backend})
	fixture.statusByName[backend.Name] = http.StatusUnauthorized
	fixture.responseBodyByName[backend.Name] = `{"error":{"message":"401 Unauthorized"}}`
	application.proxy = proxy.NewWithHTTPClient(&http.Client{Transport: fixture})

	req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(requestBody))
	req.Header.Set("Authorization", "Bearer "+client.Token)
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)
	if recorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected proxy response 503, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	logs, err := application.store.ListUsageLogsPage(context.Background(), 10, 0)
	if err != nil {
		t.Fatalf("list usage logs: %v", err)
	}
	if len(logs) != 1 {
		t.Fatalf("expected one final usage log, got %d", len(logs))
	}
	if logs[0].StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected final usage log to keep upstream status 401, got %#v", logs[0])
	}
	if !strings.Contains(logs[0].ResponseBodyPreview, "401 Unauthorized") || !strings.Contains(logs[0].ErrorMessage, "Unauthorized") {
		t.Fatalf("expected final usage log to keep upstream 401 preview/error, got %#v", logs[0])
	}
	if strings.Contains(logs[0].ResponseBodyPreview, "no backend available") || strings.Contains(logs[0].ErrorMessage, "no backend available") {
		t.Fatalf("final usage log should not store client-facing 503 error, got %#v", logs[0])
	}
}

func TestProxyRewritesBackendModelByMapping(t *testing.T) {
	const (
		clientToken = "client-secret"
		requestBody = `{"model":"gpt-5.4","messages":[{"role":"user","content":"hello"}]}`
	)

	application := newTestApp(t)
	createTestClient(t, application, clientToken)
	backend := createTestBackend(t, application, domain.Backend{
		Name:         "mapped-backend",
		BaseURL:      "https://mapped.local/root/v1",
		APIKey:       "mapped-key",
		Weight:       1,
		Models:       []string{"gpt-5.4-test"},
		ModelMapping: map[string]string{"gpt-5.4": "gpt-5.4-test"},
		Endpoints:    []string{domain.EndpointChat},
	})

	fixture := newFailoverFixture(t, []domain.Backend{backend})
	application.proxy = proxy.NewWithHTTPClient(&http.Client{Transport: fixture})

	req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(requestBody))
	req.Header.Set("Authorization", "Bearer "+clientToken)
	recorder := httptest.NewRecorder()

	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	records := fixture.recordsSnapshot()
	if len(records) != 1 {
		t.Fatalf("expected one upstream attempt, got %d", len(records))
	}
	if !strings.Contains(records[0].body, `"gpt-5.4-test"`) {
		t.Fatalf("expected upstream body to use mapped model, got %s", records[0].body)
	}
	if strings.Contains(records[0].body, `"gpt-5.4","messages"`) {
		t.Fatalf("expected client-facing model to be rewritten for upstream body, got %s", records[0].body)
	}
}

func TestPublicModelsPrefersClientFacingMappedModelNames(t *testing.T) {
	application := newTestApp(t)
	createTestClient(t, application, "client-secret")
	createTestBackend(t, application, domain.Backend{
		Name:         "mapped-backend",
		BaseURL:      "https://mapped.local/root/v1",
		APIKey:       "mapped-key",
		Weight:       1,
		Models:       []string{"gpt-5.4-test", "gpt-4o", "gpt-image-*"},
		ModelMapping: map[string]string{"gpt-5.4": "gpt-5.4-test"},
		Endpoints:    []string{domain.EndpointChat, domain.EndpointImages},
	})

	req := httptest.NewRequest(http.MethodGet, "/v1/models", nil)
	req.Header.Set("Authorization", "Bearer client-secret")
	recorder := httptest.NewRecorder()

	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	var payload struct {
		Object string `json:"object"`
		Data   []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal models payload: %v", err)
	}

	models := make(map[string]struct{}, len(payload.Data))
	for _, item := range payload.Data {
		models[item.ID] = struct{}{}
	}

	if _, ok := models["gpt-5.4"]; !ok {
		t.Fatalf("expected mapped client-facing model to be listed, got %#v", models)
	}
	if _, ok := models["gpt-5.4-test"]; ok {
		t.Fatalf("expected upstream-only model to be hidden, got %#v", models)
	}
	if _, ok := models["gpt-4o"]; !ok {
		t.Fatalf("expected unmapped exact model to remain listed, got %#v", models)
	}
	if _, ok := models["gpt-image-*"]; ok {
		t.Fatalf("expected wildcard model not to be listed, got %#v", models)
	}
}

func TestPublicModelsListsOnlyNormalBackends(t *testing.T) {
	application := newTestApp(t)
	createTestClient(t, application, "client-secret")
	createTestBackend(t, application, domain.Backend{
		Name:      "normal",
		BaseURL:   "https://normal.local/root/v1",
		APIKey:    "normal-key",
		Status:    domain.BackendStatusNormal,
		Weight:    1,
		Models:    []string{"gpt-4o"},
		Endpoints: []string{domain.EndpointChat},
	})
	createTestBackend(t, application, domain.Backend{
		Name:      "disabled",
		BaseURL:   "https://disabled.local/root/v1",
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
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), `"status":"normal"`) {
		t.Fatalf("expected backend status normal, got %s", recorder.Body.String())
	}
}

func TestExportBackendsIncludesImportablePersistedFieldsOnly(t *testing.T) {
	application := newTestApp(t)
	backend := createTestBackend(t, application, domain.Backend{
		Name:                "edge-export",
		Protocol:            domain.BackendProtocolAnthropic,
		BaseURL:             "https://edge-export.local/v1",
		APIKey:              "edge-export-key",
		ConsoleURL:          "https://console.edge-export.local",
		Tags:                []string{"primary", "paid"},
		ConsoleUsername:     "operator",
		ConsolePassword:     "console-secret",
		Notes:               "export me",
		Status:              domain.BackendStatusAbnormal,
		ConsecutiveFailures: 3,
		Weight:              9,
		Models:              []string{"claude-3-5-sonnet"},
		ModelMapping:        map[string]string{"claude-public": "claude-3-5-sonnet"},
		Endpoints:           []string{domain.EndpointMessages},
	})
	recoverAt := time.Now().UTC().Add(time.Hour)
	backend.Status = domain.BackendStatusAbnormal
	backend.ConsecutiveFailures = 3
	backend.RecoverAt = &recoverAt
	_, err := application.store.UpdateBackend(context.Background(), backend)
	if err != nil {
		t.Fatalf("update backend failure state: %v", err)
	}
	createTestBackend(t, application, domain.Backend{
		Name:      "edge-empty-tags",
		Protocol:  domain.BackendProtocolOpenAI,
		BaseURL:   "https://edge-empty-tags.local/v1",
		APIKey:    "edge-empty-tags-key",
		Weight:    1,
		Models:    []string{"gpt-4o"},
		Endpoints: []string{domain.EndpointChat},
	})

	req := httptest.NewRequest(http.MethodGet, "/admin/api/backends/export", nil)
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	var payload map[string][]map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal export payload: %v", err)
	}
	if len(payload["backends"]) != 2 {
		t.Fatalf("expected two exported backends, got %#v", payload)
	}
	var exported map[string]any
	var emptyTagsExport map[string]any
	for _, item := range payload["backends"] {
		switch item["name"] {
		case "edge-export":
			exported = item
		case "edge-empty-tags":
			emptyTagsExport = item
		}
	}
	if exported == nil || emptyTagsExport == nil {
		t.Fatalf("expected both exported backends, got %#v", payload["backends"])
	}
	for _, key := range []string{"id", "created_at", "updated_at", "recover_at", "proxy", "request_count", "avg_latency_ms", "hourly_requests"} {
		if _, ok := exported[key]; ok {
			t.Fatalf("export should not include %q: %#v", key, exported)
		}
	}
	if exported["name"] != "edge-export" || exported["api_key"] != "edge-export-key" || exported["status"] != domain.BackendStatusAbnormal {
		t.Fatalf("unexpected exported backend payload: %#v", exported)
	}
	if exported["consecutive_failures"].(float64) != 3 {
		t.Fatalf("expected exported consecutive_failures=3, got %#v", exported)
	}
	tags, ok := emptyTagsExport["tags"]
	if !ok {
		t.Fatalf("expected empty tags field to be exported, got %#v", emptyTagsExport)
	}
	tagList, ok := tags.([]any)
	if !ok || len(tagList) != 0 {
		t.Fatalf("expected tags to be an empty array, got %#v", tags)
	}
}

func TestImportBackendsRejectsExistingNameAndRollsBack(t *testing.T) {
	application := newTestApp(t)
	createTestBackend(t, application, domain.Backend{
		Name:      "existing",
		Protocol:  domain.BackendProtocolOpenAI,
		BaseURL:   "https://existing.local/v1",
		APIKey:    "existing-key",
		Weight:    1,
		Models:    []string{"gpt-4o"},
		Endpoints: []string{domain.EndpointChat},
	})

	req := httptest.NewRequest(http.MethodPost, "/admin/api/backends/import", strings.NewReader(`{
		"backends": [
			{
				"name": "new-backend",
				"protocol": "openai",
				"base_url": "https://new.local/v1",
				"api_key": "new-key",
				"proxy_id": 0,
				"status": "normal",
				"consecutive_failures": 0,
				"weight": 2,
				"models": ["gpt-4o"],
				"model_mapping": {},
				"endpoints": ["chat"]
			},
			{
				"name": "existing",
				"protocol": "openai",
				"base_url": "https://duplicate.local/v1",
				"api_key": "duplicate-key",
				"proxy_id": 0,
				"status": "normal",
				"consecutive_failures": 0,
				"weight": 3,
				"models": ["gpt-4o"],
				"model_mapping": {},
				"endpoints": ["chat"]
			}
		]
	}`))
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), "backend name already exists") {
		t.Fatalf("expected duplicate name error, got %s", recorder.Body.String())
	}
	backends, err := application.store.ListBackends(context.Background())
	if err != nil {
		t.Fatalf("list backends: %v", err)
	}
	if len(backends) != 1 || backends[0].Name != "existing" {
		t.Fatalf("expected import rollback with only existing backend, got %#v", backends)
	}
}

func TestImportBackendsCreatesRecordsWithoutMetadataFields(t *testing.T) {
	application := newTestApp(t)

	req := httptest.NewRequest(http.MethodPost, "/admin/api/backends/import", strings.NewReader(`{
		"backends": [
			{
				"name": "imported",
				"protocol": "anthropic",
				"base_url": "https://imported.local/v1",
				"api_key": "imported-key",
				"console_url": "https://console.imported.local",
				"tags": ["imported"],
				"console_username": "operator",
				"console_password": "console-secret",
				"notes": "created from import",
				"proxy_id": 0,
				"status": "abnormal",
				"consecutive_failures": 2,
				"weight": 8,
				"models": ["claude-3-5-sonnet"],
				"model_mapping": {"public-claude":"claude-3-5-sonnet"},
				"endpoints": ["messages"]
			}
		]
	}`))
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	var payload struct {
		Imported int `json:"imported"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal import response: %v", err)
	}
	if payload.Imported != 1 {
		t.Fatalf("expected imported=1, got %#v", payload)
	}

	backends, err := application.store.ListBackends(context.Background())
	if err != nil {
		t.Fatalf("list backends: %v", err)
	}
	if len(backends) != 1 {
		t.Fatalf("expected one imported backend, got %#v", backends)
	}
	backend := backends[0]
	if backend.Name != "imported" || backend.Protocol != domain.BackendProtocolAnthropic || backend.Status != domain.BackendStatusAbnormal {
		t.Fatalf("unexpected imported backend: %#v", backend)
	}
	if backend.ConsecutiveFailures != 2 || backend.RecoverAt != nil {
		t.Fatalf("expected persisted failures and empty recover_at, got %#v", backend)
	}
	if backend.CreatedAt.IsZero() || backend.UpdatedAt.IsZero() {
		t.Fatalf("expected store-generated timestamps, got %#v", backend)
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
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d body=%s", recorder.Code, recorder.Body.String())
	}
}

func TestUpdateBackendAllowsManualNormalAndDisabledStatus(t *testing.T) {
	application := newTestApp(t)
	ctx := context.Background()

	backend := createTestBackend(t, application, domain.Backend{
		Name:      "edge-manual-status",
		Protocol:  domain.BackendProtocolOpenAI,
		BaseURL:   "https://edge.local/v1",
		APIKey:    "edge-key",
		Status:    domain.BackendStatusNormal,
		Weight:    7,
		Models:    []string{"gpt-4o"},
		Endpoints: []string{domain.EndpointChat},
	})
	abnormal, err := application.store.MarkBackendFailure(ctx, backend.ID, 1, 5*time.Minute, time.Date(2026, 6, 23, 10, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatalf("mark backend failure: %v", err)
	}
	if abnormal.Status != domain.BackendStatusAbnormal {
		t.Fatalf("expected abnormal backend fixture, got %#v", abnormal)
	}

	disableReq := httptest.NewRequest(http.MethodPut, fmt.Sprintf("/admin/api/backends/%d", backend.ID), strings.NewReader(`{
		"name":"edge-manual-status",
		"protocol":"openai",
		"base_url":"https://edge.local/v1",
		"api_key":"edge-key",
		"proxy_id":0,
		"status":"disabled",
		"weight":7,
		"models":["gpt-4o"],
		"model_mapping":{},
		"endpoints":["chat"]
	}`))
	disableReq.SetPathValue("id", strconv.FormatInt(backend.ID, 10))
	disableRecorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(disableRecorder, disableReq)
	if disableRecorder.Code != http.StatusOK {
		t.Fatalf("expected 200 when manually disabling abnormal backend, got %d body=%s", disableRecorder.Code, disableRecorder.Body.String())
	}

	disabled, err := application.store.GetBackend(ctx, backend.ID)
	if err != nil {
		t.Fatalf("get disabled backend: %v", err)
	}
	if disabled.Status != domain.BackendStatusDisabled {
		t.Fatalf("expected disabled status after manual update, got %#v", disabled)
	}

	normalReq := httptest.NewRequest(http.MethodPut, fmt.Sprintf("/admin/api/backends/%d", backend.ID), strings.NewReader(`{
		"name":"edge-manual-status",
		"protocol":"openai",
		"base_url":"https://edge.local/v1",
		"api_key":"edge-key",
		"proxy_id":0,
		"status":"normal",
		"weight":7,
		"models":["gpt-4o"],
		"model_mapping":{},
		"endpoints":["chat"]
	}`))
	normalReq.SetPathValue("id", strconv.FormatInt(backend.ID, 10))
	normalRecorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(normalRecorder, normalReq)
	if normalRecorder.Code != http.StatusOK {
		t.Fatalf("expected 200 when manually restoring backend to normal, got %d body=%s", normalRecorder.Code, normalRecorder.Body.String())
	}

	restored, err := application.store.GetBackend(ctx, backend.ID)
	if err != nil {
		t.Fatalf("get restored backend: %v", err)
	}
	if restored.Status != domain.BackendStatusNormal || restored.ConsecutiveFailures != 0 || restored.RecoverAt != nil {
		t.Fatalf("expected manual normal update to clear runtime state, got %#v", restored)
	}
}

func TestPolicyRoutesRemoved(t *testing.T) {
	application := newTestApp(t)

	req := httptest.NewRequest(http.MethodGet, "/admin/api/model-policies/1/detail", nil)
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
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for removed route fields, got %d body=%s", recorder.Code, recorder.Body.String())
	}
}

func TestProxySupportsAnthropicMessagesClientAndBackend(t *testing.T) {
	const (
		clientToken = "anthropic-client-secret"
		requestBody = `{"model":"claude-3-5-sonnet-latest","max_tokens":16,"messages":[{"role":"user","content":"hello"}]}`
	)

	application := newTestApp(t)
	createTestClient(t, application, clientToken)
	backend := createTestBackend(t, application, domain.Backend{
		Name:      "claude",
		Protocol:  domain.BackendProtocolAnthropic,
		BaseURL:   "https://claude.local/root/v1",
		APIKey:    "backend-anthropic-key",
		Weight:    1,
		Models:    []string{"claude-*"},
		Endpoints: []string{domain.EndpointMessages},
	})

	fixture := newFailoverFixture(t, []domain.Backend{backend})
	application.proxy = proxy.NewWithHTTPClient(&http.Client{Transport: fixture})

	req := httptest.NewRequest(http.MethodPost, "/v1/messages?beta=1", strings.NewReader(requestBody))
	req.Header.Set("X-Api-Key", clientToken)
	req.Header.Set("Anthropic-Version", "2023-06-01")
	req.Header.Set("X-Trace", "keep-me")
	recorder := httptest.NewRecorder()

	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	records := fixture.recordsSnapshot()
	if len(records) != 1 {
		t.Fatalf("expected one upstream attempt, got %d: %#v", len(records), records)
	}
	record := records[0]
	if record.backendName != "claude" {
		t.Fatalf("unexpected backend: %q", record.backendName)
	}
	if record.path != "/root/v1/messages" {
		t.Fatalf("path changed: %q", record.path)
	}
	if record.rawQuery != "beta=1" {
		t.Fatalf("query changed: %q", record.rawQuery)
	}
	if record.authorization != "" {
		t.Fatalf("anthropic backend should not receive Authorization, got %q", record.authorization)
	}
	if record.xAPIKey != "backend-anthropic-key" {
		t.Fatalf("anthropic backend x-api-key mismatch: %q", record.xAPIKey)
	}
	if record.anthropicVersion != "2023-06-01" {
		t.Fatalf("anthropic version header mismatch: %q", record.anthropicVersion)
	}
	if record.body != requestBody {
		t.Fatalf("body changed: got %q want %q", record.body, requestBody)
	}
	if record.trace != "keep-me" {
		t.Fatalf("custom header missing: %q", record.trace)
	}

	logs, err := application.store.ListUsageLogsPage(context.Background(), 10, 0)
	if err != nil {
		t.Fatalf("list usage logs: %v", err)
	}
	if len(logs) != 1 {
		t.Fatalf("expected one usage log, got %d", len(logs))
	}
	log := logs[0]
	if log.ClientName != "client" {
		t.Fatalf("unexpected client name in usage log: %q", log.ClientName)
	}
	if log.BackendName != "claude" {
		t.Fatalf("unexpected backend name in usage log: %q", log.BackendName)
	}
	if log.Endpoint != domain.EndpointMessages {
		t.Fatalf("unexpected endpoint in usage log: %q", log.Endpoint)
	}
	if log.Model != "claude-3-5-sonnet-latest" {
		t.Fatalf("unexpected model in usage log: %q", log.Model)
	}
	if log.StatusCode != http.StatusOK {
		t.Fatalf("unexpected status in usage log: %d", log.StatusCode)
	}
}

func TestProxyForwardsAnthropicMessagesNativelyForDualProtocolBackend(t *testing.T) {
	const (
		clientToken = "dual-client-secret"
		requestBody = `{"model":"claude-3-5-sonnet-latest","max_tokens":16,"messages":[{"role":"user","content":"hello"}]}`
	)

	application := newTestApp(t)
	createTestClient(t, application, clientToken)
	backend := createTestBackend(t, application, domain.Backend{
		Name:      "dual-protocol",
		Protocol:  "both",
		BaseURL:   "https://dual.local/root/v1",
		APIKey:    "backend-dual-key",
		Weight:    1,
		Models:    []string{"claude-3-5-sonnet-latest"},
		Endpoints: []string{domain.EndpointMessages, domain.EndpointResponses},
	})
	if backend.Protocol != "both" {
		t.Fatalf("expected dual protocol to be preserved, got %q", backend.Protocol)
	}

	fixture := newFailoverFixture(t, []domain.Backend{backend})
	application.proxy = proxy.NewWithHTTPClient(&http.Client{Transport: fixture})

	req := httptest.NewRequest(http.MethodPost, "/v1/messages?beta=1", strings.NewReader(requestBody))
	req.Header.Set("X-Api-Key", clientToken)
	req.Header.Set("Anthropic-Version", "2023-06-01")
	recorder := httptest.NewRecorder()

	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	records := fixture.recordsSnapshot()
	if len(records) != 1 {
		t.Fatalf("expected one upstream attempt, got %d: %#v", len(records), records)
	}
	record := records[0]
	if record.path != "/root/v1/messages" {
		t.Fatalf("expected native anthropic messages path, got %q", record.path)
	}
	if record.authorization != "" {
		t.Fatalf("dual backend should use anthropic auth for messages, got Authorization %q", record.authorization)
	}
	if record.xAPIKey != "backend-dual-key" {
		t.Fatalf("dual backend x-api-key mismatch: %q", record.xAPIKey)
	}
	if record.anthropicVersion != "2023-06-01" {
		t.Fatalf("anthropic version header mismatch: %q", record.anthropicVersion)
	}
	if record.body != requestBody {
		t.Fatalf("body changed: got %q want %q", record.body, requestBody)
	}
}

func TestProxyForwardsOpenAIResponsesNativelyForDualProtocolBackend(t *testing.T) {
	const (
		clientToken = "dual-openai-client-secret"
		requestBody = `{"model":"gpt-4o","input":"hello detail","max_output_tokens":16}`
	)

	application := newTestApp(t)
	createTestClient(t, application, clientToken)
	backend := createTestBackend(t, application, domain.Backend{
		Name:      "dual-openai",
		Protocol:  "both",
		BaseURL:   "https://dual-openai.local/root/v1",
		APIKey:    "backend-dual-openai-key",
		Weight:    1,
		Models:    []string{"gpt-4o"},
		Endpoints: []string{domain.EndpointMessages, domain.EndpointResponses},
	})
	if backend.Protocol != "both" {
		t.Fatalf("expected dual protocol to be preserved, got %q", backend.Protocol)
	}

	fixture := newFailoverFixture(t, []domain.Backend{backend})
	application.proxy = proxy.NewWithHTTPClient(&http.Client{Transport: fixture})

	req := httptest.NewRequest(http.MethodPost, "/v1/responses?trace=1", strings.NewReader(requestBody))
	req.Header.Set("Authorization", "Bearer "+clientToken)
	req.Header.Set("Anthropic-Version", "2023-06-01")
	recorder := httptest.NewRecorder()

	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	records := fixture.recordsSnapshot()
	if len(records) != 1 {
		t.Fatalf("expected one upstream attempt, got %d: %#v", len(records), records)
	}
	record := records[0]
	if record.path != "/root/v1/responses" {
		t.Fatalf("expected native openai responses path, got %q", record.path)
	}
	if record.authorization != "Bearer backend-dual-openai-key" {
		t.Fatalf("dual backend openai authorization mismatch: %q", record.authorization)
	}
	if record.xAPIKey != "" {
		t.Fatalf("dual backend should not use anthropic auth for responses, got x-api-key %q", record.xAPIKey)
	}
	if record.anthropicVersion != "" {
		t.Fatalf("openai request should strip anthropic version header, got %q", record.anthropicVersion)
	}
	if record.body != requestBody {
		t.Fatalf("body changed: got %q want %q", record.body, requestBody)
	}
}

func TestProxyTranslatesMessagesToResponsesForOpenAIBackend(t *testing.T) {
	const (
		clientToken = "client-secret"
		requestBody = `{"model":"claude-3-5-sonnet-latest","max_tokens":16,"messages":[{"role":"user","content":"hello"}]}`
	)

	application := newTestApp(t)
	createTestClient(t, application, clientToken)
	backend := createTestBackend(t, application, domain.Backend{
		Name:      "openai-response-backend",
		Protocol:  domain.BackendProtocolOpenAI,
		BaseURL:   "https://openai.local/root/v1",
		APIKey:    "backend-openai-key",
		Weight:    1,
		Models:    []string{"claude-3-5-sonnet-latest"},
		Endpoints: []string{domain.EndpointResponses},
	})

	fixture := newFailoverFixture(t, []domain.Backend{backend})
	fixture.responseBodyByName[backend.Name] = `{"id":"resp_1","object":"response","model":"claude-3-5-sonnet-latest","output":[{"type":"message","role":"assistant","content":[{"type":"output_text","text":"hello from openai"}]}],"usage":{"input_tokens":5,"output_tokens":3}}`
	application.proxy = proxy.NewWithHTTPClient(&http.Client{Transport: fixture})

	req := httptest.NewRequest(http.MethodPost, "/v1/messages?beta=1", strings.NewReader(requestBody))
	req.Header.Set("X-Api-Key", clientToken)
	req.Header.Set("Anthropic-Version", "2023-06-01")
	recorder := httptest.NewRecorder()

	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	records := fixture.recordsSnapshot()
	if len(records) != 1 {
		t.Fatalf("expected one upstream attempt, got %d: %#v", len(records), records)
	}
	record := records[0]
	if record.path != "/root/v1/responses" {
		t.Fatalf("expected backend responses path, got %q", record.path)
	}
	if record.rawQuery != "beta=1" {
		t.Fatalf("query changed: %q", record.rawQuery)
	}
	if record.authorization != "Bearer backend-openai-key" {
		t.Fatalf("openai backend authorization mismatch: %q", record.authorization)
	}
	if !strings.Contains(record.body, `"input"`) || strings.Contains(record.body, `"messages"`) {
		t.Fatalf("expected messages request to be converted into responses request, got %s", record.body)
	}
	if record.anthropicVersion != "" {
		t.Fatalf("openai backend should not receive anthropic version header, got %q", record.anthropicVersion)
	}

	var payload struct {
		Type    string `json:"type"`
		Role    string `json:"role"`
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
		Usage struct {
			InputTokens  int `json:"input_tokens"`
			OutputTokens int `json:"output_tokens"`
		} `json:"usage"`
		StopReason string `json:"stop_reason"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal translated response: %v", err)
	}
	if payload.Type != "message" || payload.Role != "assistant" {
		t.Fatalf("unexpected translated anthropic response: %#v", payload)
	}
	if len(payload.Content) != 1 || payload.Content[0].Type != "text" || payload.Content[0].Text != "hello from openai" {
		t.Fatalf("unexpected translated content: %#v", payload.Content)
	}
	if payload.Usage.InputTokens != 5 || payload.Usage.OutputTokens != 3 {
		t.Fatalf("unexpected translated usage: %#v", payload.Usage)
	}
}

func TestProxyTranslatesStreamingMessagesToResponsesForOpenAIBackend(t *testing.T) {
	const (
		clientToken  = "client-secret"
		requestBody  = `{"model":"claude-opus-4-6","max_tokens":16,"stream":true,"messages":[{"role":"user","content":"hello"}]}`
		responseBody = "" +
			"event: response.created\n" +
			"data: {\"type\":\"response.created\",\"response\":{\"id\":\"resp_1\",\"object\":\"response\",\"model\":\"gpt-5.4\",\"status\":\"in_progress\",\"output\":[],\"usage\":{\"input_tokens\":5,\"output_tokens\":0}}}\n\n" +
			"event: response.output_item.added\n" +
			"data: {\"type\":\"response.output_item.added\",\"output_index\":0,\"item\":{\"id\":\"msg_1\",\"status\":\"in_progress\",\"type\":\"message\",\"role\":\"assistant\",\"content\":[]}}\n\n" +
			"event: response.content_part.added\n" +
			"data: {\"type\":\"response.content_part.added\",\"item_id\":\"msg_1\",\"output_index\":0,\"content_index\":0,\"part\":{\"type\":\"output_text\",\"text\":\"\",\"annotations\":[]}}\n\n" +
			"event: response.output_text.delta\n" +
			"data: {\"type\":\"response.output_text.delta\",\"item_id\":\"msg_1\",\"output_index\":0,\"content_index\":0,\"delta\":\"hello \"}\n\n" +
			"event: response.output_text.delta\n" +
			"data: {\"type\":\"response.output_text.delta\",\"item_id\":\"msg_1\",\"output_index\":0,\"content_index\":0,\"delta\":\"from openai\"}\n\n" +
			"event: response.content_part.done\n" +
			"data: {\"type\":\"response.content_part.done\",\"item_id\":\"msg_1\",\"output_index\":0,\"content_index\":0,\"part\":{\"type\":\"output_text\",\"text\":\"hello from openai\",\"annotations\":[]}}\n\n" +
			"event: response.output_item.done\n" +
			"data: {\"type\":\"response.output_item.done\",\"output_index\":0,\"item\":{\"id\":\"msg_1\",\"status\":\"completed\",\"type\":\"message\",\"role\":\"assistant\",\"content\":[{\"type\":\"output_text\",\"text\":\"hello from openai\",\"annotations\":[]}]}}\n\n" +
			"event: response.completed\n" +
			"data: {\"type\":\"response.completed\",\"response\":{\"id\":\"resp_1\",\"object\":\"response\",\"model\":\"gpt-5.4\",\"status\":\"completed\",\"output\":[{\"id\":\"msg_1\",\"status\":\"completed\",\"type\":\"message\",\"role\":\"assistant\",\"content\":[{\"type\":\"output_text\",\"text\":\"hello from openai\",\"annotations\":[]}]}],\"usage\":{\"input_tokens\":5,\"output_tokens\":3},\"stop_reason\":\"end_turn\"}}\n\n"
	)

	application := newTestApp(t)
	createTestClient(t, application, clientToken)
	backend := createTestBackend(t, application, domain.Backend{
		Name:      "openai-streaming-backend",
		Protocol:  domain.BackendProtocolOpenAI,
		BaseURL:   "https://openai.local/root/v1",
		APIKey:    "backend-openai-key",
		Weight:    1,
		Models:    []string{"claude-opus-4-6"},
		Endpoints: []string{domain.EndpointResponses},
	})

	fixture := newFailoverFixture(t, []domain.Backend{backend})
	fixture.responseBodyByName[backend.Name] = responseBody
	fixture.responseHeadersByName[backend.Name] = http.Header{
		"Content-Type": {"text/event-stream"},
	}
	application.proxy = proxy.NewWithHTTPClient(&http.Client{Transport: fixture})

	req := httptest.NewRequest(http.MethodPost, "/v1/messages", strings.NewReader(requestBody))
	req.Header.Set("X-Api-Key", clientToken)
	req.Header.Set("Anthropic-Version", "2023-06-01")
	recorder := httptest.NewRecorder()

	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	records := fixture.recordsSnapshot()
	if len(records) != 1 {
		t.Fatalf("expected one upstream attempt, got %d: %#v", len(records), records)
	}
	record := records[0]
	if record.path != "/root/v1/responses" {
		t.Fatalf("expected backend responses path, got %q", record.path)
	}
	if !strings.Contains(record.body, `"stream":true`) {
		t.Fatalf("expected upstream streaming request body, got %s", record.body)
	}

	if contentType := recorder.Header().Get("Content-Type"); !strings.Contains(contentType, "text/event-stream") {
		t.Fatalf("expected streaming content-type, got %q", contentType)
	}
	body := recorder.Body.String()
	if !strings.Contains(body, "event: message_start") {
		t.Fatalf("expected anthropic message_start event, got %s", body)
	}
	if !strings.Contains(body, "event: content_block_delta") || !strings.Contains(body, `"text":"hello "`) || !strings.Contains(body, `"text":"from openai"`) {
		t.Fatalf("expected anthropic text delta events, got %s", body)
	}
	if !strings.Contains(body, "event: message_delta") || !strings.Contains(body, `"stop_reason":"end_turn"`) {
		t.Fatalf("expected anthropic message_delta event, got %s", body)
	}
	if !strings.Contains(body, "event: message_stop") {
		t.Fatalf("expected anthropic message_stop event, got %s", body)
	}
}

func TestProxyTranslatesResponsesToMessagesForAnthropicBackend(t *testing.T) {
	const (
		clientToken = "client-secret"
		requestBody = `{"model":"gpt-4o","input":"hello detail","max_output_tokens":16}`
	)

	application := newTestApp(t)
	createTestClient(t, application, clientToken)
	backend := createTestBackend(t, application, domain.Backend{
		Name:      "anthropic-messages-backend",
		Protocol:  domain.BackendProtocolAnthropic,
		BaseURL:   "https://anthropic.local/root/v1",
		APIKey:    "backend-anthropic-key",
		Weight:    1,
		Models:    []string{"gpt-4o"},
		Endpoints: []string{domain.EndpointMessages},
	})

	fixture := newFailoverFixture(t, []domain.Backend{backend})
	fixture.responseBodyByName[backend.Name] = `{"id":"msg_1","type":"message","role":"assistant","model":"gpt-4o","content":[{"type":"text","text":"hello from anthropic"}],"usage":{"input_tokens":7,"output_tokens":4},"stop_reason":"end_turn"}`
	application.proxy = proxy.NewWithHTTPClient(&http.Client{Transport: fixture})

	req := httptest.NewRequest(http.MethodPost, "/v1/responses?trace=1", strings.NewReader(requestBody))
	req.Header.Set("Authorization", "Bearer "+clientToken)
	recorder := httptest.NewRecorder()

	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	records := fixture.recordsSnapshot()
	if len(records) != 1 {
		t.Fatalf("expected one upstream attempt, got %d: %#v", len(records), records)
	}
	record := records[0]
	if record.path != "/root/v1/messages" {
		t.Fatalf("expected backend messages path, got %q", record.path)
	}
	if record.rawQuery != "trace=1" {
		t.Fatalf("query changed: %q", record.rawQuery)
	}
	if record.xAPIKey != "backend-anthropic-key" {
		t.Fatalf("anthropic backend x-api-key mismatch: %q", record.xAPIKey)
	}
	if !strings.Contains(record.body, `"messages"`) || strings.Contains(record.body, `"input"`) {
		t.Fatalf("expected responses request to be converted into messages request, got %s", record.body)
	}
	if record.authorization != "" {
		t.Fatalf("anthropic backend should not receive Authorization, got %q", record.authorization)
	}

	var payload struct {
		Object string `json:"object"`
		Model  string `json:"model"`
		Output []struct {
			Type    string `json:"type"`
			Role    string `json:"role"`
			Content []struct {
				Type string `json:"type"`
				Text string `json:"text"`
			} `json:"content"`
		} `json:"output"`
		Usage struct {
			InputTokens  int `json:"input_tokens"`
			OutputTokens int `json:"output_tokens"`
		} `json:"usage"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal translated response: %v", err)
	}
	if payload.Object != "response" || payload.Model != "gpt-4o" {
		t.Fatalf("unexpected translated openai response: %#v", payload)
	}
	if len(payload.Output) != 1 || payload.Output[0].Type != "message" || payload.Output[0].Role != "assistant" {
		t.Fatalf("unexpected translated output: %#v", payload.Output)
	}
	if len(payload.Output[0].Content) != 1 || payload.Output[0].Content[0].Type != "output_text" || payload.Output[0].Content[0].Text != "hello from anthropic" {
		t.Fatalf("unexpected translated output content: %#v", payload.Output[0].Content)
	}
	if payload.Usage.InputTokens != 7 || payload.Usage.OutputTokens != 4 {
		t.Fatalf("unexpected translated usage: %#v", payload.Usage)
	}
}

func TestProxyTranslatesStreamingResponsesToMessagesForAnthropicBackend(t *testing.T) {
	const (
		clientToken  = "client-secret"
		requestBody  = `{"model":"gpt-5.4","input":"hello detail","stream":true,"max_output_tokens":16}`
		responseBody = "" +
			"event: message_start\n" +
			"data: {\"type\":\"message_start\",\"message\":{\"id\":\"msg_1\",\"type\":\"message\",\"role\":\"assistant\",\"model\":\"claude-opus-4-6\",\"content\":[],\"stop_reason\":null,\"stop_sequence\":null,\"usage\":{\"input_tokens\":7,\"output_tokens\":0}}}\n\n" +
			"event: content_block_start\n" +
			"data: {\"type\":\"content_block_start\",\"index\":0,\"content_block\":{\"type\":\"text\",\"text\":\"\"}}\n\n" +
			"event: content_block_delta\n" +
			"data: {\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"text_delta\",\"text\":\"hello \"}}\n\n" +
			"event: content_block_delta\n" +
			"data: {\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"text_delta\",\"text\":\"from anthropic\"}}\n\n" +
			"event: content_block_stop\n" +
			"data: {\"type\":\"content_block_stop\",\"index\":0}\n\n" +
			"event: message_delta\n" +
			"data: {\"type\":\"message_delta\",\"delta\":{\"stop_reason\":\"end_turn\",\"stop_sequence\":null},\"usage\":{\"input_tokens\":7,\"output_tokens\":4}}\n\n" +
			"event: message_stop\n" +
			"data: {\"type\":\"message_stop\"}\n\n"
	)

	application := newTestApp(t)
	createTestClient(t, application, clientToken)
	backend := createTestBackend(t, application, domain.Backend{
		Name:      "anthropic-streaming-backend",
		Protocol:  domain.BackendProtocolAnthropic,
		BaseURL:   "https://anthropic.local/root/v1",
		APIKey:    "backend-anthropic-key",
		Weight:    1,
		Models:    []string{"gpt-5.4"},
		Endpoints: []string{domain.EndpointMessages},
	})

	fixture := newFailoverFixture(t, []domain.Backend{backend})
	fixture.responseBodyByName[backend.Name] = responseBody
	fixture.responseHeadersByName[backend.Name] = http.Header{
		"Content-Type": {"text/event-stream"},
	}
	application.proxy = proxy.NewWithHTTPClient(&http.Client{Transport: fixture})

	req := httptest.NewRequest(http.MethodPost, "/v1/responses", strings.NewReader(requestBody))
	req.Header.Set("Authorization", "Bearer "+clientToken)
	recorder := httptest.NewRecorder()

	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	records := fixture.recordsSnapshot()
	if len(records) != 1 {
		t.Fatalf("expected one upstream attempt, got %d: %#v", len(records), records)
	}
	record := records[0]
	if record.path != "/root/v1/messages" {
		t.Fatalf("expected backend messages path, got %q", record.path)
	}
	if !strings.Contains(record.body, `"stream":true`) {
		t.Fatalf("expected upstream streaming request body, got %s", record.body)
	}

	if contentType := recorder.Header().Get("Content-Type"); !strings.Contains(contentType, "text/event-stream") {
		t.Fatalf("expected streaming content-type, got %q", contentType)
	}
	body := recorder.Body.String()
	if !strings.Contains(body, "event: response.created") {
		t.Fatalf("expected openai response.created event, got %s", body)
	}
	if !strings.Contains(body, "event: response.output_text.delta") || !strings.Contains(body, `"delta":"hello "`) || !strings.Contains(body, `"delta":"from anthropic"`) {
		t.Fatalf("expected openai text delta events, got %s", body)
	}
	if !strings.Contains(body, "event: response.completed") {
		t.Fatalf("expected openai response.completed event, got %s", body)
	}
}

func TestUsageLogsRecordAnthropicResponseTokenUsage(t *testing.T) {
	const requestBody = `{"model":"gpt-4o","input":"hello detail","max_output_tokens":16}`

	application := newTestApp(t)
	client := createTestClient(t, application, "anthropic-usage-client")
	backend := createTestBackend(t, application, domain.Backend{
		Name:      "anthropic-usage-backend",
		Protocol:  domain.BackendProtocolAnthropic,
		BaseURL:   "https://anthropic.local/root/v1",
		APIKey:    "backend-anthropic-key",
		Weight:    1,
		Models:    []string{"gpt-4o"},
		Endpoints: []string{domain.EndpointMessages},
	})

	fixture := newFailoverFixture(t, []domain.Backend{backend})
	fixture.responseBodyByName[backend.Name] = `{"id":"msg_1","type":"message","role":"assistant","model":"gpt-4o","content":[{"type":"text","text":"hello from anthropic"}],"usage":{"input_tokens":9547,"output_tokens":389,"cache_creation_input_tokens":76256,"cache_creation":{"ephemeral_5m_input_tokens":76256}},"stop_reason":"end_turn"}`
	application.proxy = proxy.NewWithHTTPClient(&http.Client{Transport: fixture})

	req := httptest.NewRequest(http.MethodPost, "/v1/responses", strings.NewReader(requestBody))
	req.Header.Set("Authorization", "Bearer "+client.Token)
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	logs, err := application.store.ListUsageLogsPage(context.Background(), 10, 0)
	if err != nil {
		t.Fatalf("list usage logs: %v", err)
	}
	if len(logs) != 1 {
		t.Fatalf("expected one usage log, got %d", len(logs))
	}
	if logs[0].InputTokens != 85803 || logs[0].OutputTokens != 389 || logs[0].InputCacheTokens != 76256 {
		t.Fatalf("unexpected anthropic token usage: %#v", logs[0])
	}
}

func TestProxyForwardsAcceptEncodingAndDecodesCompressedJSONResponses(t *testing.T) {
	const requestBody = `{"model":"claude-opus-4-8","max_tokens":16,"messages":[{"role":"user","content":"hello"}]}`

	tests := []struct {
		name     string
		encoding string
	}{
		{name: "gzip", encoding: "gzip"},
		{name: "deflate", encoding: "deflate"},
		{name: "brotli", encoding: "br"},
		{name: "zstd", encoding: "zstd"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			application := newTestApp(t)
			client := createTestClient(t, application, "compressed-upstream-client-"+tc.encoding)
			backend := createTestBackend(t, application, domain.Backend{
				Name:      "compressed-upstream-backend-" + tc.encoding,
				Protocol:  domain.BackendProtocolAnthropic,
				BaseURL:   "https://anthropic.local/root/v1",
				APIKey:    "backend-anthropic-key",
				Weight:    1,
				Models:    []string{"claude-opus-4-8"},
				Endpoints: []string{domain.EndpointMessages},
			})

			fixture := newFailoverFixture(t, []domain.Backend{backend})
			fixture.responseBodyByName[backend.Name] = `{"id":"msg_1","type":"message","role":"assistant","model":"claude-opus-4-8","content":[{"type":"text","text":"hello from anthropic"}],"usage":{"input_tokens":31581,"output_tokens":1382,"cache_read_input_tokens":87779},"stop_reason":"tool_use"}`
			fixture.compressResponseByName[backend.Name] = tc.encoding
			fixture.responseHeadersByName[backend.Name] = http.Header{
				"Content-Type": {"application/json"},
			}
			application.proxy = proxy.NewWithHTTPClient(&http.Client{Transport: fixture})

			req := httptest.NewRequest(http.MethodPost, "/v1/messages", strings.NewReader(requestBody))
			req.Header.Set("X-Api-Key", client.Token)
			req.Header.Set("Anthropic-Version", "2023-06-01")
			req.Header.Set("Accept-Encoding", tc.encoding)
			recorder := httptest.NewRecorder()
			application.Handler().ServeHTTP(recorder, req)

			if recorder.Code != http.StatusOK {
				t.Fatalf("expected status 200, got %d body=%q", recorder.Code, recorder.Body.Bytes())
			}

			records := fixture.recordsSnapshot()
			if len(records) != 1 {
				t.Fatalf("expected one upstream attempt, got %d: %#v", len(records), records)
			}
			if records[0].acceptEncoding != tc.encoding {
				t.Fatalf("expected upstream Accept-Encoding %q, got %q", tc.encoding, records[0].acceptEncoding)
			}
			if contentEncoding := recorder.Header().Get("Content-Encoding"); contentEncoding != "" {
				t.Fatalf("expected decoded downstream response without content-encoding, got %q", contentEncoding)
			}
			if recorder.Body.String() != fixture.responseBodyByName[backend.Name] {
				t.Fatalf("expected decoded downstream response body %q, got %q", fixture.responseBodyByName[backend.Name], recorder.Body.String())
			}

			logs, err := application.store.ListUsageLogsPage(context.Background(), 10, 0)
			if err != nil {
				t.Fatalf("list usage logs: %v", err)
			}
			if len(logs) != 1 {
				t.Fatalf("expected one usage log, got %d", len(logs))
			}
			if logs[0].InputTokens != 119360 || logs[0].OutputTokens != 1382 || logs[0].InputCacheTokens != 87779 {
				t.Fatalf("unexpected compressed-response token usage: %#v", logs[0])
			}
		})
	}
}

func TestUsageLogsRecordChatCompletionsTokenUsage(t *testing.T) {
	const requestBody = `{"model":"deepseek-v4-pro","temperature":0.1,"max_tokens":256,"stream":false,"messages":[{"role":"user","content":"hello"}]}`

	application := newTestApp(t)
	client := createTestClient(t, application, "chat-completions-usage-client")
	backend := createTestBackend(t, application, domain.Backend{
		Name:      "chat-completions-usage-backend",
		Protocol:  domain.BackendProtocolOpenAI,
		BaseURL:   "https://openai.local/root/v1",
		APIKey:    "backend-openai-key",
		Weight:    1,
		Models:    []string{"deepseek-v4-pro"},
		Endpoints: []string{domain.EndpointChat},
	})

	fixture := newFailoverFixture(t, []domain.Backend{backend})
	fixture.responseBodyByName[backend.Name] = `{"id":"chatcmpl-1","object":"chat.completion","created":1783418195,"model":"deepseek-v4-pro","choices":[{"index":0,"message":{"role":"assistant","content":"{\"profile\":\"java-21\",\"springBootVersion\":\"3.2.0\"}"},"finish_reason":"stop"}],"usage":{"prompt_tokens":242,"total_tokens":817,"completion_tokens":575,"prompt_tokens_details":{"cached_tokens":19},"completion_tokens_details":{"reasoning_tokens":553}}}`
	application.proxy = proxy.NewWithHTTPClient(&http.Client{Transport: fixture})

	req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(requestBody))
	req.Header.Set("Authorization", "Bearer "+client.Token)
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	logs, err := application.store.ListUsageLogsPage(context.Background(), 10, 0)
	if err != nil {
		t.Fatalf("list usage logs: %v", err)
	}
	if len(logs) != 1 {
		t.Fatalf("expected one usage log, got %d", len(logs))
	}
	if logs[0].InputTokens != 242 || logs[0].OutputTokens != 575 || logs[0].InputCacheTokens != 19 {
		t.Fatalf("unexpected chat completions token usage: %#v", logs[0])
	}
}

func TestUsageLogsRecordOpenAIStreamingResponseTokenUsage(t *testing.T) {
	const (
		clientToken  = "openai-stream-usage-client"
		requestBody  = `{"model":"claude-opus-4-6","max_tokens":16,"stream":true,"messages":[{"role":"user","content":"hello"}]}`
		responseBody = "" +
			"event: response.created\n" +
			"data: {\"type\":\"response.created\",\"response\":{\"id\":\"resp_1\",\"object\":\"response\",\"model\":\"gpt-5.4\",\"status\":\"in_progress\",\"output\":[],\"usage\":{\"input_tokens\":18908,\"output_tokens\":0}}}\n\n" +
			"event: response.output_item.added\n" +
			"data: {\"type\":\"response.output_item.added\",\"output_index\":0,\"item\":{\"id\":\"msg_1\",\"status\":\"in_progress\",\"type\":\"message\",\"role\":\"assistant\",\"content\":[]}}\n\n" +
			"event: response.content_part.added\n" +
			"data: {\"type\":\"response.content_part.added\",\"item_id\":\"msg_1\",\"output_index\":0,\"content_index\":0,\"part\":{\"type\":\"output_text\",\"text\":\"\",\"annotations\":[]}}\n\n" +
			"event: response.output_text.delta\n" +
			"data: {\"type\":\"response.output_text.delta\",\"item_id\":\"msg_1\",\"output_index\":0,\"content_index\":0,\"delta\":\"hello from openai\"}\n\n" +
			"event: response.completed\n" +
			"data: {\"type\":\"response.completed\",\"response\":{\"id\":\"resp_1\",\"object\":\"response\",\"model\":\"gpt-5.4\",\"status\":\"completed\",\"output\":[{\"id\":\"msg_1\",\"status\":\"completed\",\"type\":\"message\",\"role\":\"assistant\",\"content\":[{\"type\":\"output_text\",\"text\":\"hello from openai\",\"annotations\":[]}]}],\"usage\":{\"input_tokens\":18908,\"input_tokens_details\":{\"cached_tokens\":16256},\"output_tokens\":217,\"output_tokens_details\":{\"reasoning_tokens\":0},\"total_tokens\":19125},\"stop_reason\":\"end_turn\"}}\n\n"
	)

	application := newTestApp(t)
	createTestClient(t, application, clientToken)
	backend := createTestBackend(t, application, domain.Backend{
		Name:      "openai-streaming-usage-backend",
		Protocol:  domain.BackendProtocolOpenAI,
		BaseURL:   "https://openai.local/root/v1",
		APIKey:    "backend-openai-key",
		Weight:    1,
		Models:    []string{"claude-opus-4-6"},
		Endpoints: []string{domain.EndpointResponses},
	})

	fixture := newFailoverFixture(t, []domain.Backend{backend})
	fixture.responseBodyByName[backend.Name] = responseBody
	fixture.responseHeadersByName[backend.Name] = http.Header{
		"Content-Type": {"text/event-stream"},
	}
	application.proxy = proxy.NewWithHTTPClient(&http.Client{Transport: fixture})

	req := httptest.NewRequest(http.MethodPost, "/v1/messages", strings.NewReader(requestBody))
	req.Header.Set("X-Api-Key", clientToken)
	req.Header.Set("Anthropic-Version", "2023-06-01")
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	logs, err := application.store.ListUsageLogsPage(context.Background(), 10, 0)
	if err != nil {
		t.Fatalf("list usage logs: %v", err)
	}
	if len(logs) != 1 {
		t.Fatalf("expected one usage log, got %d", len(logs))
	}
	if logs[0].InputTokens != 18908 || logs[0].OutputTokens != 217 || logs[0].InputCacheTokens != 16256 {
		t.Fatalf("unexpected openai streaming token usage: %#v", logs[0])
	}
}

func TestProxyDecodesCompressedStreamingResponses(t *testing.T) {
	const (
		requestBody  = `{"model":"claude-opus-4-6","max_tokens":16,"stream":true,"messages":[{"role":"user","content":"hello"}]}`
		responseBody = "" +
			"event: response.created\n" +
			"data: {\"type\":\"response.created\",\"response\":{\"id\":\"resp_1\",\"object\":\"response\",\"model\":\"gpt-5.4\",\"status\":\"in_progress\",\"output\":[],\"usage\":{\"input_tokens\":18908,\"output_tokens\":0}}}\n\n" +
			"event: response.output_item.added\n" +
			"data: {\"type\":\"response.output_item.added\",\"output_index\":0,\"item\":{\"id\":\"msg_1\",\"status\":\"in_progress\",\"type\":\"message\",\"role\":\"assistant\",\"content\":[]}}\n\n" +
			"event: response.content_part.added\n" +
			"data: {\"type\":\"response.content_part.added\",\"item_id\":\"msg_1\",\"output_index\":0,\"content_index\":0,\"part\":{\"type\":\"output_text\",\"text\":\"\",\"annotations\":[]}}\n\n" +
			"event: response.output_text.delta\n" +
			"data: {\"type\":\"response.output_text.delta\",\"item_id\":\"msg_1\",\"output_index\":0,\"content_index\":0,\"delta\":\"hello from openai\"}\n\n" +
			"event: response.completed\n" +
			"data: {\"type\":\"response.completed\",\"response\":{\"id\":\"resp_1\",\"object\":\"response\",\"model\":\"gpt-5.4\",\"status\":\"completed\",\"output\":[{\"id\":\"msg_1\",\"status\":\"completed\",\"type\":\"message\",\"role\":\"assistant\",\"content\":[{\"type\":\"output_text\",\"text\":\"hello from openai\",\"annotations\":[]}]}],\"usage\":{\"input_tokens\":18908,\"input_tokens_details\":{\"cached_tokens\":16256},\"output_tokens\":217,\"output_tokens_details\":{\"reasoning_tokens\":0},\"total_tokens\":19125},\"stop_reason\":\"end_turn\"}}\n\n"
		expectedBody = "" +
			"event: message_start\n" +
			"data: {\"message\":{\"content\":[],\"id\":\"resp_1\",\"model\":\"gpt-5.4\",\"role\":\"assistant\",\"stop_reason\":null,\"stop_sequence\":null,\"type\":\"message\",\"usage\":{\"input_tokens\":18908,\"output_tokens\":0}},\"type\":\"message_start\"}\n\n" +
			"event: content_block_start\n" +
			"data: {\"content_block\":{\"text\":\"\",\"type\":\"text\"},\"index\":0,\"type\":\"content_block_start\"}\n\n" +
			"event: content_block_delta\n" +
			"data: {\"delta\":{\"text\":\"hello from openai\",\"type\":\"text_delta\"},\"index\":0,\"type\":\"content_block_delta\"}\n\n" +
			"event: content_block_stop\n" +
			"data: {\"index\":0,\"type\":\"content_block_stop\"}\n\n" +
			"event: message_delta\n" +
			"data: {\"delta\":{\"stop_reason\":\"end_turn\",\"stop_sequence\":null},\"type\":\"message_delta\",\"usage\":{\"input_tokens\":18908,\"input_tokens_details\":{\"cached_tokens\":16256},\"output_tokens\":217,\"output_tokens_details\":{\"reasoning_tokens\":0},\"total_tokens\":19125}}\n\n" +
			"event: message_stop\n" +
			"data: {\"type\":\"message_stop\"}\n\n"
	)

	tests := []struct {
		name     string
		encoding string
	}{
		{name: "gzip", encoding: "gzip"},
		{name: "deflate", encoding: "deflate"},
		{name: "brotli", encoding: "br"},
		{name: "zstd", encoding: "zstd"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			application := newTestApp(t)
			client := createTestClient(t, application, "openai-stream-usage-client-"+tc.encoding)
			backend := createTestBackend(t, application, domain.Backend{
				Name:      "openai-streaming-usage-backend-" + tc.encoding,
				Protocol:  domain.BackendProtocolOpenAI,
				BaseURL:   "https://openai.local/root/v1",
				APIKey:    "backend-openai-key",
				Weight:    1,
				Models:    []string{"claude-opus-4-6"},
				Endpoints: []string{domain.EndpointResponses},
			})

			fixture := newFailoverFixture(t, []domain.Backend{backend})
			fixture.responseBodyByName[backend.Name] = responseBody
			fixture.compressResponseByName[backend.Name] = tc.encoding
			fixture.responseHeadersByName[backend.Name] = http.Header{
				"Content-Type": {"text/event-stream"},
			}
			application.proxy = proxy.NewWithHTTPClient(&http.Client{Transport: fixture})

			req := httptest.NewRequest(http.MethodPost, "/v1/messages", strings.NewReader(requestBody))
			req.Header.Set("X-Api-Key", client.Token)
			req.Header.Set("Anthropic-Version", "2023-06-01")
			req.Header.Set("Accept-Encoding", tc.encoding)
			recorder := httptest.NewRecorder()
			application.Handler().ServeHTTP(recorder, req)

			if recorder.Code != http.StatusOK {
				t.Fatalf("expected status 200, got %d body=%q", recorder.Code, recorder.Body.Bytes())
			}

			records := fixture.recordsSnapshot()
			if len(records) != 1 {
				t.Fatalf("expected one upstream attempt, got %d: %#v", len(records), records)
			}
			if records[0].acceptEncoding != tc.encoding {
				t.Fatalf("expected upstream Accept-Encoding %q, got %q", tc.encoding, records[0].acceptEncoding)
			}
			if contentEncoding := recorder.Header().Get("Content-Encoding"); contentEncoding != "" {
				t.Fatalf("expected decoded downstream response without content-encoding, got %q", contentEncoding)
			}
			if recorder.Body.String() != expectedBody {
				t.Fatalf("expected decoded downstream response body %q, got %q", expectedBody, recorder.Body.String())
			}

			logs, err := application.store.ListUsageLogsPage(context.Background(), 10, 0)
			if err != nil {
				t.Fatalf("list usage logs: %v", err)
			}
			if len(logs) != 1 {
				t.Fatalf("expected one usage log, got %d", len(logs))
			}
			if logs[0].InputTokens != 18908 || logs[0].OutputTokens != 217 || logs[0].InputCacheTokens != 16256 {
				t.Fatalf("unexpected compressed streaming token usage: %#v", logs[0])
			}
		})
	}
}

func TestUsageLogsRecordAnthropicStreamingResponseTokenUsage(t *testing.T) {
	const (
		requestBody  = `{"model":"gpt-5.4","input":"hello detail","stream":true,"max_output_tokens":16}`
		responseBody = "" +
			"event: message_start\n" +
			"data: {\"type\":\"message_start\",\"message\":{\"id\":\"msg_1\",\"type\":\"message\",\"role\":\"assistant\",\"model\":\"claude-opus-4-6\",\"content\":[],\"stop_reason\":null,\"stop_sequence\":null,\"usage\":{\"input_tokens\":9547,\"output_tokens\":0,\"cache_creation_input_tokens\":76256}}}\n\n" +
			"event: content_block_start\n" +
			"data: {\"type\":\"content_block_start\",\"index\":0,\"content_block\":{\"type\":\"text\",\"text\":\"\"}}\n\n" +
			"event: content_block_delta\n" +
			"data: {\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"text_delta\",\"text\":\"hello from anthropic\"}}\n\n" +
			"event: content_block_stop\n" +
			"data: {\"type\":\"content_block_stop\",\"index\":0}\n\n" +
			"event: message_delta\n" +
			"data: {\"type\":\"message_delta\",\"delta\":{\"stop_reason\":\"end_turn\",\"stop_sequence\":null},\"usage\":{\"input_tokens\":9547,\"output_tokens\":389,\"cache_creation_input_tokens\":76256}}\n\n" +
			"event: message_stop\n" +
			"data: {\"type\":\"message_stop\"}\n\n"
	)

	application := newTestApp(t)
	client := createTestClient(t, application, "anthropic-stream-usage-client")
	backend := createTestBackend(t, application, domain.Backend{
		Name:      "anthropic-streaming-usage-backend",
		Protocol:  domain.BackendProtocolAnthropic,
		BaseURL:   "https://anthropic.local/root/v1",
		APIKey:    "backend-anthropic-key",
		Weight:    1,
		Models:    []string{"gpt-5.4"},
		Endpoints: []string{domain.EndpointMessages},
	})

	fixture := newFailoverFixture(t, []domain.Backend{backend})
	fixture.responseBodyByName[backend.Name] = responseBody
	fixture.responseHeadersByName[backend.Name] = http.Header{
		"Content-Type": {"text/event-stream"},
	}
	application.proxy = proxy.NewWithHTTPClient(&http.Client{Transport: fixture})

	req := httptest.NewRequest(http.MethodPost, "/v1/responses", strings.NewReader(requestBody))
	req.Header.Set("Authorization", "Bearer "+client.Token)
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	logs, err := application.store.ListUsageLogsPage(context.Background(), 10, 0)
	if err != nil {
		t.Fatalf("list usage logs: %v", err)
	}
	if len(logs) != 1 {
		t.Fatalf("expected one usage log, got %d", len(logs))
	}
	if logs[0].InputTokens != 85803 || logs[0].OutputTokens != 389 || logs[0].InputCacheTokens != 76256 {
		t.Fatalf("unexpected anthropic streaming token usage: %#v", logs[0])
	}
}

func TestUpdateBackendPreservesAPIKeyWhenPayloadIsBlank(t *testing.T) {
	application := newTestApp(t)
	backend := createTestBackend(t, application, domain.Backend{
		Name:      "editable",
		Protocol:  domain.BackendProtocolAnthropic,
		BaseURL:   "https://editable.local/v1",
		APIKey:    "keep-this-key",
		Status:    domain.BackendStatusNormal,
		Weight:    1,
		Models:    []string{"gpt-4o"},
		Endpoints: []string{domain.EndpointChat},
	})

	body := `{
		"name":"editable-updated",
		"base_url":"https://editable.local/root/v1",
		"api_key":"",
		"status":"normal",
		"weight":2,
		"models":["gpt-4o","gpt-image-*"],
		"model_mapping":{"gpt-4o":"gpt-4o-upstream"},
		"endpoints":["chat","images"]
	}`
	req := httptest.NewRequest(http.MethodPut, "/admin/api/backends/"+strconv.FormatInt(backend.ID, 10), strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer test-admin")
	recorder := httptest.NewRecorder()

	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	updated, err := application.store.GetBackend(context.Background(), backend.ID)
	if err != nil {
		t.Fatalf("get updated backend: %v", err)
	}
	if updated.APIKey != "keep-this-key" {
		t.Fatalf("expected API key to be preserved, got %q", updated.APIKey)
	}
	if updated.Protocol != domain.BackendProtocolAnthropic {
		t.Fatalf("expected protocol to be preserved when payload omits it, got %q", updated.Protocol)
	}
	if updated.Name != "editable-updated" {
		t.Fatalf("expected name update, got %q", updated.Name)
	}
	if updated.Weight != 2 {
		t.Fatalf("expected weight update, got %d", updated.Weight)
	}
	if updated.ModelMapping["gpt-4o"] != "gpt-4o-upstream" {
		t.Fatalf("expected model mapping update, got %#v", updated.ModelMapping)
	}
}

func TestAdminClientKeyStoresAndReturnsToken(t *testing.T) {
	application := newTestApp(t)
	const clientToken = "client-visible-key"

	createBody := `{
		"name":"visible-client",
		"token":"` + clientToken + `",
		"enabled":true
	}`
	createReq := httptest.NewRequest(http.MethodPost, "/admin/api/client-keys", strings.NewReader(createBody))
	createReq.Header.Set("Authorization", "Bearer test-admin")
	createRecorder := httptest.NewRecorder()

	application.Handler().ServeHTTP(createRecorder, createReq)

	if createRecorder.Code != http.StatusCreated {
		t.Fatalf("expected create status 201, got %d body=%s", createRecorder.Code, createRecorder.Body.String())
	}

	var createPayload struct {
		Client      domain.ClientKey `json:"client"`
		IssuedToken string           `json:"issued_token"`
	}
	if err := json.Unmarshal(createRecorder.Body.Bytes(), &createPayload); err != nil {
		t.Fatalf("unmarshal create response: %v", err)
	}
	if createPayload.IssuedToken != clientToken {
		t.Fatalf("expected issued token %q, got %q", clientToken, createPayload.IssuedToken)
	}
	if createPayload.Client.Token != clientToken {
		t.Fatalf("expected response client token %q, got %q", clientToken, createPayload.Client.Token)
	}

	listReq := httptest.NewRequest(http.MethodGet, "/admin/api/client-keys", nil)
	listReq.Header.Set("Authorization", "Bearer test-admin")
	listRecorder := httptest.NewRecorder()

	application.Handler().ServeHTTP(listRecorder, listReq)

	if listRecorder.Code != http.StatusOK {
		t.Fatalf("expected list status 200, got %d body=%s", listRecorder.Code, listRecorder.Body.String())
	}
	var listPayload struct {
		Items []domain.ClientKey `json:"items"`
		Total int                `json:"total"`
		Page  int                `json:"page"`
		Limit int                `json:"limit"`
	}
	if err := json.Unmarshal(listRecorder.Body.Bytes(), &listPayload); err != nil {
		t.Fatalf("unmarshal client list: %v", err)
	}
	if listPayload.Total != 1 || listPayload.Page != 1 || listPayload.Limit != 10 {
		t.Fatalf("unexpected pagination payload: %#v", listPayload)
	}
	if len(listPayload.Items) != 1 || listPayload.Items[0].Token != clientToken {
		t.Fatalf("expected client list to include token %q, got %#v", clientToken, listPayload.Items)
	}

	updateBody := `{
		"name":"visible-client-renamed",
		"token":"` + clientToken + `",
		"enabled":true
	}`
	updateReq := httptest.NewRequest(http.MethodPut, "/admin/api/client-keys/"+strconv.FormatInt(createPayload.Client.ID, 10), strings.NewReader(updateBody))
	updateReq.Header.Set("Authorization", "Bearer test-admin")
	updateRecorder := httptest.NewRecorder()

	application.Handler().ServeHTTP(updateRecorder, updateReq)

	if updateRecorder.Code != http.StatusOK {
		t.Fatalf("expected update status 200, got %d body=%s", updateRecorder.Code, updateRecorder.Body.String())
	}
	var updatePayload struct {
		Client      domain.ClientKey `json:"client"`
		IssuedToken string           `json:"issued_token"`
	}
	if err := json.Unmarshal(updateRecorder.Body.Bytes(), &updatePayload); err != nil {
		t.Fatalf("unmarshal update response: %v", err)
	}
	if updatePayload.IssuedToken != "" {
		t.Fatalf("unchanged token should not be re-issued, got %q", updatePayload.IssuedToken)
	}
	if updatePayload.Client.Token != clientToken {
		t.Fatalf("expected updated client token %q, got %q", clientToken, updatePayload.Client.Token)
	}
}

func TestAdminClientKeyListIncludesUsageSummary(t *testing.T) {
	application := newTestApp(t)
	client := createTestClient(t, application, "client-visible-key")

	ctx := context.Background()
	for i := 0; i < 2; i++ {
		if err := application.store.AppendUsageLog(ctx, domain.UsageLog{
			RequestID:         fmt.Sprintf("client-list-%d", i),
			ClientID:          client.ID,
			ClientName:        client.Name,
			ClientTokenPrefix: client.TokenPrefix,
			Method:            http.MethodPost,
			Path:              "/v1/chat/completions",
			Endpoint:          domain.EndpointChat,
			Model:             "gpt-4o",
			BackendID:         1,
			BackendName:       "alpha",
			Attempts:          1,
			StatusCode:        http.StatusOK,
			DurationMS:        45,
		}); err != nil {
			t.Fatalf("append usage log %d: %v", i, err)
		}
	}

	req := httptest.NewRequest(http.MethodGet, "/admin/api/client-keys", nil)
	req.Header.Set("Authorization", "Bearer test-admin")
	recorder := httptest.NewRecorder()

	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected list status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	var payload struct {
		Items []struct {
			ID          int64     `json:"id"`
			Name        string    `json:"name"`
			Token       string    `json:"token"`
			MaskedToken string    `json:"masked_token"`
			UsageCount  int       `json:"usage_count"`
			LastUsedAt  time.Time `json:"last_used_at"`
		} `json:"items"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal client key list: %v", err)
	}
	if len(payload.Items) != 1 {
		t.Fatalf("expected one client item, got %#v", payload.Items)
	}
	item := payload.Items[0]
	if item.ID != client.ID || item.Name != client.Name {
		t.Fatalf("unexpected client identity: %#v", item)
	}
	if item.Token != client.Token {
		t.Fatalf("expected full client token %q, got %q", client.Token, item.Token)
	}
	if item.MaskedToken == "" || item.MaskedToken == client.Token {
		t.Fatalf("expected masked token distinct from raw token, got %q", item.MaskedToken)
	}
	if item.UsageCount != 2 {
		t.Fatalf("expected usage_count=2, got %#v", item)
	}
	if item.LastUsedAt.IsZero() {
		t.Fatalf("expected last_used_at to be populated, got %#v", item)
	}
}

func TestAdminClientKeyListMasksShortTokens(t *testing.T) {
	application := newTestApp(t)
	client := createTestClient(t, application, "short1")

	req := httptest.NewRequest(http.MethodGet, "/admin/api/client-keys", nil)
	req.Header.Set("Authorization", "Bearer test-admin")
	recorder := httptest.NewRecorder()

	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected list status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	var payload struct {
		Items []struct {
			Token       string `json:"token"`
			MaskedToken string `json:"masked_token"`
		} `json:"items"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal short-token list: %v", err)
	}
	if len(payload.Items) != 1 {
		t.Fatalf("expected one client item, got %#v", payload.Items)
	}
	if payload.Items[0].Token != client.Token {
		t.Fatalf("expected raw token %q, got %#v", client.Token, payload.Items[0])
	}
	if payload.Items[0].MaskedToken == "" || payload.Items[0].MaskedToken == client.Token {
		t.Fatalf("expected short token to be masked, got %#v", payload.Items[0])
	}
}

func TestAdminSocksProxyCRUDAndBackendBinding(t *testing.T) {
	application := newTestApp(t)

	proxyBody := `{
		"name":"tokyo-socks",
		"address":"127.0.0.1:1080",
		"username":"proxy-user",
		"password":"proxy-pass",
		"enabled":true
	}`
	proxyReq := httptest.NewRequest(http.MethodPost, "/admin/api/socks-proxies", strings.NewReader(proxyBody))
	proxyReq.Header.Set("Authorization", "Bearer test-admin")
	proxyRecorder := httptest.NewRecorder()

	application.Handler().ServeHTTP(proxyRecorder, proxyReq)

	if proxyRecorder.Code != http.StatusCreated {
		t.Fatalf("expected proxy create status 201, got %d body=%s", proxyRecorder.Code, proxyRecorder.Body.String())
	}
	var createdProxy domain.SocksProxy
	if err := json.Unmarshal(proxyRecorder.Body.Bytes(), &createdProxy); err != nil {
		t.Fatalf("unmarshal proxy response: %v", err)
	}
	if createdProxy.Password != "proxy-pass" {
		t.Fatalf("expected proxy password to be returned for editing, got %q", createdProxy.Password)
	}

	backendBody := fmt.Sprintf(`{
		"name":"proxied-backend",
		"base_url":"https://proxied.local/v1",
		"api_key":"backend-key",
		"proxy_id":%d,
		"weight":1,
		"models":["gpt-4o"],
		"endpoints":["chat"]
	}`, createdProxy.ID)
	backendReq := httptest.NewRequest(http.MethodPost, "/admin/api/backends", strings.NewReader(backendBody))
	backendReq.Header.Set("Authorization", "Bearer test-admin")
	backendRecorder := httptest.NewRecorder()

	application.Handler().ServeHTTP(backendRecorder, backendReq)

	if backendRecorder.Code != http.StatusCreated {
		t.Fatalf("expected backend create status 201, got %d body=%s", backendRecorder.Code, backendRecorder.Body.String())
	}
	var backend domain.Backend
	if err := json.Unmarshal(backendRecorder.Body.Bytes(), &backend); err != nil {
		t.Fatalf("unmarshal backend response: %v", err)
	}
	if backend.ProxyID != createdProxy.ID || backend.Proxy == nil || backend.Proxy.Name != "tokyo-socks" {
		t.Fatalf("expected backend to include bound socks proxy, got %#v", backend)
	}

	deleteReq := httptest.NewRequest(http.MethodDelete, "/admin/api/socks-proxies/"+strconv.FormatInt(createdProxy.ID, 10), nil)
	deleteReq.Header.Set("Authorization", "Bearer test-admin")
	deleteRecorder := httptest.NewRecorder()

	application.Handler().ServeHTTP(deleteRecorder, deleteReq)

	if deleteRecorder.Code != http.StatusOK {
		t.Fatalf("expected proxy delete status 200, got %d body=%s", deleteRecorder.Code, deleteRecorder.Body.String())
	}
	updatedBackend, err := application.store.GetBackend(context.Background(), backend.ID)
	if err != nil {
		t.Fatalf("get backend after proxy delete: %v", err)
	}
	if updatedBackend.ProxyID != 0 || updatedBackend.Proxy != nil {
		t.Fatalf("expected backend proxy binding to be cleared, got %#v", updatedBackend)
	}
}

func TestAdminSocksProxyListIncludesBindingAndUsageSummary(t *testing.T) {
	application := newTestApp(t)
	ctx := context.Background()

	proxy, err := application.store.CreateSocksProxy(ctx, domain.SocksProxy{
		Name:     "tokyo-socks",
		Address:  "127.0.0.1:1080",
		Username: "proxy-user",
		Password: "proxy-pass",
		Enabled:  true,
	})
	if err != nil {
		t.Fatalf("create socks proxy: %v", err)
	}

	createTestBackend(t, application, domain.Backend{
		Name:      "alpha",
		BaseURL:   "https://alpha.local/v1",
		APIKey:    "alpha-key",
		ProxyID:   proxy.ID,
		Weight:    1,
		Models:    []string{"gpt-4o"},
		Endpoints: []string{domain.EndpointChat},
	})

	if err := application.store.AppendUsageLog(ctx, domain.UsageLog{
		RequestID:     "proxy-list-1",
		ClientID:      1,
		ClientName:    "prod-web",
		Method:        http.MethodPost,
		Path:          "/v1/chat/completions",
		Endpoint:      domain.EndpointChat,
		Model:         "gpt-4o",
		ProxyID:       proxy.ID,
		ProxyName:     proxy.Name,
		BackendID:     7,
		BackendName:   "alpha",
		Attempts:      1,
		StatusCode:    http.StatusOK,
		DurationMS:    88,
		RequestBytes:  120,
		ResponseBytes: 640,
	}); err != nil {
		t.Fatalf("append usage log: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/admin/api/socks-proxies", nil)
	req.Header.Set("Authorization", "Bearer test-admin")
	recorder := httptest.NewRecorder()

	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected list status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	var payload struct {
		Items []struct {
			ID                int64     `json:"id"`
			BoundBackendCount int       `json:"bound_backend_count"`
			RequestCount      int       `json:"request_count"`
			TrafficBytes      int64     `json:"traffic_bytes"`
			AvgLatencyMS      float64   `json:"avg_latency_ms"`
			LastUsedAt        time.Time `json:"last_used_at"`
		} `json:"items"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal proxy list: %v", err)
	}
	if len(payload.Items) != 1 {
		t.Fatalf("expected one proxy item, got %#v", payload.Items)
	}
	item := payload.Items[0]
	if item.ID != proxy.ID {
		t.Fatalf("expected proxy id %d, got %#v", proxy.ID, item)
	}
	if item.BoundBackendCount != 1 || item.RequestCount != 1 {
		t.Fatalf("unexpected proxy counts: %#v", item)
	}
	if item.TrafficBytes != 760 {
		t.Fatalf("expected traffic_bytes=760, got %#v", item)
	}
	if item.AvgLatencyMS != 88 {
		t.Fatalf("expected avg_latency_ms=88, got %#v", item)
	}
	if item.LastUsedAt.IsZero() {
		t.Fatalf("expected last_used_at populated, got %#v", item)
	}
}

func TestPolicyListRouteRemoved(t *testing.T) {
	application := newTestApp(t)

	req := httptest.NewRequest(http.MethodGet, "/admin/api/model-policies", nil)
	req.Header.Set("Authorization", "Bearer test-admin")
	recorder := httptest.NewRecorder()

	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d body=%s", recorder.Code, recorder.Body.String())
	}
}

func TestAdminOverviewAndListsReturnEmptyArrays(t *testing.T) {
	application := newTestApp(t)

	cases := []struct {
		path string
	}{
		{path: "/admin/api/overview"},
		{path: "/admin/api/socks-proxies"},
		{path: "/admin/api/backends"},
		{path: "/admin/api/client-keys"},
		{path: "/admin/api/events"},
	}

	for _, tc := range cases {
		req := httptest.NewRequest(http.MethodGet, tc.path, nil)
		recorder := httptest.NewRecorder()

		application.Handler().ServeHTTP(recorder, req)

		if recorder.Code != http.StatusOK {
			t.Fatalf("%s expected status 200, got %d body=%s", tc.path, recorder.Code, recorder.Body.String())
		}

		var payload any
		if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
			t.Fatalf("%s unmarshal response: %v", tc.path, err)
		}

		switch value := payload.(type) {
		case map[string]any:
			if tc.path == "/admin/api/overview" {
				if _, ok := value["backends"].([]any); !ok {
					t.Fatalf("%s expected backends to be [] not %T", tc.path, value["backends"])
				}
				if _, ok := value["events"].([]any); !ok {
					t.Fatalf("%s expected events to be [] not %T", tc.path, value["events"])
				}
			} else {
				if _, ok := value["items"].([]any); !ok {
					t.Fatalf("%s expected items to be [] not %T", tc.path, value["items"])
				}
				if value["total"] != float64(0) {
					t.Fatalf("%s expected total=0, got %#v", tc.path, value["total"])
				}
				if value["page"] != float64(1) {
					t.Fatalf("%s expected page=1, got %#v", tc.path, value["page"])
				}
				if value["limit"] != float64(10) {
					t.Fatalf("%s expected limit=10, got %#v", tc.path, value["limit"])
				}
			}
		default:
			t.Fatalf("%s expected object response, got %T", tc.path, payload)
		}
	}
}

func TestAdminMutationEndpointsDoNotRequireAuthorization(t *testing.T) {
	application := newTestApp(t)

	createReq := httptest.NewRequest(http.MethodPost, "/admin/api/client-keys", strings.NewReader(`{
		"name":"open-admin",
		"enabled":true
	}`))
	createRecorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(createRecorder, createReq)

	if createRecorder.Code != http.StatusCreated {
		t.Fatalf("expected unauthenticated admin create to succeed, got %d body=%s", createRecorder.Code, createRecorder.Body.String())
	}

	var createPayload struct {
		Client domain.ClientKey `json:"client"`
	}
	if err := json.Unmarshal(createRecorder.Body.Bytes(), &createPayload); err != nil {
		t.Fatalf("unmarshal create payload: %v", err)
	}
	if createPayload.Client.ID == 0 {
		t.Fatalf("expected created client id, got %#v", createPayload.Client)
	}

	deleteReq := httptest.NewRequest(http.MethodDelete, "/admin/api/client-keys/"+strconv.FormatInt(createPayload.Client.ID, 10), nil)
	deleteRecorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(deleteRecorder, deleteReq)

	if deleteRecorder.Code != http.StatusOK {
		t.Fatalf("expected unauthenticated admin delete to succeed, got %d body=%s", deleteRecorder.Code, deleteRecorder.Body.String())
	}
}

func TestAdminDashboardApisReturnAggregatedData(t *testing.T) {
	application := newTestApp(t)
	client := createTestClient(t, application, "client-secret")
	backend := createTestBackend(t, application, domain.Backend{
		Name:      "alpha-backend",
		BaseURL:   "https://alpha.local/v1",
		APIKey:    "alpha-key",
		Weight:    1,
		Models:    []string{"gpt-4o"},
		Endpoints: []string{domain.EndpointChat},
	})

	fixture := newFailoverFixture(t, []domain.Backend{backend})
	application.proxy = proxy.NewWithHTTPClient(&http.Client{Transport: fixture})

	successReq := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(`{"model":"gpt-4o","messages":[{"role":"user","content":"hello"}]}`))
	successReq.Header.Set("Authorization", "Bearer "+client.Token)
	successRecorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(successRecorder, successReq)
	if successRecorder.Code != http.StatusOK {
		t.Fatalf("expected successful proxy request, got %d body=%s", successRecorder.Code, successRecorder.Body.String())
	}

	fixture.statusByName[backend.Name] = http.StatusInternalServerError
	failReq := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(`{"model":"gpt-4o","messages":[{"role":"user","content":"again"}]}`))
	failReq.Header.Set("Authorization", "Bearer "+client.Token)
	failRecorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(failRecorder, failReq)
	if failRecorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected failed proxy request, got %d body=%s", failRecorder.Code, failRecorder.Body.String())
	}

	updateReq := httptest.NewRequest(http.MethodPut, "/admin/api/backends/"+strconv.FormatInt(backend.ID, 10), strings.NewReader(`{
		"name":"alpha-backend",
		"protocol":"openai",
		"base_url":"https://alpha.local/v1",
		"api_key":"alpha-key",
		"proxy_id":0,
		"status":"normal",
		"weight":1,
		"models":["gpt-4o"],
		"model_mapping":{},
		"endpoints":["chat"]
	}`))
	updateReq.Header.Set("Authorization", "Bearer test-admin")
	updateRecorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(updateRecorder, updateReq)
	if updateRecorder.Code != http.StatusOK {
		t.Fatalf("expected backend update status 200, got %d body=%s", updateRecorder.Code, updateRecorder.Body.String())
	}
	configReq := httptest.NewRequest(http.MethodPut, "/admin/api/config", strings.NewReader(`{"focus_models":"gpt-4o"}`))
	configRecorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(configRecorder, configReq)
	if configRecorder.Code != http.StatusOK {
		t.Fatalf("expected config update status 200, got %d body=%s", configRecorder.Code, configRecorder.Body.String())
	}

	summaryReq := httptest.NewRequest(http.MethodGet, "/admin/api/dashboard/summary", nil)
	summaryReq.Header.Set("Authorization", "Bearer test-admin")
	summaryRecorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(summaryRecorder, summaryReq)
	if summaryRecorder.Code != http.StatusOK {
		t.Fatalf("expected summary status 200, got %d body=%s", summaryRecorder.Code, summaryRecorder.Body.String())
	}
	var summaryPayload struct {
		Cards map[string]struct {
			Count     int `json:"count"`
			Enabled   int `json:"enabled"`
			Successes int `json:"successes"`
			Failures  int `json:"failures"`
		} `json:"cards"`
	}
	if err := json.Unmarshal(summaryRecorder.Body.Bytes(), &summaryPayload); err != nil {
		t.Fatalf("unmarshal dashboard summary: %v", err)
	}
	if summaryPayload.Cards["backends"].Count != 1 {
		t.Fatalf("expected one backend card, got %#v", summaryPayload.Cards["backends"])
	}
	if summaryPayload.Cards["client_keys"].Count != 1 {
		t.Fatalf("expected one client key card, got %#v", summaryPayload.Cards["client_keys"])
	}
	if summaryPayload.Cards["backends"].Failures == 0 {
		t.Fatalf("expected backend failure count to be recorded, got %#v", summaryPayload.Cards["backends"])
	}

	usageReq := httptest.NewRequest(http.MethodGet, "/admin/api/dashboard/usage?range=7d", nil)
	usageReq.Header.Set("Authorization", "Bearer test-admin")
	usageRecorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(usageRecorder, usageReq)
	if usageRecorder.Code != http.StatusOK {
		t.Fatalf("expected usage status 200, got %d body=%s", usageRecorder.Code, usageRecorder.Body.String())
	}
	var usagePayload struct {
		Range  string `json:"range"`
		Series []struct {
			Label     string  `json:"label"`
			Requests  int     `json:"requests"`
			Successes int     `json:"successes"`
			Failures  int     `json:"failures"`
			LatencyMS int64   `json:"latency_ms"`
			ErrorRate float64 `json:"error_rate"`
		} `json:"series"`
	}
	if err := json.Unmarshal(usageRecorder.Body.Bytes(), &usagePayload); err != nil {
		t.Fatalf("unmarshal dashboard usage: %v", err)
	}
	if usagePayload.Range != "7d" {
		t.Fatalf("expected range 7d, got %q", usagePayload.Range)
	}
	if len(usagePayload.Series) == 0 {
		t.Fatalf("expected usage series data, got %#v", usagePayload)
	}
	if usagePayload.Series[len(usagePayload.Series)-1].Requests == 0 {
		t.Fatalf("expected non-zero usage series requests, got %#v", usagePayload.Series)
	}

	activityReq := httptest.NewRequest(http.MethodGet, "/admin/api/dashboard/activity", nil)
	activityReq.Header.Set("Authorization", "Bearer test-admin")
	activityRecorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(activityRecorder, activityReq)
	if activityRecorder.Code != http.StatusOK {
		t.Fatalf("expected activity status 200, got %d body=%s", activityRecorder.Code, activityRecorder.Body.String())
	}
	var activityPayload struct {
		Events []domain.AuditEvent `json:"events"`
		Logs   []domain.UsageLog   `json:"usage_logs"`
	}
	if err := json.Unmarshal(activityRecorder.Body.Bytes(), &activityPayload); err != nil {
		t.Fatalf("unmarshal dashboard activity: %v", err)
	}
	if len(activityPayload.Events) == 0 {
		t.Fatalf("expected recent events, got %#v", activityPayload)
	}
	if len(activityPayload.Logs) == 0 {
		t.Fatalf("expected recent usage logs, got %#v", activityPayload)
	}
}

func TestAdminSearchReturnsGroupedResults(t *testing.T) {
	application := newTestApp(t)
	client, err := application.store.CreateClientKey(context.Background(), domain.ClientKey{
		Name:        "alpha-client",
		TokenHash:   store.HashToken("alpha-client-token"),
		Token:       "alpha-client-token",
		TokenPrefix: tokenPrefix("alpha-client-token"),
		Enabled:     true,
	})
	if err != nil {
		t.Fatalf("create alpha client: %v", err)
	}
	backend := createTestBackend(t, application, domain.Backend{
		Name:      "alpha-backend",
		BaseURL:   "https://alpha.local/v1",
		APIKey:    "alpha-key",
		Weight:    1,
		Models:    []string{"gpt-alpha"},
		Endpoints: []string{domain.EndpointChat},
	})
	createTestBackend(t, application, domain.Backend{
		Name:      "beta-backend",
		BaseURL:   "https://beta.local/v1",
		APIKey:    "beta-key",
		Weight:    1,
		Models:    []string{"gpt-4o"},
		Endpoints: []string{domain.EndpointChat},
	})
	createTestClient(t, application, "beta-client-token")
	createdProxy := createTestProxy(t, application, domain.SocksProxy{
		Name:     "alpha-proxy",
		Address:  "127.0.0.1:1080",
		Username: "proxy-user",
		Password: "proxy-pass",
		Enabled:  true,
	})
	backend.ProxyID = createdProxy.ID
	backend, _ = application.store.UpdateBackend(context.Background(), backend)

	fixture := newFailoverFixture(t, []domain.Backend{backend})
	application.proxy = proxy.NewWithHTTPClient(&http.Client{Transport: fixture})
	req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(`{"model":"gpt-alpha","messages":[{"role":"user","content":"hello"}]}`))
	req.Header.Set("Authorization", "Bearer "+client.Token)
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected proxy request to succeed, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	updateReq := httptest.NewRequest(http.MethodPut, "/admin/api/backends/"+strconv.FormatInt(backend.ID, 10), strings.NewReader(`{
		"name":"alpha-backend",
		"protocol":"openai",
		"base_url":"https://alpha.local/v1",
		"api_key":"alpha-key",
		"proxy_id":`+strconv.FormatInt(createdProxy.ID, 10)+`,
		"status":"normal",
		"weight":1,
		"models":["gpt-alpha"],
		"model_mapping":{},
		"endpoints":["chat"]
	}`))
	updateReq.Header.Set("Authorization", "Bearer test-admin")
	updateRecorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(updateRecorder, updateReq)
	if updateRecorder.Code != http.StatusOK {
		t.Fatalf("expected backend update status 200, got %d body=%s", updateRecorder.Code, updateRecorder.Body.String())
	}
	if err := application.store.AppendAuditEvent(context.Background(), domain.AuditEvent{
		Type:         "admin_backend_create",
		Actor:        "admin",
		ResourceType: "backend",
		ResourceID:   backend.ID,
		Message:      "backend created: " + backend.Name,
		BackendName:  backend.Name,
	}); err != nil {
		t.Fatalf("append backend create audit event: %v", err)
	}

	searchReq := httptest.NewRequest(http.MethodGet, "/admin/api/search?q=alpha", nil)
	searchReq.Header.Set("Authorization", "Bearer test-admin")
	searchRecorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(searchRecorder, searchReq)
	if searchRecorder.Code != http.StatusOK {
		t.Fatalf("expected search status 200, got %d body=%s", searchRecorder.Code, searchRecorder.Body.String())
	}

	var searchPayload struct {
		Query   string `json:"query"`
		Results struct {
			Backends   []map[string]any `json:"backends"`
			ClientKeys []map[string]any `json:"client_keys"`
			Proxies    []map[string]any `json:"proxies"`
			Events     []map[string]any `json:"events"`
			UsageLogs  []map[string]any `json:"usage_logs"`
		} `json:"results"`
	}
	if err := json.Unmarshal(searchRecorder.Body.Bytes(), &searchPayload); err != nil {
		t.Fatalf("unmarshal search payload: %v", err)
	}
	if searchPayload.Query != "alpha" {
		t.Fatalf("expected query alpha, got %q", searchPayload.Query)
	}
	if len(searchPayload.Results.Backends) == 0 {
		t.Fatalf("expected backend search results, got %#v", searchPayload.Results)
	}
	if len(searchPayload.Results.ClientKeys) == 0 {
		t.Fatalf("expected client key search results, got %#v", searchPayload.Results)
	}
	if len(searchPayload.Results.Proxies) == 0 {
		t.Fatalf("expected proxy search results, got %#v", searchPayload.Results)
	}
	if len(searchPayload.Results.Events) == 0 {
		t.Fatalf("expected event search results, got %#v", searchPayload.Results)
	}
	if len(searchPayload.Results.UsageLogs) == 0 {
		t.Fatalf("expected usage log search results, got %#v", searchPayload.Results)
	}
}

func TestResourceDetailApisReturnDrawerPayload(t *testing.T) {
	application := newTestApp(t)
	client := createTestClient(t, application, "client-secret")
	proxyItem := createTestProxy(t, application, domain.SocksProxy{
		Name:     "tokyo-proxy",
		Address:  "127.0.0.1:1080",
		Username: "proxy-user",
		Password: "proxy-pass",
		Enabled:  true,
	})
	backend := createTestBackend(t, application, domain.Backend{
		Name:      "alpha-backend",
		BaseURL:   "https://alpha.local/v1",
		APIKey:    "alpha-key",
		ProxyID:   proxyItem.ID,
		Weight:    1,
		Models:    []string{"gpt-alpha"},
		Endpoints: []string{domain.EndpointChat},
	})
	fixture := newFailoverFixture(t, []domain.Backend{backend})
	application.proxy = proxy.NewWithHTTPClient(&http.Client{Transport: fixture})
	req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(`{"model":"gpt-alpha","messages":[{"role":"user","content":"hello"}]}`))
	req.Header.Set("Authorization", "Bearer "+client.Token)
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected proxy request to succeed, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	cases := []struct {
		name string
		path string
	}{
		{name: "backend", path: "/admin/api/backends/" + strconv.FormatInt(backend.ID, 10) + "/detail"},
		{name: "client", path: "/admin/api/client-keys/" + strconv.FormatInt(client.ID, 10) + "/detail"},
		{name: "proxy", path: "/admin/api/socks-proxies/" + strconv.FormatInt(proxyItem.ID, 10) + "/detail"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, tc.path, nil)
			req.Header.Set("Authorization", "Bearer test-admin")
			recorder := httptest.NewRecorder()
			application.Handler().ServeHTTP(recorder, req)
			if recorder.Code != http.StatusOK {
				t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
			}

			var payload struct {
				Overview      []map[string]any `json:"overview"`
				Configuration []map[string]any `json:"configuration"`
				Metadata      []map[string]any `json:"metadata"`
				Raw           map[string]any   `json:"raw"`
				Activity      struct {
					Events    []map[string]any `json:"events"`
					UsageLogs []map[string]any `json:"usage_logs"`
				} `json:"activity"`
			}
			if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
				t.Fatalf("unmarshal detail payload: %v", err)
			}
			if len(payload.Overview) == 0 || len(payload.Configuration) == 0 || len(payload.Metadata) == 0 {
				t.Fatalf("expected populated detail sections, got %#v", payload)
			}
			if len(payload.Raw) == 0 {
				t.Fatalf("expected raw payload, got %#v", payload)
			}
			if len(payload.Activity.Events) == 0 && len(payload.Activity.UsageLogs) == 0 {
				t.Fatalf("expected related activity entries, got %#v", payload.Activity)
			}
		})
	}
}

func createTestProxy(t *testing.T, application *App, proxy domain.SocksProxy) domain.SocksProxy {
	t.Helper()

	created, err := application.store.CreateSocksProxy(context.Background(), proxy)
	if err != nil {
		t.Fatalf("create proxy %q: %v", proxy.Name, err)
	}
	return created
}

func TestAdminListPagination(t *testing.T) {
	application := newTestApp(t)

	for i := 0; i < 12; i++ {
		createTestClient(t, application, fmt.Sprintf("client-token-%02d", i))
	}

	req := httptest.NewRequest(http.MethodGet, "/admin/api/client-keys?page=2&limit=10", nil)
	req.Header.Set("Authorization", "Bearer test-admin")
	recorder := httptest.NewRecorder()

	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	var payload struct {
		Items []domain.ClientKey `json:"items"`
		Total int                `json:"total"`
		Page  int                `json:"page"`
		Limit int                `json:"limit"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal paged response: %v", err)
	}
	if payload.Total != 12 {
		t.Fatalf("expected total 12, got %d", payload.Total)
	}
	if payload.Page != 2 {
		t.Fatalf("expected page 2, got %d", payload.Page)
	}
	if payload.Limit != 10 {
		t.Fatalf("expected limit 10, got %d", payload.Limit)
	}
	if len(payload.Items) != 2 {
		t.Fatalf("expected 2 items on page 2, got %d", len(payload.Items))
	}
}

func TestBackendListIncludesRecentRequestStats(t *testing.T) {
	application := newTestApp(t)
	client := createTestClient(t, application, "client-secret")
	backend := createTestBackend(t, application, domain.Backend{
		Name:      "alpha",
		BaseURL:   "https://alpha.local/v1",
		APIKey:    "alpha-key",
		Weight:    1,
		Models:    []string{"gpt-4o"},
		Endpoints: []string{domain.EndpointChat},
	})

	fixture := newFailoverFixture(t, []domain.Backend{backend})
	application.proxy = proxy.NewWithHTTPClient(&http.Client{Transport: fixture})

	successReq := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(`{"model":"gpt-4o","messages":[{"role":"user","content":"hello"}]}`))
	successReq.Header.Set("Authorization", "Bearer "+client.Token)
	successRecorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(successRecorder, successReq)
	if successRecorder.Code != http.StatusOK {
		t.Fatalf("expected successful proxy request, got %d body=%s", successRecorder.Code, successRecorder.Body.String())
	}

	fixture.statusByName[backend.Name] = http.StatusInternalServerError
	failReq := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(`{"model":"gpt-4o","messages":[{"role":"user","content":"again"}]}`))
	failReq.Header.Set("Authorization", "Bearer "+client.Token)
	failRecorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(failRecorder, failReq)
	if failRecorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected failed proxy request, got %d body=%s", failRecorder.Code, failRecorder.Body.String())
	}

	listReq := httptest.NewRequest(http.MethodGet, "/admin/api/backends", nil)
	listReq.Header.Set("Authorization", "Bearer test-admin")
	listRecorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(listRecorder, listReq)
	if listRecorder.Code != http.StatusOK {
		t.Fatalf("expected backend list status 200, got %d body=%s", listRecorder.Code, listRecorder.Body.String())
	}

	var payload struct {
		Items []struct {
			ID           int64      `json:"id"`
			RequestCount int        `json:"request_count"`
			AvgLatencyMS float64    `json:"avg_latency_ms"`
			LastUsedAt   *time.Time `json:"last_used_at"`
			ModelCount   int        `json:"model_count"`
			RecentStats  struct {
				WindowMinutes int `json:"window_minutes"`
				Successes     int `json:"successes"`
				Failures      int `json:"failures"`
			} `json:"recent_stats"`
		} `json:"items"`
	}
	if err := json.Unmarshal(listRecorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal backend list: %v", err)
	}
	var rawPayload struct {
		Items []map[string]any `json:"items"`
	}
	if err := json.Unmarshal(listRecorder.Body.Bytes(), &rawPayload); err != nil {
		t.Fatalf("unmarshal raw backend list: %v", err)
	}
	if len(payload.Items) != 1 {
		t.Fatalf("expected one backend item, got %d", len(payload.Items))
	}
	if len(rawPayload.Items) != 1 {
		t.Fatalf("expected one raw backend item, got %d", len(rawPayload.Items))
	}
	if payload.Items[0].ID != backend.ID {
		t.Fatalf("unexpected backend item: %#v", payload.Items[0])
	}
	if payload.Items[0].RequestCount != 2 {
		t.Fatalf("expected request_count 2, got %d", payload.Items[0].RequestCount)
	}
	if payload.Items[0].AvgLatencyMS < 0 {
		t.Fatalf("expected avg_latency_ms >= 0, got %f", payload.Items[0].AvgLatencyMS)
	}
	if payload.Items[0].LastUsedAt == nil || payload.Items[0].LastUsedAt.IsZero() {
		t.Fatalf("expected last_used_at to be populated, got %#v", payload.Items[0].LastUsedAt)
	}
	if payload.Items[0].ModelCount != 1 {
		t.Fatalf("unexpected model count: %d", payload.Items[0].ModelCount)
	}
	if _, ok := rawPayload.Items[0]["endpoint_count"]; ok {
		t.Fatalf("backend list should not include endpoint_count: %#v", rawPayload.Items[0])
	}
	if _, ok := rawPayload.Items[0]["endpoints"]; ok {
		t.Fatalf("backend list should not include endpoints: %#v", rawPayload.Items[0])
	}
	if payload.Items[0].RecentStats.WindowMinutes != 30 || payload.Items[0].RecentStats.Successes != 1 || payload.Items[0].RecentStats.Failures != 1 {
		t.Fatalf("unexpected recent stats: %#v", payload.Items[0].RecentStats)
	}
}

func TestBackendListTreatsUpstreamBadRequestAsFailedAttempt(t *testing.T) {
	application := newTestApp(t)
	client := createTestClient(t, application, "client-secret")
	backend := createTestBackend(t, application, domain.Backend{
		Name:      "alpha",
		BaseURL:   "https://alpha.local/v1",
		APIKey:    "alpha-key",
		Status:    domain.BackendStatusNormal,
		Weight:    1,
		Models:    []string{"gpt-4o"},
		Endpoints: []string{domain.EndpointChat},
	})

	fixture := newFailoverFixture(t, []domain.Backend{backend})
	fixture.statusByName[backend.Name] = http.StatusBadRequest
	application.proxy = proxy.NewWithHTTPClient(&http.Client{Transport: fixture})

	req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(`{"model":"gpt-4o","messages":[{"role":"user","content":"bad"}]}`))
	req.Header.Set("Authorization", "Bearer "+client.Token)
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)
	if recorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected proxy response 503, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	listReq := httptest.NewRequest(http.MethodGet, "/admin/api/backends", nil)
	listReq.Header.Set("Authorization", "Bearer test-admin")
	listRecorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(listRecorder, listReq)
	if listRecorder.Code != http.StatusOK {
		t.Fatalf("expected backend list status 200, got %d body=%s", listRecorder.Code, listRecorder.Body.String())
	}

	var payload struct {
		Items []struct {
			ID          int64 `json:"id"`
			RecentStats struct {
				WindowMinutes int `json:"window_minutes"`
				Successes     int `json:"successes"`
				Failures      int `json:"failures"`
			} `json:"recent_stats"`
		} `json:"items"`
	}
	if err := json.Unmarshal(listRecorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal backend list: %v", err)
	}
	if len(payload.Items) != 1 {
		t.Fatalf("expected one backend item, got %d", len(payload.Items))
	}
	if payload.Items[0].RecentStats.Failures != 1 {
		t.Fatalf("expected failed attempt to count as backend failure, got %#v", payload.Items[0].RecentStats)
	}
}

func TestBackendListIncludesUsageAndRelationshipSummaries(t *testing.T) {
	application := newTestApp(t)
	ctx := context.Background()

	proxyItem, err := application.store.CreateSocksProxy(ctx, domain.SocksProxy{
		Name:    "summary-proxy",
		Address: "127.0.0.1:1080",
		Enabled: true,
	})
	if err != nil {
		t.Fatalf("create proxy: %v", err)
	}

	backend := createTestBackend(t, application, domain.Backend{
		Name:      "alpha",
		BaseURL:   "https://alpha.local/v1",
		APIKey:    "alpha-key",
		ProxyID:   proxyItem.ID,
		Weight:    2,
		Models:    []string{"gpt-4o", "gpt-4.1"},
		Endpoints: []string{domain.EndpointChat, domain.EndpointResponses},
	})

	for i, duration := range []int64{45, 75} {
		if err := application.store.AppendUsageLog(ctx, domain.UsageLog{
			RequestID:         fmt.Sprintf("backend-summary-%d", i+1),
			ClientID:          1,
			ClientName:        "summary-client",
			ClientTokenPrefix: "summ",
			Method:            http.MethodPost,
			Path:              "/v1/chat/completions",
			Endpoint:          domain.EndpointChat,
			Model:             "gpt-4o",
			BackendID:         backend.ID,
			BackendName:       backend.Name,
			ProxyID:           proxyItem.ID,
			ProxyName:         proxyItem.Name,
			Attempts:          1,
			StatusCode:        http.StatusOK,
			DurationMS:        duration,
		}); err != nil {
			t.Fatalf("append usage log %d: %v", i+1, err)
		}
	}

	req := httptest.NewRequest(http.MethodGet, "/admin/api/backends", nil)
	req.Header.Set("Authorization", "Bearer test-admin")
	recorder := httptest.NewRecorder()

	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected backend list status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	var payload struct {
		Items []struct {
			ID           int64     `json:"id"`
			APIKey       string    `json:"api_key"`
			RequestCount int       `json:"request_count"`
			AvgLatencyMS float64   `json:"avg_latency_ms"`
			LastUsedAt   time.Time `json:"last_used_at"`
			ModelCount   int       `json:"model_count"`
			Proxy        *struct {
				Name string `json:"name"`
			} `json:"proxy"`
		} `json:"items"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal backend list: %v", err)
	}
	var rawPayload struct {
		Items []map[string]any `json:"items"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &rawPayload); err != nil {
		t.Fatalf("unmarshal raw backend list: %v", err)
	}
	if len(payload.Items) != 1 {
		t.Fatalf("expected one backend item, got %#v", payload.Items)
	}
	if len(rawPayload.Items) != 1 {
		t.Fatalf("expected one raw backend item, got %#v", rawPayload.Items)
	}
	item := payload.Items[0]
	if item.ID != backend.ID {
		t.Fatalf("unexpected backend item: %#v", item)
	}
	if item.APIKey != backend.APIKey {
		t.Fatalf("expected backend list to keep raw api key available, got %#v", item)
	}
	if item.RequestCount != 2 || item.AvgLatencyMS != 60 {
		t.Fatalf("unexpected usage summary: %#v", item)
	}
	if item.LastUsedAt.IsZero() {
		t.Fatalf("expected last_used_at populated, got %#v", item)
	}
	if item.ModelCount != 2 {
		t.Fatalf("unexpected relationship counts: %#v", item)
	}
	if _, ok := rawPayload.Items[0]["endpoint_count"]; ok {
		t.Fatalf("backend list should not include endpoint_count: %#v", rawPayload.Items[0])
	}
	if _, ok := rawPayload.Items[0]["endpoints"]; ok {
		t.Fatalf("backend list should not include endpoints: %#v", rawPayload.Items[0])
	}
	if item.Proxy == nil || item.Proxy.Name != proxyItem.Name {
		t.Fatalf("expected proxy relationship in payload, got %#v", item.Proxy)
	}
}

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
		"console_user_id":"1929",
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
	createdAccount := decodeJSONPayload(t, created.ConsoleAccountJSON)
	if createdAccount["id"] != "1929" {
		t.Fatalf("expected created backend account id from console_user_id, got %#v", createdAccount)
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
		"console_user_id":"2048",
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
	updated, err := application.store.GetBackend(context.Background(), created.ID)
	if err != nil {
		t.Fatalf("get updated backend: %v", err)
	}
	updatedAccount := decodeJSONPayload(t, updated.ConsoleAccountJSON)
	if updatedAccount["id"] != "2048" {
		t.Fatalf("expected updated backend account id from console_user_id, got %#v", updatedAccount)
	}
}

func TestAdminBackendCreateUpdateAndListIncludeSub2APIConsoleMetadata(t *testing.T) {
	application := newTestApp(t)

	createReq := httptest.NewRequest(http.MethodPost, "/admin/api/backends", strings.NewReader(`{
		"name":"relay-sub2api",
		"backend_type":"sub2api",
		"base_url":"https://relay-sub2api.local/v1",
		"api_key":"relay-key",
		"console_url":"https://console.relay-sub2api.local",
		"console_authorization":"Bearer create-sub2api-token",
		"console_checkin_path":"/api/v1/checkin",
		"channel_url":"/api/v1/channels",
		"weight":1,
		"models":["gpt-4o"]
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
	if created.BackendType != domain.BackendTypeSub2API {
		t.Fatalf("expected created backend type sub2api, got %#v", created)
	}
	if created.ConsoleAuthorization != "Bearer create-sub2api-token" {
		t.Fatalf("expected created console authorization, got %#v", created)
	}
	if created.ConsoleCheckinPath != "/api/v1/checkin" {
		t.Fatalf("expected created console checkin path, got %#v", created)
	}
	if created.ChannelURL != "/api/v1/channels" {
		t.Fatalf("expected created channel url, got %#v", created)
	}

	updateReq := httptest.NewRequest(http.MethodPut, "/admin/api/backends/"+strconv.FormatInt(created.ID, 10), strings.NewReader(`{
		"name":"relay-sub2api",
		"protocol":"openai",
		"backend_type":"sub2api",
		"base_url":"https://relay-sub2api.local/v1",
		"api_key":"relay-key",
		"console_url":"https://console.relay-sub2api-2.local",
		"console_authorization":"Bearer update-sub2api-token",
		"console_checkin_path":"/api/v1/daily-checkin",
		"channel_url":"/api/v1/catalog",
		"proxy_id":0,
		"status":"normal",
		"weight":1,
		"models":["gpt-4o"],
		"model_mapping":{}
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
			ID                   int64  `json:"id"`
			BackendType          string `json:"backend_type"`
			ConsoleURL           string `json:"console_url"`
			ConsoleAuthorization string `json:"console_authorization"`
			ConsoleCheckinPath   string `json:"console_checkin_path"`
			ChannelURL           string `json:"channel_url"`
		} `json:"items"`
	}
	if err := json.Unmarshal(listRecorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal backend list: %v", err)
	}
	if len(payload.Items) != 1 {
		t.Fatalf("expected one backend item, got %#v", payload.Items)
	}
	item := payload.Items[0]
	if item.ID != created.ID || item.BackendType != domain.BackendTypeSub2API {
		t.Fatalf("expected sub2api backend in list payload, got %#v", item)
	}
	if item.ConsoleURL != "https://console.relay-sub2api-2.local" || item.ConsoleAuthorization != "Bearer update-sub2api-token" || item.ConsoleCheckinPath != "/api/v1/daily-checkin" || item.ChannelURL != "/api/v1/catalog" {
		t.Fatalf("expected updated sub2api console metadata in list payload, got %#v", item)
	}

	updated, err := application.store.GetBackend(context.Background(), created.ID)
	if err != nil {
		t.Fatalf("get updated backend: %v", err)
	}
	if updated.BackendType != domain.BackendTypeSub2API || updated.ConsoleAuthorization != "Bearer update-sub2api-token" || updated.ConsoleCheckinPath != "/api/v1/daily-checkin" || updated.ChannelURL != "/api/v1/catalog" {
		t.Fatalf("expected stored sub2api console metadata, got %#v", updated)
	}
}

func TestAdminBackendSub2APIConsoleSyncCheckinAndAccountSummary(t *testing.T) {
	application := newTestApp(t)

	var calls []string
	application.backendHandler.SetConsoleHTTPClient(&http.Client{Transport: consoleRoundTripFunc(func(r *http.Request) (*http.Response, error) {
		calls = append(calls, r.Method+" "+r.URL.Path)
		if got := r.Header.Get("Authorization"); got != "Bearer sub2api-token" {
			t.Fatalf("expected authorization header, got %q", got)
		}

		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Fatalf("read request body: %v", err)
		}

		switch r.URL.Path {
		case "/api/v1/checkin":
			if r.Method != http.MethodPost {
				t.Fatalf("expected POST checkin, got %s", r.Method)
			}
			if strings.TrimSpace(string(body)) != "{}" {
				t.Fatalf("expected checkin body {}, got %q", string(body))
			}
			return consoleJSONResponse(http.StatusOK, nil, `{"code":0,"message":"checked in","data":{"ok":true}}`), nil
		case "/api/v1/auth/me":
			if r.Method != http.MethodGet {
				t.Fatalf("expected GET auth/me, got %s", r.Method)
			}
			if strings.TrimSpace(string(body)) != "" {
				t.Fatalf("expected empty auth/me body, got %q", string(body))
			}
			return consoleJSONResponse(http.StatusOK, nil, `{"code":0,"message":"success","data":{"id":13870,"email":"linuxdo-420226@linuxdo-connect.invalid","username":"leon7","balance":2681.86526074}}`), nil
		case "/api/v1/channels":
			if r.Method != http.MethodGet {
				t.Fatalf("expected GET channels, got %s", r.Method)
			}
			if strings.TrimSpace(string(body)) != "" {
				t.Fatalf("expected empty channels body, got %q", string(body))
			}
			return consoleJSONResponse(http.StatusOK, nil, `{"code":0,"message":"success","data":[{"name":"GPT","platforms":[{"platform":"openai","groups":[{"id":2,"name":"GPT-Plus","rate_multiplier":0.07},{"id":8,"name":"GPT-Pro","rate_multiplier":0.19}],"supported_models":[{"name":"gpt-5.4","platform":"openai","pricing":{"billing_mode":"token","input_price":0.0000025,"output_price":0.000015}}]}]},{"name":"Claude","platforms":[{"platform":"anthropic","groups":[{"id":1,"name":"CC-MAX","rate_multiplier":1.1},{"id":16,"name":"Claude-逆向高缓存","rate_multiplier":0.2}],"supported_models":[{"name":"claude-sonnet-5","platform":"anthropic","pricing":{"billing_mode":"token","input_price":0.000002,"output_price":0.00001}}]}]}]}`), nil
		default:
			t.Fatalf("unexpected console path %s", r.URL.Path)
		}
		return nil, errors.New("unreachable console path")
	})})

	backend := createTestBackend(t, application, domain.Backend{
		Name:                 "sub2api-sync",
		Protocol:             domain.BackendProtocolOpenAI,
		BackendType:          domain.BackendTypeSub2API,
		BaseURL:              "https://sub2api.local/v1",
		APIKey:               "backend-key",
		ConsoleURL:           "https://console.local",
		ConsoleAuthorization: "Bearer sub2api-token",
		ConsoleCheckinPath:   "/api/v1/checkin",
		ChannelURL:           "/api/v1/channels",
		Models:               []string{"routed-model"},
		Endpoints:            []string{domain.EndpointChat},
	})

	req := httptest.NewRequest(http.MethodPost, "/admin/api/backends/"+strconv.FormatInt(backend.ID, 10)+"/console/sync", nil)
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected sync status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	if !reflect.DeepEqual(calls, []string{"POST /api/v1/checkin", "GET /api/v1/auth/me", "GET /api/v1/channels"}) {
		t.Fatalf("unexpected console call sequence: %#v", calls)
	}

	updated, err := application.store.GetBackend(context.Background(), backend.ID)
	if err != nil {
		t.Fatalf("get updated backend: %v", err)
	}
	account := decodeJSONPayload(t, updated.ConsoleAccountJSON)
	if account["id"] != float64(13870) || account["username"] != "leon7" || account["email"] != "linuxdo-420226@linuxdo-connect.invalid" || account["balance"] != 2681.86526074 {
		t.Fatalf("expected saved sub2api account summary, got %#v", account)
	}
	if lastCheckinAt, ok := account["last_checkin_at"].(string); !ok || strings.TrimSpace(lastCheckinAt) == "" {
		t.Fatalf("expected successful checkin timestamp, got %#v", account)
	}
	pricing := decodeJSONPayload(t, updated.ConsolePricingJSON)
	data, ok := pricing["data"].([]any)
	if !ok || len(data) != 2 {
		t.Fatalf("expected saved channel pricing payload, got %#v", pricing)
	}

	var response struct {
		Checkin  map[string]any `json:"checkin"`
		Account  map[string]any `json:"account"`
		Pricing  map[string]any `json:"pricing"`
		Requests []struct {
			Method string `json:"method"`
			Path   string `json:"path"`
		} `json:"requests"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("unmarshal sync response: %v", err)
	}
	if response.Account["username"] != "leon7" || response.Checkin["code"] != float64(0) {
		t.Fatalf("expected sync response account/checkin payloads, got %#v", response)
	}
	if response.Pricing["code"] != float64(0) {
		t.Fatalf("expected sync response pricing payload, got %#v", response)
	}
	if len(response.Requests) != 3 {
		t.Fatalf("expected sync request logs, got %#v", response.Requests)
	}

	events, err := application.store.ListAuditEvents(context.Background(), 10)
	if err != nil {
		t.Fatalf("list audit events: %v", err)
	}
	if len(events) != 1 || events[0].Type != "admin_backend_sync" || events[0].ResourceID != backend.ID || events[0].BackendName != backend.Name {
		t.Fatalf("expected one single-backend sync audit event, got %#v", events)
	}

	batchReq := httptest.NewRequest(http.MethodPost, "/admin/api/backends/"+strconv.FormatInt(backend.ID, 10)+"/console/sync?audit=0", nil)
	batchRecorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(batchRecorder, batchReq)
	if batchRecorder.Code != http.StatusOK {
		t.Fatalf("expected batch member sync status 200, got %d body=%s", batchRecorder.Code, batchRecorder.Body.String())
	}
	events, err = application.store.ListAuditEvents(context.Background(), 10)
	if err != nil {
		t.Fatalf("list audit events after batch member sync: %v", err)
	}
	if len(events) != 1 {
		t.Fatalf("batch member sync should suppress the single-backend audit event, got %#v", events)
	}
}

func TestAdminBackendNewAPIConsoleCheckinUsesConfiguredProxy(t *testing.T) {
	application := newTestApp(t)
	t.Setenv("HTTP_PROXY", "")
	t.Setenv("HTTPS_PROXY", "")
	t.Setenv("NO_PROXY", "")
	t.Setenv("http_proxy", "")
	t.Setenv("https_proxy", "")
	t.Setenv("no_proxy", "")

	createdProxy := createTestProxy(t, application, domain.SocksProxy{
		Name:    "broken-console-proxy",
		Address: "127.0.0.1:1",
		Enabled: true,
	})

	backend := createTestBackend(t, application, domain.Backend{
		Name:               "new-api-checkin-proxy",
		Protocol:           domain.BackendProtocolOpenAI,
		BackendType:        domain.BackendTypeNewAPI,
		BaseURL:            "https://new-api.local/v1",
		APIKey:             "backend-key",
		ConsoleURL:         "http://console-target.invalid",
		ConsoleCookie:      "session=valid",
		ConsoleAccountJSON: `{"id":1929}`,
		ProxyID:            createdProxy.ID,
		Models:             []string{"routed-model"},
		Endpoints:          []string{domain.EndpointChat},
	})

	req := httptest.NewRequest(http.MethodPost, "/admin/api/backends/"+strconv.FormatInt(backend.ID, 10)+"/console/checkin", nil)
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)
	if recorder.Code != http.StatusBadGateway {
		t.Fatalf("expected proxy dial failure status 502, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), "127.0.0.1:1") {
		t.Fatalf("expected error to mention configured proxy address, got body=%s", recorder.Body.String())
	}
}

func TestAdminBackendSub2APIConsoleSyncUsesConfiguredProxy(t *testing.T) {
	application := newTestApp(t)
	t.Setenv("HTTP_PROXY", "")
	t.Setenv("HTTPS_PROXY", "")
	t.Setenv("NO_PROXY", "")
	t.Setenv("http_proxy", "")
	t.Setenv("https_proxy", "")
	t.Setenv("no_proxy", "")

	createdProxy := createTestProxy(t, application, domain.SocksProxy{
		Name:    "broken-sub2api-console-proxy",
		Address: "127.0.0.1:1",
		Enabled: true,
	})

	backend := createTestBackend(t, application, domain.Backend{
		Name:                 "sub2api-sync-proxy",
		Protocol:             domain.BackendProtocolOpenAI,
		BackendType:          domain.BackendTypeSub2API,
		BaseURL:              "https://sub2api.local/v1",
		APIKey:               "backend-key",
		ConsoleURL:           "http://console-target.invalid",
		ConsoleAuthorization: "Bearer sub2api-token",
		ConsoleCheckinPath:   "/api/v1/checkin",
		ProxyID:              createdProxy.ID,
		Models:               []string{"routed-model"},
		Endpoints:            []string{domain.EndpointChat},
	})

	req := httptest.NewRequest(http.MethodPost, "/admin/api/backends/"+strconv.FormatInt(backend.ID, 10)+"/console/sync", nil)
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)
	if recorder.Code != http.StatusBadGateway {
		t.Fatalf("expected proxy dial failure status 502, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), "127.0.0.1:1") {
		t.Fatalf("expected error to mention configured proxy address, got body=%s", recorder.Body.String())
	}
}

func TestAdminBackendNewAPIConsoleCheckinUsesConfiguredCookieAndStoredUserIDDirectly(t *testing.T) {
	application := newTestApp(t)

	var calls []string
	application.backendHandler.SetConsoleHTTPClient(&http.Client{Transport: consoleRoundTripFunc(func(r *http.Request) (*http.Response, error) {
		calls = append(calls, r.Method+" "+r.URL.Path)
		if r.Header.Get("Cookie") != "session=valid" {
			t.Fatalf("expected saved cookie, got %q", r.Header.Get("Cookie"))
		}
		switch r.URL.Path {
		case "/api/user/checkin":
			if r.Method != http.MethodPost {
				t.Fatalf("expected POST checkin, got %s", r.Method)
			}
			if r.Header.Get("new-user-id") != "1929" {
				t.Fatalf("expected new-user-id header 1929, got %q", r.Header.Get("new-user-id"))
			}
			return consoleJSONResponse(http.StatusOK, nil, `{"success":true,"message":"ok"}`), nil
		case "/api/user/self":
			if len(calls) == 1 {
				t.Fatalf("self should not be called before direct checkin when cookie and stored user id are configured")
			}
			if r.Method != http.MethodGet {
				t.Fatalf("expected GET self, got %s", r.Method)
			}
			if r.Header.Get("new-user-id") != "1929" {
				t.Fatalf("expected new-user-id header 1929 on refresh self, got %q", r.Header.Get("new-user-id"))
			}
			return consoleJSONResponse(http.StatusOK, nil, `{"success":true,"data":{"username":"tom","display_name":"Tom Admin","group":"default","role":1,"status":1,"id":1929,"quota":248540,"used_quota":3250000}}`), nil
		case "/api/user/login":
			t.Fatalf("login should not be called when cookie and stored user id are configured")
		default:
			t.Fatalf("unexpected console path %s", r.URL.Path)
		}
		return nil, errors.New("unreachable console path")
	})})

	backend := createTestBackend(t, application, domain.Backend{
		Name:               "new-api-console-direct-checkin",
		Protocol:           domain.BackendProtocolOpenAI,
		BackendType:        domain.BackendTypeNewAPI,
		BaseURL:            "https://new-api.local/v1",
		APIKey:             "backend-key",
		ConsoleURL:         "https://console.local",
		ConsoleUsername:    "tom",
		ConsolePassword:    "tom_passwd",
		ConsoleCookie:      "session=valid",
		ConsoleAccountJSON: `{"id":"1929","username":"cached"}`,
		Models:             []string{"gpt-4o"},
		Endpoints:          []string{domain.EndpointChat},
	})

	req := httptest.NewRequest(http.MethodPost, "/admin/api/backends/"+strconv.FormatInt(backend.ID, 10)+"/console/checkin", nil)
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected checkin status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	if !reflect.DeepEqual(calls, []string{"POST /api/user/checkin", "GET /api/user/self"}) {
		t.Fatalf("unexpected console call sequence: %#v", calls)
	}
}

func TestAdminBackendNewAPIConsoleCheckinWithConfiguredCookieAndUserIDDoesNotRetryFailure(t *testing.T) {
	application := newTestApp(t)

	var calls []string
	application.backendHandler.SetConsoleHTTPClient(&http.Client{Transport: consoleRoundTripFunc(func(r *http.Request) (*http.Response, error) {
		calls = append(calls, r.Method+" "+r.URL.Path)
		switch r.URL.Path {
		case "/api/user/checkin":
			if r.Header.Get("Cookie") != "session=expired" {
				t.Fatalf("expected saved cookie, got %q", r.Header.Get("Cookie"))
			}
			if r.Header.Get("new-user-id") != "1929" {
				t.Fatalf("expected new-user-id header 1929, got %q", r.Header.Get("new-user-id"))
			}
			return consoleJSONResponse(http.StatusUnauthorized, nil, `{"success":false,"message":"未登录"}`), nil
		case "/api/user/self", "/api/user/login":
			t.Fatalf("checkin failure should not trigger %s", r.URL.Path)
		default:
			t.Fatalf("unexpected console path %s", r.URL.Path)
		}
		return nil, errors.New("unreachable console path")
	})})

	backend := createTestBackend(t, application, domain.Backend{
		Name:               "new-api-console-direct-checkin-failure",
		Protocol:           domain.BackendProtocolOpenAI,
		BackendType:        domain.BackendTypeNewAPI,
		BaseURL:            "https://new-api.local/v1",
		APIKey:             "backend-key",
		ConsoleURL:         "https://console.local",
		ConsoleUsername:    "tom",
		ConsolePassword:    "tom_passwd",
		ConsoleCookie:      "session=expired",
		ConsoleAccountJSON: `{"id":"1929","username":"cached"}`,
		Models:             []string{"gpt-4o"},
		Endpoints:          []string{domain.EndpointChat},
	})

	req := httptest.NewRequest(http.MethodPost, "/admin/api/backends/"+strconv.FormatInt(backend.ID, 10)+"/console/checkin", nil)
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)
	if recorder.Code != http.StatusBadGateway {
		t.Fatalf("expected checkin failure status 502, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	if !reflect.DeepEqual(calls, []string{"POST /api/user/checkin"}) {
		t.Fatalf("unexpected console call sequence: %#v", calls)
	}
}

func TestAdminBackendNewAPIConsoleCheckinUsesSavedCookieAndRefreshesBalance(t *testing.T) {
	application := newTestApp(t)

	var calls []string
	application.backendHandler.SetConsoleHTTPClient(&http.Client{Transport: consoleRoundTripFunc(func(r *http.Request) (*http.Response, error) {
		calls = append(calls, r.Method+" "+r.URL.Path)
		if r.Header.Get("Cookie") != "session=valid" {
			t.Fatalf("expected saved cookie, got %q", r.Header.Get("Cookie"))
		}
		switch r.URL.Path {
		case "/api/user/checkin":
			if r.Method != http.MethodPost {
				t.Fatalf("expected POST checkin, got %s", r.Method)
			}
			if r.Header.Get("New-Api-User") != "1929" {
				t.Fatalf("expected New-Api-User header 1929, got %q", r.Header.Get("New-Api-User"))
			}
			return consoleJSONResponse(http.StatusOK, nil, `{"success":true,"message":"ok"}`), nil
		case "/api/user/self":
			if r.Method != http.MethodGet {
				t.Fatalf("expected GET self, got %s", r.Method)
			}
			return consoleJSONResponse(http.StatusOK, nil, `{"success":true,"data":{"username":"tom","display_name":"Tom Admin","group":"default","role":1,"status":1,"id":1929,"quota":248540,"used_quota":3250000,"email":"hidden@example.com"}}`), nil
		default:
			t.Fatalf("unexpected console path %s", r.URL.Path)
		}
		return nil, errors.New("unreachable console path")
	})})

	backend := createTestBackend(t, application, domain.Backend{
		Name:            "new-api-console",
		Protocol:        domain.BackendProtocolOpenAI,
		BackendType:     domain.BackendTypeNewAPI,
		BaseURL:         "https://new-api.local/v1",
		APIKey:          "backend-key",
		ConsoleURL:      "https://console.local",
		ConsoleUsername: "tom",
		ConsolePassword: "tom_passwd",
		ConsoleCookie:   "session=valid",
		Models:          []string{"gpt-4o"},
		Endpoints:       []string{domain.EndpointChat},
	})

	req := httptest.NewRequest(http.MethodPost, "/admin/api/backends/"+strconv.FormatInt(backend.ID, 10)+"/console/checkin", nil)
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected checkin status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	updated, err := application.store.GetBackend(context.Background(), backend.ID)
	if err != nil {
		t.Fatalf("get updated backend: %v", err)
	}
	account := decodeJSONPayload(t, updated.ConsoleAccountJSON)
	if account["username"] != "tom" || account["id"] != float64(1929) || account["quota"] != float64(248540) || account["used_quota"] != float64(3250000) {
		t.Fatalf("expected saved account summary, got %#v", account)
	}
	if account["display_name"] != "Tom Admin" || account["group"] != "default" || account["role"] != float64(1) || account["status"] != float64(1) {
		t.Fatalf("expected saved account self fields, got %#v", account)
	}
	lastCheckinAt, ok := account["last_checkin_at"].(string)
	if !ok || strings.TrimSpace(lastCheckinAt) == "" {
		t.Fatalf("expected last successful checkin time in account summary, got %#v", account)
	}
	if _, err := time.Parse(time.RFC3339, lastCheckinAt); err != nil {
		t.Fatalf("expected RFC3339 last_checkin_at, got %q: %v", lastCheckinAt, err)
	}
	if _, ok := account["email"]; ok {
		t.Fatalf("expected account summary to exclude email, got %#v", account)
	}
	if !reflect.DeepEqual(calls, []string{"GET /api/user/self", "POST /api/user/checkin", "GET /api/user/self"}) {
		t.Fatalf("unexpected console call sequence: %#v", calls)
	}

	var response struct {
		Requests []struct {
			Time       string `json:"time"`
			Method     string `json:"method"`
			Path       string `json:"path"`
			StatusCode int    `json:"status_code"`
			Body       string `json:"body"`
		} `json:"requests"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("unmarshal checkin response: %v", err)
	}
	if len(response.Requests) != 3 {
		t.Fatalf("expected three console request logs, got %#v", response.Requests)
	}
	wantLogs := []struct {
		method string
		path   string
		body   string
	}{
		{http.MethodGet, "/api/user/self", `"username":"tom"`},
		{http.MethodPost, "/api/user/checkin", `"message":"ok"`},
		{http.MethodGet, "/api/user/self", `"username":"tom"`},
	}
	for i, want := range wantLogs {
		got := response.Requests[i]
		if strings.TrimSpace(got.Time) == "" {
			t.Fatalf("expected request log %d to include time, got %#v", i, got)
		}
		if got.Method != want.method || got.Path != want.path || got.StatusCode != http.StatusOK || !strings.Contains(got.Body, want.body) {
			t.Fatalf("unexpected request log %d: got %#v want method=%s path=%s body containing %q", i, got, want.method, want.path, want.body)
		}
	}
}

func TestAdminBackendConsoleRequestsUseConfiguredUserAgent(t *testing.T) {
	application := newTestApp(t)

	updateReq := httptest.NewRequest(http.MethodPut, "/admin/api/config", strings.NewReader(`{"backend_console_user_agent":"TokenGateTest/1.0"}`))
	updateReq.Header.Set("Content-Type", "application/json")
	updateRecorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(updateRecorder, updateReq)
	if updateRecorder.Code != http.StatusOK {
		t.Fatalf("expected config update status 200, got %d body=%s", updateRecorder.Code, updateRecorder.Body.String())
	}

	application.backendHandler.SetConsoleHTTPClient(&http.Client{Transport: consoleRoundTripFunc(func(r *http.Request) (*http.Response, error) {
		if got := r.Header.Get("User-Agent"); got != "TokenGateTest/1.0" {
			t.Fatalf("expected configured user agent, got %q", got)
		}
		return consoleJSONResponse(http.StatusOK, nil, `{"success":true,"data":{"gpt-5.4":{"model_ratio":2}}}`), nil
	})})

	backend := createTestBackend(t, application, domain.Backend{
		Name:          "new-api-console-user-agent",
		Protocol:      domain.BackendProtocolOpenAI,
		BackendType:   domain.BackendTypeNewAPI,
		BaseURL:       "https://new-api.local/v1",
		APIKey:        "backend-key",
		ConsoleURL:    "https://console.local",
		ConsoleCookie: "session=valid",
		Models:        []string{"gpt-5.4"},
		Endpoints:     []string{domain.EndpointChat},
	})

	req := httptest.NewRequest(http.MethodPost, "/admin/api/backends/"+strconv.FormatInt(backend.ID, 10)+"/console/pricing", nil)
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected pricing status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
}

func TestAdminBackendNewAPIConsoleCheckinLogsInWhenCookieExpired(t *testing.T) {
	application := newTestApp(t)

	var calls []string
	application.backendHandler.SetConsoleHTTPClient(&http.Client{Transport: consoleRoundTripFunc(func(r *http.Request) (*http.Response, error) {
		calls = append(calls, r.Method+" "+r.URL.Path)
		switch r.URL.Path {
		case "/api/user/checkin":
			if r.Header.Get("Cookie") != "theme=dark; session=fresh" {
				t.Fatalf("expected refreshed session cookie, got %q", r.Header.Get("Cookie"))
			}
			if r.Header.Get("New-Api-User") != "1929" {
				t.Fatalf("expected New-Api-User header 1929, got %q", r.Header.Get("New-Api-User"))
			}
			return consoleJSONResponse(http.StatusOK, nil, `{"success":true,"message":"checked in"}`), nil
		case "/api/user/login":
			body, err := io.ReadAll(r.Body)
			if err != nil {
				t.Fatalf("read login body: %v", err)
			}
			if string(body) != `{"username":"tom","password":"tom_passwd"}`+"\n" && string(body) != `{"username":"tom","password":"tom_passwd"}` {
				t.Fatalf("unexpected login body %q", string(body))
			}
			return consoleJSONResponse(http.StatusOK, http.Header{"Set-Cookie": []string{"session=fresh; Path=/; HttpOnly"}}, `{"success":true,"message":"logged in"}`), nil
		case "/api/user/self":
			if len(calls) == 1 {
				if r.Header.Get("Cookie") != "theme=dark; session=expired" {
					t.Fatalf("expected expired saved cookie for initial self, got %q", r.Header.Get("Cookie"))
				}
				return consoleJSONResponse(http.StatusOK, nil, `{"success":false,"message":"未登录"}`), nil
			}
			if r.Header.Get("Cookie") != "theme=dark; session=fresh" {
				t.Fatalf("expected refreshed cookie for self, got %q", r.Header.Get("Cookie"))
			}
			return consoleJSONResponse(http.StatusOK, nil, `{"success":true,"data":{"username":"tom","id":1929,"quota":200,"used_quota":50}}`), nil
		default:
			t.Fatalf("unexpected console path %s", r.URL.Path)
		}
		return nil, errors.New("unreachable console path")
	})})

	backend := createTestBackend(t, application, domain.Backend{
		Name:            "new-api-expired-cookie",
		Protocol:        domain.BackendProtocolOpenAI,
		BackendType:     domain.BackendTypeNewAPI,
		BaseURL:         "https://new-api.local/v1",
		APIKey:          "backend-key",
		ConsoleURL:      "https://console.local",
		ConsoleUsername: "tom",
		ConsolePassword: "tom_passwd",
		ConsoleCookie:   "theme=dark; session=expired",
		Models:          []string{"gpt-4o"},
		Endpoints:       []string{domain.EndpointChat},
	})

	req := httptest.NewRequest(http.MethodPost, "/admin/api/backends/"+strconv.FormatInt(backend.ID, 10)+"/console/checkin", nil)
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected checkin status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	updated, err := application.store.GetBackend(context.Background(), backend.ID)
	if err != nil {
		t.Fatalf("get updated backend: %v", err)
	}
	if updated.ConsoleCookie != "theme=dark; session=fresh" {
		t.Fatalf("expected saved cookie to merge session, got %q", updated.ConsoleCookie)
	}
	account := decodeJSONPayload(t, updated.ConsoleAccountJSON)
	if account["quota"] != float64(200) || account["used_quota"] != float64(50) {
		t.Fatalf("expected refreshed account summary, got %#v", account)
	}
	if !reflect.DeepEqual(calls, []string{"GET /api/user/self", "POST /api/user/login", "GET /api/user/self", "POST /api/user/checkin", "GET /api/user/self"}) {
		t.Fatalf("unexpected console call sequence: %#v", calls)
	}
}

func TestAdminBackendNewAPIConsoleCheckinUsesLoginUserIDWhenSelfRequiresNewAPIUser(t *testing.T) {
	application := newTestApp(t)

	var calls []string
	application.backendHandler.SetConsoleHTTPClient(&http.Client{Transport: consoleRoundTripFunc(func(r *http.Request) (*http.Response, error) {
		calls = append(calls, r.Method+" "+r.URL.Path)
		switch r.URL.Path {
		case "/api/user/self":
			if r.Header.Get("New-Api-User") == "" {
				return consoleJSONResponse(http.StatusUnauthorized, nil, `{"success":false,"message":"无权进行此操作，未提供 New-Api-User"}`), nil
			}
			if r.Header.Get("New-Api-User") != "1929" {
				t.Fatalf("expected New-Api-User header 1929, got %q", r.Header.Get("New-Api-User"))
			}
			if r.Header.Get("Cookie") != "theme=dark; session=fresh" {
				t.Fatalf("expected refreshed cookie for self, got %q", r.Header.Get("Cookie"))
			}
			return consoleJSONResponse(http.StatusOK, nil, `{"success":true,"data":{"username":"tom","id":1929,"quota":200,"used_quota":50}}`), nil
		case "/api/user/login":
			return consoleJSONResponse(http.StatusOK, http.Header{"Set-Cookie": []string{"session=fresh; Path=/; HttpOnly"}}, `{"success":true,"data":{"id":1929,"username":"tom"},"message":"logged in"}`), nil
		case "/api/user/checkin":
			if r.Header.Get("New-Api-User") != "1929" {
				t.Fatalf("expected New-Api-User header 1929, got %q", r.Header.Get("New-Api-User"))
			}
			if r.Header.Get("Cookie") != "theme=dark; session=fresh" {
				t.Fatalf("expected refreshed cookie for checkin, got %q", r.Header.Get("Cookie"))
			}
			return consoleJSONResponse(http.StatusOK, nil, `{"success":true,"message":"checked in"}`), nil
		default:
			t.Fatalf("unexpected console path %s", r.URL.Path)
		}
		return nil, errors.New("unreachable console path")
	})})

	backend := createTestBackend(t, application, domain.Backend{
		Name:            "new-api-self-requires-user-header",
		Protocol:        domain.BackendProtocolOpenAI,
		BackendType:     domain.BackendTypeNewAPI,
		BaseURL:         "https://new-api.local/v1",
		APIKey:          "backend-key",
		ConsoleURL:      "https://console.local",
		ConsoleUsername: "tom",
		ConsolePassword: "tom_passwd",
		ConsoleCookie:   "theme=dark; session=expired",
		Models:          []string{"gpt-4o"},
		Endpoints:       []string{domain.EndpointChat},
	})

	req := httptest.NewRequest(http.MethodPost, "/admin/api/backends/"+strconv.FormatInt(backend.ID, 10)+"/console/checkin", nil)
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected checkin status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	if !reflect.DeepEqual(calls, []string{"GET /api/user/self", "POST /api/user/login", "GET /api/user/self", "POST /api/user/checkin", "GET /api/user/self"}) {
		t.Fatalf("unexpected console call sequence: %#v", calls)
	}
}

func TestAdminBackendNewAPIConsoleCheckinWritesDiagnosticLogsWithoutSecrets(t *testing.T) {
	var logs bytes.Buffer
	previousLogger := slog.Default()
	slog.SetDefault(slog.New(slog.NewTextHandler(&logs, &slog.HandlerOptions{Level: slog.LevelDebug})))
	t.Cleanup(func() {
		slog.SetDefault(previousLogger)
	})

	application := newTestApp(t)

	application.backendHandler.SetConsoleHTTPClient(&http.Client{Transport: consoleRoundTripFunc(func(r *http.Request) (*http.Response, error) {
		switch r.URL.Path {
		case "/api/user/checkin":
			return consoleJSONResponse(http.StatusOK, nil, `{"success":true,"message":"ok"}`), nil
		case "/api/user/self":
			return consoleJSONResponse(http.StatusOK, nil, `{"success":true,"data":{"username":"tom","id":1929,"quota":248540,"used_quota":3250000}}`), nil
		default:
			t.Fatalf("unexpected console path %s", r.URL.Path)
		}
		return nil, errors.New("unreachable console path")
	})})

	backend := createTestBackend(t, application, domain.Backend{
		Name:            "new-api-console-logging",
		Protocol:        domain.BackendProtocolOpenAI,
		BackendType:     domain.BackendTypeNewAPI,
		BaseURL:         "https://new-api.local/v1",
		APIKey:          "backend-key",
		ConsoleURL:      "https://console.local",
		ConsoleUsername: "tom",
		ConsolePassword: "tom_passwd",
		ConsoleCookie:   "session=valid",
		Models:          []string{"gpt-4o"},
		Endpoints:       []string{domain.EndpointChat},
	})

	req := httptest.NewRequest(http.MethodPost, "/admin/api/backends/"+strconv.FormatInt(backend.ID, 10)+"/console/checkin", nil)
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected checkin status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	output := logs.String()
	for _, want := range []string{
		"newapi_console_checkin_started",
		"newapi_console_request_finished",
		"newapi_console_account_summary_saved",
	} {
		if !strings.Contains(output, want) {
			t.Fatalf("expected diagnostic log %q in output:\n%s", want, output)
		}
	}
	for _, secret := range []string{"session=valid", "tom_passwd"} {
		if strings.Contains(output, secret) {
			t.Fatalf("diagnostic logs leaked secret %q:\n%s", secret, output)
		}
	}
}

func TestAdminBackendNewAPIConsolePricingSavesModelPlazaJSON(t *testing.T) {
	application := newTestApp(t)

	application.backendHandler.SetConsoleHTTPClient(&http.Client{Transport: consoleRoundTripFunc(func(r *http.Request) (*http.Response, error) {
		if r.Method != http.MethodGet || r.URL.Path != "/api/pricing" {
			t.Fatalf("unexpected pricing request %s %s", r.Method, r.URL.Path)
		}
		if r.Header.Get("new-user-id") != "1929" {
			t.Fatalf("expected new-user-id header 1929, got %q", r.Header.Get("new-user-id"))
		}
		return consoleJSONResponse(http.StatusOK, nil, `{"success":true,"data":{"pricing_version":"2026-07-03","vendors":[{"name":"openai","models":["gpt-4o"]}],"group_ratio":{"default":1}}}`), nil
	})})

	backend := createTestBackend(t, application, domain.Backend{
		Name:               "new-api-pricing",
		Protocol:           domain.BackendProtocolOpenAI,
		BackendType:        domain.BackendTypeNewAPI,
		BaseURL:            "https://new-api.local/v1",
		APIKey:             "backend-key",
		ConsoleURL:         "https://console.local",
		ConsoleCookie:      "session=valid",
		ConsoleAccountJSON: `{"id":1929}`,
		Models:             []string{"routed-model"},
		Endpoints:          []string{domain.EndpointChat},
	})

	req := httptest.NewRequest(http.MethodPost, "/admin/api/backends/"+strconv.FormatInt(backend.ID, 10)+"/console/pricing", nil)
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected pricing status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	updated, err := application.store.GetBackend(context.Background(), backend.ID)
	if err != nil {
		t.Fatalf("get updated backend: %v", err)
	}
	pricing := decodeJSONPayload(t, updated.ConsolePricingJSON)
	data, ok := pricing["data"].(map[string]any)
	if !ok || data["pricing_version"] != "2026-07-03" {
		t.Fatalf("expected saved pricing payload, got %#v", pricing)
	}
	if !reflect.DeepEqual(updated.Models, []string{"routed-model"}) {
		t.Fatalf("pricing sync must not change scheduler models, got %#v", updated.Models)
	}

	var response struct {
		Requests []struct {
			Time       string `json:"time"`
			Method     string `json:"method"`
			Path       string `json:"path"`
			StatusCode int    `json:"status_code"`
			Body       string `json:"body"`
		} `json:"requests"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("unmarshal pricing response: %v", err)
	}
	if len(response.Requests) != 1 {
		t.Fatalf("expected one pricing request log, got %#v", response.Requests)
	}
	got := response.Requests[0]
	if strings.TrimSpace(got.Time) == "" || got.Method != http.MethodGet || got.Path != "/api/pricing" || got.StatusCode != http.StatusOK || !strings.Contains(got.Body, `"pricing_version":"2026-07-03"`) {
		t.Fatalf("unexpected pricing request log: %#v", got)
	}
}

func TestAdminBackendNewAPIConsoleSyncSavesStatusAccountAndFilteredPricing(t *testing.T) {
	application := newTestApp(t)
	application.cfg.FocusModels = "gpt-5.*"

	var calls []string
	application.backendHandler.SetConsoleHTTPClient(&http.Client{Transport: consoleRoundTripFunc(func(r *http.Request) (*http.Response, error) {
		calls = append(calls, r.Method+" "+r.URL.Path)
		if r.Header.Get("Cookie") != "session=valid" {
			t.Fatalf("expected saved cookie, got %q", r.Header.Get("Cookie"))
		}
		switch r.URL.Path {
		case "/api/status":
			if r.Method != http.MethodGet {
				t.Fatalf("expected GET status, got %s", r.Method)
			}
			return consoleJSONResponse(http.StatusOK, nil, `{"success":true,"data":{"checkin_enabled":true,"custom_currency_exchange_rate":10,"custom_currency_symbol":"硬币","quota_display_type":"CUSTOM","quota_per_unit":500000,"system_name":"relay"}}`), nil
		case "/api/user/self":
			if r.Method != http.MethodGet {
				t.Fatalf("expected GET self, got %s", r.Method)
			}
			return consoleJSONResponse(http.StatusOK, nil, `{"success":true,"data":{"username":"tom","display_name":"Tom Admin","group":"default","role":1,"status":1,"id":1929,"quota":248540,"used_quota":3250000}}`), nil
		case "/api/user/checkin":
			if r.Method != http.MethodPost {
				t.Fatalf("expected POST checkin, got %s", r.Method)
			}
			if r.Header.Get("New-Api-User") != "1929" {
				t.Fatalf("expected New-Api-User header 1929, got %q", r.Header.Get("New-Api-User"))
			}
			return consoleJSONResponse(http.StatusOK, nil, `{"success":true,"message":"checked in"}`), nil
		case "/api/pricing":
			if r.Method != http.MethodGet {
				t.Fatalf("expected GET pricing, got %s", r.Method)
			}
			if r.Header.Get("new-user-id") != "1929" {
				t.Fatalf("expected new-user-id header 1929 for pricing, got %q", r.Header.Get("new-user-id"))
			}
			return consoleJSONResponse(http.StatusOK, nil, `{"success":true,"data":[{"model_name":"gpt-5.4","model_ratio":2},{"model_name":"claude-sonnet-4","model_ratio":3},{"model_name":"gpt-5.5-tools","model_ratio":4}]}`), nil
		default:
			t.Fatalf("unexpected console path %s", r.URL.Path)
		}
		return nil, errors.New("unreachable console path")
	})})

	backend := createTestBackend(t, application, domain.Backend{
		Name:               "new-api-sync",
		Protocol:           domain.BackendProtocolOpenAI,
		BackendType:        domain.BackendTypeNewAPI,
		BaseURL:            "https://new-api.local/v1",
		APIKey:             "backend-key",
		ConsoleURL:         "https://console.local",
		ConsoleCookie:      "session=valid",
		ConsoleAccountJSON: `{"id":1929}`,
		ConsolePricingJSON: `{"existing":true}`,
		Models:             []string{"routed-model"},
		Endpoints:          []string{domain.EndpointChat},
	})

	req := httptest.NewRequest(http.MethodPost, "/admin/api/backends/"+strconv.FormatInt(backend.ID, 10)+"/console/sync", nil)
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected sync status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	if !reflect.DeepEqual(calls, []string{"GET /api/status", "POST /api/user/checkin", "GET /api/user/self", "GET /api/pricing"}) {
		t.Fatalf("unexpected console call sequence: %#v", calls)
	}

	updated, err := application.store.GetBackend(context.Background(), backend.ID)
	if err != nil {
		t.Fatalf("get updated backend: %v", err)
	}
	account := decodeJSONPayload(t, updated.ConsoleAccountJSON)
	if account["username"] != "tom" || account["id"] != float64(1929) || account["quota"] != float64(248540) || account["used_quota"] != float64(3250000) {
		t.Fatalf("expected saved account summary, got %#v", account)
	}
	if account["custom_currency_exchange_rate"] != float64(10) || account["custom_currency_symbol"] != "硬币" || account["quota_display_type"] != "CUSTOM" || account["quota_per_unit"] != float64(500000) {
		t.Fatalf("expected status currency metadata in account summary, got %#v", account)
	}
	if lastCheckinAt, ok := account["last_checkin_at"].(string); !ok || strings.TrimSpace(lastCheckinAt) == "" {
		t.Fatalf("expected successful checkin timestamp, got %#v", account)
	}

	pricing := decodeJSONPayload(t, updated.ConsolePricingJSON)
	data, ok := pricing["data"].([]any)
	if !ok {
		t.Fatalf("expected pricing data array, got %#v", pricing)
	}
	if len(data) != 2 {
		t.Fatalf("expected filtered pricing data, got %#v", data)
	}
	models := make([]string, 0, len(data))
	for _, item := range data {
		record, ok := item.(map[string]any)
		if !ok {
			t.Fatalf("expected pricing item object, got %#v", item)
		}
		models = append(models, fmt.Sprint(record["model_name"]))
	}
	if !reflect.DeepEqual(models, []string{"gpt-5.4", "gpt-5.5-tools"}) {
		t.Fatalf("expected focus model pricing rows, got %#v", models)
	}

	var response struct {
		Account  map[string]any `json:"account"`
		Pricing  map[string]any `json:"pricing"`
		Requests []struct {
			Method string `json:"method"`
			Path   string `json:"path"`
		} `json:"requests"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("unmarshal sync response: %v", err)
	}
	if response.Account["custom_currency_symbol"] != "硬币" {
		t.Fatalf("expected account metadata in response, got %#v", response.Account)
	}
	if len(response.Requests) != 4 {
		t.Fatalf("expected sync request logs, got %#v", response.Requests)
	}
}

func TestAdminBackendNewAPIConsoleSyncStreamsRequestLogs(t *testing.T) {
	application := newTestApp(t)

	application.backendHandler.SetConsoleHTTPClient(&http.Client{Transport: consoleRoundTripFunc(func(r *http.Request) (*http.Response, error) {
		switch r.URL.Path {
		case "/api/status":
			return consoleJSONResponse(http.StatusOK, nil, `{"success":true,"data":{"checkin_enabled":true,"custom_currency_exchange_rate":1,"custom_currency_symbol":"$","quota_display_type":"USD","quota_per_unit":500000}}`), nil
		case "/api/user/checkin":
			return consoleJSONResponse(http.StatusOK, nil, `{"success":true,"message":"checked in"}`), nil
		case "/api/user/self":
			return consoleJSONResponse(http.StatusOK, nil, `{"success":true,"data":{"username":"tom","id":1929,"quota":200,"used_quota":50}}`), nil
		case "/api/pricing":
			return consoleJSONResponse(http.StatusOK, nil, `{"success":true,"data":[{"model_name":"gpt-5.4","model_ratio":2}]}`), nil
		default:
			t.Fatalf("unexpected console path %s", r.URL.Path)
		}
		return nil, errors.New("unreachable console path")
	})})

	backend := createTestBackend(t, application, domain.Backend{
		Name:               "new-api-sync-stream",
		Protocol:           domain.BackendProtocolOpenAI,
		BackendType:        domain.BackendTypeNewAPI,
		BaseURL:            "https://new-api.local/v1",
		APIKey:             "backend-key",
		ConsoleURL:         "https://console.local",
		ConsoleCookie:      "session=valid",
		ConsoleAccountJSON: `{"id":1929}`,
		Models:             []string{"routed-model"},
		Endpoints:          []string{domain.EndpointChat},
	})

	req := httptest.NewRequest(http.MethodPost, "/admin/api/backends/"+strconv.FormatInt(backend.ID, 10)+"/console/sync?stream=1", nil)
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected stream status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	if got := recorder.Header().Get("Content-Type"); !strings.Contains(got, "application/x-ndjson") {
		t.Fatalf("expected ndjson content type, got %q body=%s", got, recorder.Body.String())
	}
	lines := strings.Split(strings.TrimSpace(recorder.Body.String()), "\n")
	if len(lines) != 5 {
		t.Fatalf("expected four request events and one complete event, got %d lines: %s", len(lines), recorder.Body.String())
	}
	var first struct {
		Type    string `json:"type"`
		Request struct {
			Method string `json:"method"`
			Path   string `json:"path"`
		} `json:"request"`
	}
	if err := json.Unmarshal([]byte(lines[0]), &first); err != nil {
		t.Fatalf("decode first stream line: %v", err)
	}
	if first.Type != "request" || first.Request.Method != http.MethodGet || first.Request.Path != "/api/status" {
		t.Fatalf("unexpected first stream event: %#v", first)
	}
	var last struct {
		Type string `json:"type"`
	}
	if err := json.Unmarshal([]byte(lines[len(lines)-1]), &last); err != nil {
		t.Fatalf("decode last stream line: %v", err)
	}
	if last.Type != "complete" {
		t.Fatalf("expected complete stream event, got %#v", last)
	}
}

func TestAdminBackendNewAPIConsoleSyncSkipsCheckinWhenAlreadyCheckedInToday(t *testing.T) {
	application := newTestApp(t)
	today := time.Now().UTC().Format(time.RFC3339)

	var calls []string
	application.backendHandler.SetConsoleHTTPClient(&http.Client{Transport: consoleRoundTripFunc(func(r *http.Request) (*http.Response, error) {
		calls = append(calls, r.Method+" "+r.URL.Path)
		switch r.URL.Path {
		case "/api/status":
			return consoleJSONResponse(http.StatusOK, nil, `{"success":true,"data":{"checkin_enabled":true,"custom_currency_exchange_rate":10,"custom_currency_symbol":"硬币","quota_per_unit":500000}}`), nil
		case "/api/user/self":
			return consoleJSONResponse(http.StatusOK, nil, `{"success":true,"data":{"username":"tom","id":1929,"quota":200,"used_quota":50}}`), nil
		case "/api/user/checkin":
			t.Fatalf("checkin should be skipped when last successful checkin is today")
		case "/api/pricing":
			return consoleJSONResponse(http.StatusOK, nil, `{"success":true,"data":[{"model_name":"gpt-5.4","model_ratio":2}]}`), nil
		default:
			t.Fatalf("unexpected console path %s", r.URL.Path)
		}
		return nil, errors.New("unreachable console path")
	})})

	backend := createTestBackend(t, application, domain.Backend{
		Name:               "new-api-sync-skip-checkin",
		Protocol:           domain.BackendProtocolOpenAI,
		BackendType:        domain.BackendTypeNewAPI,
		BaseURL:            "https://new-api.local/v1",
		APIKey:             "backend-key",
		ConsoleURL:         "https://console.local",
		ConsoleCookie:      "session=valid",
		ConsoleAccountJSON: fmt.Sprintf(`{"id":1929,"last_checkin_at":%q}`, today),
		Models:             []string{"routed-model"},
		Endpoints:          []string{domain.EndpointChat},
	})

	req := httptest.NewRequest(http.MethodPost, "/admin/api/backends/"+strconv.FormatInt(backend.ID, 10)+"/console/sync", nil)
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected sync status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	if !reflect.DeepEqual(calls, []string{"GET /api/status", "GET /api/user/self", "GET /api/pricing"}) {
		t.Fatalf("unexpected console call sequence: %#v", calls)
	}

	updated, err := application.store.GetBackend(context.Background(), backend.ID)
	if err != nil {
		t.Fatalf("get updated backend: %v", err)
	}
	account := decodeJSONPayload(t, updated.ConsoleAccountJSON)
	if account["last_checkin_at"] != today {
		t.Fatalf("expected existing checkin timestamp to be preserved, got %#v", account)
	}
}

func TestAdminBackendNewAPIConsoleSyncMigratesLegacyCheckinTimeAndSkipsCheckin(t *testing.T) {
	application := newTestApp(t)
	today := time.Now().Format("2006-01-02")

	var calls []string
	application.backendHandler.SetConsoleHTTPClient(&http.Client{Transport: consoleRoundTripFunc(func(r *http.Request) (*http.Response, error) {
		calls = append(calls, r.Method+" "+r.URL.Path)
		switch r.URL.Path {
		case "/api/status":
			return consoleJSONResponse(http.StatusOK, nil, `{"success":true,"data":{"checkin_enabled":true,"custom_currency_exchange_rate":10,"custom_currency_symbol":"硬币","quota_per_unit":500000}}`), nil
		case "/api/user/self":
			return consoleJSONResponse(http.StatusOK, nil, `{"success":true,"data":{"username":"tom","id":1929,"quota":200,"used_quota":50}}`), nil
		case "/api/user/checkin":
			t.Fatalf("checkin should be skipped when legacy checkin_time is today")
		case "/api/pricing":
			return consoleJSONResponse(http.StatusOK, nil, `{"success":true,"data":[{"model_name":"gpt-5.4","model_ratio":2}]}`), nil
		default:
			t.Fatalf("unexpected console path %s", r.URL.Path)
		}
		return nil, errors.New("unreachable console path")
	})})

	backend := createTestBackend(t, application, domain.Backend{
		Name:               "new-api-sync-legacy-checkin",
		Protocol:           domain.BackendProtocolOpenAI,
		BackendType:        domain.BackendTypeNewAPI,
		BaseURL:            "https://new-api.local/v1",
		APIKey:             "backend-key",
		ConsoleURL:         "https://console.local",
		ConsoleCookie:      "session=valid",
		ConsoleAccountJSON: fmt.Sprintf(`{"id":1929,"checkin_time":%q}`, today),
		Models:             []string{"routed-model"},
		Endpoints:          []string{domain.EndpointChat},
	})

	req := httptest.NewRequest(http.MethodPost, "/admin/api/backends/"+strconv.FormatInt(backend.ID, 10)+"/console/sync", nil)
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected sync status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	if !reflect.DeepEqual(calls, []string{"GET /api/status", "GET /api/user/self", "GET /api/pricing"}) {
		t.Fatalf("unexpected console call sequence: %#v", calls)
	}

	updated, err := application.store.GetBackend(context.Background(), backend.ID)
	if err != nil {
		t.Fatalf("get updated backend: %v", err)
	}
	account := decodeJSONPayload(t, updated.ConsoleAccountJSON)
	lastCheckinAt, ok := account["last_checkin_at"].(string)
	if !ok {
		t.Fatalf("expected legacy checkin time migrated to last_checkin_at, got %#v", account)
	}
	parsedLastCheckinAt, err := time.Parse(time.RFC3339, lastCheckinAt)
	if err != nil {
		t.Fatalf("expected RFC3339 last_checkin_at, got %q: %v", lastCheckinAt, err)
	}
	if parsedLastCheckinAt.In(time.Local).Format("2006-01-02") != today {
		t.Fatalf("expected migrated checkin time to stay on %s, got %q", today, lastCheckinAt)
	}
}

func TestAdminBackendNewAPIConsoleSyncTreatsAlreadyCheckedInAsToday(t *testing.T) {
	application := newTestApp(t)

	var calls []string
	application.backendHandler.SetConsoleHTTPClient(&http.Client{Transport: consoleRoundTripFunc(func(r *http.Request) (*http.Response, error) {
		calls = append(calls, r.Method+" "+r.URL.Path)
		switch r.URL.Path {
		case "/api/status":
			return consoleJSONResponse(http.StatusOK, nil, `{"success":true,"data":{"checkin_enabled":true,"custom_currency_exchange_rate":10,"custom_currency_symbol":"硬币","quota_per_unit":500000}}`), nil
		case "/api/user/self":
			return consoleJSONResponse(http.StatusOK, nil, `{"success":true,"data":{"username":"tom","id":1929,"quota":200,"used_quota":50}}`), nil
		case "/api/user/checkin":
			return consoleJSONResponse(http.StatusOK, nil, `{"success":false,"message":"今日已签到"}`), nil
		case "/api/pricing":
			return consoleJSONResponse(http.StatusOK, nil, `{"success":true,"data":[{"model_name":"gpt-5.4","model_ratio":2}]}`), nil
		default:
			t.Fatalf("unexpected console path %s", r.URL.Path)
		}
		return nil, errors.New("unreachable console path")
	})})

	backend := createTestBackend(t, application, domain.Backend{
		Name:          "new-api-sync-already-checkin",
		Protocol:      domain.BackendProtocolOpenAI,
		BackendType:   domain.BackendTypeNewAPI,
		BaseURL:       "https://new-api.local/v1",
		APIKey:        "backend-key",
		ConsoleURL:    "https://console.local",
		ConsoleCookie: "session=valid",
		Models:        []string{"routed-model"},
		Endpoints:     []string{domain.EndpointChat},
	})

	req := httptest.NewRequest(http.MethodPost, "/admin/api/backends/"+strconv.FormatInt(backend.ID, 10)+"/console/sync", nil)
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected sync status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	if !reflect.DeepEqual(calls, []string{"GET /api/status", "POST /api/user/checkin", "GET /api/user/self", "GET /api/pricing"}) {
		t.Fatalf("unexpected console call sequence: %#v", calls)
	}

	updated, err := application.store.GetBackend(context.Background(), backend.ID)
	if err != nil {
		t.Fatalf("get updated backend: %v", err)
	}
	account := decodeJSONPayload(t, updated.ConsoleAccountJSON)
	if lastCheckinAt, ok := account["last_checkin_at"].(string); !ok || strings.TrimSpace(lastCheckinAt) == "" {
		t.Fatalf("expected already-checked-in response to save last_checkin_at, got %#v", account)
	}
}

func TestAdminBackendNewAPIConsoleSyncSkipsCheckinWhenStatusDoesNotEnableIt(t *testing.T) {
	application := newTestApp(t)

	var calls []string
	application.backendHandler.SetConsoleHTTPClient(&http.Client{Transport: consoleRoundTripFunc(func(r *http.Request) (*http.Response, error) {
		calls = append(calls, r.Method+" "+r.URL.Path)
		switch r.URL.Path {
		case "/api/status":
			return consoleJSONResponse(http.StatusOK, nil, `{"success":true,"data":{"custom_currency_exchange_rate":10,"custom_currency_symbol":"硬币","quota_per_unit":500000}}`), nil
		case "/api/user/self":
			return consoleJSONResponse(http.StatusOK, nil, `{"success":true,"data":{"username":"tom","id":1929,"quota":200,"used_quota":50}}`), nil
		case "/api/user/checkin":
			t.Fatalf("checkin should be skipped when status does not enable it")
		case "/api/pricing":
			return consoleJSONResponse(http.StatusOK, nil, `{"success":true,"data":[{"model_name":"gpt-5.4","model_ratio":2}]}`), nil
		default:
			t.Fatalf("unexpected console path %s", r.URL.Path)
		}
		return nil, errors.New("unreachable console path")
	})})

	backend := createTestBackend(t, application, domain.Backend{
		Name:          "new-api-sync-status-no-checkin",
		Protocol:      domain.BackendProtocolOpenAI,
		BackendType:   domain.BackendTypeNewAPI,
		BaseURL:       "https://new-api.local/v1",
		APIKey:        "backend-key",
		ConsoleURL:    "https://console.local",
		ConsoleCookie: "session=valid",
		Models:        []string{"routed-model"},
		Endpoints:     []string{domain.EndpointChat},
	})

	req := httptest.NewRequest(http.MethodPost, "/admin/api/backends/"+strconv.FormatInt(backend.ID, 10)+"/console/sync", nil)
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected sync status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	if !reflect.DeepEqual(calls, []string{"GET /api/status", "GET /api/user/self", "GET /api/pricing"}) {
		t.Fatalf("unexpected console call sequence: %#v", calls)
	}

	updated, err := application.store.GetBackend(context.Background(), backend.ID)
	if err != nil {
		t.Fatalf("get updated backend: %v", err)
	}
	account := decodeJSONPayload(t, updated.ConsoleAccountJSON)
	if lastCheckinAt, ok := account["last_checkin_at"].(string); !ok || strings.TrimSpace(lastCheckinAt) == "" {
		t.Fatalf("expected unsupported checkin flow to save sync completion time, got %#v", account)
	}
}

func TestAdminBackendNewAPIConsoleSyncRefreshesExistingCheckinTimeWhenStatusDoesNotEnableIt(t *testing.T) {
	application := newTestApp(t)

	var calls []string
	application.backendHandler.SetConsoleHTTPClient(&http.Client{Transport: consoleRoundTripFunc(func(r *http.Request) (*http.Response, error) {
		calls = append(calls, r.Method+" "+r.URL.Path)
		switch r.URL.Path {
		case "/api/status":
			return consoleJSONResponse(http.StatusOK, nil, `{"success":true,"data":{"custom_currency_exchange_rate":10,"custom_currency_symbol":"硬币","quota_per_unit":500000}}`), nil
		case "/api/user/self":
			return consoleJSONResponse(http.StatusOK, nil, `{"success":true,"data":{"username":"tom","id":1929,"quota":200,"used_quota":50}}`), nil
		case "/api/user/checkin":
			t.Fatalf("checkin should be skipped when status does not enable it")
		case "/api/pricing":
			return consoleJSONResponse(http.StatusOK, nil, `{"success":true,"data":[{"model_name":"gpt-5.4","model_ratio":2}]}`), nil
		default:
			t.Fatalf("unexpected console path %s", r.URL.Path)
		}
		return nil, errors.New("unreachable console path")
	})})

	previousCheckin := time.Now().UTC().Add(-48 * time.Hour).Format(time.RFC3339)
	backend := createTestBackend(t, application, domain.Backend{
		Name:               "new-api-sync-status-no-checkin-refresh",
		Protocol:           domain.BackendProtocolOpenAI,
		BackendType:        domain.BackendTypeNewAPI,
		BaseURL:            "https://new-api.local/v1",
		APIKey:             "backend-key",
		ConsoleURL:         "https://console.local",
		ConsoleCookie:      "session=valid",
		ConsoleAccountJSON: fmt.Sprintf(`{"id":1929,"last_checkin_at":%q}`, previousCheckin),
		Models:             []string{"routed-model"},
		Endpoints:          []string{domain.EndpointChat},
	})

	req := httptest.NewRequest(http.MethodPost, "/admin/api/backends/"+strconv.FormatInt(backend.ID, 10)+"/console/sync", nil)
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected sync status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	if !reflect.DeepEqual(calls, []string{"GET /api/status", "GET /api/user/self", "GET /api/pricing"}) {
		t.Fatalf("unexpected console call sequence: %#v", calls)
	}

	updated, err := application.store.GetBackend(context.Background(), backend.ID)
	if err != nil {
		t.Fatalf("get updated backend: %v", err)
	}
	account := decodeJSONPayload(t, updated.ConsoleAccountJSON)
	lastCheckinAt, ok := account["last_checkin_at"].(string)
	if !ok || strings.TrimSpace(lastCheckinAt) == "" {
		t.Fatalf("expected sync completion time, got %#v", account)
	}
	if lastCheckinAt == previousCheckin {
		t.Fatalf("expected sync to refresh existing checkin time %q, got %#v", previousCheckin, account)
	}
}

func TestAdminBackendSub2APIConsoleSyncWithoutCheckinPathSavesCompletionTime(t *testing.T) {
	application := newTestApp(t)

	var calls []string
	application.backendHandler.SetConsoleHTTPClient(&http.Client{Transport: consoleRoundTripFunc(func(r *http.Request) (*http.Response, error) {
		calls = append(calls, r.Method+" "+r.URL.Path)
		if got := r.Header.Get("Authorization"); got != "Bearer sub2api-token" {
			t.Fatalf("expected authorization header, got %q", got)
		}

		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Fatalf("read request body: %v", err)
		}

		switch r.URL.Path {
		case "/api/v1/auth/me":
			if r.Method != http.MethodGet {
				t.Fatalf("expected GET auth/me, got %s", r.Method)
			}
			if strings.TrimSpace(string(body)) != "" {
				t.Fatalf("expected empty auth/me body, got %q", string(body))
			}
			return consoleJSONResponse(http.StatusOK, nil, `{"code":0,"message":"success","data":{"id":13870,"email":"linuxdo-420226@linuxdo-connect.invalid","username":"leon7","balance":2681.86526074}}`), nil
		case "/api/v1/channels":
			if r.Method != http.MethodGet {
				t.Fatalf("expected GET channels, got %s", r.Method)
			}
			if strings.TrimSpace(string(body)) != "" {
				t.Fatalf("expected empty channels body, got %q", string(body))
			}
			return consoleJSONResponse(http.StatusOK, nil, `{"code":0,"message":"success","data":[{"name":"GPT","platforms":[{"platform":"openai","groups":[{"id":2,"name":"GPT-Plus","rate_multiplier":0.07}],"supported_models":[{"name":"gpt-5.4","platform":"openai","pricing":{"billing_mode":"token","input_price":0.0000025,"output_price":0.000015}}]}]}]}`), nil
		case "/api/v1/checkin":
			t.Fatalf("checkin should be skipped when console_checkin_path is not configured")
		default:
			t.Fatalf("unexpected console path %s", r.URL.Path)
		}
		return nil, errors.New("unreachable console path")
	})})

	backend := createTestBackend(t, application, domain.Backend{
		Name:                 "sub2api-sync-no-checkin-path",
		Protocol:             domain.BackendProtocolOpenAI,
		BackendType:          domain.BackendTypeSub2API,
		BaseURL:              "https://sub2api.local/v1",
		APIKey:               "backend-key",
		ConsoleURL:           "https://console.local",
		ConsoleAuthorization: "Bearer sub2api-token",
		ChannelURL:           "/api/v1/channels",
		Models:               []string{"routed-model"},
		Endpoints:            []string{domain.EndpointChat},
	})

	req := httptest.NewRequest(http.MethodPost, "/admin/api/backends/"+strconv.FormatInt(backend.ID, 10)+"/console/sync", nil)
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected sync status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	if !reflect.DeepEqual(calls, []string{"GET /api/v1/auth/me", "GET /api/v1/channels"}) {
		t.Fatalf("unexpected console call sequence: %#v", calls)
	}

	updated, err := application.store.GetBackend(context.Background(), backend.ID)
	if err != nil {
		t.Fatalf("get updated backend: %v", err)
	}
	account := decodeJSONPayload(t, updated.ConsoleAccountJSON)
	if lastCheckinAt, ok := account["last_checkin_at"].(string); !ok || strings.TrimSpace(lastCheckinAt) == "" {
		t.Fatalf("expected sync completion time without checkin path, got %#v", account)
	}
}

func TestAdminBackendSub2APIConsoleSyncWithoutCheckinPathRefreshesExistingCheckinTime(t *testing.T) {
	application := newTestApp(t)

	var calls []string
	application.backendHandler.SetConsoleHTTPClient(&http.Client{Transport: consoleRoundTripFunc(func(r *http.Request) (*http.Response, error) {
		calls = append(calls, r.Method+" "+r.URL.Path)
		if got := r.Header.Get("Authorization"); got != "Bearer sub2api-token" {
			t.Fatalf("expected authorization header, got %q", got)
		}

		switch r.URL.Path {
		case "/api/v1/auth/me":
			return consoleJSONResponse(http.StatusOK, nil, `{"code":0,"message":"success","data":{"id":13870,"email":"linuxdo-420226@linuxdo-connect.invalid","username":"leon7","balance":2681.86526074}}`), nil
		case "/api/v1/channels":
			return consoleJSONResponse(http.StatusOK, nil, `{"code":0,"message":"success","data":[{"name":"GPT","platforms":[{"platform":"openai","groups":[{"id":2,"name":"GPT-Plus","rate_multiplier":0.07}],"supported_models":[{"name":"gpt-5.4","platform":"openai","pricing":{"billing_mode":"token","input_price":0.0000025,"output_price":0.000015}}]}]}]}`), nil
		case "/api/v1/checkin":
			t.Fatalf("checkin should be skipped when console_checkin_path is not configured")
		default:
			t.Fatalf("unexpected console path %s", r.URL.Path)
		}
		return nil, errors.New("unreachable console path")
	})})

	previousCheckin := time.Now().UTC().Add(-48 * time.Hour).Format(time.RFC3339)
	backend := createTestBackend(t, application, domain.Backend{
		Name:                 "sub2api-sync-no-checkin-path-refresh",
		Protocol:             domain.BackendProtocolOpenAI,
		BackendType:          domain.BackendTypeSub2API,
		BaseURL:              "https://sub2api.local/v1",
		APIKey:               "backend-key",
		ConsoleURL:           "https://console.local",
		ConsoleAuthorization: "Bearer sub2api-token",
		ConsoleAccountJSON:   fmt.Sprintf(`{"id":13870,"last_checkin_at":%q}`, previousCheckin),
		ChannelURL:           "/api/v1/channels",
		Models:               []string{"routed-model"},
		Endpoints:            []string{domain.EndpointChat},
	})

	req := httptest.NewRequest(http.MethodPost, "/admin/api/backends/"+strconv.FormatInt(backend.ID, 10)+"/console/sync", nil)
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected sync status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	if !reflect.DeepEqual(calls, []string{"GET /api/v1/auth/me", "GET /api/v1/channels"}) {
		t.Fatalf("unexpected console call sequence: %#v", calls)
	}

	updated, err := application.store.GetBackend(context.Background(), backend.ID)
	if err != nil {
		t.Fatalf("get updated backend: %v", err)
	}
	account := decodeJSONPayload(t, updated.ConsoleAccountJSON)
	lastCheckinAt, ok := account["last_checkin_at"].(string)
	if !ok || strings.TrimSpace(lastCheckinAt) == "" {
		t.Fatalf("expected sync completion time without checkin path, got %#v", account)
	}
	if lastCheckinAt == previousCheckin {
		t.Fatalf("expected sync to refresh existing checkin time %q, got %#v", previousCheckin, account)
	}
}

func TestAdminBackendNewAPIConsoleSyncSavesAccountBeforePricing(t *testing.T) {
	application := newTestApp(t)

	application.backendHandler.SetConsoleHTTPClient(&http.Client{Transport: consoleRoundTripFunc(func(r *http.Request) (*http.Response, error) {
		switch r.URL.Path {
		case "/api/status":
			return consoleJSONResponse(http.StatusOK, nil, `{"success":true,"data":{"checkin_enabled":true,"custom_currency_exchange_rate":10,"custom_currency_symbol":"硬币","quota_per_unit":500000}}`), nil
		case "/api/user/self":
			return consoleJSONResponse(http.StatusOK, nil, `{"success":true,"data":{"username":"tom","id":1929,"quota":200,"used_quota":50}}`), nil
		case "/api/user/checkin":
			return consoleJSONResponse(http.StatusOK, nil, `{"success":true,"message":"checked in"}`), nil
		case "/api/pricing":
			return consoleJSONResponse(http.StatusOK, nil, `{"success":false,"message":"pricing unavailable"}`), nil
		default:
			t.Fatalf("unexpected console path %s", r.URL.Path)
		}
		return nil, errors.New("unreachable console path")
	})})

	backend := createTestBackend(t, application, domain.Backend{
		Name:               "new-api-sync-pricing-error",
		Protocol:           domain.BackendProtocolOpenAI,
		BackendType:        domain.BackendTypeNewAPI,
		BaseURL:            "https://new-api.local/v1",
		APIKey:             "backend-key",
		ConsoleURL:         "https://console.local",
		ConsoleCookie:      "session=valid",
		ConsolePricingJSON: `{"existing":true}`,
		Models:             []string{"routed-model"},
		Endpoints:          []string{domain.EndpointChat},
	})

	req := httptest.NewRequest(http.MethodPost, "/admin/api/backends/"+strconv.FormatInt(backend.ID, 10)+"/console/sync", nil)
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)
	if recorder.Code != http.StatusBadGateway {
		t.Fatalf("expected pricing failure status 502, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	updated, err := application.store.GetBackend(context.Background(), backend.ID)
	if err != nil {
		t.Fatalf("get updated backend: %v", err)
	}
	account := decodeJSONPayload(t, updated.ConsoleAccountJSON)
	if account["username"] != "tom" || account["custom_currency_symbol"] != "硬币" {
		t.Fatalf("expected account summary to be saved before pricing, got %#v", account)
	}
	if lastCheckinAt, ok := account["last_checkin_at"].(string); !ok || strings.TrimSpace(lastCheckinAt) == "" {
		t.Fatalf("expected saved checkin timestamp, got %#v", account)
	}
	pricing := decodeJSONPayload(t, updated.ConsolePricingJSON)
	if pricing["existing"] != true {
		t.Fatalf("expected pricing json to remain unchanged after pricing failure, got %#v", pricing)
	}
}

func TestAdminBackendNewAPIConsolePricingErrorIncludesRequestLogs(t *testing.T) {
	application := newTestApp(t)

	application.backendHandler.SetConsoleHTTPClient(&http.Client{Transport: consoleRoundTripFunc(func(r *http.Request) (*http.Response, error) {
		if r.Method != http.MethodGet || r.URL.Path != "/api/pricing" {
			t.Fatalf("unexpected pricing request %s %s", r.Method, r.URL.Path)
		}
		return consoleJSONResponse(http.StatusPaymentRequired, nil, `{"success":false,"message":"quota exhausted"}`), nil
	})})

	backend := createTestBackend(t, application, domain.Backend{
		Name:          "new-api-pricing-error",
		Protocol:      domain.BackendProtocolOpenAI,
		BackendType:   domain.BackendTypeNewAPI,
		BaseURL:       "https://new-api.local/v1",
		APIKey:        "backend-key",
		ConsoleURL:    "https://console.local",
		ConsoleCookie: "session=valid",
		Models:        []string{"routed-model"},
		Endpoints:     []string{domain.EndpointChat},
	})

	req := httptest.NewRequest(http.MethodPost, "/admin/api/backends/"+strconv.FormatInt(backend.ID, 10)+"/console/pricing", nil)
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)
	if recorder.Code != http.StatusBadGateway {
		t.Fatalf("expected pricing status 502, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	var response struct {
		Error struct {
			Message string `json:"message"`
		} `json:"error"`
		Requests []struct {
			Method     string `json:"method"`
			Path       string `json:"path"`
			StatusCode int    `json:"status_code"`
			Body       string `json:"body"`
		} `json:"requests"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("unmarshal pricing error response: %v", err)
	}
	if response.Error.Message != "quota exhausted" {
		t.Fatalf("expected console error message, got %#v", response.Error)
	}
	if len(response.Requests) != 1 || response.Requests[0].Method != http.MethodGet || response.Requests[0].Path != "/api/pricing" || response.Requests[0].StatusCode != http.StatusPaymentRequired || !strings.Contains(response.Requests[0].Body, `"quota exhausted"`) {
		t.Fatalf("expected failed pricing request log, got %#v", response.Requests)
	}
}

func TestAdminBackendUpdateCanClearBackendType(t *testing.T) {
	application := newTestApp(t)
	backend := createTestBackend(t, application, domain.Backend{
		Name:        "clear-backend-type",
		Protocol:    domain.BackendProtocolOpenAI,
		BackendType: domain.BackendTypeNewAPI,
		BaseURL:     "https://clear-type.local/v1",
		APIKey:      "backend-key",
		Weight:      10,
		Models:      []string{"gpt-4o"},
		Endpoints:   []string{domain.EndpointChat},
	})

	body := `{
		"name":"clear-backend-type",
		"protocol":"openai",
		"backend_type":"",
		"base_url":"https://clear-type.local/v1",
		"api_key":"backend-key",
		"console_url":"",
		"tags":[],
		"console_username":"",
		"console_password":"",
		"console_cookie":"",
		"notes":"",
		"proxy_id":0,
		"status":"normal",
		"weight":10,
		"models":["gpt-4o"],
		"model_mapping":{},
		"endpoints":["chat"]
	}`
	req := httptest.NewRequest(http.MethodPut, "/admin/api/backends/"+strconv.FormatInt(backend.ID, 10), strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected update status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	var updated domain.Backend
	if err := json.Unmarshal(recorder.Body.Bytes(), &updated); err != nil {
		t.Fatalf("unmarshal updated backend: %v", err)
	}
	if updated.BackendType != "" {
		t.Fatalf("expected backend_type to be cleared, got %q", updated.BackendType)
	}
}

func TestBackendListIncludesHourlyCountersAndDetailMetadata(t *testing.T) {
	application := newTestApp(t)
	ctx := context.Background()

	backend := createTestBackend(t, application, domain.Backend{
		Name:            "relay-hourly",
		BaseURL:         "https://relay-hourly.local/v1",
		APIKey:          "hourly-key",
		BackendType:     domain.BackendTypeNewAPI,
		ConsoleURL:      "https://console.relay-hourly.local",
		ConsoleCookie:   "session=hourly-secret; theme=dark",
		Tags:            []string{"night"},
		ConsoleUsername: "console-user",
		ConsolePassword: "console-pass",
		ConsoleAccountJSON: `{
			"username": "console-user",
			"id": 1929,
			"quota": 248540,
			"used_quota": 3250000
		}`,
		ConsolePricingJSON: `{"data":{"gpt-4o":{"model_ratio":1}}}`,
		Notes:              "night shift",
		Weight:             1,
		Models:             []string{"gpt-4o"},
		Endpoints:          []string{domain.EndpointChat},
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
	if overview["backend_type"] != domain.BackendTypeNewAPI {
		t.Fatalf("expected backend type in overview, got %#v", overview)
	}
	if overview["console_username"] != "console-user" || overview["console_password"] != "set" {
		t.Fatalf("expected console credentials in overview, got %#v", overview)
	}
	if overview["console_cookie"] != "set" {
		t.Fatalf("expected console cookie presence in overview, got %#v", overview)
	}
	if overview["proxy"] != "direct" {
		t.Fatalf("expected proxy summary in overview, got %#v", overview)
	}
	if configuration["api_key"] != "set" {
		t.Fatalf("expected api key presence in configuration, got %#v", configuration)
	}
	if configuration["notes"] != "night shift" {
		t.Fatalf("expected notes in configuration, got %#v", configuration)
	}
	account, ok := configuration["console_account"].(map[string]any)
	if !ok || account["username"] != "console-user" || account["quota"] != float64(248540) {
		t.Fatalf("expected console account json in configuration, got %#v", configuration)
	}
	pricing, ok := configuration["console_pricing"].(map[string]any)
	if !ok {
		t.Fatalf("expected console pricing json in configuration, got %#v", configuration)
	}
	pricingData, ok := pricing["data"].(map[string]any)
	if !ok {
		t.Fatalf("expected console pricing data map, got %#v", pricing)
	}
	if _, ok := pricingData["gpt-4o"].(map[string]any); !ok {
		t.Fatalf("expected console pricing model plaza data, got %#v", pricing)
	}
	if detailPayload.Raw.ConsoleURL != "https://console.relay-hourly.local" || detailPayload.Raw.Notes != "night shift" {
		t.Fatalf("expected raw console metadata, got %#v", detailPayload.Raw)
	}
	if detailPayload.Raw.APIKey != "set" || detailPayload.Raw.ConsolePassword != "set" || detailPayload.Raw.ConsoleCookie != "set" {
		t.Fatalf("expected masked raw secrets, got %#v", detailPayload.Raw)
	}
}

func TestUsageLogsEmptyList(t *testing.T) {
	application := newTestApp(t)

	req := httptest.NewRequest(http.MethodGet, "/admin/api/usage-logs", nil)
	req.Header.Set("Authorization", "Bearer test-admin")
	recorder := httptest.NewRecorder()

	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	var payload struct {
		Items []domain.UsageLog `json:"items"`
		Total int               `json:"total"`
		Page  int               `json:"page"`
		Limit int               `json:"limit"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal usage logs list: %v", err)
	}
	if payload.Total != 0 || payload.Page != 1 || payload.Limit != 10 {
		t.Fatalf("unexpected empty pagination payload: %#v", payload)
	}
	if len(payload.Items) != 0 {
		t.Fatalf("expected empty usage log list, got %d items", len(payload.Items))
	}
}

func TestUsageLogListAndPagination(t *testing.T) {
	application := newTestApp(t)
	client := createTestClient(t, application, "client-secret")
	backend := createTestBackend(t, application, domain.Backend{
		Name:      "alpha",
		BaseURL:   "https://alpha.local/v1",
		APIKey:    "alpha-key",
		Weight:    1,
		Models:    []string{"gpt-4o"},
		Endpoints: []string{domain.EndpointChat},
	})

	fixture := newFailoverFixture(t, []domain.Backend{backend})
	fixture.responseBodyByName[backend.Name] = `{"backend":"alpha","usage":{"input_tokens":50,"output_tokens":10,"input_tokens_details":{"cached_tokens":20}}}`
	application.proxy = proxy.NewWithHTTPClient(&http.Client{Transport: fixture})

	req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions?trace=1", strings.NewReader(`{"model":"gpt-4o","messages":[{"role":"user","content":"hello"}]}`))
	req.Header.Set("Authorization", "Bearer "+client.Token)
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected proxy request to succeed, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	listReq := httptest.NewRequest(http.MethodGet, "/admin/api/usage-logs", nil)
	listReq.Header.Set("Authorization", "Bearer test-admin")
	listRecorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(listRecorder, listReq)
	if listRecorder.Code != http.StatusOK {
		t.Fatalf("expected usage log list status 200, got %d body=%s", listRecorder.Code, listRecorder.Body.String())
	}

	var payload struct {
		Items []domain.UsageLog `json:"items"`
		Total int               `json:"total"`
		Page  int               `json:"page"`
		Limit int               `json:"limit"`
	}
	if err := json.Unmarshal(listRecorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal usage log list: %v", err)
	}
	if payload.Total != 1 || payload.Page != 1 || payload.Limit != 10 {
		t.Fatalf("unexpected pagination payload: %#v", payload)
	}
	if len(payload.Items) != 1 {
		t.Fatalf("expected one usage log, got %d", len(payload.Items))
	}
	if payload.Items[0].ClientID != client.ID {
		t.Fatalf("unexpected client id in usage log: %#v", payload.Items[0])
	}
	if payload.Items[0].BackendID != backend.ID {
		t.Fatalf("unexpected backend id in usage log: %#v", payload.Items[0])
	}
	if payload.Items[0].RequestID == "" {
		t.Fatalf("expected request id to be recorded")
	}
	if payload.Items[0].InputTokens != 50 || payload.Items[0].OutputTokens != 10 || payload.Items[0].InputCacheTokens != 20 {
		t.Fatalf("unexpected usage log token usage: %#v", payload.Items[0])
	}

	pageReq := httptest.NewRequest(http.MethodGet, "/admin/api/usage-logs?page=1&limit=10", nil)
	pageReq.Header.Set("Authorization", "Bearer test-admin")
	pageRecorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(pageRecorder, pageReq)
	if pageRecorder.Code != http.StatusOK {
		t.Fatalf("expected paged usage log status 200, got %d body=%s", pageRecorder.Code, pageRecorder.Body.String())
	}
}

func TestUsageLogListFiltersByBackendModelAndClientKey(t *testing.T) {
	application := newTestApp(t)
	ctx := context.Background()

	if err := application.store.AppendUsageLog(ctx, domain.UsageLog{
		RequestID:         "req-1",
		ClientID:          1,
		ClientName:        "client-a",
		ClientTokenPrefix: "sk-a",
		Method:            http.MethodPost,
		Path:              "/v1/chat/completions",
		Endpoint:          domain.EndpointChat,
		Model:             "gpt-4o",
		BackendID:         11,
		BackendName:       "alpha",
		Attempts:          1,
		StatusCode:        http.StatusOK,
		DurationMS:        120,
		ClientIP:          "10.0.0.1:1234",
	}); err != nil {
		t.Fatalf("append usage log 1: %v", err)
	}
	if err := application.store.AppendUsageLog(ctx, domain.UsageLog{
		RequestID:         "req-2",
		ClientID:          2,
		ClientName:        "client-b",
		ClientTokenPrefix: "sk-b",
		Method:            http.MethodPost,
		Path:              "/v1/chat/completions",
		Endpoint:          domain.EndpointChat,
		Model:             "gpt-4.1",
		BackendID:         22,
		BackendName:       "beta",
		Attempts:          1,
		StatusCode:        http.StatusBadGateway,
		DurationMS:        90,
		ClientIP:          "10.0.0.2:2345",
		ErrorMessage:      "backend failed",
	}); err != nil {
		t.Fatalf("append usage log 2: %v", err)
	}

	assertUsageLogQuery := func(rawQuery string, wantTotal int, wantRequestIDs ...string) {
		t.Helper()

		req := httptest.NewRequest(http.MethodGet, "/admin/api/usage-logs?"+rawQuery, nil)
		req.Header.Set("Authorization", "Bearer test-admin")
		recorder := httptest.NewRecorder()
		application.Handler().ServeHTTP(recorder, req)

		if recorder.Code != http.StatusOK {
			t.Fatalf("expected status 200 for query %q, got %d body=%s", rawQuery, recorder.Code, recorder.Body.String())
		}

		var payload struct {
			Items []domain.UsageLog `json:"items"`
			Total int               `json:"total"`
		}
		if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
			t.Fatalf("unmarshal filtered usage log list: %v", err)
		}
		if payload.Total != wantTotal {
			t.Fatalf("unexpected total for query %q: got %d want %d", rawQuery, payload.Total, wantTotal)
		}
		if len(payload.Items) != len(wantRequestIDs) {
			t.Fatalf("unexpected item count for query %q: got %d want %d", rawQuery, len(payload.Items), len(wantRequestIDs))
		}
		for index, requestID := range wantRequestIDs {
			if payload.Items[index].RequestID != requestID {
				t.Fatalf("unexpected request id at %d for query %q: got %q want %q", index, rawQuery, payload.Items[index].RequestID, requestID)
			}
		}
	}

	assertUsageLogQuery("backend=alpha", 1, "req-1")
	assertUsageLogQuery("model=gpt-4.1", 1, "req-2")
	assertUsageLogQuery("client_key=client-a", 1, "req-1")
	assertUsageLogQuery("backend=beta&model=gpt-4.1&client_key=client-b", 1, "req-2")
	assertUsageLogQuery("backend=alpha&model=gpt-4.1", 0)
}

func TestUsageLogOptionsListConfiguredBackendsModelsAndClientKeys(t *testing.T) {
	application := newTestApp(t)
	ctx := context.Background()

	proxyItem, err := application.store.CreateSocksProxy(ctx, domain.SocksProxy{
		Name:     "tokyo",
		Address:  "127.0.0.1:1080",
		Username: "proxy-user",
		Password: "proxy-pass",
		Enabled:  true,
	})
	if err != nil {
		t.Fatalf("create socks proxy: %v", err)
	}
	if _, err := application.store.CreateClientKey(ctx, domain.ClientKey{
		Name:        "client-a",
		TokenHash:   store.HashToken("client-a-token"),
		Token:       "client-a-token",
		TokenPrefix: "cli-a",
		Enabled:     true,
	}); err != nil {
		t.Fatalf("create client key a: %v", err)
	}
	if _, err := application.store.CreateClientKey(ctx, domain.ClientKey{
		Name:        "client-b",
		TokenHash:   store.HashToken("client-b-token"),
		Token:       "client-b-token",
		TokenPrefix: "cli-b",
		Enabled:     true,
	}); err != nil {
		t.Fatalf("create client key b: %v", err)
	}
	if _, err := application.store.CreateBackend(ctx, domain.Backend{
		Name:         "alpha",
		BaseURL:      "https://alpha.local/v1",
		APIKey:       "alpha-key",
		ProxyID:      proxyItem.ID,
		Weight:       1,
		Models:       []string{"gpt-4o", "gpt-image-*"},
		ModelMapping: map[string]string{"gpt-5.4": "gpt-5.4-test"},
		Endpoints:    []string{domain.EndpointChat, domain.EndpointImages},
	}); err != nil {
		t.Fatalf("create backend alpha: %v", err)
	}
	if _, err := application.store.CreateBackend(ctx, domain.Backend{
		Name:      "beta",
		BaseURL:   "https://beta.local/v1",
		APIKey:    "beta-key",
		Weight:    1,
		Models:    []string{"gpt-4.1"},
		Endpoints: []string{domain.EndpointResponses},
	}); err != nil {
		t.Fatalf("create backend beta: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/admin/api/usage-log-options", nil)
	req.Header.Set("Authorization", "Bearer test-admin")
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected options status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	var payload struct {
		Backends   []string `json:"backends"`
		Models     []string `json:"models"`
		ClientKeys []string `json:"client_keys"`
		Proxies    []string `json:"proxies"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal usage log options: %v", err)
	}

	assertHas := func(items []string, want string) {
		t.Helper()
		for _, item := range items {
			if item == want {
				return
			}
		}
		t.Fatalf("expected %q in %#v", want, items)
	}
	assertHas(payload.Backends, "alpha")
	assertHas(payload.Backends, "beta")
	assertHas(payload.Models, "gpt-4o")
	assertHas(payload.Models, "gpt-image-*")
	assertHas(payload.Models, "gpt-4.1")
	assertHas(payload.Models, "gpt-5.4")
	assertHas(payload.ClientKeys, "client-a")
	assertHas(payload.ClientKeys, "client-b")
	assertHas(payload.Proxies, "tokyo")
}

func TestUsageLogDeleteFilteredAndClear(t *testing.T) {
	application := newTestApp(t)
	ctx := context.Background()

	if err := application.store.AppendUsageLog(ctx, domain.UsageLog{
		RequestID:         "req-1",
		ClientID:          1,
		ClientName:        "client-a",
		ClientTokenPrefix: "sk-a",
		Method:            http.MethodPost,
		Path:              "/v1/chat/completions",
		Endpoint:          domain.EndpointChat,
		Model:             "gpt-4o",
		BackendID:         11,
		BackendName:       "alpha",
		Attempts:          1,
		StatusCode:        http.StatusOK,
		DurationMS:        10,
	}); err != nil {
		t.Fatalf("append usage log 1: %v", err)
	}
	if err := application.store.AppendUsageLog(ctx, domain.UsageLog{
		RequestID:         "req-2",
		ClientID:          2,
		ClientName:        "client-b",
		ClientTokenPrefix: "sk-b",
		Method:            http.MethodPost,
		Path:              "/v1/responses",
		Endpoint:          domain.EndpointResponses,
		Model:             "gpt-4.1",
		BackendID:         22,
		BackendName:       "beta",
		Attempts:          2,
		StatusCode:        http.StatusBadGateway,
		DurationMS:        20,
		ErrorMessage:      "upstream error",
	}); err != nil {
		t.Fatalf("append usage log 2: %v", err)
	}

	deleteReq := httptest.NewRequest(http.MethodDelete, "/admin/api/usage-logs?backend=beta&model=gpt-4.1&client_key=client-b", nil)
	deleteReq.Header.Set("Authorization", "Bearer test-admin")
	deleteRecorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(deleteRecorder, deleteReq)
	if deleteRecorder.Code != http.StatusOK {
		t.Fatalf("expected delete status 200, got %d body=%s", deleteRecorder.Code, deleteRecorder.Body.String())
	}
	var deletePayload struct {
		Deleted int64 `json:"deleted"`
	}
	if err := json.Unmarshal(deleteRecorder.Body.Bytes(), &deletePayload); err != nil {
		t.Fatalf("unmarshal filtered delete response: %v", err)
	}
	if deletePayload.Deleted != 1 {
		t.Fatalf("expected filtered delete to remove 1 usage log, got %d", deletePayload.Deleted)
	}

	logs, err := application.store.ListUsageLogsPage(ctx, 10, 0)
	if err != nil {
		t.Fatalf("list usage logs after filtered delete: %v", err)
	}
	if len(logs) != 1 {
		t.Fatalf("expected one usage log after filtered delete, got %d", len(logs))
	}
	if logs[0].RequestID != "req-1" {
		t.Fatalf("unexpected remaining usage log after filtered delete: %#v", logs[0])
	}

	clearReq := httptest.NewRequest(http.MethodDelete, "/admin/api/usage-logs", nil)
	clearReq.Header.Set("Authorization", "Bearer test-admin")
	clearRecorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(clearRecorder, clearReq)
	if clearRecorder.Code != http.StatusOK {
		t.Fatalf("expected clear status 200, got %d body=%s", clearRecorder.Code, clearRecorder.Body.String())
	}
	var clearPayload struct {
		Deleted int64 `json:"deleted"`
	}
	if err := json.Unmarshal(clearRecorder.Body.Bytes(), &clearPayload); err != nil {
		t.Fatalf("unmarshal clear response: %v", err)
	}
	if clearPayload.Deleted != 1 {
		t.Fatalf("expected clear to remove remaining usage log, got %d", clearPayload.Deleted)
	}

	total, err := application.store.CountUsageLogs(ctx)
	if err != nil {
		t.Fatalf("count usage logs after clear: %v", err)
	}
	if total != 0 {
		t.Fatalf("expected usage logs to be empty after clear, got %d", total)
	}
}

func TestUsageLogPersistsAfterClientWriteFailure(t *testing.T) {
	application := newTestApp(t)
	client := createTestClient(t, application, "client-secret")
	backend := createTestBackend(t, application, domain.Backend{
		Name:      "alpha",
		BaseURL:   "https://alpha.local/v1",
		APIKey:    "alpha-key",
		Weight:    1,
		Models:    []string{"gpt-4o"},
		Endpoints: []string{domain.EndpointChat},
	})

	fixture := newFailoverFixture(t, []domain.Backend{backend})
	application.proxy = proxy.NewWithHTTPClient(&http.Client{Transport: fixture})

	req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(`{"model":"gpt-4o","messages":[{"role":"user","content":"hello"}]}`))
	req.Header.Set("Authorization", "Bearer "+client.Token)
	writer := &failingResponseWriter{header: make(http.Header)}
	application.Handler().ServeHTTP(writer, req)

	logs, err := application.store.ListUsageLogsPage(context.Background(), 10, 0)
	if err != nil {
		t.Fatalf("list usage logs: %v", err)
	}
	if len(logs) != 1 {
		t.Fatalf("expected one usage log after client write failure, got %d", len(logs))
	}
	if logs[0].BackendID != backend.ID {
		t.Fatalf("unexpected backend id in usage log: %#v", logs[0])
	}
}

func TestProxyStopsFailoverWhenClientContextIsCanceled(t *testing.T) {
	const requestBody = `{"model":"claude-opus-4-8","max_tokens":16,"messages":[{"role":"user","content":"hello"}]}`

	application := newTestApp(t)
	client := createTestClient(t, application, "cancel-client")
	backends := []domain.Backend{
		createTestBackend(t, application, domain.Backend{
			Name:      "alpha",
			Protocol:  domain.BackendProtocolAnthropic,
			BaseURL:   "https://alpha.local/v1",
			APIKey:    "alpha-key",
			Weight:    2,
			Models:    []string{"claude-opus-4-8"},
			Endpoints: []string{domain.EndpointMessages},
		}),
		createTestBackend(t, application, domain.Backend{
			Name:      "beta",
			Protocol:  domain.BackendProtocolAnthropic,
			BaseURL:   "https://beta.local/v1",
			APIKey:    "beta-key",
			Weight:    1,
			Models:    []string{"claude-opus-4-8"},
			Endpoints: []string{domain.EndpointMessages},
		}),
	}

	fixture := newFailoverFixture(t, backends)
	fixture.responseBodyByName[backends[0].Name] = `{"id":"msg_1","type":"message","role":"assistant","model":"claude-opus-4-8","content":[{"type":"text","text":"hello from alpha"}],"usage":{"input_tokens":10,"output_tokens":2},"stop_reason":"end_turn"}`
	fixture.cancelResponseReadByName[backends[0].Name] = true
	application.proxy = proxy.NewWithHTTPClient(&http.Client{Transport: fixture})

	req := httptest.NewRequest(http.MethodPost, "/v1/messages?beta=true", strings.NewReader(requestBody))
	req.Header.Set("X-Api-Key", client.Token)
	req.Header.Set("Anthropic-Version", "2023-06-01")
	ctx, cancel := context.WithCancel(req.Context())
	ctx = context.WithValue(ctx, cancelRequestContextKey{}, cancel)
	req = req.WithContext(ctx)
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != 499 {
		t.Fatalf("expected canceled request status 499, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	records := fixture.recordsSnapshot()
	if len(records) != 1 {
		t.Fatalf("expected only one upstream attempt after cancellation, got %d: %#v", len(records), records)
	}
	if records[0].backendName != backends[0].Name {
		t.Fatalf("expected only backend %q to be attempted, got %#v", backends[0].Name, records)
	}

	logs, err := application.store.ListUsageLogsPage(context.Background(), 10, 0)
	if err != nil {
		t.Fatalf("list usage logs: %v", err)
	}
	if len(logs) != 1 {
		t.Fatalf("expected one final usage log after cancellation, got %d", len(logs))
	}
	if logs[0].StatusCode != 499 || logs[0].StatusFamily != "4xx" {
		t.Fatalf("expected canceled usage log status 499/4xx, got %#v", logs[0])
	}
	if !strings.Contains(logs[0].ErrorMessage, context.Canceled.Error()) {
		t.Fatalf("expected canceled usage log error, got %#v", logs[0])
	}

	alpha, err := application.store.GetBackend(context.Background(), backends[0].ID)
	if err != nil {
		t.Fatalf("get alpha backend: %v", err)
	}
	if alpha.ConsecutiveFailures != 0 || alpha.Status != domain.BackendStatusNormal {
		t.Fatalf("expected cancellation to preserve alpha backend health, got %#v", alpha)
	}
	beta, err := application.store.GetBackend(context.Background(), backends[1].ID)
	if err != nil {
		t.Fatalf("get beta backend: %v", err)
	}
	if beta.ConsecutiveFailures != 0 || beta.Status != domain.BackendStatusNormal {
		t.Fatalf("expected cancellation to preserve beta backend health, got %#v", beta)
	}
}

func TestUsageLogsRejectInvalidStatusFilter(t *testing.T) {
	application := newTestApp(t)
	ctx := context.Background()

	if err := application.store.AppendUsageLog(ctx, domain.UsageLog{
		RequestID:         "invalid-status-1",
		ClientID:          1,
		ClientName:        "client-a",
		ClientTokenPrefix: "sk-a",
		Method:            http.MethodPost,
		Path:              "/v1/chat/completions",
		Endpoint:          domain.EndpointChat,
		Model:             "gpt-4o",
		BackendID:         11,
		BackendName:       "alpha",
		Attempts:          1,
		StatusCode:        http.StatusTooManyRequests,
		DurationMS:        120,
		TraceID:           "trace-invalid-status",
	}); err != nil {
		t.Fatalf("append usage log: %v", err)
	}

	for _, tc := range []struct {
		method string
		path   string
	}{
		{method: http.MethodGet, path: "/admin/api/usage-logs?status=warning"},
		{method: http.MethodGet, path: "/admin/api/usage-logs/stats?status=warning"},
		{method: http.MethodDelete, path: "/admin/api/usage-logs?status=warning"},
	} {
		req := httptest.NewRequest(tc.method, tc.path, nil)
		req.Header.Set("Authorization", "Bearer test-admin")
		recorder := httptest.NewRecorder()
		application.Handler().ServeHTTP(recorder, req)
		if recorder.Code != http.StatusBadRequest {
			t.Fatalf("%s %s expected status 400, got %d body=%s", tc.method, tc.path, recorder.Code, recorder.Body.String())
		}
		if !strings.Contains(recorder.Body.String(), "invalid usage log status filter") {
			t.Fatalf("%s %s expected invalid status error, got %s", tc.method, tc.path, recorder.Body.String())
		}
	}

	total, err := application.store.CountUsageLogs(ctx)
	if err != nil {
		t.Fatalf("count usage logs: %v", err)
	}
	if total != 1 {
		t.Fatalf("expected invalid delete filter to preserve usage logs, got %d entries", total)
	}
}

func TestUsageLogStatsReturnsFilteredMetrics(t *testing.T) {
	application := newTestApp(t)
	ctx := context.Background()

	for _, entry := range []domain.UsageLog{
		{
			RequestID:         "stats-1",
			ClientID:          1,
			ClientName:        "client-a",
			ClientTokenPrefix: "sk-a",
			Method:            http.MethodPost,
			Path:              "/v1/chat/completions",
			Endpoint:          domain.EndpointChat,
			Model:             "gpt-4o",
			BackendID:         11,
			BackendName:       "alpha",
			Attempts:          1,
			StatusCode:        http.StatusOK,
			DurationMS:        100,
		},
		{
			RequestID:         "stats-2",
			ClientID:          2,
			ClientName:        "client-b",
			ClientTokenPrefix: "sk-b",
			Method:            http.MethodPost,
			Path:              "/v1/responses",
			Endpoint:          domain.EndpointResponses,
			Model:             "gpt-4.1",
			BackendID:         22,
			BackendName:       "beta",
			Attempts:          1,
			StatusCode:        http.StatusBadGateway,
			DurationMS:        300,
			ErrorMessage:      "upstream failed",
		},
	} {
		if err := application.store.AppendUsageLog(ctx, entry); err != nil {
			t.Fatalf("append usage log %q: %v", entry.RequestID, err)
		}
	}

	req := httptest.NewRequest(http.MethodGet, "/admin/api/usage-logs/stats?backend=alpha&status=2xx", nil)
	req.Header.Set("Authorization", "Bearer test-admin")
	recorder := httptest.NewRecorder()

	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	var payload struct {
		Totals struct {
			Requests  int `json:"requests"`
			Successes int `json:"successes"`
			Failures  int `json:"failures"`
		} `json:"totals"`
		Latency struct {
			AvgMS float64 `json:"avg_ms"`
		} `json:"latency"`
		StatusFamilies []struct {
			Family string `json:"family"`
			Count  int    `json:"count"`
		} `json:"status_families"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal usage log stats: %v", err)
	}
	if payload.Totals.Requests != 1 || payload.Totals.Successes != 1 || payload.Totals.Failures != 0 {
		t.Fatalf("unexpected totals: %#v", payload.Totals)
	}
	if payload.Latency.AvgMS != 100 {
		t.Fatalf("expected avg latency 100, got %#v", payload.Latency)
	}
	if len(payload.StatusFamilies) == 0 || payload.StatusFamilies[0].Family != "2xx" || payload.StatusFamilies[0].Count != 1 {
		t.Fatalf("unexpected status family summary: %#v", payload.StatusFamilies)
	}
}

func TestBackendHourlyModelStatsEndpointReturnsRowsAndScope(t *testing.T) {
	application := newTestApp(t)
	ctx := context.Background()

	for _, entry := range []domain.UsageLog{
		{
			RequestID:        "api-1",
			BackendID:        11,
			BackendName:      "alpha",
			Model:            "gpt-4o",
			StatusCode:       200,
			DurationMS:       100,
			RequestBytes:     10,
			ResponseBytes:    20,
			InputTokens:      100,
			OutputTokens:     25,
			InputCacheTokens: 40,
			CreatedAt:        time.Date(2026, 6, 26, 7, 15, 0, 0, time.UTC),
		},
		{
			RequestID:        "api-2",
			BackendID:        22,
			BackendName:      "beta",
			Model:            "gpt-4.1",
			StatusCode:       502,
			InputTokens:      999,
			OutputTokens:     999,
			InputCacheTokens: 999,
			CreatedAt:        time.Date(2026, 6, 26, 8, 15, 0, 0, time.UTC),
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
			Backend   *string `json:"backend"`
			Model     *string `json:"model"`
			StartHour *string `json:"start_hour"`
			EndHour   *string `json:"end_hour"`
		} `json:"query"`
		Scope struct {
			Backends []struct {
				ID   int64  `json:"id"`
				Name string `json:"name"`
			} `json:"backends"`
			Models    []string `json:"models"`
			TimeRange struct {
				StartHour *string `json:"start_hour"`
				EndHour   *string `json:"end_hour"`
				Timezone  string  `json:"timezone"`
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
			InputTokens          int64   `json:"input_tokens"`
			OutputTokens         int64   `json:"output_tokens"`
			InputCacheTokens     int64   `json:"input_cache_tokens"`
			SuccessAvgDurationMS float64 `json:"success_avg_duration_ms"`
			SuccessRequestBytes  int64   `json:"success_request_bytes"`
			SuccessResponseBytes int64   `json:"success_response_bytes"`
		} `json:"items"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal payload: %v", err)
	}
	if payload.Query.StartHour == nil || *payload.Query.StartHour != "2026-06-26T07:00:00Z" {
		t.Fatalf("unexpected query start hour: %#v", payload.Query)
	}
	if payload.Query.EndHour == nil || *payload.Query.EndHour != "2026-06-26T08:00:00Z" {
		t.Fatalf("unexpected query end hour: %#v", payload.Query)
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
	if payload.Items[0].InputTokens != 100 || payload.Items[0].OutputTokens != 25 || payload.Items[0].InputCacheTokens != 40 {
		t.Fatalf("unexpected first hourly token payload: %#v", payload.Items[0])
	}
	if payload.Items[1].InputTokens != 0 || payload.Items[1].OutputTokens != 0 || payload.Items[1].InputCacheTokens != 0 {
		t.Fatalf("expected failed hourly row to have zero token sums: %#v", payload.Items[1])
	}
}

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

func TestUsageLogsQueryMatchesTraceIDAndPath(t *testing.T) {
	application := newTestApp(t)
	ctx := context.Background()

	for _, entry := range []domain.UsageLog{
		{
			RequestID:         "query-1",
			ClientID:          1,
			ClientName:        "client-a",
			ClientTokenPrefix: "sk-a",
			Method:            http.MethodPost,
			Path:              "/v1/responses",
			Endpoint:          domain.EndpointResponses,
			Model:             "gpt-4o",
			BackendID:         11,
			BackendName:       "alpha",
			Attempts:          1,
			StatusCode:        http.StatusOK,
			DurationMS:        100,
			TraceID:           "trace-needle",
		},
		{
			RequestID:         "query-2",
			ClientID:          2,
			ClientName:        "client-b",
			ClientTokenPrefix: "sk-b",
			Method:            http.MethodPost,
			Path:              "/v1/chat/completions",
			Endpoint:          domain.EndpointChat,
			Model:             "gpt-4.1",
			BackendID:         22,
			BackendName:       "beta",
			Attempts:          1,
			StatusCode:        http.StatusBadGateway,
			DurationMS:        300,
			TraceID:           "trace-other",
		},
	} {
		if err := application.store.AppendUsageLog(ctx, entry); err != nil {
			t.Fatalf("append usage log %q: %v", entry.RequestID, err)
		}
	}

	for _, tc := range []struct {
		name      string
		query     string
		requestID string
	}{
		{name: "trace-id", query: "trace-needle", requestID: "query-1"},
		{name: "path", query: "/v1/chat/completions", requestID: "query-2"},
	} {
		req := httptest.NewRequest(http.MethodGet, "/admin/api/usage-logs?q="+url.QueryEscape(tc.query), nil)
		req.Header.Set("Authorization", "Bearer test-admin")
		recorder := httptest.NewRecorder()
		application.Handler().ServeHTTP(recorder, req)
		if recorder.Code != http.StatusOK {
			t.Fatalf("%s expected status 200, got %d body=%s", tc.name, recorder.Code, recorder.Body.String())
		}

		var payload struct {
			Items []domain.UsageLog `json:"items"`
			Total int               `json:"total"`
		}
		if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
			t.Fatalf("%s unmarshal usage logs: %v", tc.name, err)
		}
		if payload.Total != 1 || len(payload.Items) != 1 {
			t.Fatalf("%s expected exactly one usage log, got total=%d items=%d", tc.name, payload.Total, len(payload.Items))
		}
		if payload.Items[0].RequestID != tc.requestID {
			t.Fatalf("%s expected request %q, got %#v", tc.name, tc.requestID, payload.Items[0])
		}
	}
}

func TestUsageLogDetailReturnsPreviewData(t *testing.T) {
	application := newTestApp(t)
	client := createTestClient(t, application, "detail-client-secret")
	backend := createTestBackend(t, application, domain.Backend{
		Name:      "alpha",
		BaseURL:   "https://alpha.local/v1",
		APIKey:    "alpha-key",
		Weight:    1,
		Models:    []string{"gpt-4o"},
		Endpoints: []string{domain.EndpointResponses},
	})

	fixture := newFailoverFixture(t, []domain.Backend{backend})
	fixture.responseBodyByName[backend.Name] = `{"id":"resp_1","object":"response","model":"gpt-4o","output":[{"type":"message","role":"assistant","content":[{"type":"output_text","text":"hello from alpha"}]}],"usage":{"input_tokens":123,"output_tokens":45,"input_tokens_details":{"cached_tokens":67}}}`
	application.proxy = proxy.NewWithHTTPClient(&http.Client{Transport: fixture})

	req := httptest.NewRequest(http.MethodPost, "/v1/responses", strings.NewReader(`{"model":"gpt-4o","input":"hello detail"}`))
	req.Header.Set("Authorization", "Bearer "+client.Token)
	req.Header.Set("X-Request-ID", "trace-detail-1")
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected proxy request to succeed, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	logs, err := application.store.ListUsageLogsPage(context.Background(), 10, 0)
	if err != nil {
		t.Fatalf("list usage logs: %v", err)
	}
	if len(logs) != 1 {
		t.Fatalf("expected one usage log, got %d", len(logs))
	}

	detailReq := httptest.NewRequest(http.MethodGet, "/admin/api/usage-logs/"+strconv.FormatInt(logs[0].ID, 10), nil)
	detailReq.Header.Set("Authorization", "Bearer test-admin")
	detailRecorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(detailRecorder, detailReq)

	if detailRecorder.Code != http.StatusOK {
		t.Fatalf("expected detail status 200, got %d body=%s", detailRecorder.Code, detailRecorder.Body.String())
	}

	var payload struct {
		Overview struct {
			RequestID        string `json:"request_id"`
			StatusCode       int    `json:"status_code"`
			InputTokens      int64  `json:"input_tokens"`
			OutputTokens     int64  `json:"output_tokens"`
			InputCacheTokens int64  `json:"input_cache_tokens"`
		} `json:"overview"`
		Metadata struct {
			ID      int64  `json:"id"`
			TraceID string `json:"trace_id"`
		} `json:"metadata"`
		Request struct {
			Method      string `json:"method"`
			Path        string `json:"path"`
			Query       string `json:"query"`
			Bytes       int64  `json:"bytes"`
			BodyPreview string `json:"body_preview"`
		} `json:"request"`
		Response struct {
			Bytes        int64  `json:"bytes"`
			BodyPreview  string `json:"body_preview"`
			StatusFamily string `json:"status_family"`
		} `json:"response"`
		Raw domain.UsageLog `json:"raw"`
	}
	if err := json.Unmarshal(detailRecorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal usage log detail: %v", err)
	}
	if payload.Metadata.ID != logs[0].ID || payload.Raw.ID != logs[0].ID {
		t.Fatalf("unexpected usage log ids: metadata=%#v raw=%#v", payload.Metadata, payload.Raw)
	}
	if payload.Metadata.TraceID != "trace-detail-1" {
		t.Fatalf("expected trace id trace-detail-1, got %#v", payload.Metadata)
	}
	if payload.Overview.RequestID == "" || payload.Overview.StatusCode != http.StatusOK {
		t.Fatalf("unexpected overview payload: %#v", payload.Overview)
	}
	if payload.Overview.InputTokens != 123 || payload.Overview.OutputTokens != 45 || payload.Overview.InputCacheTokens != 67 {
		t.Fatalf("unexpected overview token payload: %#v", payload.Overview)
	}
	if payload.Request.Bytes <= 0 || !strings.Contains(payload.Request.BodyPreview, "hello detail") {
		t.Fatalf("unexpected request preview payload: %#v", payload.Request)
	}
	if payload.Request.Method != http.MethodPost || payload.Request.Path != "/v1/responses" || payload.Request.Query != "" {
		t.Fatalf("unexpected request metadata payload: %#v", payload.Request)
	}
	if payload.Response.Bytes <= 0 || payload.Response.StatusFamily != "2xx" || !strings.Contains(payload.Response.BodyPreview, "hello from alpha") {
		t.Fatalf("unexpected response preview payload: %#v", payload.Response)
	}
	if payload.Raw.InputTokens != 123 || payload.Raw.OutputTokens != 45 || payload.Raw.InputCacheTokens != 67 {
		t.Fatalf("unexpected raw token payload: %#v", payload.Raw)
	}
}

func TestEventSummaryReturnsCategoryCounts(t *testing.T) {
	application := newTestApp(t)
	ctx := context.Background()

	for _, event := range []domain.AuditEvent{
		{Level: "warn", Type: "backend", Message: "alpha failed", ClientName: "ops"},
		{Level: "info", Type: "backend", Message: "alpha recovered", ClientName: "ops"},
		{Level: "warn", Type: "client_key", Message: "client key changed", ClientName: "admin"},
	} {
		if err := application.store.AppendAuditEvent(ctx, event); err != nil {
			t.Fatalf("append audit event: %v", err)
		}
	}

	req := httptest.NewRequest(http.MethodGet, "/admin/api/events/summary", nil)
	req.Header.Set("Authorization", "Bearer test-admin")
	recorder := httptest.NewRecorder()

	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	var payload struct {
		Total      int `json:"total"`
		Categories []struct {
			Category string `json:"category"`
			Count    int    `json:"count"`
		} `json:"categories"`
		Severities []struct {
			Severity string `json:"severity"`
			Count    int    `json:"count"`
		} `json:"severities"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal event summary: %v", err)
	}
	if payload.Total != 3 {
		t.Fatalf("expected total=3, got %#v", payload)
	}

	categoryCounts := make(map[string]int)
	for _, item := range payload.Categories {
		categoryCounts[item.Category] = item.Count
	}
	if categoryCounts["backend"] != 2 || categoryCounts["client_key"] != 1 {
		t.Fatalf("unexpected category counts: %#v", payload.Categories)
	}

	severityCounts := make(map[string]int)
	for _, item := range payload.Severities {
		severityCounts[item.Severity] = item.Count
	}
	if severityCounts["warning"] != 2 || severityCounts["info"] != 1 {
		t.Fatalf("unexpected severity counts: %#v", payload.Severities)
	}
}

func TestEventsFilterByCategoryAndDateRange(t *testing.T) {
	application := newTestApp(t)
	ctx := context.Background()

	for _, event := range []domain.AuditEvent{
		{Level: "warn", Type: "backend", Message: "backend event"},
		{Level: "info", Type: "client_key", Message: "client key event"},
	} {
		if err := application.store.AppendAuditEvent(ctx, event); err != nil {
			t.Fatalf("append audit event: %v", err)
		}
	}

	dateFrom := url.QueryEscape(time.Now().UTC().Add(-1 * time.Hour).Format(time.RFC3339))
	dateTo := url.QueryEscape(time.Now().UTC().Add(1 * time.Hour).Format(time.RFC3339))

	req := httptest.NewRequest(http.MethodGet, "/admin/api/events?category=backend&date_from="+dateFrom+"&date_to="+dateTo, nil)
	req.Header.Set("Authorization", "Bearer test-admin")
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	var payload struct {
		Items []domain.AuditEvent `json:"items"`
		Total int                 `json:"total"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal filtered events: %v", err)
	}
	if payload.Total != 1 || len(payload.Items) != 1 || payload.Items[0].Type != "backend" {
		t.Fatalf("unexpected filtered event payload: %#v", payload)
	}

	emptyReq := httptest.NewRequest(http.MethodGet, "/admin/api/events?category=backend&date_from="+url.QueryEscape(time.Now().UTC().Add(1*time.Hour).Format(time.RFC3339)), nil)
	emptyReq.Header.Set("Authorization", "Bearer test-admin")
	emptyRecorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(emptyRecorder, emptyReq)
	if emptyRecorder.Code != http.StatusOK {
		t.Fatalf("expected empty filter status 200, got %d body=%s", emptyRecorder.Code, emptyRecorder.Body.String())
	}
	if err := json.Unmarshal(emptyRecorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal empty filtered events: %v", err)
	}
	if payload.Total != 0 || len(payload.Items) != 0 {
		t.Fatalf("expected empty filtered events, got %#v", payload)
	}
}

func TestClearEventsDeletesAllAuditEvents(t *testing.T) {
	application := newTestApp(t)
	ctx := context.Background()

	for _, event := range []domain.AuditEvent{
		{Level: "warn", Type: "backend", Message: "backend event"},
		{Level: "info", Type: "client_key", Message: "client key event"},
	} {
		if err := application.store.AppendAuditEvent(ctx, event); err != nil {
			t.Fatalf("append audit event: %v", err)
		}
	}

	req := httptest.NewRequest(http.MethodDelete, "/admin/api/events", nil)
	req.Header.Set("Authorization", "Bearer test-admin")
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	var payload struct {
		Cleared bool  `json:"cleared"`
		Deleted int64 `json:"deleted"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal clear events response: %v", err)
	}
	if !payload.Cleared || payload.Deleted != 2 {
		t.Fatalf("unexpected clear events payload: %#v", payload)
	}

	remaining, err := application.store.CountAuditEvents(ctx)
	if err != nil {
		t.Fatalf("count audit events after clear: %v", err)
	}
	if remaining != 0 {
		t.Fatalf("expected no audit events after clear, got %d", remaining)
	}
}

func TestEventDetailReturnsDrawerPayload(t *testing.T) {
	application := newTestApp(t)
	ctx := context.Background()

	event := domain.AuditEvent{
		Level:        "warn",
		Type:         "backend.failover",
		Category:     "backend",
		Severity:     "warning",
		Actor:        "system",
		ResourceType: "backend",
		ResourceID:   42,
		Message:      "switched to backup backend",
		ClientName:   "web-prod",
		Model:        "gpt-4o",
		Endpoint:     domain.EndpointResponses,
		BackendName:  "alpha",
	}
	if err := application.store.AppendAuditEvent(ctx, event); err != nil {
		t.Fatalf("append audit event: %v", err)
	}

	events, err := application.store.ListAuditEvents(ctx, 10)
	if err != nil {
		t.Fatalf("list audit events: %v", err)
	}
	if len(events) != 1 {
		t.Fatalf("expected one event, got %d", len(events))
	}

	req := httptest.NewRequest(http.MethodGet, "/admin/api/events/"+strconv.FormatInt(events[0].ID, 10), nil)
	req.Header.Set("Authorization", "Bearer test-admin")
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	var payload struct {
		Overview map[string]any    `json:"overview"`
		Metadata map[string]any    `json:"metadata"`
		Raw      domain.AuditEvent `json:"raw"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal event detail: %v", err)
	}
	if payload.Raw.ID != events[0].ID || payload.Raw.Type != "backend.failover" {
		t.Fatalf("unexpected raw event payload: %#v", payload.Raw)
	}
	if payload.Overview["message"] != "switched to backup backend" {
		t.Fatalf("unexpected overview payload: %#v", payload.Overview)
	}
	if payload.Metadata["resource_type"] != "backend" {
		t.Fatalf("unexpected metadata payload: %#v", payload.Metadata)
	}
}

func TestDashboardSummaryReturnsCountsAndSeries(t *testing.T) {
	application := newTestApp(t)
	ctx := context.Background()

	proxyItem, err := application.store.CreateSocksProxy(ctx, domain.SocksProxy{
		Name:     "alpha-proxy",
		Address:  "127.0.0.1:1080",
		Username: "proxy-user",
		Password: "proxy-pass",
		Enabled:  true,
	})
	if err != nil {
		t.Fatalf("create proxy: %v", err)
	}
	backend := createTestBackend(t, application, domain.Backend{
		Name:      "alpha",
		BaseURL:   "https://alpha.local/v1",
		APIKey:    "alpha-key",
		ProxyID:   proxyItem.ID,
		Weight:    1,
		Models:    []string{"gpt-4o"},
		Endpoints: []string{domain.EndpointChat},
	})
	createTestClient(t, application, "alpha-client-token")
	if err := application.store.AppendUsageLog(ctx, domain.UsageLog{
		RequestID:         "dash-1",
		ClientID:          1,
		ClientName:        "alpha-client",
		ClientTokenPrefix: tokenPrefix("alpha-client-token"),
		Method:            http.MethodPost,
		Path:              "/v1/chat/completions",
		Endpoint:          domain.EndpointChat,
		Model:             "gpt-4o",
		BackendID:         backend.ID,
		BackendName:       backend.Name,
		Attempts:          1,
		StatusCode:        http.StatusOK,
		DurationMS:        120,
	}); err != nil {
		t.Fatalf("append usage log: %v", err)
	}
	if err := application.store.AppendAuditEvent(ctx, domain.AuditEvent{
		Level:       "info",
		Type:        "backend.updated",
		Message:     "backend alpha updated",
		BackendName: "alpha",
	}); err != nil {
		t.Fatalf("append audit event: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/admin/api/dashboard/summary", nil)
	req.Header.Set("Authorization", "Bearer test-admin")
	recorder := httptest.NewRecorder()

	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	var payload struct {
		Counts struct {
			Backends     int `json:"backends"`
			ClientKeys   int `json:"client_keys"`
			SocksProxies int `json:"socks_proxies"`
		} `json:"counts"`
		Growth struct {
			Requests float64 `json:"requests"`
			Errors   float64 `json:"errors"`
		} `json:"growth"`
		Status struct {
			HealthyBackends int `json:"healthy_backends"`
			RecentErrors    int `json:"recent_errors"`
			ActiveClients   int `json:"active_clients"`
		} `json:"status"`
		Sparkline []struct {
			Label    string `json:"label"`
			Requests int    `json:"requests"`
		} `json:"sparkline"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal dashboard summary: %v", err)
	}
	if payload.Counts.Backends != 1 || payload.Counts.ClientKeys != 1 || payload.Counts.SocksProxies != 1 {
		t.Fatalf("unexpected counts payload: %#v", payload.Counts)
	}
	if payload.Status.HealthyBackends != 1 || payload.Status.ActiveClients != 1 {
		t.Fatalf("unexpected status payload: %#v", payload.Status)
	}
	if len(payload.Sparkline) != 7 {
		t.Fatalf("expected 7 sparkline points, got %d", len(payload.Sparkline))
	}
	if payload.Sparkline[len(payload.Sparkline)-1].Requests < 1 {
		t.Fatalf("expected latest sparkline bucket to include requests, got %#v", payload.Sparkline)
	}
}

func TestDashboardUsageReturnsSeries(t *testing.T) {
	application := newTestApp(t)
	ctx := context.Background()

	backend := createTestBackend(t, application, domain.Backend{
		Name:      "usage-backend",
		BaseURL:   "https://usage.local/v1",
		APIKey:    "usage-key",
		Weight:    1,
		Models:    []string{"gpt-4o"},
		Endpoints: []string{domain.EndpointChat},
	})
	if err := application.store.AppendUsageLog(ctx, domain.UsageLog{
		RequestID:         "usage-1",
		ClientID:          1,
		ClientName:        "alpha-client",
		ClientTokenPrefix: "alpha",
		Method:            http.MethodPost,
		Path:              "/v1/chat/completions",
		Endpoint:          domain.EndpointChat,
		Model:             "gpt-4o",
		BackendID:         backend.ID,
		BackendName:       backend.Name,
		Attempts:          1,
		StatusCode:        http.StatusOK,
		DurationMS:        256,
		RequestBytes:      120,
		ResponseBytes:     880,
	}); err != nil {
		t.Fatalf("append usage log 1: %v", err)
	}
	if err := application.store.AppendUsageLog(ctx, domain.UsageLog{
		RequestID:         "usage-2",
		ClientID:          2,
		ClientName:        "beta-client",
		ClientTokenPrefix: "beta",
		Method:            http.MethodPost,
		Path:              "/v1/chat/completions",
		Endpoint:          domain.EndpointChat,
		Model:             "gpt-4o",
		BackendID:         backend.ID,
		BackendName:       backend.Name,
		Attempts:          1,
		StatusCode:        http.StatusBadGateway,
		DurationMS:        512,
		RequestBytes:      64,
		ResponseBytes:     256,
		ErrorMessage:      "upstream failed",
	}); err != nil {
		t.Fatalf("append usage log 2: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/admin/api/dashboard/usage?range=7d", nil)
	req.Header.Set("Authorization", "Bearer test-admin")
	recorder := httptest.NewRecorder()

	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	var payload struct {
		Range  string `json:"range"`
		Series []struct {
			Label        string  `json:"label"`
			Requests     int     `json:"requests"`
			TrafficBytes int64   `json:"traffic_bytes"`
			ErrorRate    float64 `json:"error_rate"`
		} `json:"series"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal dashboard usage: %v", err)
	}
	if payload.Range != "7d" {
		t.Fatalf("expected range 7d, got %q", payload.Range)
	}
	if len(payload.Series) != 7 {
		t.Fatalf("expected 7 series points, got %d", len(payload.Series))
	}
	latest := payload.Series[len(payload.Series)-1]
	if latest.Requests != 2 {
		t.Fatalf("expected latest requests=2, got %#v", latest)
	}
	if latest.TrafficBytes != 1320 {
		t.Fatalf("expected latest traffic_bytes=1320, got %#v", latest)
	}
	if latest.ErrorRate <= 0 {
		t.Fatalf("expected latest error rate > 0, got %#v", latest)
	}
}

func TestDashboardUsageSupportsThirtyDayRange(t *testing.T) {
	application := newTestApp(t)

	req := httptest.NewRequest(http.MethodGet, "/admin/api/dashboard/usage?range=30d", nil)
	req.Header.Set("Authorization", "Bearer test-admin")
	recorder := httptest.NewRecorder()

	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	var payload struct {
		Range  string `json:"range"`
		Series []struct {
			Label    string `json:"label"`
			Requests int    `json:"requests"`
		} `json:"series"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal dashboard usage: %v", err)
	}
	if payload.Range != "30d" {
		t.Fatalf("expected range 30d, got %q", payload.Range)
	}
	if len(payload.Series) != 30 {
		t.Fatalf("expected 30 series points, got %d", len(payload.Series))
	}
}

func TestDashboardActivityReturnsRecentLists(t *testing.T) {
	application := newTestApp(t)
	ctx := context.Background()

	if err := application.store.AppendAuditEvent(ctx, domain.AuditEvent{
		Level:       "warn",
		Type:        "backend.abnormal",
		Message:     "backend marked abnormal",
		BackendName: "alpha",
	}); err != nil {
		t.Fatalf("append audit event: %v", err)
	}
	if err := application.store.AppendUsageLog(ctx, domain.UsageLog{
		RequestID:         "activity-1",
		ClientID:          1,
		ClientName:        "alpha-client",
		ClientTokenPrefix: "alpha",
		Method:            http.MethodPost,
		Path:              "/v1/chat/completions",
		Endpoint:          domain.EndpointChat,
		Model:             "gpt-4o",
		BackendID:         11,
		BackendName:       "alpha",
		Attempts:          1,
		StatusCode:        http.StatusTooManyRequests,
		DurationMS:        99,
		ErrorMessage:      "rate limited",
	}); err != nil {
		t.Fatalf("append usage log: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/admin/api/dashboard/activity", nil)
	req.Header.Set("Authorization", "Bearer test-admin")
	recorder := httptest.NewRecorder()

	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	var payload struct {
		Events  []domain.AuditEvent `json:"events"`
		Usage   []domain.UsageLog   `json:"usage"`
		Summary []struct {
			Category string `json:"category"`
			Count    int    `json:"count"`
		} `json:"summary"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal dashboard activity: %v", err)
	}
	if !containsAuditEvent(payload.Events, func(event domain.AuditEvent) bool {
		return event.Type == "backend.abnormal"
	}) {
		t.Fatalf("expected recent event in payload, got %#v", payload.Events)
	}
	if !containsUsageLog(payload.Usage, func(entry domain.UsageLog) bool {
		return entry.RequestID == "activity-1"
	}) {
		t.Fatalf("expected recent usage in payload, got %#v", payload.Usage)
	}
	if len(payload.Summary) == 0 {
		t.Fatalf("expected activity summary categories, got %#v", payload.Summary)
	}
}

func TestDashboardActivitySummaryCountsEventTypes(t *testing.T) {
	application := newTestApp(t)
	ctx := context.Background()

	for _, event := range []domain.AuditEvent{
		{Level: "info", Type: "backend.abnormal", Message: "backend one"},
		{Level: "warn", Type: "backend.abnormal", Message: "backend two"},
		{Level: "info", Type: "backend.updated", Message: "backend one"},
	} {
		if err := application.store.AppendAuditEvent(ctx, event); err != nil {
			t.Fatalf("append audit event: %v", err)
		}
	}

	req := httptest.NewRequest(http.MethodGet, "/admin/api/dashboard/activity", nil)
	req.Header.Set("Authorization", "Bearer test-admin")
	recorder := httptest.NewRecorder()

	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	var payload struct {
		Summary []struct {
			Category string `json:"category"`
			Count    int    `json:"count"`
		} `json:"summary"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal dashboard activity: %v", err)
	}

	counts := make(map[string]int)
	for _, item := range payload.Summary {
		counts[item.Category] = item.Count
	}
	if counts["backend.abnormal"] != 2 {
		t.Fatalf("expected backend.abnormal count=2, got summary %#v", payload.Summary)
	}
	if counts["backend.updated"] != 1 {
		t.Fatalf("expected backend.updated count=1, got summary %#v", payload.Summary)
	}
}

func TestSearchReturnsGroupedResults(t *testing.T) {
	application := newTestApp(t)
	ctx := context.Background()

	proxyItem, err := application.store.CreateSocksProxy(ctx, domain.SocksProxy{
		Name:    "alpha-proxy",
		Address: "127.0.0.1:1080",
		Enabled: true,
	})
	if err != nil {
		t.Fatalf("create proxy: %v", err)
	}
	backend := createTestBackend(t, application, domain.Backend{
		Name:      "alpha-backend",
		BaseURL:   "https://alpha.local/v1",
		APIKey:    "alpha-key",
		ProxyID:   proxyItem.ID,
		Weight:    1,
		Models:    []string{"gpt-4o"},
		Endpoints: []string{domain.EndpointChat},
	})
	client, err := application.store.CreateClientKey(ctx, domain.ClientKey{
		Name:        "alpha-client",
		TokenHash:   store.HashToken("alpha-client-token"),
		Token:       "alpha-client-token",
		TokenPrefix: tokenPrefix("alpha-client-token"),
		Enabled:     true,
	})
	if err != nil {
		t.Fatalf("create client key: %v", err)
	}
	if err := application.store.AppendUsageLog(ctx, domain.UsageLog{
		RequestID:         "search-alpha-1",
		ClientID:          client.ID,
		ClientName:        client.Name,
		ClientTokenPrefix: client.TokenPrefix,
		Method:            http.MethodPost,
		Path:              "/v1/chat/completions",
		Endpoint:          domain.EndpointChat,
		Model:             "alpha-model",
		BackendID:         backend.ID,
		BackendName:       backend.Name,
		Attempts:          1,
		StatusCode:        http.StatusOK,
		DurationMS:        44,
	}); err != nil {
		t.Fatalf("append usage log: %v", err)
	}
	if err := application.store.AppendAuditEvent(ctx, domain.AuditEvent{
		Level:       "info",
		Type:        "alpha.event",
		Message:     "alpha backend promoted",
		BackendName: backend.Name,
		Model:       "alpha-model",
	}); err != nil {
		t.Fatalf("append audit event: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/admin/api/search?q=alpha", nil)
	req.Header.Set("Authorization", "Bearer test-admin")
	recorder := httptest.NewRecorder()

	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	var payload struct {
		Query   string                             `json:"query"`
		Results map[string][]searchResultAssertion `json:"results"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal search payload: %v", err)
	}
	if payload.Query != "alpha" {
		t.Fatalf("expected query alpha, got %q", payload.Query)
	}
	for _, section := range []string{"backends", "client_keys", "proxies", "usage_logs", "events"} {
		items, ok := payload.Results[section]
		if !ok {
			t.Fatalf("expected section %q in results, got %#v", section, payload.Results)
		}
		if len(items) == 0 {
			t.Fatalf("expected matches in section %q, got %#v", section, payload.Results)
		}
	}
	if _, ok := payload.Results["policies"]; ok {
		t.Fatalf("did not expect removed policies section in results: %#v", payload.Results)
	}
	if !containsSearchResult(payload.Results["backends"], func(item searchResultAssertion) bool {
		return item.TargetPage == "backends" && item.TargetID == backend.ID
	}) {
		t.Fatalf("unexpected backend search results: %#v", payload.Results["backends"])
	}
}

func TestSearchHonorsLimitAndRanksExactMatchesFirst(t *testing.T) {
	application := newTestApp(t)

	exact := createTestBackend(t, application, domain.Backend{
		Name:      "alpha",
		BaseURL:   "https://alpha.local/v1",
		APIKey:    "alpha-key",
		Weight:    1,
		Models:    []string{"gpt-4o"},
		Endpoints: []string{domain.EndpointChat},
	})
	createTestBackend(t, application, domain.Backend{
		Name:      "zz-alpha-later",
		BaseURL:   "https://zz-alpha.local/v1",
		APIKey:    "zz-alpha-key",
		Weight:    1,
		Models:    []string{"gpt-4o"},
		Endpoints: []string{domain.EndpointChat},
	})

	req := httptest.NewRequest(http.MethodGet, "/admin/api/search?q=alpha&limit=1", nil)
	req.Header.Set("Authorization", "Bearer test-admin")
	recorder := httptest.NewRecorder()

	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	var payload struct {
		Results map[string][]searchResultAssertion `json:"results"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal search payload: %v", err)
	}
	if len(payload.Results["backends"]) != 1 {
		t.Fatalf("expected one backend result, got %#v", payload.Results["backends"])
	}
	if got := payload.Results["backends"][0]; got.TargetID != exact.ID || got.Title != exact.Name {
		t.Fatalf("expected exact match first, got %#v", got)
	}
}

func TestBackendDetailReturnsDrawerData(t *testing.T) {
	application := newTestApp(t)
	ctx := context.Background()

	proxyItem, err := application.store.CreateSocksProxy(ctx, domain.SocksProxy{
		Name:    "drawer-proxy",
		Address: "127.0.0.1:1080",
		Enabled: true,
	})
	if err != nil {
		t.Fatalf("create proxy: %v", err)
	}
	backend := createTestBackend(t, application, domain.Backend{
		Name:         "alpha-backend",
		BaseURL:      "https://alpha.local/v1",
		APIKey:       "alpha-key",
		ProxyID:      proxyItem.ID,
		Weight:       2,
		Models:       []string{"gpt-4o"},
		ModelMapping: map[string]string{"alpha": "gpt-4o"},
		Endpoints:    []string{domain.EndpointChat},
	})
	if err := application.store.AppendUsageLog(ctx, domain.UsageLog{
		RequestID:         "backend-detail-1",
		ClientID:          1,
		ClientName:        "drawer-client",
		ClientTokenPrefix: "draw",
		Method:            http.MethodPost,
		Path:              "/v1/chat/completions",
		Endpoint:          domain.EndpointChat,
		Model:             "gpt-4o",
		BackendID:         backend.ID,
		BackendName:       backend.Name,
		Attempts:          1,
		StatusCode:        http.StatusOK,
		DurationMS:        77,
	}); err != nil {
		t.Fatalf("append usage log: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/admin/api/backends/"+strconv.FormatInt(backend.ID, 10)+"/detail", nil)
	req.Header.Set("Authorization", "Bearer test-admin")
	recorder := httptest.NewRecorder()

	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	var payload struct {
		Overview      []resourceDetailEntry `json:"overview"`
		Configuration []resourceDetailEntry `json:"configuration"`
		Metadata      []resourceDetailEntry `json:"metadata"`
		Raw           domain.Backend        `json:"raw"`
		Activity      struct {
			Usage []domain.UsageLog `json:"usage"`
		} `json:"activity"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal backend detail: %v", err)
	}
	metadata := detailEntriesToMap(payload.Metadata)
	configuration := detailEntriesToMap(payload.Configuration)
	overview := detailEntriesToMap(payload.Overview)
	if metadata["id"] != float64(backend.ID) || payload.Raw.ID != backend.ID {
		t.Fatalf("expected backend ids in payload, got metadata=%#v raw=%#v", metadata, payload.Raw)
	}
	models, _ := configuration["models"].([]any)
	modelMapping, _ := configuration["model_mapping"].(map[string]any)
	if len(models) == 0 || modelMapping["alpha"] != "gpt-4o" {
		t.Fatalf("expected backend configuration in payload, got %#v", configuration)
	}
	if overview["proxy"] != "drawer-proxy (127.0.0.1:1080)" {
		t.Fatalf("expected backend proxy summary, got %#v", overview)
	}
	if configuration["api_key"] != "set" || payload.Raw.APIKey != "set" {
		t.Fatalf("expected masked backend api key, got configuration=%#v raw=%#v", configuration, payload.Raw)
	}
	if !containsUsageLog(payload.Activity.Usage, func(entry domain.UsageLog) bool {
		return entry.BackendID == backend.ID
	}) {
		t.Fatalf("expected backend activity usage, got %#v", payload.Activity.Usage)
	}
}

func TestClientKeyDetailReturnsDrawerData(t *testing.T) {
	application := newTestApp(t)
	ctx := context.Background()

	client, err := application.store.CreateClientKey(ctx, domain.ClientKey{
		Name:        "alpha-client",
		TokenHash:   store.HashToken("alpha-client-token"),
		Token:       "alpha-client-token",
		TokenPrefix: tokenPrefix("alpha-client-token"),
		Enabled:     true,
	})
	if err != nil {
		t.Fatalf("create client key: %v", err)
	}
	if err := application.store.AppendUsageLog(ctx, domain.UsageLog{
		RequestID:         "client-detail-1",
		ClientID:          client.ID,
		ClientName:        client.Name,
		ClientTokenPrefix: client.TokenPrefix,
		Method:            http.MethodPost,
		Path:              "/v1/chat/completions",
		Endpoint:          domain.EndpointChat,
		Model:             "gpt-4o",
		BackendID:         7,
		BackendName:       "alpha-backend",
		Attempts:          1,
		StatusCode:        http.StatusOK,
		DurationMS:        50,
	}); err != nil {
		t.Fatalf("append usage log: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/admin/api/client-keys/"+strconv.FormatInt(client.ID, 10)+"/detail", nil)
	req.Header.Set("Authorization", "Bearer test-admin")
	recorder := httptest.NewRecorder()

	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	var payload struct {
		Overview      []resourceDetailEntry `json:"overview"`
		Configuration []resourceDetailEntry `json:"configuration"`
		Metadata      []resourceDetailEntry `json:"metadata"`
		Raw           domain.ClientKey      `json:"raw"`
		Activity      struct {
			Usage []domain.UsageLog `json:"usage"`
		} `json:"activity"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal client key detail: %v", err)
	}
	overview := detailEntriesToMap(payload.Overview)
	configuration := detailEntriesToMap(payload.Configuration)
	metadata := detailEntriesToMap(payload.Metadata)
	if metadata["id"] != float64(client.ID) || payload.Raw.ID != client.ID {
		t.Fatalf("expected client ids in payload, got metadata=%#v raw=%#v", metadata, payload.Raw)
	}
	if configuration["token"] != client.Token {
		t.Fatalf("expected detail configuration token %q, got %#v", client.Token, configuration)
	}
	if len(configuration) != 1 {
		t.Fatalf("unexpected client configuration: %#v", configuration)
	}
	if overview["usage_count"] != float64(1) {
		t.Fatalf("expected overview usage_count=1, got %#v", overview)
	}
	if _, ok := overview["last_used_at"].(string); !ok {
		t.Fatalf("expected overview last_used_at string, got %#v", overview)
	}
	if !containsUsageLog(payload.Activity.Usage, func(entry domain.UsageLog) bool {
		return entry.ClientID == client.ID
	}) {
		t.Fatalf("expected client usage activity, got %#v", payload.Activity.Usage)
	}
}

func TestPolicyDetailRouteRemoved(t *testing.T) {
	application := newTestApp(t)
	req := httptest.NewRequest(http.MethodGet, "/admin/api/model-policies/1/detail", nil)
	req.Header.Set("Authorization", "Bearer test-admin")
	recorder := httptest.NewRecorder()

	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d body=%s", recorder.Code, recorder.Body.String())
	}
}

func TestProxyDetailReturnsDrawerData(t *testing.T) {
	application := newTestApp(t)
	ctx := context.Background()

	proxyItem, err := application.store.CreateSocksProxy(ctx, domain.SocksProxy{
		Name:     "alpha-proxy",
		Address:  "127.0.0.1:1080",
		Username: "proxy-user",
		Password: "proxy-pass",
		Enabled:  true,
	})
	if err != nil {
		t.Fatalf("create proxy: %v", err)
	}
	backend := createTestBackend(t, application, domain.Backend{
		Name:      "alpha-backend",
		BaseURL:   "https://alpha.local/v1",
		APIKey:    "alpha-key",
		ProxyID:   proxyItem.ID,
		Weight:    1,
		Models:    []string{"gpt-4o"},
		Endpoints: []string{domain.EndpointChat},
	})
	if err := application.store.AppendUsageLog(ctx, domain.UsageLog{
		RequestID:         "proxy-detail-1",
		ClientID:          1,
		ClientName:        "proxy-client",
		ClientTokenPrefix: "prx",
		Method:            http.MethodPost,
		Path:              "/v1/chat/completions",
		Endpoint:          domain.EndpointChat,
		Model:             "gpt-4o",
		BackendID:         backend.ID,
		BackendName:       backend.Name,
		ProxyID:           proxyItem.ID,
		ProxyName:         proxyItem.Name,
		Attempts:          1,
		StatusCode:        http.StatusOK,
		DurationMS:        64,
	}); err != nil {
		t.Fatalf("append proxy usage log: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/admin/api/socks-proxies/"+strconv.FormatInt(proxyItem.ID, 10)+"/detail", nil)
	req.Header.Set("Authorization", "Bearer test-admin")
	recorder := httptest.NewRecorder()

	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	var payload struct {
		Overview      []resourceDetailEntry `json:"overview"`
		Configuration []resourceDetailEntry `json:"configuration"`
		Metadata      []resourceDetailEntry `json:"metadata"`
		Raw           domain.SocksProxy     `json:"raw"`
		Activity      struct {
			Usage    []domain.UsageLog `json:"usage"`
			Backends []domain.Backend  `json:"backends"`
		} `json:"activity"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal proxy detail: %v", err)
	}
	configuration := detailEntriesToMap(payload.Configuration)
	metadata := detailEntriesToMap(payload.Metadata)
	if metadata["id"] != float64(proxyItem.ID) || payload.Raw.ID != proxyItem.ID {
		t.Fatalf("expected proxy ids in payload, got metadata=%#v raw=%#v", metadata, payload.Raw)
	}
	if configuration["address"] != "127.0.0.1:1080" || configuration["username"] != "proxy-user" {
		t.Fatalf("unexpected proxy configuration: %#v", configuration)
	}
	if !containsBackend(payload.Activity.Backends, func(item domain.Backend) bool {
		return item.ID == backend.ID
	}) {
		t.Fatalf("expected proxy-bound backends in activity, got %#v", payload.Activity.Backends)
	}
	if !containsUsageLog(payload.Activity.Usage, func(entry domain.UsageLog) bool {
		return entry.ProxyID == proxyItem.ID
	}) {
		t.Fatalf("expected proxy usage activity, got %#v", payload.Activity.Usage)
	}
}

func TestAdminAuditEventsTrackOnlyRequestedManagementActions(t *testing.T) {
	application := newTestApp(t)

	serve := func(method, path, body string, wantStatus int) []byte {
		t.Helper()
		var reader io.Reader
		if body != "" {
			reader = strings.NewReader(body)
		}
		req := httptest.NewRequest(method, path, reader)
		if body != "" {
			req.Header.Set("Content-Type", "application/json")
		}
		recorder := httptest.NewRecorder()
		application.Handler().ServeHTTP(recorder, req)
		if recorder.Code != wantStatus {
			t.Fatalf("%s %s: got status %d body=%s, want %d", method, path, recorder.Code, recorder.Body.String(), wantStatus)
		}
		return recorder.Body.Bytes()
	}

	var createdProxy domain.SocksProxy
	if err := json.Unmarshal(serve(http.MethodPost, "/admin/api/socks-proxies", `{
		"name":"audit-proxy",
		"address":"127.0.0.1:1080",
		"enabled":true
	}`, http.StatusCreated), &createdProxy); err != nil {
		t.Fatalf("unmarshal created proxy: %v", err)
	}
	serve(http.MethodPut, "/admin/api/socks-proxies/"+strconv.FormatInt(createdProxy.ID, 10), `{
		"name":"audit-proxy-renamed",
		"address":"127.0.0.1:1081",
		"enabled":true
	}`, http.StatusOK)

	var createdClient struct {
		Client domain.ClientKey `json:"client"`
	}
	if err := json.Unmarshal(serve(http.MethodPost, "/admin/api/client-keys", `{
		"name":"audit-client",
		"token":"audit-client-token",
		"enabled":true
	}`, http.StatusCreated), &createdClient); err != nil {
		t.Fatalf("unmarshal created client key: %v", err)
	}
	serve(http.MethodPut, "/admin/api/client-keys/"+strconv.FormatInt(createdClient.Client.ID, 10), `{
		"name":"audit-client-renamed",
		"enabled":true
	}`, http.StatusOK)

	var createdBackend domain.Backend
	if err := json.Unmarshal(serve(http.MethodPost, "/admin/api/backends", `{
		"name":"audit-backend",
		"protocol":"openai",
		"base_url":"https://audit-backend.local/v1",
		"api_key":"backend-key",
		"weight":1,
		"models":["gpt-4o"],
		"model_mapping":{}
	}`, http.StatusCreated), &createdBackend); err != nil {
		t.Fatalf("unmarshal created backend: %v", err)
	}
	serve(http.MethodPut, "/admin/api/backends/"+strconv.FormatInt(createdBackend.ID, 10), `{
		"name":"audit-backend-renamed",
		"protocol":"openai",
		"base_url":"https://audit-backend.local/v1",
		"api_key":"backend-key",
		"status":"normal",
		"weight":2,
		"models":["gpt-4o"],
		"model_mapping":{}
	}`, http.StatusOK)

	serve(http.MethodPut, "/admin/api/config", `{"focus_models":"gpt-4o,claude-*"}`, http.StatusOK)
	serve(http.MethodDelete, "/admin/api/backends/"+strconv.FormatInt(createdBackend.ID, 10), "", http.StatusOK)
	serve(http.MethodDelete, "/admin/api/client-keys/"+strconv.FormatInt(createdClient.Client.ID, 10), "", http.StatusOK)
	serve(http.MethodDelete, "/admin/api/socks-proxies/"+strconv.FormatInt(createdProxy.ID, 10), "", http.StatusOK)

	events, err := application.store.ListAuditEvents(context.Background(), 20)
	if err != nil {
		t.Fatalf("list audit events: %v", err)
	}
	wantTypes := map[string]int{
		"admin_backend_create":     1,
		"admin_backend_delete":     1,
		"admin_client_create":      1,
		"admin_client_delete":      1,
		"admin_socks_proxy_create": 1,
		"admin_socks_proxy_delete": 1,
		"admin_config_update":      1,
	}
	gotTypes := make(map[string]int, len(events))
	for _, event := range events {
		gotTypes[event.Type]++
		if event.Actor != "admin" {
			t.Fatalf("management audit event should identify admin actor, got %#v", event)
		}
	}
	if !reflect.DeepEqual(gotTypes, wantTypes) {
		t.Fatalf("unexpected audit event types: got %#v want %#v", gotTypes, wantTypes)
	}
	if !containsAuditEvent(events, func(event domain.AuditEvent) bool {
		return event.Type == "admin_backend_create" && event.ResourceType == "backend" && event.ResourceID == createdBackend.ID && event.BackendName == "audit-backend"
	}) {
		t.Fatalf("expected backend create resource metadata, got %#v", events)
	}
	if !containsAuditEvent(events, func(event domain.AuditEvent) bool {
		return event.Type == "admin_config_update" && event.ResourceType == "config" && strings.Contains(event.Message, "focus_models")
	}) {
		t.Fatalf("expected config update audit event, got %#v", events)
	}
}

func TestProxyNetworkFailoverDoesNotCreateAuditEvent(t *testing.T) {
	application := newTestApp(t)
	client := createTestClient(t, application, "network-failover-client")
	createTestBackend(t, application, domain.Backend{
		Name: "network-primary", BaseURL: "https://network-primary.local/v1", APIKey: "primary-key", Weight: 2,
		Models: []string{"gpt-4o"},
	})
	createTestBackend(t, application, domain.Backend{
		Name: "network-backup", BaseURL: "https://network-backup.local/v1", APIKey: "backup-key", Weight: 1,
		Models: []string{"gpt-4o"},
	})
	application.proxy = proxy.NewWithHTTPClient(&http.Client{Transport: consoleRoundTripFunc(func(r *http.Request) (*http.Response, error) {
		if r.URL.Host == "network-primary.local" {
			return nil, errors.New("upstream network unavailable")
		}
		return &http.Response{
			StatusCode: http.StatusOK,
			Status:     "200 OK",
			Header:     http.Header{"Content-Type": {"application/json"}},
			Body:       io.NopCloser(strings.NewReader(`{"ok":true}`)),
			Request:    r,
		}, nil
	})})

	req := httptest.NewRequest(http.MethodPost, "/v1/responses", strings.NewReader(`{"model":"gpt-4o","input":"hello"}`))
	req.Header.Set("Authorization", "Bearer "+client.Token)
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected successful network failover, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	events, err := application.store.ListAuditEvents(context.Background(), 10)
	if err != nil {
		t.Fatalf("list audit events: %v", err)
	}
	if len(events) != 0 {
		t.Fatalf("network failover should not create audit events, got %#v", events)
	}
}

func TestAdminBackendGlobalSyncSummaryCreatesOneAuditEvent(t *testing.T) {
	application := newTestApp(t)
	req := httptest.NewRequest(http.MethodPost, "/admin/api/backends/console/sync-summary", strings.NewReader(`{
		"total":3,
		"success_count":2,
		"failure_count":1
	}`))
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected global sync summary status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	events, err := application.store.ListAuditEvents(context.Background(), 10)
	if err != nil {
		t.Fatalf("list audit events: %v", err)
	}
	if len(events) != 1 {
		t.Fatalf("expected one global sync audit event, got %#v", events)
	}
	event := events[0]
	if event.Type != "admin_backends_sync" || event.Level != "warn" || event.ResourceType != "backend" || !strings.Contains(event.Message, "2/3 succeeded") {
		t.Fatalf("unexpected global sync audit event: %#v", event)
	}
}

type failingResponseWriter struct {
	header http.Header
	status int
}

func (w *failingResponseWriter) Header() http.Header {
	return w.header
}

func (w *failingResponseWriter) WriteHeader(status int) {
	w.status = status
}

func (w *failingResponseWriter) Write(_ []byte) (int, error) {
	return 0, errors.New("client write failed")
}

type upstreamRecord struct {
	backendName      string
	method           string
	path             string
	rawQuery         string
	authorization    string
	xAPIKey          string
	anthropicVersion string
	acceptEncoding   string
	trace            string
	connection       string
	body             string
}

type cancelRequestContextKey struct{}

type failoverFixture struct {
	t                        *testing.T
	mu                       sync.Mutex
	hostToName               map[string]string
	statusByName             map[string]int
	cancelResponseReadByName map[string]bool
	compressResponseByName   map[string]string
	responseHeadersByName    map[string]http.Header
	responseBodyByName       map[string]string
	records                  []upstreamRecord
}

func newFailoverFixture(t *testing.T, backends []domain.Backend) *failoverFixture {
	t.Helper()

	fixture := &failoverFixture{
		t:                        t,
		hostToName:               make(map[string]string),
		statusByName:             make(map[string]int),
		cancelResponseReadByName: make(map[string]bool),
		compressResponseByName:   make(map[string]string),
		responseHeadersByName:    make(map[string]http.Header),
		responseBodyByName:       make(map[string]string),
	}
	for _, backend := range backends {
		parsed, err := url.Parse(backend.BaseURL)
		if err != nil {
			t.Fatalf("parse backend URL %q: %v", backend.BaseURL, err)
		}
		fixture.hostToName[parsed.Host] = backend.Name
		fixture.statusByName[backend.Name] = http.StatusOK
	}
	return fixture
}

func (f *failoverFixture) RoundTrip(req *http.Request) (*http.Response, error) {
	name := f.hostToName[req.URL.Host]
	if name == "" {
		f.t.Fatalf("unexpected upstream host: %s", req.URL.Host)
	}

	body, err := io.ReadAll(req.Body)
	if err != nil {
		f.t.Fatalf("read request body: %v", err)
	}

	f.mu.Lock()
	status := f.statusByName[name]
	f.records = append(f.records, upstreamRecord{
		backendName:      name,
		method:           req.Method,
		path:             req.URL.Path,
		rawQuery:         req.URL.RawQuery,
		authorization:    req.Header.Get("Authorization"),
		xAPIKey:          req.Header.Get("X-Api-Key"),
		anthropicVersion: req.Header.Get("Anthropic-Version"),
		acceptEncoding:   req.Header.Get("Accept-Encoding"),
		trace:            req.Header.Get("X-Trace"),
		connection:       req.Header.Get("Connection"),
		body:             string(body),
	})
	f.mu.Unlock()

	if status == 0 {
		status = http.StatusOK
	}
	bodyBytes := []byte(f.responseBodyByName[name])
	if len(bodyBytes) == 0 {
		bodyBytes = []byte(`{"backend":"` + name + `"}`)
	}
	header := http.Header{
		"Content-Type": {"application/json"},
		"X-Upstream":   {name},
	}
	if encoding := f.compressResponseByName[name]; encoding != "" && strings.Contains(req.Header.Get("Accept-Encoding"), encoding) {
		bodyBytes = compressFixtureBody(f.t, bodyBytes, encoding)
		header.Set("Content-Encoding", encoding)
		header.Set("Vary", "Accept-Encoding")
	}
	for key, values := range f.responseHeadersByName[name] {
		cloned := make([]string, len(values))
		copy(cloned, values)
		header[key] = cloned
	}
	respBody := io.NopCloser(bytes.NewReader(bodyBytes))
	if f.cancelResponseReadByName[name] {
		cancel, _ := req.Context().Value(cancelRequestContextKey{}).(context.CancelFunc)
		respBody = &cancelOnReadBody{cancel: cancel}
	}
	return &http.Response{
		StatusCode: status,
		Status:     http.StatusText(status),
		Header:     header,
		Body:       respBody,
		Request:    req,
	}, nil
}

func (f *failoverFixture) recordsSnapshot() []upstreamRecord {
	f.mu.Lock()
	defer f.mu.Unlock()

	out := make([]upstreamRecord, len(f.records))
	copy(out, f.records)
	return out
}

func compressFixtureBody(t *testing.T, body []byte, encoding string) []byte {
	t.Helper()

	var compressed bytes.Buffer
	switch encoding {
	case "gzip":
		zw := gzip.NewWriter(&compressed)
		if _, err := zw.Write(body); err != nil {
			t.Fatalf("gzip response body: %v", err)
		}
		if err := zw.Close(); err != nil {
			t.Fatalf("close gzip response body: %v", err)
		}
	case "deflate":
		zw := zlib.NewWriter(&compressed)
		if _, err := zw.Write(body); err != nil {
			t.Fatalf("deflate response body: %v", err)
		}
		if err := zw.Close(); err != nil {
			t.Fatalf("close deflate response body: %v", err)
		}
	case "br":
		zw := brotli.NewWriter(&compressed)
		if _, err := zw.Write(body); err != nil {
			t.Fatalf("brotli response body: %v", err)
		}
		if err := zw.Close(); err != nil {
			t.Fatalf("close brotli response body: %v", err)
		}
	case "zstd":
		zw, err := zstd.NewWriter(&compressed)
		if err != nil {
			t.Fatalf("create zstd writer: %v", err)
		}
		if _, err := zw.Write(body); err != nil {
			t.Fatalf("zstd response body: %v", err)
		}
		if err := zw.Close(); err != nil {
			t.Fatalf("close zstd response body: %v", err)
		}
	default:
		t.Fatalf("unsupported test compression encoding %q", encoding)
	}
	return compressed.Bytes()
}

type cancelOnReadBody struct {
	cancel context.CancelFunc
	done   bool
}

func (b *cancelOnReadBody) Read(_ []byte) (int, error) {
	if !b.done {
		b.done = true
		if b.cancel != nil {
			b.cancel()
		}
		return 0, context.Canceled
	}
	return 0, io.EOF
}

func (b *cancelOnReadBody) Close() error {
	return nil
}

func newTestApp(t *testing.T) *App {
	t.Helper()

	application, err := New(context.Background(), t.TempDir()+"/app.db")
	if err != nil {
		t.Fatalf("new app: %v", err)
	}
	t.Cleanup(func() {
		_ = application.Close()
	})
	return application
}

func createTestClient(t *testing.T, application *App, token string) domain.ClientKey {
	t.Helper()

	client, err := application.store.CreateClientKey(context.Background(), domain.ClientKey{
		Name:        "client",
		TokenHash:   store.HashToken(token),
		Token:       token,
		TokenPrefix: tokenPrefix(token),
		Enabled:     true,
	})
	if err != nil {
		t.Fatalf("create client: %v", err)
	}
	return client
}

func createTestBackend(t *testing.T, application *App, backend domain.Backend) domain.Backend {
	t.Helper()

	created, err := application.store.CreateBackend(context.Background(), backend)
	if err != nil {
		t.Fatalf("create backend %q: %v", backend.Name, err)
	}
	return created
}

func containsUsageLog(items []domain.UsageLog, match func(domain.UsageLog) bool) bool {
	for _, item := range items {
		if match(item) {
			return true
		}
	}
	return false
}

func containsAuditEvent(items []domain.AuditEvent, match func(domain.AuditEvent) bool) bool {
	for _, item := range items {
		if match(item) {
			return true
		}
	}
	return false
}

func containsBackend(items []domain.Backend, match func(domain.Backend) bool) bool {
	for _, item := range items {
		if match(item) {
			return true
		}
	}
	return false
}

func detailEntriesToMap(entries []resourceDetailEntry) map[string]any {
	values := make(map[string]any, len(entries))
	for _, entry := range entries {
		values[entry.Key] = entry.Value
	}
	return values
}

func decodeJSONPayload(t *testing.T, raw string) map[string]any {
	t.Helper()

	var payload map[string]any
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		t.Fatalf("decode json payload %q: %v", raw, err)
	}
	return payload
}

type consoleRoundTripFunc func(*http.Request) (*http.Response, error)

func (f consoleRoundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func consoleJSONResponse(status int, header http.Header, body string) *http.Response {
	if header == nil {
		header = http.Header{}
	}
	header.Set("Content-Type", "application/json")
	return &http.Response{
		StatusCode: status,
		Status:     http.StatusText(status),
		Header:     header,
		Body:       io.NopCloser(strings.NewReader(body)),
	}
}

type searchResultAssertion struct {
	Kind       string         `json:"kind"`
	ID         int64          `json:"id"`
	Title      string         `json:"title"`
	Subtitle   string         `json:"subtitle"`
	Meta       map[string]any `json:"meta"`
	Status     string         `json:"status"`
	TargetPage string         `json:"target_page"`
	TargetID   int64          `json:"target_id"`
}

func containsSearchResult(items []searchResultAssertion, match func(searchResultAssertion) bool) bool {
	for _, item := range items {
		if match(item) {
			return true
		}
	}
	return false
}
