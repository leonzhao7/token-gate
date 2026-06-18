package app

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"token-gate/internal/config"
	"token-gate/internal/domain"
	"token-gate/internal/proxy"
	"token-gate/internal/store"
)

func TestProxyFailsOverAndKeepsTransparentRequest(t *testing.T) {
	const (
		clientToken = "client-secret"
		requestBody = `{"model":"gpt-4o","messages":[{"role":"user","content":"hello"}]}`
	)

	application := newTestApp(t)
	client := createTestClient(t, application, clientToken)
	backends := []domain.Backend{
		createTestBackend(t, application, domain.Backend{
			Name:      "alpha",
			BaseURL:   "https://alpha.local/root/v1",
			APIKey:    "alpha-key",
			Enabled:   true,
			Weight:    1,
			Models:    []string{"gpt-4o"},
			Endpoints: []string{domain.EndpointChat},
		}),
		createTestBackend(t, application, domain.Backend{
			Name:      "beta",
			BaseURL:   "https://beta.local/root/v1",
			APIKey:    "beta-key",
			Enabled:   true,
			Weight:    1,
			Models:    []string{"gpt-4o"},
			Endpoints: []string{domain.EndpointChat},
		}),
	}
	createTestPolicy(t, application, domain.ModelPolicy{
		Pattern:         "gpt-*",
		Endpoint:        domain.EndpointChat,
		PlacementPolicy: domain.PlacementSticky,
		FailoverEnabled: true,
		Priority:        10,
	})

	selection, err := application.scheduler.SelectBackend(context.Background(), client, domain.EndpointChat, "gpt-4o")
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
			Enabled:   true,
			Weight:    1,
			Models:    []string{"gpt-4o"},
			Endpoints: []string{domain.EndpointChat},
		}),
		createTestBackend(t, application, domain.Backend{
			Name:      "beta",
			BaseURL:   "https://beta.local/root/v1",
			APIKey:    "beta-key",
			Enabled:   true,
			Weight:    1,
			Models:    []string{"gpt-4o"},
			Endpoints: []string{domain.EndpointChat},
		}),
	}
	createTestPolicy(t, application, domain.ModelPolicy{
		Pattern:         "gpt-*",
		Endpoint:        domain.EndpointChat,
		PlacementPolicy: domain.PlacementSticky,
		FailoverEnabled: true,
		Priority:        10,
	})

	selection, err := application.scheduler.SelectBackend(context.Background(), client, domain.EndpointChat, "gpt-4o")
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
		Enabled:      true,
		Weight:       1,
		Models:       []string{"gpt-5.4-test"},
		ModelMapping: map[string]string{"gpt-5.4": "gpt-5.4-test"},
		Endpoints:    []string{domain.EndpointChat},
	})
	createTestPolicy(t, application, domain.ModelPolicy{
		Pattern:         "gpt-5.4",
		Endpoint:        domain.EndpointChat,
		PlacementPolicy: domain.PlacementSticky,
		FailoverEnabled: true,
		Priority:        10,
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
		Enabled:      true,
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
		Enabled:   true,
		Weight:    1,
		Models:    []string{"claude-*"},
		Endpoints: []string{domain.EndpointMessages},
	})
	createTestPolicy(t, application, domain.ModelPolicy{
		Pattern:         "claude-*",
		Endpoint:        domain.EndpointMessages,
		PlacementPolicy: domain.PlacementSticky,
		FailoverEnabled: true,
		Priority:        10,
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

func TestUpdateBackendPreservesAPIKeyWhenPayloadIsBlank(t *testing.T) {
	application := newTestApp(t)
	backend := createTestBackend(t, application, domain.Backend{
		Name:      "editable",
		Protocol:  domain.BackendProtocolAnthropic,
		BaseURL:   "https://editable.local/v1",
		APIKey:    "keep-this-key",
		Enabled:   true,
		Weight:    1,
		Models:    []string{"gpt-4o"},
		Endpoints: []string{domain.EndpointChat},
	})

	body := `{
		"name":"editable-updated",
		"pool":"main",
		"base_url":"https://editable.local/root/v1",
		"api_key":"",
		"enabled":true,
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
		"enabled":true,
		"route_mode_override":"sticky",
		"route_group":"frontend-a"
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
		"enabled":true,
		"route_mode_override":"sticky",
		"route_group":"frontend-a"
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
		"pool":"main",
		"base_url":"https://proxied.local/v1",
		"api_key":"backend-key",
		"proxy_id":%d,
		"enabled":true,
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

func TestAdminOverviewAndListsReturnEmptyArrays(t *testing.T) {
	application := newTestApp(t)

	cases := []struct {
		path string
	}{
		{path: "/admin/api/overview"},
		{path: "/admin/api/socks-proxies"},
		{path: "/admin/api/backends"},
		{path: "/admin/api/client-keys"},
		{path: "/admin/api/model-policies"},
		{path: "/admin/api/events"},
	}

	for _, tc := range cases {
		req := httptest.NewRequest(http.MethodGet, tc.path, nil)
		req.Header.Set("Authorization", "Bearer test-admin")
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
		Enabled:   true,
		Weight:    1,
		Models:    []string{"gpt-4o"},
		Endpoints: []string{domain.EndpointChat},
	})
	createTestPolicy(t, application, domain.ModelPolicy{
		Pattern:         "gpt-*",
		Endpoint:        domain.EndpointChat,
		PlacementPolicy: domain.PlacementSticky,
		FailoverEnabled: true,
		Priority:        10,
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
	if failRecorder.Code != http.StatusInternalServerError {
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
	if payload.Items[0].ID != backend.ID {
		t.Fatalf("unexpected backend item: %#v", payload.Items[0])
	}
	if payload.Items[0].RecentStats.WindowMinutes != 30 || payload.Items[0].RecentStats.Successes != 1 || payload.Items[0].RecentStats.Failures != 1 {
		t.Fatalf("unexpected recent stats: %#v", payload.Items[0].RecentStats)
	}
}

func TestBackendListExcludesBadRequestFromFailureStats(t *testing.T) {
	application := newTestApp(t)
	client := createTestClient(t, application, "client-secret")
	backend := createTestBackend(t, application, domain.Backend{
		Name:      "alpha",
		BaseURL:   "https://alpha.local/v1",
		APIKey:    "alpha-key",
		Enabled:   true,
		Weight:    1,
		Models:    []string{"gpt-4o"},
		Endpoints: []string{domain.EndpointChat},
	})
	createTestPolicy(t, application, domain.ModelPolicy{
		Pattern:         "gpt-*",
		Endpoint:        domain.EndpointChat,
		PlacementPolicy: domain.PlacementSticky,
		FailoverEnabled: true,
		Priority:        10,
	})

	fixture := newFailoverFixture(t, []domain.Backend{backend})
	fixture.statusByName[backend.Name] = http.StatusBadRequest
	application.proxy = proxy.NewWithHTTPClient(&http.Client{Transport: fixture})

	req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(`{"model":"gpt-4o","messages":[{"role":"user","content":"bad"}]}`))
	req.Header.Set("Authorization", "Bearer "+client.Token)
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected proxy response 400, got %d body=%s", recorder.Code, recorder.Body.String())
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
	if payload.Items[0].RecentStats.Failures != 0 {
		t.Fatalf("expected 400 not to count as backend failure, got %#v", payload.Items[0].RecentStats)
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
		Enabled:   true,
		Weight:    1,
		Models:    []string{"gpt-4o"},
		Endpoints: []string{domain.EndpointChat},
	})
	createTestPolicy(t, application, domain.ModelPolicy{
		Pattern:         "gpt-*",
		Endpoint:        domain.EndpointChat,
		PlacementPolicy: domain.PlacementSticky,
		FailoverEnabled: true,
		Priority:        10,
	})

	fixture := newFailoverFixture(t, []domain.Backend{backend})
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
		Enabled:      true,
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
		Enabled:   true,
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
		Enabled:   true,
		Weight:    1,
		Models:    []string{"gpt-4o"},
		Endpoints: []string{domain.EndpointChat},
	})
	createTestPolicy(t, application, domain.ModelPolicy{
		Pattern:         "gpt-*",
		Endpoint:        domain.EndpointChat,
		PlacementPolicy: domain.PlacementSticky,
		FailoverEnabled: true,
		Priority:        10,
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
	trace            string
	connection       string
	body             string
}

type failoverFixture struct {
	t            *testing.T
	mu           sync.Mutex
	hostToName   map[string]string
	statusByName map[string]int
	records      []upstreamRecord
}

func newFailoverFixture(t *testing.T, backends []domain.Backend) *failoverFixture {
	t.Helper()

	fixture := &failoverFixture{
		t:            t,
		hostToName:   make(map[string]string),
		statusByName: make(map[string]int),
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
		trace:            req.Header.Get("X-Trace"),
		connection:       req.Header.Get("Connection"),
		body:             string(body),
	})
	f.mu.Unlock()

	if status == 0 {
		status = http.StatusOK
	}
	return &http.Response{
		StatusCode: status,
		Status:     http.StatusText(status),
		Header: http.Header{
			"Content-Type": {"application/json"},
			"X-Upstream":   {name},
		},
		Body:    io.NopCloser(strings.NewReader(`{"backend":"` + name + `"}`)),
		Request: req,
	}, nil
}

func (f *failoverFixture) recordsSnapshot() []upstreamRecord {
	f.mu.Lock()
	defer f.mu.Unlock()

	out := make([]upstreamRecord, len(f.records))
	copy(out, f.records)
	return out
}

func newTestApp(t *testing.T) *App {
	t.Helper()

	application, err := New(context.Background(), config.Config{
		ListenAddr:      ":0",
		DBPath:          t.TempDir() + "/app.db",
		AdminToken:      "test-admin",
		BackendCooldown: time.Minute,
		RequestTimeout:  time.Second,
		ShutdownTimeout: time.Second,
	})
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

func createTestPolicy(t *testing.T, application *App, policy domain.ModelPolicy) domain.ModelPolicy {
	t.Helper()

	created, err := application.store.CreateModelPolicy(context.Background(), policy)
	if err != nil {
		t.Fatalf("create policy %q: %v", policy.Pattern, err)
	}
	return created
}
