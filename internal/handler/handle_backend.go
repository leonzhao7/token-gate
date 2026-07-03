package handler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"token-gate/internal/domain"
	"token-gate/internal/store"
)

type BackendHandler struct {
	store *store.Store
}

func NewBackendHandler(st *store.Store) *BackendHandler {
	return &BackendHandler{store: st}
}

type BackendView struct {
	domain.Backend
	RequestCount   int                `json:"request_count"`
	AvgLatencyMS   float64            `json:"avg_latency_ms"`
	LastUsedAt     *time.Time         `json:"last_used_at,omitempty"`
	ModelCount     int                `json:"model_count"`
	EndpointCount  int                `json:"endpoint_count"`
	HourlyRequests int                `json:"hourly_requests"`
	HourlyFailures int                `json:"hourly_failures"`
	RecentStats    BackendRecentStats `json:"recent_stats"`
}

type BackendRecentStats struct {
	WindowMinutes int `json:"window_minutes"`
	Successes     int `json:"successes"`
	Failures      int `json:"failures"`
}

type backendImportExportPayload struct {
	Backends []backendImportExportItem `json:"backends"`
}

type backendImportExportItem struct {
	Name                string            `json:"name"`
	Protocol            string            `json:"protocol"`
	BaseURL             string            `json:"base_url"`
	APIKey              string            `json:"api_key"`
	ConsoleURL          string            `json:"console_url"`
	Tags                []string          `json:"tags"`
	ConsoleUsername     string            `json:"console_username"`
	ConsolePassword     string            `json:"console_password"`
	Notes               string            `json:"notes"`
	ProxyID             int64             `json:"proxy_id"`
	Status              string            `json:"status"`
	ConsecutiveFailures int               `json:"consecutive_failures"`
	Weight              int               `json:"weight"`
	Models              []string          `json:"models"`
	ModelMapping        map[string]string `json:"model_mapping"`
	Endpoints           []string          `json:"endpoints"`
}

type BackendUsageSummary struct {
	RequestCount int
	AvgLatencyMS float64
	LastUsedAt   *time.Time
}

type backendHourlyModelStatsResponse struct {
	Query backendHourlyModelStatsQuery  `json:"query"`
	Scope backendHourlyModelStatsScope  `json:"scope"`
	Items []backendHourlyModelStatsItem `json:"items"`
}

type backendHourlyModelStatsQuery struct {
	Backend   *string `json:"backend"`
	Model     *string `json:"model"`
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
	InputTokens          int64   `json:"input_tokens"`
	OutputTokens         int64   `json:"output_tokens"`
	InputCacheTokens     int64   `json:"input_cache_tokens"`
	SuccessAvgDurationMS float64 `json:"success_avg_duration_ms"`
	SuccessRequestBytes  int64   `json:"success_request_bytes"`
	SuccessResponseBytes int64   `json:"success_response_bytes"`
}

type resourceDetailEntry struct {
	Key   string `json:"key,omitempty"`
	Label string `json:"label"`
	Value any    `json:"value"`
}

type resourceDetailActivity struct {
	Usage     []domain.UsageLog   `json:"usage,omitempty"`
	UsageLogs []domain.UsageLog   `json:"usage_logs,omitempty"`
	Events    []domain.AuditEvent `json:"events,omitempty"`
	Backends  []domain.Backend    `json:"backends,omitempty"`
}

type resourceDetailPayload struct {
	Overview      []resourceDetailEntry  `json:"overview"`
	Configuration []resourceDetailEntry  `json:"configuration"`
	Metadata      []resourceDetailEntry  `json:"metadata"`
	Raw           any                    `json:"raw"`
	Activity      resourceDetailActivity `json:"activity"`
}

func (h *BackendHandler) HandleListBackends(w http.ResponseWriter, r *http.Request) {
	page, limit := parsePageQuery(r)
	total, err := h.store.CountBackends(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	backends, err := h.store.ListBackendsPage(r.Context(), limit, pageOffset(page, limit))
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	stats, err := h.store.BackendRequestStatsSince(r.Context(), time.Now().UTC().Add(-30*time.Minute))
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	hourlyStats, err := h.store.BackendHourlyStatsByIDs(r.Context(), backendIDs(backends), time.Now().UTC().Add(-1*time.Hour))
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	summaries, err := h.BackendUsageSummaryMap(r.Context(), backends)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	response := BuildBackendViews(backends, summaries, stats, hourlyStats)
	writeJSON(w, http.StatusOK, pagedResponse(EnsureBackendViews(response), total, page, limit))
}

func (h *BackendHandler) HandleExportBackends(w http.ResponseWriter, r *http.Request) {
	backends, err := h.store.ListBackends(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	items := make([]backendImportExportItem, 0, len(backends))
	for _, backend := range backends {
		items = append(items, backendToImportExportItem(backend))
	}
	w.Header().Set("Content-Disposition", `attachment; filename="token-gate-backends.json"`)
	writeJSON(w, http.StatusOK, backendImportExportPayload{Backends: items})
}

func (h *BackendHandler) HandleImportBackends(w http.ResponseWriter, r *http.Request) {
	var payload backendImportExportPayload
	if err := decodeJSON(r, &payload); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	backends, err := h.validateBackendImportPayload(r.Context(), payload)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	imported, err := h.store.ImportBackends(r.Context(), backends)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{
		"imported": len(imported),
		"backends": imported,
	})
}

func (h *BackendHandler) HandleCreateBackend(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		Name            string            `json:"name"`
		Protocol        string            `json:"protocol"`
		BaseURL         string            `json:"base_url"`
		APIKey          string            `json:"api_key"`
		ConsoleURL      string            `json:"console_url"`
		Tags            []string          `json:"tags"`
		ConsoleUsername string            `json:"console_username"`
		ConsolePassword string            `json:"console_password"`
		Notes           string            `json:"notes"`
		ProxyID         int64             `json:"proxy_id"`
		Status          string            `json:"status"`
		Weight          int               `json:"weight"`
		Models          []string          `json:"models"`
		ModelMapping    map[string]string `json:"model_mapping"`
		Endpoints       []string          `json:"endpoints"`
	}
	if err := decodeJSON(r, &payload); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := validateURL(payload.BaseURL); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if strings.TrimSpace(payload.ConsoleURL) != "" {
		if err := validateURL(payload.ConsoleURL); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
	}
	if err := h.validateSocksProxyReference(r.Context(), payload.ProxyID); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	backend, err := h.store.CreateBackend(r.Context(), domain.Backend{
		Name:            payload.Name,
		Protocol:        domain.NormalizeBackendProtocol(payload.Protocol),
		BaseURL:         payload.BaseURL,
		APIKey:          payload.APIKey,
		ConsoleURL:      payload.ConsoleURL,
		Tags:            payload.Tags,
		ConsoleUsername: payload.ConsoleUsername,
		ConsolePassword: payload.ConsolePassword,
		Notes:           payload.Notes,
		ProxyID:         payload.ProxyID,
		Weight:          payload.Weight,
		Models:          payload.Models,
		ModelMapping:    payload.ModelMapping,
		Endpoints:       payload.Endpoints,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	_ = h.store.AppendAuditEvent(r.Context(), domain.AuditEvent{
		Type:        "admin_backend_create",
		Message:     "backend created",
		BackendName: backend.Name,
	})
	writeJSON(w, http.StatusCreated, backend)
}

func (h *BackendHandler) HandleUpdateBackend(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	current, err := h.store.GetBackend(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "backend not found")
		return
	}

	var payload struct {
		Name            string            `json:"name"`
		Protocol        string            `json:"protocol"`
		BaseURL         string            `json:"base_url"`
		APIKey          string            `json:"api_key"`
		ConsoleURL      string            `json:"console_url"`
		Tags            []string          `json:"tags"`
		ConsoleUsername string            `json:"console_username"`
		ConsolePassword string            `json:"console_password"`
		Notes           string            `json:"notes"`
		ProxyID         int64             `json:"proxy_id"`
		Status          string            `json:"status"`
		Weight          int               `json:"weight"`
		Models          []string          `json:"models"`
		ModelMapping    map[string]string `json:"model_mapping"`
		Endpoints       []string          `json:"endpoints"`
	}
	if err := decodeJSON(r, &payload); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := validateURL(payload.BaseURL); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if strings.TrimSpace(payload.ConsoleURL) != "" {
		if err := validateURL(payload.ConsoleURL); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
	}
	if err := h.validateSocksProxyReference(r.Context(), payload.ProxyID); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	current.Name = payload.Name
	if strings.TrimSpace(payload.Protocol) != "" {
		current.Protocol = domain.NormalizeBackendProtocol(payload.Protocol)
	}
	current.BaseURL = payload.BaseURL
	if strings.TrimSpace(payload.APIKey) != "" {
		current.APIKey = payload.APIKey
	}
	current.ConsoleURL = payload.ConsoleURL
	current.Tags = payload.Tags
	current.ConsoleUsername = payload.ConsoleUsername
	current.ConsolePassword = payload.ConsolePassword
	current.Notes = payload.Notes
	current.ProxyID = payload.ProxyID
	switch payload.Status {
	case "":
	case domain.BackendStatusNormal, domain.BackendStatusDisabled:
		if current.Status != payload.Status {
			current.Status = payload.Status
			current.ConsecutiveFailures = 0
			current.RecoverAt = nil
		}
	default:
		writeError(w, http.StatusBadRequest, "invalid backend status")
		return
	}
	current.Weight = payload.Weight
	current.Models = payload.Models
	current.ModelMapping = payload.ModelMapping
	current.Endpoints = payload.Endpoints

	backend, err := h.store.UpdateBackend(r.Context(), current)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	_ = h.store.AppendAuditEvent(r.Context(), domain.AuditEvent{
		Type:        "admin_backend_update",
		Message:     "backend updated",
		BackendName: backend.Name,
	})
	writeJSON(w, http.StatusOK, backend)
}

func (h *BackendHandler) validateBackendImportPayload(ctx context.Context, payload backendImportExportPayload) ([]domain.Backend, error) {
	existing, err := h.store.ListBackends(ctx)
	if err != nil {
		return nil, err
	}
	existingNames := make(map[string]struct{}, len(existing))
	for _, backend := range existing {
		existingNames[strings.ToLower(strings.TrimSpace(backend.Name))] = struct{}{}
	}

	seenNames := make(map[string]struct{}, len(payload.Backends))
	backends := make([]domain.Backend, 0, len(payload.Backends))
	for i, item := range payload.Backends {
		name := strings.TrimSpace(item.Name)
		if name == "" {
			return nil, fmt.Errorf("backend %d name is required", i+1)
		}
		nameKey := strings.ToLower(name)
		if _, ok := seenNames[nameKey]; ok {
			return nil, fmt.Errorf("duplicate backend name in import: %s", name)
		}
		seenNames[nameKey] = struct{}{}
		if _, ok := existingNames[nameKey]; ok {
			return nil, fmt.Errorf("backend name already exists: %s", name)
		}
		if err := validateURL(item.BaseURL); err != nil {
			return nil, fmt.Errorf("backend %q base_url: %w", name, err)
		}
		if strings.TrimSpace(item.ConsoleURL) != "" {
			if err := validateURL(item.ConsoleURL); err != nil {
				return nil, fmt.Errorf("backend %q console_url: %w", name, err)
			}
		}
		if err := h.validateSocksProxyReference(ctx, item.ProxyID); err != nil {
			return nil, fmt.Errorf("backend %q: %w", name, err)
		}
		status := strings.ToLower(strings.TrimSpace(item.Status))
		if status == "" {
			status = domain.BackendStatusNormal
		}
		switch status {
		case domain.BackendStatusNormal, domain.BackendStatusAbnormal, domain.BackendStatusDisabled:
		default:
			return nil, fmt.Errorf("backend %q invalid status", name)
		}
		if item.ConsecutiveFailures < 0 {
			return nil, fmt.Errorf("backend %q consecutive_failures must be >= 0", name)
		}
		backends = append(backends, domain.Backend{
			Name:                name,
			Protocol:            domain.NormalizeBackendProtocol(item.Protocol),
			BaseURL:             item.BaseURL,
			APIKey:              item.APIKey,
			ConsoleURL:          item.ConsoleURL,
			Tags:                item.Tags,
			ConsoleUsername:     item.ConsoleUsername,
			ConsolePassword:     item.ConsolePassword,
			Notes:               item.Notes,
			ProxyID:             item.ProxyID,
			Status:              status,
			ConsecutiveFailures: item.ConsecutiveFailures,
			Weight:              item.Weight,
			Models:              item.Models,
			ModelMapping:        item.ModelMapping,
			Endpoints:           item.Endpoints,
		})
	}
	return backends, nil
}

func backendToImportExportItem(backend domain.Backend) backendImportExportItem {
	return backendImportExportItem{
		Name:                backend.Name,
		Protocol:            domain.NormalizeBackendProtocol(backend.Protocol),
		BaseURL:             backend.BaseURL,
		APIKey:              backend.APIKey,
		ConsoleURL:          backend.ConsoleURL,
		Tags:                backend.Tags,
		ConsoleUsername:     backend.ConsoleUsername,
		ConsolePassword:     backend.ConsolePassword,
		Notes:               backend.Notes,
		ProxyID:             backend.ProxyID,
		Status:              backend.Status,
		ConsecutiveFailures: backend.ConsecutiveFailures,
		Weight:              backend.Weight,
		Models:              backend.Models,
		ModelMapping:        backend.ModelMapping,
		Endpoints:           backend.Endpoints,
	}
}

func (h *BackendHandler) HandleDeleteBackend(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := h.store.DeleteBackend(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"deleted": id})
}

func (h *BackendHandler) HandleBackendDetail(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	detail, err := h.store.BackendDetail(r.Context(), id, 10)
	if err != nil {
		writeError(w, http.StatusNotFound, "backend not found")
		return
	}
	writeJSON(w, http.StatusOK, resourceDetailPayload{
		Overview: []resourceDetailEntry{
			detailEntry("name", "Name", detail.Backend.Name),
			detailEntry("console_url", "Console URL", detail.Backend.ConsoleURL),
			detailEntry("console_username", "Console Username", detail.Backend.ConsoleUsername),
			detailEntry("console_password", "Console Password", secretPresenceValue(detail.Backend.ConsolePassword)),
			detailEntry("status", "Status", detail.Backend.Status),
			detailEntry("consecutive_failures", "Consecutive Failures", detail.Backend.ConsecutiveFailures),
			detailEntry("recover_at", "Recover At", optionalTimePointer(detail.Backend.RecoverAt)),
			detailEntry("proxy", "Proxy", backendProxyDisplay(detail.Backend)),
			detailEntry("proxy_id", "Proxy ID", detail.Backend.ProxyID),
			detailEntry("protocol", "Protocol", detail.Backend.Protocol),
			detailEntry("weight", "Weight", detail.Backend.Weight),
		},
		Configuration: []resourceDetailEntry{
			detailEntry("api_key", "API Key", secretPresenceValue(detail.Backend.APIKey)),
			detailEntry("tags", "Tags", detail.Backend.Tags),
			detailEntry("notes", "Notes", detail.Backend.Notes),
			detailEntry("models", "Models", detail.Backend.Models),
			detailEntry("model_mapping", "Model Mapping", detail.Backend.ModelMapping),
			detailEntry("endpoints", "Endpoints", detail.Backend.Endpoints),
			detailEntry("base_url", "Base URL", detail.Backend.BaseURL),
		},
		Metadata: []resourceDetailEntry{
			detailEntry("id", "ID", detail.Backend.ID),
			detailEntry("created_at", "Created At", detail.Backend.CreatedAt),
			detailEntry("updated_at", "Updated At", detail.Backend.UpdatedAt),
		},
		Raw: maskedBackendDetail(detail.Backend),
		Activity: resourceDetailActivity{
			Usage:     EnsureUsageLogs(detail.Usage),
			UsageLogs: EnsureUsageLogs(detail.Usage),
			Events:    EnsureAuditEvents(detail.Events),
			Backends:  []domain.Backend{},
		},
	})
}

func (h *BackendHandler) HandleBackendHourlyModelStats(w http.ResponseWriter, r *http.Request) {
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
	result, err := h.store.ListBackendHourlyModelStats(r.Context(), filter)
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
			InputTokens:          row.SuccessInputTokens,
			OutputTokens:         row.SuccessOutputTokens,
			InputCacheTokens:     row.SuccessInputCacheTokens,
			SuccessAvgDurationMS: avg,
			SuccessRequestBytes:  row.SuccessRequestBytes,
			SuccessResponseBytes: row.SuccessResponseBytes,
		})
	}

	backends := make([]backendHourlyModelStatsBackendRef, 0, len(result.Backends))
	for _, backend := range result.Backends {
		backends = append(backends, backendHourlyModelStatsBackendRef{
			ID:   backend.ID,
			Name: backend.Name,
		})
	}

	writeJSON(w, http.StatusOK, backendHourlyModelStatsResponse{
		Query: backendHourlyModelStatsQuery{
			Backend:   optionalString(filter.BackendName),
			Model:     optionalString(filter.Model),
			StartHour: formatOptionalUTCTime(optionalTimeValue(startHour)),
			EndHour:   formatOptionalUTCTime(optionalTimeValue(endHour)),
		},
		Scope: backendHourlyModelStatsScope{
			Backends: backends,
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

func decodeJSON(r *http.Request, dst any) error {
	defer r.Body.Close()
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	return decoder.Decode(dst)
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]any{
		"error": map[string]any{
			"message": message,
			"type":    "token_gate_error",
		},
	})
}

func parseID(value string) (int64, error) {
	id, err := strconv.ParseInt(strings.TrimSpace(value), 10, 64)
	if err != nil || id <= 0 {
		return 0, errors.New("invalid id")
	}
	return id, nil
}

func validateURL(value string) error {
	parsed, err := url.Parse(strings.TrimSpace(value))
	if err != nil {
		return errors.New("invalid base_url")
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return errors.New("base_url must use http or https")
	}
	if parsed.Host == "" {
		return errors.New("base_url must include host")
	}
	return nil
}

func (h *BackendHandler) validateSocksProxyReference(ctx context.Context, proxyID int64) error {
	if proxyID < 0 {
		return errors.New("proxy_id must be >= 0")
	}
	if proxyID == 0 {
		return nil
	}
	if _, err := h.store.GetSocksProxy(ctx, proxyID); err != nil {
		return errors.New("socks proxy not found")
	}
	return nil
}

func EnsureBackendViews(values []BackendView) []BackendView {
	if values == nil {
		return []BackendView{}
	}
	return values
}

func (h *BackendHandler) BackendUsageSummaryMap(ctx context.Context, backends []domain.Backend) (map[int64]BackendUsageSummary, error) {
	ids := make([]int64, 0, len(backends))
	for _, backend := range backends {
		ids = append(ids, backend.ID)
	}

	storeSummaries, err := h.store.BackendUsageSummaryByIDs(ctx, ids)
	if err != nil {
		return nil, err
	}

	out := make(map[int64]BackendUsageSummary, len(storeSummaries))
	for backendID, summary := range storeSummaries {
		summaryValue := BackendUsageSummary{
			RequestCount: summary.RequestCount,
			AvgLatencyMS: summary.AvgLatencyMS,
		}
		if !summary.LastUsedAt.IsZero() {
			lastUsedAt := summary.LastUsedAt
			summaryValue.LastUsedAt = &lastUsedAt
		}
		out[backendID] = summaryValue
	}
	return out, nil
}

func BuildBackendViews(backends []domain.Backend, summaries map[int64]BackendUsageSummary, stats map[int64]store.BackendRequestStats, hourlyStats map[int64]store.BackendHourlyStats) []BackendView {
	views := make([]BackendView, 0, len(backends))
	for _, backend := range backends {
		stat := stats[backend.ID]
		summary := summaries[backend.ID]
		hourly := hourlyStats[backend.ID]
		views = append(views, BackendView{
			Backend:        backend,
			RequestCount:   summary.RequestCount,
			AvgLatencyMS:   summary.AvgLatencyMS,
			LastUsedAt:     summary.LastUsedAt,
			ModelCount:     len(backend.Models),
			EndpointCount:  len(backend.Endpoints),
			HourlyRequests: hourly.Requests,
			HourlyFailures: hourly.Failures,
			RecentStats: BackendRecentStats{
				WindowMinutes: 30,
				Successes:     stat.Successes,
				Failures:      stat.Failures,
			},
		})
	}
	return views
}

func backendIDs(values []domain.Backend) []int64 {
	if len(values) == 0 {
		return nil
	}
	ids := make([]int64, 0, len(values))
	for _, value := range values {
		ids = append(ids, value.ID)
	}
	return ids
}

func MappedBackendModel(backend domain.Backend, clientModel string) string {
	if backend.ModelMapping == nil {
		return clientModel
	}
	if mapped := strings.TrimSpace(backend.ModelMapping[strings.TrimSpace(clientModel)]); mapped != "" {
		return mapped
	}
	return clientModel
}

func optionalTimePointer(value *time.Time) *time.Time {
	if value == nil || value.IsZero() {
		return nil
	}
	copy := value.UTC()
	return &copy
}

func detailEntry(key, label string, value any) resourceDetailEntry {
	return resourceDetailEntry{
		Key:   key,
		Label: label,
		Value: value,
	}
}

func parsePageQuery(r *http.Request) (int, int) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if page < 1 {
		page = 1
	}
	if limit <= 0 {
		limit = 10
	}
	if limit > 10000 {
		limit = 10000
	}
	return page, limit
}

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

func optionalTimeValue(value time.Time) *time.Time {
	if value.IsZero() {
		return nil
	}
	copy := value
	return &copy
}

func pageOffset(page, limit int) int {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 10
	}
	return (page - 1) * limit
}

func pagedResponse(items any, total, page, limit int) map[string]any {
	return map[string]any{
		"items": items,
		"total": total,
		"page":  page,
		"limit": limit,
	}
}

func optionalString(value string) *string {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	copy := value
	return &copy
}

func secretPresenceValue(value string) string {
	if strings.TrimSpace(value) == "" {
		return ""
	}
	return "set"
}

func backendProxyDisplay(backend domain.Backend) string {
	if backend.ProxyID == 0 {
		return "direct"
	}
	if backend.Proxy == nil {
		return fmt.Sprintf("proxy #%d", backend.ProxyID)
	}
	label := strings.TrimSpace(backend.Proxy.Name)
	if label == "" {
		label = fmt.Sprintf("proxy #%d", backend.Proxy.ID)
	}
	if address := strings.TrimSpace(backend.Proxy.Address); address != "" {
		label = fmt.Sprintf("%s (%s)", label, address)
	}
	if !backend.Proxy.Enabled {
		label += " - disabled"
	}
	return label
}

func maskedBackendDetail(backend domain.Backend) domain.Backend {
	copy := backend
	copy.APIKey = secretPresenceValue(copy.APIKey)
	copy.ConsolePassword = secretPresenceValue(copy.ConsolePassword)
	return copy
}
