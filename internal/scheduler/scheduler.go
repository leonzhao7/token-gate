package scheduler

import (
	"context"
	"crypto/sha256"
	"encoding/binary"
	"errors"
	"math"
	"path"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"token-gate/internal/domain"
	"token-gate/internal/store"
)

var ErrNoBackendAvailable = errors.New("no backend available")

type Selection struct {
	Policy     domain.ModelPolicy `json:"policy"`
	Candidates []domain.Backend   `json:"candidates"`
}

type BackendRuntime struct {
	ActiveRequests      int64      `json:"active_requests"`
	ConsecutiveFailures int        `json:"consecutive_failures"`
	CooldownUntil       *time.Time `json:"cooldown_until,omitempty"`
	LastError           string     `json:"last_error"`
}

type runtimeState struct {
	activeRequests      atomic.Int64
	consecutiveFailures int
	cooldownUntil       time.Time
	lastError           string
}

type Service struct {
	store           *store.Store
	backendCooldown time.Duration
	mu              sync.RWMutex
	states          map[int64]*runtimeState
}

func New(store *store.Store, backendCooldown time.Duration) *Service {
	return &Service{
		store:           store,
		backendCooldown: backendCooldown,
		states:          make(map[int64]*runtimeState),
	}
}

func (s *Service) SelectBackend(ctx context.Context, client domain.ClientKey, endpoint, model string) (Selection, error) {
	backends, err := s.store.ListBackends(ctx)
	if err != nil {
		return Selection{}, err
	}
	policies, err := s.store.ListModelPolicies(ctx)
	if err != nil {
		return Selection{}, err
	}

	policy := pickPolicy(policies, endpoint, model)
	placement := effectivePlacement(client, policy)
	routeKey := buildRouteKey(client, model, placement)

	var available []scoredBackend
	var cooling []scoredBackend
	now := time.Now().UTC()

	for _, backend := range backends {
		if !backend.Enabled {
			continue
		}
		if policy.BackendPool != "" && policy.BackendPool != backend.Pool {
			continue
		}
		if !supportsEndpoint(backend.Endpoints, endpoint) {
			continue
		}
		if !supportsModel(backend.Models, model) {
			continue
		}

		state := s.getState(backend.ID)
		score := rendezvousScore(routeKey, backend, placement, state.activeRequests.Load())

		if !state.cooldownUntil.IsZero() && state.cooldownUntil.After(now) {
			cooling = append(cooling, scoredBackend{backend: backend, score: score})
			continue
		}
		available = append(available, scoredBackend{backend: backend, score: score})
	}

	sortBackends(available)
	sortBackends(cooling)

	if len(available) > 0 {
		return Selection{Policy: policy, Candidates: unwrapBackends(available)}, nil
	}
	if len(cooling) > 0 {
		return Selection{Policy: policy, Candidates: unwrapBackends(cooling)}, nil
	}
	return Selection{}, ErrNoBackendAvailable
}

func (s *Service) Acquire(backendID int64) func() {
	state := s.getState(backendID)
	state.activeRequests.Add(1)
	return func() {
		state.activeRequests.Add(-1)
	}
}

func (s *Service) MarkSuccess(backendID int64) {
	state := s.getState(backendID)

	s.mu.Lock()
	defer s.mu.Unlock()

	state.consecutiveFailures = 0
	state.cooldownUntil = time.Time{}
	state.lastError = ""
}

func (s *Service) MarkFailure(backendID int64, err error) {
	state := s.getState(backendID)

	s.mu.Lock()
	defer s.mu.Unlock()

	state.consecutiveFailures++
	state.lastError = errorString(err)
	backoff := s.backendCooldown
	if backoff <= 0 {
		backoff = 20 * time.Second
	}
	multiplier := state.consecutiveFailures
	if multiplier > 5 {
		multiplier = 5
	}
	state.cooldownUntil = time.Now().UTC().Add(time.Duration(multiplier) * backoff)
}

func (s *Service) Snapshot() map[int64]BackendRuntime {
	s.mu.RLock()
	defer s.mu.RUnlock()

	out := make(map[int64]BackendRuntime, len(s.states))
	for id, state := range s.states {
		runtime := BackendRuntime{
			ActiveRequests:      state.activeRequests.Load(),
			ConsecutiveFailures: state.consecutiveFailures,
			LastError:           state.lastError,
		}
		if !state.cooldownUntil.IsZero() {
			value := state.cooldownUntil
			runtime.CooldownUntil = &value
		}
		out[id] = runtime
	}
	return out
}

func (s *Service) getState(backendID int64) *runtimeState {
	s.mu.RLock()
	state, ok := s.states[backendID]
	s.mu.RUnlock()
	if ok {
		return state
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	if state, ok = s.states[backendID]; ok {
		return state
	}
	state = &runtimeState{}
	s.states[backendID] = state
	return state
}

func pickPolicy(policies []domain.ModelPolicy, endpoint, model string) domain.ModelPolicy {
	best := domain.ModelPolicy{
		Pattern:         "*",
		Endpoint:        endpoint,
		PlacementPolicy: domain.PlacementSticky,
		FailoverEnabled: true,
		Priority:        1000,
	}
	bestSpecificity := -1

	for _, policy := range policies {
		if !matchPattern(policy.Endpoint, endpoint) {
			continue
		}
		if !matchPattern(policy.Pattern, model) {
			continue
		}

		specificity := patternSpecificity(policy.Pattern)
		if policy.Priority < best.Priority || (policy.Priority == best.Priority && specificity > bestSpecificity) {
			best = policy
			bestSpecificity = specificity
		}
	}
	return best
}

func effectivePlacement(client domain.ClientKey, policy domain.ModelPolicy) string {
	value := strings.TrimSpace(client.RouteModeOverride)
	if value == "" {
		value = strings.TrimSpace(policy.PlacementPolicy)
	}
	switch value {
	case domain.PlacementPack, domain.PlacementSpread, domain.PlacementSticky:
		return value
	default:
		return domain.PlacementSticky
	}
}

func buildRouteKey(client domain.ClientKey, model, placement string) string {
	switch placement {
	case domain.PlacementPack:
		group := strings.TrimSpace(client.RouteGroup)
		if group == "" {
			group = "shared"
		}
		return group + "|" + model
	default:
		return client.TokenHash + "|" + model
	}
}

func rendezvousScore(routeKey string, backend domain.Backend, placement string, activeRequests int64) float64 {
	hash := hashUint64(routeKey + "|" + backend.Name + "|" + backend.BaseURL)
	u := (float64(hash) + 1) / (float64(math.MaxUint64) + 1)
	if u <= 0 {
		u = 1e-12
	}

	score := float64(maxInt(backend.Weight, 1)) / -math.Log(u)
	if placement == domain.PlacementSpread {
		score = score / float64(activeRequests+1)
	}
	return score
}

func hashUint64(input string) uint64 {
	sum := sha256.Sum256([]byte(input))
	return binary.BigEndian.Uint64(sum[:8])
}

func sortBackends(values []scoredBackend) {
	sort.SliceStable(values, func(i, j int) bool {
		return values[i].score > values[j].score
	})
}

type scoredBackend struct {
	backend domain.Backend
	score   float64
}

func unwrapBackends(values []scoredBackend) []domain.Backend {
	out := make([]domain.Backend, 0, len(values))
	for _, value := range values {
		out = append(out, value.backend)
	}
	return out
}

func supportsEndpoint(endpoints []string, endpoint string) bool {
	for _, candidate := range endpoints {
		if matchPattern(candidate, endpoint) {
			return true
		}
	}
	return false
}

func supportsModel(patterns []string, model string) bool {
	for _, candidate := range patterns {
		if matchPattern(candidate, model) {
			return true
		}
	}
	return false
}

func matchPattern(pattern, value string) bool {
	pattern = strings.TrimSpace(pattern)
	if pattern == "" || pattern == "*" {
		return true
	}
	if !strings.ContainsAny(pattern, "*?") {
		return pattern == value
	}
	ok, err := path.Match(pattern, value)
	return err == nil && ok
}

func patternSpecificity(pattern string) int {
	pattern = strings.TrimSpace(pattern)
	if pattern == "" || pattern == "*" {
		return 0
	}
	return len(strings.ReplaceAll(pattern, "*", ""))
}

func errorString(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}
