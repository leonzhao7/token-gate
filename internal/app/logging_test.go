package app

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/http/httptrace"
	"strings"
	"testing"
	"time"

	"token-gate/internal/domain"
	"token-gate/internal/proxy"
)

func TestWithBackendTraceDoesNotAttachDNSCallbacks(t *testing.T) {
	application := newTestApp(t)

	ctx := application.withBackendTrace(context.Background(), domain.Backend{
		ID:      1,
		Name:    "alpha",
		BaseURL: "https://alpha.local/v1",
	}, 1)

	trace := httptrace.ContextClientTrace(ctx)
	if trace == nil {
		t.Fatal("expected backend trace in context")
	}
	if trace.DNSStart != nil || trace.DNSDone != nil {
		t.Fatalf("expected backend trace to omit DNS callbacks, got DNSStart=%v DNSDone=%v", trace.DNSStart != nil, trace.DNSDone != nil)
	}
}

func TestUsageLogCreatedAtTracksRequestStartTime(t *testing.T) {
	const upstreamDelay = 150 * time.Millisecond

	application := newTestApp(t)
	client := createTestClient(t, application, "created-at-client-secret")
	backend := createTestBackend(t, application, domain.Backend{
		Name:      "alpha",
		BaseURL:   "https://alpha.local/root/v1",
		APIKey:    "alpha-key",
		Weight:    1,
		Models:    []string{"gpt-4o"},
		Endpoints: []string{domain.EndpointChat},
	})

	fixture := newFailoverFixture(t, []domain.Backend{backend})
	application.proxy = proxy.NewWithHTTPClient(&http.Client{
		Transport: delayedRoundTripper{delay: upstreamDelay, next: fixture},
	})

	req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(`{"model":"gpt-4o","messages":[{"role":"user","content":"hello"}]}`))
	req.Header.Set("Authorization", "Bearer "+client.Token)

	startedAt := time.Now()
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)
	finishedAt := time.Now()

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

	log := logs[0]
	if log.DurationMS < upstreamDelay.Milliseconds() {
		t.Fatalf("expected duration_ms to include upstream delay, got %d", log.DurationMS)
	}
	if log.CreatedAt.Before(startedAt.Add(-50 * time.Millisecond)) {
		t.Fatalf("expected created_at near request start, got %s before %s", log.CreatedAt, startedAt)
	}
	if finishedAt.Sub(log.CreatedAt) < upstreamDelay-(50*time.Millisecond) {
		t.Fatalf("expected created_at to reflect request start, got started=%s finished=%s delta=%s", log.CreatedAt, finishedAt, finishedAt.Sub(log.CreatedAt))
	}
}

func TestUsageLogRecordsUpstreamErrorBodyOnTerminalFailure(t *testing.T) {
	application := newTestApp(t)
	client := createTestClient(t, application, "terminal-failure-client-secret")
	backend := createTestBackend(t, application, domain.Backend{
		Name:      "alpha",
		BaseURL:   "https://alpha.local/root/v1",
		APIKey:    "alpha-key",
		Weight:    1,
		Models:    []string{"gpt-4o"},
		Endpoints: []string{domain.EndpointResponses},
	})

	fixture := newFailoverFixture(t, []domain.Backend{backend})
	fixture.statusByName[backend.Name] = http.StatusBadGateway
	fixture.responseBodyByName[backend.Name] = `{"error":{"message":"alpha upstream exploded"}}`
	application.proxy = proxy.NewWithHTTPClient(&http.Client{Transport: fixture})

	req := httptest.NewRequest(http.MethodPost, "/v1/responses", strings.NewReader(`{"model":"gpt-4o","input":"hello failure"}`))
	req.Header.Set("Authorization", "Bearer "+client.Token)
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected proxy request to fail with 503, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	logs, err := application.store.ListUsageLogsPage(context.Background(), 10, 0)
	if err != nil {
		t.Fatalf("list usage logs: %v", err)
	}
	if len(logs) != 1 {
		t.Fatalf("expected one usage log, got %d", len(logs))
	}

	log := logs[0]
	if log.BackendName != backend.Name {
		t.Fatalf("expected failed usage log to keep backend name %q, got %q", backend.Name, log.BackendName)
	}
	if log.StatusCode != http.StatusBadGateway {
		t.Fatalf("expected failed usage log to store upstream status, got %#v", log)
	}
	if !strings.Contains(log.ResponseBodyPreview, "alpha upstream exploded") {
		t.Fatalf("expected failed usage log to store upstream error body, got %#v", log)
	}
}

func TestUsageLogRecordsUpstreamErrorBodyOnFailoverAttempt(t *testing.T) {
	application := newTestApp(t)
	client := createTestClient(t, application, "failover-failure-client-secret")
	backends := []domain.Backend{
		createTestBackend(t, application, domain.Backend{
			Name:      "alpha",
			BaseURL:   "https://alpha.local/root/v1",
			APIKey:    "alpha-key",
			Weight:    2,
			Models:    []string{"gpt-4o"},
			Endpoints: []string{domain.EndpointResponses},
		}),
		createTestBackend(t, application, domain.Backend{
			Name:      "beta",
			BaseURL:   "https://beta.local/root/v1",
			APIKey:    "beta-key",
			Weight:    1,
			Models:    []string{"gpt-4o"},
			Endpoints: []string{domain.EndpointResponses},
		}),
	}

	fixture := newFailoverFixture(t, backends)
	fixture.statusByName["alpha"] = http.StatusTooManyRequests
	fixture.responseBodyByName["alpha"] = `{"error":{"message":"alpha rate limited"}}`
	fixture.responseBodyByName["beta"] = `{"backend":"beta"}`
	application.proxy = proxy.NewWithHTTPClient(&http.Client{Transport: fixture})

	req := httptest.NewRequest(http.MethodPost, "/v1/responses", strings.NewReader(`{"model":"gpt-4o","input":"hello failover"}`))
	req.Header.Set("Authorization", "Bearer "+client.Token)
	recorder := httptest.NewRecorder()
	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected proxy request to succeed after failover, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	logs, err := application.store.ListUsageLogsPage(context.Background(), 10, 0)
	if err != nil {
		t.Fatalf("list usage logs: %v", err)
	}
	if len(logs) != 2 {
		t.Fatalf("expected two usage logs, got %d", len(logs))
	}

	var failedAttempt *domain.UsageLog
	for i := range logs {
		if logs[i].BackendName == "alpha" && logs[i].StatusCode == http.StatusTooManyRequests {
			failedAttempt = &logs[i]
			break
		}
	}
	if failedAttempt == nil {
		t.Fatalf("expected failed alpha attempt in usage logs, got %#v", logs)
	}
	if failedAttempt.Attempts != 1 {
		t.Fatalf("expected failed attempt number 1, got %#v", failedAttempt)
	}
	if !strings.Contains(failedAttempt.ResponseBodyPreview, "alpha rate limited") {
		t.Fatalf("expected failed attempt to store upstream error body, got %#v", failedAttempt)
	}
}

type delayedRoundTripper struct {
	delay time.Duration
	next  http.RoundTripper
}

func (d delayedRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	time.Sleep(d.delay)
	return d.next.RoundTrip(req)
}
