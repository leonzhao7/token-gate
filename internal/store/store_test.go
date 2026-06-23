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
