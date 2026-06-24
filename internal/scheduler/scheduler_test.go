package scheduler

import (
	"context"
	"testing"
	"time"

	"token-gate/internal/domain"
	"token-gate/internal/store"
)

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

func TestSelectBackendIgnoresEndpointCapability(t *testing.T) {
	ctx := context.Background()
	st := openTestStore(t)
	defer st.Close()

	backend := createBackend(t, st, domain.Backend{
		Name:      "any-endpoint",
		Protocol:  domain.BackendProtocolOpenAI,
		BaseURL:   "https://any.local/v1",
		APIKey:    "any-key",
		Weight:    5,
		Models:    []string{"gpt-4o"},
		Endpoints: []string{domain.EndpointChat},
	})

	service := New(st, time.Minute, 2)
	selection, err := service.SelectBackend(ctx, domain.EndpointResponses, "gpt-4o")
	if err != nil {
		t.Fatalf("SelectBackend returned error: %v", err)
	}
	if len(selection.Candidates) != 1 || selection.Candidates[0].ID != backend.ID {
		t.Fatalf("expected backend to be selectable regardless of endpoint, got %#v", selection.Candidates)
	}
}

func openTestStore(t *testing.T) *store.Store {
	t.Helper()

	st, err := store.Open(context.Background(), t.TempDir()+"/test.db")
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	return st
}

func createBackend(t *testing.T, st *store.Store, backend domain.Backend) domain.Backend {
	t.Helper()

	created, err := st.CreateBackend(context.Background(), backend)
	if err != nil {
		t.Fatalf("create backend %q: %v", backend.Name, err)
	}
	return created
}
