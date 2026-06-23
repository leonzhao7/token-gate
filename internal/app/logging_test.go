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

type delayedRoundTripper struct {
	delay time.Duration
	next  http.RoundTripper
}

func (d delayedRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	time.Sleep(d.delay)
	return d.next.RoundTrip(req)
}
