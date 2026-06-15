package scheduler

import (
	"context"
	"testing"
	"time"

	"token-gate/internal/domain"
	"token-gate/internal/store"
)

func TestSelectBackendMatchesModelPatternEndpointAndPool(t *testing.T) {
	ctx := context.Background()
	st := openTestStore(t)
	defer st.Close()

	imageBackend := createBackend(t, st, domain.Backend{
		Name:      "image-a",
		Pool:      "image",
		BaseURL:   "https://image.local/v1",
		APIKey:    "image-key",
		Enabled:   true,
		Weight:    1,
		Models:    []string{"gpt-image-*"},
		Endpoints: []string{domain.EndpointImages},
	})
	createBackend(t, st, domain.Backend{
		Name:      "chat-a",
		Pool:      "chat",
		BaseURL:   "https://chat.local/v1",
		APIKey:    "chat-key",
		Enabled:   true,
		Weight:    1,
		Models:    []string{"gpt-4o"},
		Endpoints: []string{domain.EndpointChat},
	})
	createPolicy(t, st, domain.ModelPolicy{
		Pattern:         "gpt-image-*",
		Endpoint:        domain.EndpointImages,
		PlacementPolicy: domain.PlacementPack,
		BackendPool:     "image",
		FailoverEnabled: true,
		Priority:        10,
	})
	createPolicy(t, st, domain.ModelPolicy{
		Pattern:         "*",
		Endpoint:        "*",
		PlacementPolicy: domain.PlacementSticky,
		FailoverEnabled: true,
		Priority:        100,
	})

	service := New(st, time.Second, 1)
	selection, err := service.SelectBackend(ctx, domain.ClientKey{TokenHash: "client-a"}, domain.EndpointImages, "gpt-image-2")
	if err != nil {
		t.Fatalf("SelectBackend returned error: %v", err)
	}
	if selection.Policy.Pattern != "gpt-image-*" {
		t.Fatalf("expected image policy, got %q", selection.Policy.Pattern)
	}
	if selection.Policy.PlacementPolicy != domain.PlacementPack {
		t.Fatalf("expected pack placement, got %q", selection.Policy.PlacementPolicy)
	}
	if len(selection.Candidates) != 1 {
		t.Fatalf("expected one candidate, got %d", len(selection.Candidates))
	}
	if selection.Candidates[0].ID != imageBackend.ID {
		t.Fatalf("expected image backend, got %#v", selection.Candidates[0])
	}
}

func TestPackPlacementUsesRouteGroupAcrossClients(t *testing.T) {
	clientA := domain.ClientKey{TokenHash: "client-a", RouteGroup: "frontend-group"}
	clientB := domain.ClientKey{TokenHash: "client-b", RouteGroup: "frontend-group"}
	clientC := domain.ClientKey{TokenHash: "client-c", RouteGroup: "other-group"}

	keyA := buildRouteKey(clientA, "gpt-4o", domain.PlacementPack)
	keyB := buildRouteKey(clientB, "gpt-4o", domain.PlacementPack)
	keyC := buildRouteKey(clientC, "gpt-4o", domain.PlacementPack)

	if keyA != keyB {
		t.Fatalf("clients in the same route group should share pack route key: %q != %q", keyA, keyB)
	}
	if keyA == keyC {
		t.Fatalf("clients in different route groups should not share pack route key: %q", keyA)
	}
}

func TestFailedBackendIsSkippedWhileAvailableCandidateExists(t *testing.T) {
	ctx := context.Background()
	st := openTestStore(t)
	defer st.Close()

	createBackend(t, st, domain.Backend{
		Name:      "first",
		BaseURL:   "https://first.local/v1",
		APIKey:    "first-key",
		Enabled:   true,
		Weight:    1,
		Models:    []string{"gpt-4o"},
		Endpoints: []string{domain.EndpointChat},
	})
	createBackend(t, st, domain.Backend{
		Name:      "second",
		BaseURL:   "https://second.local/v1",
		APIKey:    "second-key",
		Enabled:   true,
		Weight:    1,
		Models:    []string{"gpt-4o"},
		Endpoints: []string{domain.EndpointChat},
	})

	service := New(st, time.Minute, 2)
	client := domain.ClientKey{TokenHash: "client-a"}
	initial, err := service.SelectBackend(ctx, client, domain.EndpointChat, "gpt-4o")
	if err != nil {
		t.Fatalf("initial SelectBackend returned error: %v", err)
	}
	if len(initial.Candidates) != 2 {
		t.Fatalf("expected two initial candidates, got %d", len(initial.Candidates))
	}

	service.MarkFailure(initial.Candidates[0].ID, assertErr("upstream failed"))

	stillAvailable, err := service.SelectBackend(ctx, client, domain.EndpointChat, "gpt-4o")
	if err != nil {
		t.Fatalf("SelectBackend below cooling threshold returned error: %v", err)
	}
	if len(stillAvailable.Candidates) != 2 {
		t.Fatalf("expected both candidates before cooling threshold, got %d", len(stillAvailable.Candidates))
	}

	service.MarkFailure(initial.Candidates[0].ID, assertErr("upstream failed again"))

	afterFailure, err := service.SelectBackend(ctx, client, domain.EndpointChat, "gpt-4o")
	if err != nil {
		t.Fatalf("SelectBackend after failure returned error: %v", err)
	}
	if len(afterFailure.Candidates) != 1 {
		t.Fatalf("expected only available candidate after failure, got %d", len(afterFailure.Candidates))
	}
	if afterFailure.Candidates[0].ID == initial.Candidates[0].ID {
		t.Fatalf("failed backend should be skipped while another candidate is available")
	}

	service.MarkFailure(afterFailure.Candidates[0].ID, assertErr("second upstream failed"))
	service.MarkFailure(afterFailure.Candidates[0].ID, assertErr("second upstream failed again"))

	allCooling, err := service.SelectBackend(ctx, client, domain.EndpointChat, "gpt-4o")
	if err != ErrNoBackendAvailable {
		t.Fatalf("expected ErrNoBackendAvailable when all candidates are cooling, got selection=%#v err=%v", allCooling, err)
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

func createPolicy(t *testing.T, st *store.Store, policy domain.ModelPolicy) domain.ModelPolicy {
	t.Helper()

	created, err := st.CreateModelPolicy(context.Background(), policy)
	if err != nil {
		t.Fatalf("create policy %q: %v", policy.Pattern, err)
	}
	return created
}

type assertErr string

func (e assertErr) Error() string {
	return string(e)
}
