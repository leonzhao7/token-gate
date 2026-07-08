package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"math/rand/v2"
	"net/http"
	"net/url"
	pathpkg "path"
	"strconv"
	"strings"
	"time"

	"token-gate/internal/config"
	"token-gate/internal/domain"
	proxypkg "token-gate/internal/proxy"
	"token-gate/internal/store"
)

type BackendHandler struct {
	store             *store.Store
	cfg               *config.Config
	consoleHTTPClient *http.Client
	logger            *slog.Logger
}

func NewBackendHandler(st *store.Store) *BackendHandler {
	return &BackendHandler{
		store:  st,
		logger: slog.Default().With("component", "backend_handler"),
	}
}

func (h *BackendHandler) SetConsoleHTTPClient(client *http.Client) {
	h.consoleHTTPClient = client
}

func (h *BackendHandler) SetConfig(cfg *config.Config) {
	h.cfg = cfg
}

func (h *BackendHandler) SetLogger(logger *slog.Logger) {
	if logger == nil {
		return
	}
	h.logger = logger.With("component", "backend_handler")
}

type BackendView struct {
	domain.Backend
	RequestCount   int                `json:"request_count"`
	AvgLatencyMS   float64            `json:"avg_latency_ms"`
	LastUsedAt     *time.Time         `json:"last_used_at,omitempty"`
	ModelCount     int                `json:"model_count"`
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
	Name                 string            `json:"name"`
	Protocol             string            `json:"protocol"`
	BackendType          string            `json:"backend_type"`
	BaseURL              string            `json:"base_url"`
	APIKey               string            `json:"api_key"`
	ConsoleURL           string            `json:"console_url"`
	Tags                 []string          `json:"tags"`
	ConsoleUsername      string            `json:"console_username"`
	ConsolePassword      string            `json:"console_password"`
	ConsoleAuthorization string            `json:"console_authorization"`
	ConsoleCheckinPath   string            `json:"console_checkin_path"`
	ChannelURL           string            `json:"channel_url"`
	ConsoleCookie        string            `json:"console_cookie"`
	ConsoleAccountJSON   string            `json:"console_account_json"`
	ConsolePricingJSON   string            `json:"console_pricing_json"`
	Notes                string            `json:"notes"`
	ProxyID              int64             `json:"proxy_id"`
	Status               string            `json:"status"`
	ConsecutiveFailures  int               `json:"consecutive_failures"`
	Weight               int               `json:"weight"`
	Models               []string          `json:"models"`
	ModelMapping         map[string]string `json:"model_mapping"`
	Endpoints            []string          `json:"endpoints,omitempty"`
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
		Name                 string            `json:"name"`
		Protocol             string            `json:"protocol"`
		BackendType          string            `json:"backend_type"`
		BaseURL              string            `json:"base_url"`
		APIKey               string            `json:"api_key"`
		ConsoleURL           string            `json:"console_url"`
		Tags                 []string          `json:"tags"`
		ConsoleUsername      string            `json:"console_username"`
		ConsolePassword      string            `json:"console_password"`
		ConsoleAuthorization string            `json:"console_authorization"`
		ConsoleCheckinPath   string            `json:"console_checkin_path"`
		ChannelURL           string            `json:"channel_url"`
		ConsoleCookie        string            `json:"console_cookie"`
		ConsoleUserID        *string           `json:"console_user_id"`
		Notes                string            `json:"notes"`
		ProxyID              int64             `json:"proxy_id"`
		Status               string            `json:"status"`
		Weight               int               `json:"weight"`
		Models               []string          `json:"models"`
		ModelMapping         map[string]string `json:"model_mapping"`
		Endpoints            []string          `json:"endpoints"`
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
	backendType := domain.NormalizeBackendType(payload.BackendType)
	consoleAuthorization := strings.TrimSpace(payload.ConsoleAuthorization)
	consoleCheckinPath := normalizeConsoleAPIPath(payload.ConsoleCheckinPath)
	channelURL := normalizeConsoleAPIPath(payload.ChannelURL)
	if backendType != domain.BackendTypeSub2API {
		consoleAuthorization = ""
		consoleCheckinPath = ""
		channelURL = ""
	}
	consoleCookie := strings.TrimSpace(payload.ConsoleCookie)
	if backendType != domain.BackendTypeNewAPI {
		consoleCookie = ""
	}
	consoleAccountJSON := ""
	if payload.ConsoleUserID != nil {
		var accountErr error
		consoleAccountJSON, accountErr = consoleAccountJSONWithUserID("", *payload.ConsoleUserID)
		if accountErr != nil {
			writeError(w, http.StatusBadRequest, accountErr.Error())
			return
		}
	}

	backend, err := h.store.CreateBackend(r.Context(), domain.Backend{
		Name:                 payload.Name,
		Protocol:             domain.NormalizeBackendProtocol(payload.Protocol),
		BackendType:          backendType,
		BaseURL:              payload.BaseURL,
		APIKey:               payload.APIKey,
		ConsoleURL:           payload.ConsoleURL,
		Tags:                 payload.Tags,
		ConsoleUsername:      payload.ConsoleUsername,
		ConsolePassword:      payload.ConsolePassword,
		ConsoleAuthorization: consoleAuthorization,
		ConsoleCheckinPath:   consoleCheckinPath,
		ChannelURL:           channelURL,
		ConsoleCookie:        consoleCookie,
		ConsoleAccountJSON:   consoleAccountJSON,
		Notes:                payload.Notes,
		ProxyID:              payload.ProxyID,
		Weight:               payload.Weight,
		Models:               payload.Models,
		ModelMapping:         payload.ModelMapping,
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
		Name                 string            `json:"name"`
		Protocol             string            `json:"protocol"`
		BackendType          string            `json:"backend_type"`
		BaseURL              string            `json:"base_url"`
		APIKey               string            `json:"api_key"`
		ConsoleURL           string            `json:"console_url"`
		Tags                 []string          `json:"tags"`
		ConsoleUsername      string            `json:"console_username"`
		ConsolePassword      string            `json:"console_password"`
		ConsoleAuthorization string            `json:"console_authorization"`
		ConsoleCheckinPath   string            `json:"console_checkin_path"`
		ChannelURL           string            `json:"channel_url"`
		ConsoleCookie        string            `json:"console_cookie"`
		ConsoleUserID        *string           `json:"console_user_id"`
		Notes                string            `json:"notes"`
		ProxyID              int64             `json:"proxy_id"`
		Status               string            `json:"status"`
		Weight               int               `json:"weight"`
		Models               []string          `json:"models"`
		ModelMapping         map[string]string `json:"model_mapping"`
		Endpoints            []string          `json:"endpoints"`
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
	current.BackendType = domain.NormalizeBackendType(payload.BackendType)
	current.BaseURL = payload.BaseURL
	if strings.TrimSpace(payload.APIKey) != "" {
		current.APIKey = payload.APIKey
	}
	current.ConsoleURL = payload.ConsoleURL
	current.Tags = payload.Tags
	current.ConsoleUsername = payload.ConsoleUsername
	current.ConsolePassword = payload.ConsolePassword
	if current.BackendType == domain.BackendTypeSub2API {
		current.ConsoleAuthorization = strings.TrimSpace(payload.ConsoleAuthorization)
		current.ConsoleCheckinPath = normalizeConsoleAPIPath(payload.ConsoleCheckinPath)
		current.ChannelURL = normalizeConsoleAPIPath(payload.ChannelURL)
	} else {
		current.ConsoleAuthorization = ""
		current.ConsoleCheckinPath = ""
		current.ChannelURL = ""
	}
	if current.BackendType == domain.BackendTypeNewAPI {
		current.ConsoleCookie = strings.TrimSpace(payload.ConsoleCookie)
	} else {
		current.ConsoleCookie = ""
	}
	if payload.ConsoleUserID != nil {
		current.ConsoleAccountJSON, err = consoleAccountJSONWithUserID(current.ConsoleAccountJSON, *payload.ConsoleUserID)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
	}
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

func (h *BackendHandler) HandleBackendConsoleCheckin(w http.ResponseWriter, r *http.Request) {
	recorder := newNewAPIConsoleRequestRecorder()
	backend, err := h.consoleBackend(r)
	if err != nil {
		h.logConsoleEvent(r.Context(), slog.LevelWarn, "newapi_console_checkin_rejected",
			slog.String("error", err.Error()),
		)
		writeConsoleError(w, http.StatusBadRequest, err.Error(), recorder)
		return
	}
	h.logConsoleEvent(r.Context(), slog.LevelInfo, "newapi_console_checkin_started", consoleBackendAttrs(backend)...)

	accountID := consoleStoredAccountID(backend)
	directCheckin := hasNewAPIDirectCheckinCredentials(backend, accountID)
	var selfResult newAPIConsoleResult
	if directCheckin {
		h.logConsoleEvent(r.Context(), slog.LevelInfo, "newapi_console_checkin_account_identified", append(consoleBackendAttrs(backend),
			slog.String("stage", "stored_account"),
			slog.String("new_api_user", accountID),
		)...)
	} else {
		selfResult, backend, accountID, err = h.newAPIConsoleSelfWithLogin(r.Context(), backend, accountID, recorder)
		if err != nil {
			h.logConsoleEvent(r.Context(), slog.LevelWarn, "newapi_console_checkin_failed", append(consoleBackendAttrs(backend),
				slog.String("stage", "initial_self"),
				slog.String("error", err.Error()),
			)...)
			writeConsoleError(w, http.StatusBadGateway, err.Error(), recorder)
			return
		}
		accountID = firstNonEmpty(consoleAccountID(selfResult.Payload), accountID)
		if accountID == "" {
			h.logConsoleEvent(r.Context(), slog.LevelWarn, "newapi_console_checkin_failed", append(consoleBackendAttrs(backend),
				slog.String("stage", "account_id"),
				slog.String("error", "new-api self response missing user id"),
			)...)
			writeConsoleError(w, http.StatusBadGateway, "new-api self response missing user id", recorder)
			return
		}
		h.logConsoleEvent(r.Context(), slog.LevelInfo, "newapi_console_checkin_account_identified", append(consoleBackendAttrs(backend),
			slog.String("new_api_user", accountID),
		)...)
	}

	result, err := h.doNewAPIConsoleJSON(r.Context(), backend, http.MethodPost, "/api/user/checkin", nil, backend.ConsoleCookie, accountID, recorder)
	if err != nil {
		h.logConsoleEvent(r.Context(), slog.LevelWarn, "newapi_console_checkin_failed", append(consoleBackendAttrs(backend),
			slog.String("stage", "checkin_request"),
			slog.String("new_api_user", accountID),
			slog.String("error", err.Error()),
		)...)
		writeConsoleError(w, http.StatusBadGateway, err.Error(), recorder)
		return
	}

	if result.loginRequired() && !directCheckin {
		h.logConsoleEvent(r.Context(), slog.LevelInfo, "newapi_console_checkin_login_required", append(append(consoleBackendAttrs(backend),
			slog.String("stage", "checkin_result"),
			slog.String("new_api_user", accountID),
		), consoleResultAttrs(result)...)...)
		var loginAccountID string
		backend, loginAccountID, err = h.loginNewAPIConsole(r.Context(), backend, recorder)
		if err != nil {
			h.logConsoleEvent(r.Context(), slog.LevelWarn, "newapi_console_checkin_failed", append(consoleBackendAttrs(backend),
				slog.String("stage", "login_after_checkin"),
				slog.String("new_api_user", accountID),
				slog.String("error", err.Error()),
			)...)
			writeConsoleError(w, http.StatusBadGateway, err.Error(), recorder)
			return
		}
		accountID = firstNonEmpty(loginAccountID, accountID)
		selfResult, backend, accountID, err = h.newAPIConsoleSelfWithLogin(r.Context(), backend, accountID, recorder)
		if err != nil {
			h.logConsoleEvent(r.Context(), slog.LevelWarn, "newapi_console_checkin_failed", append(consoleBackendAttrs(backend),
				slog.String("stage", "self_after_login"),
				slog.String("error", err.Error()),
			)...)
			writeConsoleError(w, http.StatusBadGateway, err.Error(), recorder)
			return
		}
		accountID = firstNonEmpty(consoleAccountID(selfResult.Payload), accountID)
		if accountID == "" {
			h.logConsoleEvent(r.Context(), slog.LevelWarn, "newapi_console_checkin_failed", append(consoleBackendAttrs(backend),
				slog.String("stage", "account_id_after_login"),
				slog.String("error", "new-api self response missing user id"),
			)...)
			writeConsoleError(w, http.StatusBadGateway, "new-api self response missing user id", recorder)
			return
		}
		h.logConsoleEvent(r.Context(), slog.LevelInfo, "newapi_console_checkin_account_identified", append(consoleBackendAttrs(backend),
			slog.String("stage", "after_login"),
			slog.String("new_api_user", accountID),
		)...)

		result, err = h.doNewAPIConsoleJSON(r.Context(), backend, http.MethodPost, "/api/user/checkin", nil, backend.ConsoleCookie, accountID, recorder)
		if err != nil {
			h.logConsoleEvent(r.Context(), slog.LevelWarn, "newapi_console_checkin_failed", append(consoleBackendAttrs(backend),
				slog.String("stage", "checkin_retry_request"),
				slog.String("new_api_user", accountID),
				slog.String("error", err.Error()),
			)...)
			writeConsoleError(w, http.StatusBadGateway, err.Error(), recorder)
			return
		}
	}
	if !result.success() && !result.alreadyCheckedIn() {
		h.logConsoleEvent(r.Context(), slog.LevelWarn, "newapi_console_checkin_failed", append(append(consoleBackendAttrs(backend),
			slog.String("stage", "checkin_result"),
			slog.String("new_api_user", accountID),
		), consoleResultAttrs(result)...)...)
		writeConsoleError(w, http.StatusBadGateway, result.errorMessage("new-api checkin failed"), recorder)
		return
	}
	lastCheckinAt := time.Now().UTC()

	selfResult, err = h.doNewAPIConsoleJSON(r.Context(), backend, http.MethodGet, "/api/user/self", nil, backend.ConsoleCookie, accountID, recorder)
	if err != nil {
		h.logConsoleEvent(r.Context(), slog.LevelWarn, "newapi_console_checkin_failed", append(consoleBackendAttrs(backend),
			slog.String("stage", "refresh_self"),
			slog.String("new_api_user", accountID),
			slog.String("error", err.Error()),
		)...)
		writeConsoleError(w, http.StatusBadGateway, err.Error(), recorder)
		return
	}
	if !selfResult.success() {
		h.logConsoleEvent(r.Context(), slog.LevelWarn, "newapi_console_checkin_failed", append(append(consoleBackendAttrs(backend),
			slog.String("stage", "refresh_self_result"),
			slog.String("new_api_user", accountID),
		), consoleResultAttrs(selfResult)...)...)
		writeConsoleError(w, http.StatusBadGateway, selfResult.errorMessage("new-api self request failed"), recorder)
		return
	}
	accountJSON, err := consoleAccountSummaryJSON(selfResult.Payload, nil, lastCheckinAt)
	if err != nil {
		h.logConsoleEvent(r.Context(), slog.LevelWarn, "newapi_console_checkin_failed", append(consoleBackendAttrs(backend),
			slog.String("stage", "account_summary"),
			slog.String("new_api_user", accountID),
			slog.String("error", err.Error()),
		)...)
		writeConsoleError(w, http.StatusBadGateway, err.Error(), recorder)
		return
	}
	backend.ConsoleAccountJSON = accountJSON
	updated, err := h.store.UpdateBackend(r.Context(), backend)
	if err != nil {
		h.logConsoleEvent(r.Context(), slog.LevelError, "newapi_console_checkin_failed", append(consoleBackendAttrs(backend),
			slog.String("stage", "save_account_summary"),
			slog.String("new_api_user", accountID),
			slog.String("error", err.Error()),
		)...)
		writeConsoleError(w, http.StatusInternalServerError, err.Error(), recorder)
		return
	}
	h.logConsoleEvent(r.Context(), slog.LevelInfo, "newapi_console_account_summary_saved", append(consoleBackendAttrs(updated),
		slog.String("new_api_user", accountID),
		slog.Int("account_summary_bytes", len(accountJSON)),
	)...)
	h.logConsoleEvent(r.Context(), slog.LevelInfo, "newapi_console_checkin_completed", append(append(consoleBackendAttrs(updated),
		slog.String("new_api_user", accountID),
	), consoleResultAttrs(result)...)...)

	writeJSON(w, http.StatusOK, map[string]any{
		"backend":  updated,
		"checkin":  result.Payload,
		"account":  decodeJSONMap(accountJSON),
		"requests": recorder.Requests,
	})
}

func (h *BackendHandler) HandleBackendConsolePricing(w http.ResponseWriter, r *http.Request) {
	recorder := newNewAPIConsoleRequestRecorder()
	backend, err := h.consoleBackend(r)
	if err != nil {
		writeConsoleError(w, http.StatusBadRequest, err.Error(), recorder)
		return
	}

	accountID := consoleStoredAccountID(backend)
	result, err := h.doNewAPIConsoleJSON(r.Context(), backend, http.MethodGet, "/api/pricing", nil, backend.ConsoleCookie, accountID, recorder)
	if err != nil {
		writeConsoleError(w, http.StatusBadGateway, err.Error(), recorder)
		return
	}
	if !result.success() {
		writeConsoleError(w, http.StatusBadGateway, result.errorMessage("new-api pricing request failed"), recorder)
		return
	}
	filteredPricing := filterConsolePricingPayload(result.Payload, h.focusModelPatterns())
	pricingJSON, err := json.Marshal(filteredPricing)
	if err != nil {
		writeConsoleError(w, http.StatusBadGateway, err.Error(), recorder)
		return
	}
	backend.ConsolePricingJSON = string(pricingJSON)
	updated, err := h.store.UpdateBackend(r.Context(), backend)
	if err != nil {
		writeConsoleError(w, http.StatusInternalServerError, err.Error(), recorder)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"backend":  updated,
		"pricing":  filteredPricing,
		"requests": recorder.Requests,
	})
}

func (h *BackendHandler) HandleBackendConsoleSync(w http.ResponseWriter, r *http.Request) {
	stream := newConsoleSyncStream(w, r)
	recorder := newNewAPIConsoleRequestRecorder(func(entry newAPIConsoleRequestLog) {
		if stream != nil {
			stream.write(map[string]any{
				"type":    "request",
				"request": entry,
			})
		}
	})
	backend, err := h.consoleSyncBackend(r)
	if err != nil {
		writeConsoleSyncError(w, http.StatusBadRequest, err.Error(), recorder, stream)
		return
	}

	switch domain.NormalizeBackendType(backend.BackendType) {
	case domain.BackendTypeNewAPI:
		h.handleNewAPIConsoleSync(w, r, backend, recorder, stream)
	case domain.BackendTypeSub2API:
		h.handleSub2APIConsoleSync(w, r, backend, recorder, stream)
	default:
		writeConsoleSyncError(w, http.StatusBadRequest, "backend_type must be new-api or sub2api", recorder, stream)
	}
}

func (h *BackendHandler) handleNewAPIConsoleSync(w http.ResponseWriter, r *http.Request, backend domain.Backend, recorder *newAPIConsoleRequestRecorder, stream *consoleSyncStream) {
	statusResult, err := h.doNewAPIConsoleJSON(r.Context(), backend, http.MethodGet, "/api/status", nil, backend.ConsoleCookie, "", recorder)
	if err != nil {
		writeConsoleSyncError(w, http.StatusBadGateway, err.Error(), recorder, stream)
		return
	}
	if !statusResult.success() {
		writeConsoleSyncError(w, http.StatusBadGateway, statusResult.errorMessage("new-api status request failed"), recorder, stream)
		return
	}

	lastCheckinAt, checkedInToday := consoleLastCheckinStatus(backend, time.Now().UTC())
	checkinEnabled := newAPIStatusCheckinEnabled(statusResult.Payload)
	recordSyncCompletionAsCheckin := !checkinEnabled
	accountID := consoleStoredAccountID(backend)
	var selfResult newAPIConsoleResult
	var checkinPayload map[string]any
	if checkedInToday || !checkinEnabled {
		selfResult, backend, accountID, err = h.newAPIConsoleSelfWithLogin(r.Context(), backend, accountID, recorder)
		if err != nil {
			writeConsoleSyncError(w, http.StatusBadGateway, err.Error(), recorder, stream)
			return
		}
		accountID = firstNonEmpty(consoleAccountID(selfResult.Payload), accountID)
		if accountID == "" {
			writeConsoleSyncError(w, http.StatusBadGateway, "new-api self response missing user id", recorder, stream)
			return
		}
	} else {
		checkinResult, updatedBackend, updatedAccountID, err := h.performNewAPIConsoleCheckin(r.Context(), backend, accountID, recorder)
		if err != nil {
			writeConsoleSyncError(w, http.StatusBadGateway, err.Error(), recorder, stream)
			return
		}
		backend = updatedBackend
		accountID = firstNonEmpty(updatedAccountID, accountID)
		checkinPayload = checkinResult.Payload
		lastCheckinAt = time.Now().UTC()

		selfResult, err = h.doNewAPIConsoleJSON(r.Context(), backend, http.MethodGet, "/api/user/self", nil, backend.ConsoleCookie, accountID, recorder)
		if err != nil {
			writeConsoleSyncError(w, http.StatusBadGateway, err.Error(), recorder, stream)
			return
		}
		if !selfResult.success() {
			writeConsoleSyncError(w, http.StatusBadGateway, selfResult.errorMessage("new-api self request failed"), recorder, stream)
			return
		}
		accountID = firstNonEmpty(consoleAccountID(selfResult.Payload), accountID)
	}

	accountJSON, err := consoleAccountSummaryJSON(selfResult.Payload, statusResult.Payload, lastCheckinAt)
	if err != nil {
		writeConsoleSyncError(w, http.StatusBadGateway, err.Error(), recorder, stream)
		return
	}
	backend.ConsoleAccountJSON = accountJSON
	backend, err = h.store.UpdateBackend(r.Context(), backend)
	if err != nil {
		writeConsoleSyncError(w, http.StatusInternalServerError, err.Error(), recorder, stream)
		return
	}

	pricingResult, err := h.doNewAPIConsoleJSON(r.Context(), backend, http.MethodGet, "/api/pricing", nil, backend.ConsoleCookie, accountID, recorder)
	if err != nil {
		writeConsoleSyncError(w, http.StatusBadGateway, err.Error(), recorder, stream)
		return
	}
	if !pricingResult.success() {
		writeConsoleSyncError(w, http.StatusBadGateway, pricingResult.errorMessage("new-api pricing request failed"), recorder, stream)
		return
	}
	filteredPricing := filterConsolePricingPayload(pricingResult.Payload, h.focusModelPatterns())
	pricingJSON, err := json.Marshal(filteredPricing)
	if err != nil {
		writeConsoleSyncError(w, http.StatusBadGateway, err.Error(), recorder, stream)
		return
	}
	if recordSyncCompletionAsCheckin {
		lastCheckinAt = time.Now().UTC()
		accountJSON, err = consoleAccountSummaryJSON(selfResult.Payload, statusResult.Payload, lastCheckinAt)
		if err != nil {
			writeConsoleSyncError(w, http.StatusBadGateway, err.Error(), recorder, stream)
			return
		}
		backend.ConsoleAccountJSON = accountJSON
	}
	backend.ConsolePricingJSON = string(pricingJSON)

	updated, err := h.store.UpdateBackend(r.Context(), backend)
	if err != nil {
		writeConsoleSyncError(w, http.StatusInternalServerError, err.Error(), recorder, stream)
		return
	}

	writeConsoleSyncSuccess(w, map[string]any{
		"backend":  updated,
		"status":   statusResult.Payload,
		"checkin":  checkinPayload,
		"account":  decodeJSONMap(accountJSON),
		"pricing":  filteredPricing,
		"requests": recorder.Requests,
	}, stream)
}

func (h *BackendHandler) handleSub2APIConsoleSync(w http.ResponseWriter, r *http.Request, backend domain.Backend, recorder *newAPIConsoleRequestRecorder, stream *consoleSyncStream) {
	if strings.TrimSpace(backend.ConsoleAuthorization) == "" {
		writeConsoleSyncError(w, http.StatusBadRequest, "console_authorization is required", recorder, stream)
		return
	}

	var (
		checkinPayload map[string]any
		lastCheckinAt  time.Time
		pricingPayload map[string]any
	)
	recordSyncCompletionAsCheckin := normalizeConsoleAPIPath(backend.ConsoleCheckinPath) == ""
	if checkinPath := normalizeConsoleAPIPath(backend.ConsoleCheckinPath); checkinPath != "" {
		checkinResult, err := h.doSub2APIConsoleJSON(r.Context(), backend, http.MethodPost, checkinPath, []byte("{}"), recorder)
		if err != nil {
			writeConsoleSyncError(w, http.StatusBadGateway, err.Error(), recorder, stream)
			return
		}
		if !checkinResult.success() {
			writeConsoleSyncError(w, http.StatusBadGateway, checkinResult.errorMessage("sub2api checkin failed"), recorder, stream)
			return
		}
		checkinPayload = checkinResult.Payload
		lastCheckinAt = time.Now().UTC()
	}

	accountResult, err := h.doSub2APIConsoleJSON(r.Context(), backend, http.MethodGet, "/api/v1/auth/me", nil, recorder)
	if err != nil {
		writeConsoleSyncError(w, http.StatusBadGateway, err.Error(), recorder, stream)
		return
	}
	if !accountResult.success() {
		writeConsoleSyncError(w, http.StatusBadGateway, accountResult.errorMessage("sub2api auth/me request failed"), recorder, stream)
		return
	}

	accountJSON, err := sub2APIConsoleAccountSummaryJSON(accountResult.Payload, backend.ConsoleAccountJSON, lastCheckinAt)
	if err != nil {
		writeConsoleSyncError(w, http.StatusBadGateway, err.Error(), recorder, stream)
		return
	}
	backend.ConsoleAccountJSON = accountJSON

	if channelURL := normalizeConsoleAPIPath(backend.ChannelURL); channelURL != "" {
		channelResult, err := h.doSub2APIConsoleJSON(r.Context(), backend, http.MethodGet, channelURL, nil, recorder)
		if err != nil {
			writeConsoleSyncError(w, http.StatusBadGateway, err.Error(), recorder, stream)
			return
		}
		if !channelResult.success() {
			writeConsoleSyncError(w, http.StatusBadGateway, channelResult.errorMessage("sub2api channel request failed"), recorder, stream)
			return
		}
		pricingPayload = channelResult.Payload
		pricingJSON, err := json.Marshal(pricingPayload)
		if err != nil {
			writeConsoleSyncError(w, http.StatusBadGateway, err.Error(), recorder, stream)
			return
		}
		backend.ConsolePricingJSON = string(pricingJSON)
	}
	if recordSyncCompletionAsCheckin {
		lastCheckinAt = time.Now().UTC()
		accountJSON, err = sub2APIConsoleAccountSummaryJSON(accountResult.Payload, backend.ConsoleAccountJSON, lastCheckinAt)
		if err != nil {
			writeConsoleSyncError(w, http.StatusBadGateway, err.Error(), recorder, stream)
			return
		}
		backend.ConsoleAccountJSON = accountJSON
	}

	updated, err := h.store.UpdateBackend(r.Context(), backend)
	if err != nil {
		writeConsoleSyncError(w, http.StatusInternalServerError, err.Error(), recorder, stream)
		return
	}

	writeConsoleSyncSuccess(w, map[string]any{
		"backend":  updated,
		"checkin":  checkinPayload,
		"account":  decodeJSONMap(accountJSON),
		"pricing":  pricingPayload,
		"requests": recorder.Requests,
	}, stream)
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
			Name:                 name,
			Protocol:             domain.NormalizeBackendProtocol(item.Protocol),
			BackendType:          domain.NormalizeBackendType(item.BackendType),
			BaseURL:              item.BaseURL,
			APIKey:               item.APIKey,
			ConsoleURL:           item.ConsoleURL,
			Tags:                 item.Tags,
			ConsoleUsername:      item.ConsoleUsername,
			ConsolePassword:      item.ConsolePassword,
			ConsoleAuthorization: item.ConsoleAuthorization,
			ConsoleCheckinPath:   normalizeConsoleAPIPath(item.ConsoleCheckinPath),
			ChannelURL:           normalizeConsoleAPIPath(item.ChannelURL),
			ConsoleCookie:        item.ConsoleCookie,
			ConsoleAccountJSON:   item.ConsoleAccountJSON,
			ConsolePricingJSON:   item.ConsolePricingJSON,
			Notes:                item.Notes,
			ProxyID:              item.ProxyID,
			Status:               status,
			ConsecutiveFailures:  item.ConsecutiveFailures,
			Weight:               item.Weight,
			Models:               item.Models,
			ModelMapping:         item.ModelMapping,
		})
	}
	return backends, nil
}

func backendToImportExportItem(backend domain.Backend) backendImportExportItem {
	return backendImportExportItem{
		Name:                 backend.Name,
		Protocol:             domain.NormalizeBackendProtocol(backend.Protocol),
		BackendType:          domain.NormalizeBackendType(backend.BackendType),
		BaseURL:              backend.BaseURL,
		APIKey:               backend.APIKey,
		ConsoleURL:           backend.ConsoleURL,
		Tags:                 backend.Tags,
		ConsoleUsername:      backend.ConsoleUsername,
		ConsolePassword:      backend.ConsolePassword,
		ConsoleAuthorization: backend.ConsoleAuthorization,
		ConsoleCheckinPath:   backend.ConsoleCheckinPath,
		ChannelURL:           backend.ChannelURL,
		ConsoleCookie:        backend.ConsoleCookie,
		ConsoleAccountJSON:   backend.ConsoleAccountJSON,
		ConsolePricingJSON:   backend.ConsolePricingJSON,
		Notes:                backend.Notes,
		ProxyID:              backend.ProxyID,
		Status:               backend.Status,
		ConsecutiveFailures:  backend.ConsecutiveFailures,
		Weight:               backend.Weight,
		Models:               backend.Models,
		ModelMapping:         backend.ModelMapping,
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
			detailEntry("backend_type", "Backend Type", domain.NormalizeBackendType(detail.Backend.BackendType)),
			detailEntry("console_url", "Console URL", detail.Backend.ConsoleURL),
			detailEntry("console_username", "Console Username", detail.Backend.ConsoleUsername),
			detailEntry("console_checkin_path", "Console Check-in Path", detail.Backend.ConsoleCheckinPath),
			detailEntry("channel_url", "Channel URL", detail.Backend.ChannelURL),
			detailEntry("console_password", "Console Password", secretPresenceValue(detail.Backend.ConsolePassword)),
			detailEntry("console_cookie", "Console Cookie", secretPresenceValue(detail.Backend.ConsoleCookie)),
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
			detailEntry("base_url", "Base URL", detail.Backend.BaseURL),
			detailEntry("console_account", "Console Account", decodeJSONMap(detail.Backend.ConsoleAccountJSON)),
			detailEntry("console_pricing", "Console Pricing", decodeJSONMap(detail.Backend.ConsolePricingJSON)),
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

func writeConsoleError(w http.ResponseWriter, status int, message string, recorder *newAPIConsoleRequestRecorder) {
	requests := []newAPIConsoleRequestLog{}
	if recorder != nil {
		requests = recorder.Requests
	}
	writeJSON(w, status, map[string]any{
		"error": map[string]any{
			"message": message,
			"type":    "token_gate_error",
		},
		"requests": requests,
	})
}

type consoleSyncStream struct {
	w       http.ResponseWriter
	flusher http.Flusher
}

func newConsoleSyncStream(w http.ResponseWriter, r *http.Request) *consoleSyncStream {
	if !wantsConsoleSyncStream(r) {
		return nil
	}
	flusher, ok := w.(http.Flusher)
	if !ok {
		return nil
	}
	w.Header().Set("Content-Type", "application/x-ndjson")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusOK)
	flusher.Flush()
	return &consoleSyncStream{w: w, flusher: flusher}
}

func wantsConsoleSyncStream(r *http.Request) bool {
	if r.URL.Query().Get("stream") == "1" {
		return true
	}
	return strings.Contains(r.Header.Get("Accept"), "application/x-ndjson")
}

func (s *consoleSyncStream) write(event map[string]any) {
	if s == nil {
		return
	}
	_ = json.NewEncoder(s.w).Encode(event)
	s.flusher.Flush()
}

func writeConsoleSyncError(w http.ResponseWriter, status int, message string, recorder *newAPIConsoleRequestRecorder, stream *consoleSyncStream) {
	if stream != nil {
		requests := []newAPIConsoleRequestLog{}
		if recorder != nil {
			requests = recorder.Requests
		}
		stream.write(map[string]any{
			"type":     "error",
			"status":   status,
			"message":  message,
			"requests": requests,
		})
		return
	}
	writeConsoleError(w, status, message, recorder)
}

func writeConsoleSyncSuccess(w http.ResponseWriter, payload map[string]any, stream *consoleSyncStream) {
	if stream != nil {
		stream.write(map[string]any{
			"type":     "complete",
			"response": payload,
		})
		return
	}
	writeJSON(w, http.StatusOK, payload)
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

func (h *BackendHandler) logConsoleEvent(ctx context.Context, level slog.Level, message string, attrs ...slog.Attr) {
	logger := h.logger
	if logger == nil {
		logger = slog.Default().With("component", "backend_handler")
	}
	logger.LogAttrs(ctx, level, message, attrs...)
}

func consoleBackendAttrs(backend domain.Backend) []slog.Attr {
	attrs := []slog.Attr{
		slog.Int64("backend_id", backend.ID),
		slog.String("backend_name", backend.Name),
		slog.String("backend_type", domain.NormalizeBackendType(backend.BackendType)),
		slog.String("backend_status", backend.Status),
		slog.Bool("console_cookie_present", strings.TrimSpace(backend.ConsoleCookie) != ""),
		slog.Int("console_cookie_bytes", len(strings.TrimSpace(backend.ConsoleCookie))),
	}
	if parsed, err := url.Parse(strings.TrimSpace(backend.ConsoleURL)); err == nil {
		attrs = append(attrs,
			slog.String("console_scheme", parsed.Scheme),
			slog.String("console_host", parsed.Host),
		)
	} else {
		attrs = append(attrs,
			slog.String("console_scheme", ""),
			slog.String("console_host", ""),
			slog.String("console_url_error", err.Error()),
		)
	}
	return attrs
}

func consoleRequestAttrs(backend domain.Backend, method, path string, body []byte, cookie string, newAPIUser string) []slog.Attr {
	cookie = strings.TrimSpace(cookie)
	newAPIUser = strings.TrimSpace(newAPIUser)
	attrs := append(consoleBackendAttrs(backend),
		slog.String("method", method),
		slog.String("path", path),
		slog.Int("request_body_bytes", len(body)),
		slog.Bool("cookie_present", cookie != ""),
		slog.Int("cookie_bytes", len(cookie)),
		slog.Bool("new_api_user_present", newAPIUser != ""),
	)
	if newAPIUser != "" {
		attrs = append(attrs, slog.String("new_api_user", newAPIUser))
	}
	return attrs
}

func consoleResultAttrs(result newAPIConsoleResult) []slog.Attr {
	attrs := []slog.Attr{
		slog.Int("console_http_status", result.StatusCode),
		slog.Bool("console_success", result.success()),
		slog.Bool("console_login_required", result.loginRequired()),
	}
	if message := consoleResultMessage(result); message != "" {
		attrs = append(attrs, slog.String("console_message", message))
	}
	return attrs
}

func consoleResultMessage(result newAPIConsoleResult) string {
	message := strings.TrimSpace(fmt.Sprint(result.Payload["message"]))
	if message == "" || message == "<nil>" {
		return ""
	}
	const limit = 200
	if len([]rune(message)) <= limit {
		return message
	}
	return string([]rune(message)[:limit]) + "..."
}

type newAPIConsoleResult struct {
	StatusCode int
	Header     http.Header
	Raw        string
	Payload    map[string]any
}

type newAPIConsoleRequestLog struct {
	Time       string `json:"time"`
	Method     string `json:"method"`
	Path       string `json:"path"`
	StatusCode int    `json:"status_code"`
	Body       string `json:"body"`
}

type newAPIConsoleRequestRecorder struct {
	Requests []newAPIConsoleRequestLog `json:"requests"`
	onRecord func(newAPIConsoleRequestLog)
}

func newNewAPIConsoleRequestRecorder(onRecord ...func(newAPIConsoleRequestLog)) *newAPIConsoleRequestRecorder {
	recorder := &newAPIConsoleRequestRecorder{Requests: []newAPIConsoleRequestLog{}}
	if len(onRecord) > 0 {
		recorder.onRecord = onRecord[0]
	}
	return recorder
}

func (r *newAPIConsoleRequestRecorder) record(method, path string, statusCode int, body string) {
	if r == nil {
		return
	}
	entry := newAPIConsoleRequestLog{
		Time:       time.Now().UTC().Format(time.RFC3339Nano),
		Method:     method,
		Path:       path,
		StatusCode: statusCode,
		Body:       body,
	}
	r.Requests = append(r.Requests, entry)
	if r.onRecord != nil {
		r.onRecord(entry)
	}
}

func (h *BackendHandler) loadConsoleBackend(r *http.Request) (domain.Backend, error) {
	id, err := parseID(r.PathValue("id"))
	if err != nil {
		return domain.Backend{}, err
	}
	backend, err := h.store.GetBackend(r.Context(), id)
	if err != nil {
		return domain.Backend{}, errors.New("backend not found")
	}
	if strings.TrimSpace(backend.ConsoleURL) == "" {
		return domain.Backend{}, errors.New("console_url is required")
	}
	if err := validateURL(backend.ConsoleURL); err != nil {
		return domain.Backend{}, err
	}
	return backend, nil
}

func (h *BackendHandler) consoleBackend(r *http.Request) (domain.Backend, error) {
	backend, err := h.loadConsoleBackend(r)
	if err != nil {
		return domain.Backend{}, err
	}
	if domain.NormalizeBackendType(backend.BackendType) != domain.BackendTypeNewAPI {
		return domain.Backend{}, errors.New("backend_type must be new-api")
	}
	return backend, nil
}

func (h *BackendHandler) consoleSyncBackend(r *http.Request) (domain.Backend, error) {
	backend, err := h.loadConsoleBackend(r)
	if err != nil {
		return domain.Backend{}, err
	}
	switch domain.NormalizeBackendType(backend.BackendType) {
	case domain.BackendTypeNewAPI, domain.BackendTypeSub2API:
		return backend, nil
	default:
		return domain.Backend{}, errors.New("backend_type must be new-api or sub2api")
	}
}

func (h *BackendHandler) performNewAPIConsoleCheckin(ctx context.Context, backend domain.Backend, accountID string, recorder *newAPIConsoleRequestRecorder) (newAPIConsoleResult, domain.Backend, string, error) {
	directCheckin := hasNewAPIDirectCheckinCredentials(backend, accountID)
	result, err := h.doNewAPIConsoleJSON(ctx, backend, http.MethodPost, "/api/user/checkin", nil, backend.ConsoleCookie, accountID, recorder)
	if err != nil {
		return newAPIConsoleResult{}, backend, accountID, err
	}
	if result.loginRequired() && !directCheckin {
		updated, loginAccountID, err := h.loginNewAPIConsole(ctx, backend, recorder)
		if err != nil {
			return newAPIConsoleResult{}, backend, accountID, err
		}
		backend = updated
		accountID = firstNonEmpty(loginAccountID, accountID)
		selfResult, updated, updatedAccountID, err := h.newAPIConsoleSelfWithLogin(ctx, backend, accountID, recorder)
		if err != nil {
			return newAPIConsoleResult{}, backend, accountID, err
		}
		backend = updated
		accountID = firstNonEmpty(updatedAccountID, consoleAccountID(selfResult.Payload), accountID)
		result, err = h.doNewAPIConsoleJSON(ctx, backend, http.MethodPost, "/api/user/checkin", nil, backend.ConsoleCookie, accountID, recorder)
		if err != nil {
			return newAPIConsoleResult{}, backend, accountID, err
		}
	}
	if !result.success() && !result.alreadyCheckedIn() {
		return newAPIConsoleResult{}, backend, accountID, errors.New(result.errorMessage("new-api checkin failed"))
	}
	return result, backend, accountID, nil
}

func (h *BackendHandler) focusModelPatterns() string {
	if h.cfg == nil {
		return ""
	}
	return h.cfg.FocusModels
}

func (h *BackendHandler) newAPIConsoleSelfWithLogin(ctx context.Context, backend domain.Backend, accountID string, recorder *newAPIConsoleRequestRecorder) (newAPIConsoleResult, domain.Backend, string, error) {
	h.logConsoleEvent(ctx, slog.LevelInfo, "newapi_console_self_started", consoleBackendAttrs(backend)...)
	selfResult, err := h.doNewAPIConsoleJSON(ctx, backend, http.MethodGet, "/api/user/self", nil, backend.ConsoleCookie, accountID, recorder)
	if err != nil {
		h.logConsoleEvent(ctx, slog.LevelWarn, "newapi_console_self_failed", append(consoleBackendAttrs(backend),
			slog.String("stage", "request"),
			slog.String("error", err.Error()),
		)...)
		return newAPIConsoleResult{}, backend, accountID, err
	}
	if selfResult.success() {
		h.logConsoleEvent(ctx, slog.LevelInfo, "newapi_console_self_completed", append(consoleBackendAttrs(backend), consoleResultAttrs(selfResult)...)...)
		return selfResult, backend, firstNonEmpty(consoleAccountID(selfResult.Payload), accountID), nil
	}
	if !selfResult.loginRequired() {
		h.logConsoleEvent(ctx, slog.LevelWarn, "newapi_console_self_failed", append(append(consoleBackendAttrs(backend),
			slog.String("stage", "result"),
		), consoleResultAttrs(selfResult)...)...)
		return newAPIConsoleResult{}, backend, accountID, errors.New(selfResult.errorMessage("new-api self request failed"))
	}
	h.logConsoleEvent(ctx, slog.LevelInfo, "newapi_console_self_login_required", append(consoleBackendAttrs(backend), consoleResultAttrs(selfResult)...)...)

	updated, loginAccountID, err := h.loginNewAPIConsole(ctx, backend, recorder)
	if err != nil {
		h.logConsoleEvent(ctx, slog.LevelWarn, "newapi_console_self_failed", append(consoleBackendAttrs(backend),
			slog.String("stage", "login"),
			slog.String("error", err.Error()),
		)...)
		return newAPIConsoleResult{}, backend, accountID, err
	}
	accountID = firstNonEmpty(loginAccountID, accountID)
	selfResult, err = h.doNewAPIConsoleJSON(ctx, updated, http.MethodGet, "/api/user/self", nil, updated.ConsoleCookie, accountID, recorder)
	if err != nil {
		h.logConsoleEvent(ctx, slog.LevelWarn, "newapi_console_self_failed", append(consoleBackendAttrs(updated),
			slog.String("stage", "request_after_login"),
			slog.String("error", err.Error()),
		)...)
		return newAPIConsoleResult{}, updated, accountID, err
	}
	if !selfResult.success() {
		h.logConsoleEvent(ctx, slog.LevelWarn, "newapi_console_self_failed", append(append(consoleBackendAttrs(updated),
			slog.String("stage", "result_after_login"),
		), consoleResultAttrs(selfResult)...)...)
		return newAPIConsoleResult{}, updated, accountID, errors.New(selfResult.errorMessage("new-api self request failed"))
	}
	accountID = firstNonEmpty(consoleAccountID(selfResult.Payload), accountID)
	h.logConsoleEvent(ctx, slog.LevelInfo, "newapi_console_self_completed", append(append(consoleBackendAttrs(updated),
		slog.String("stage", "after_login"),
	), consoleResultAttrs(selfResult)...)...)
	return selfResult, updated, accountID, nil
}

func (h *BackendHandler) loginNewAPIConsole(ctx context.Context, backend domain.Backend, recorder *newAPIConsoleRequestRecorder) (domain.Backend, string, error) {
	h.logConsoleEvent(ctx, slog.LevelInfo, "newapi_console_login_started", append(consoleBackendAttrs(backend),
		slog.Bool("console_username_present", strings.TrimSpace(backend.ConsoleUsername) != ""),
		slog.Bool("console_password_present", strings.TrimSpace(backend.ConsolePassword) != ""),
	)...)
	if strings.TrimSpace(backend.ConsoleUsername) == "" || strings.TrimSpace(backend.ConsolePassword) == "" {
		h.logConsoleEvent(ctx, slog.LevelWarn, "newapi_console_login_failed", append(consoleBackendAttrs(backend),
			slog.String("stage", "credentials"),
			slog.Bool("console_username_present", strings.TrimSpace(backend.ConsoleUsername) != ""),
			slog.Bool("console_password_present", strings.TrimSpace(backend.ConsolePassword) != ""),
			slog.String("error", "console username and password are required"),
		)...)
		return domain.Backend{}, "", errors.New("console username and password are required")
	}
	loginBody, err := json.Marshal(struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}{
		Username: strings.TrimSpace(backend.ConsoleUsername),
		Password: strings.TrimSpace(backend.ConsolePassword),
	})
	if err != nil {
		h.logConsoleEvent(ctx, slog.LevelWarn, "newapi_console_login_failed", append(consoleBackendAttrs(backend),
			slog.String("stage", "encode_body"),
			slog.String("error", err.Error()),
		)...)
		return domain.Backend{}, "", err
	}
	loginResult, err := h.doNewAPIConsoleJSON(ctx, backend, http.MethodPost, "/api/user/login", loginBody, "", "", recorder)
	if err != nil {
		h.logConsoleEvent(ctx, slog.LevelWarn, "newapi_console_login_failed", append(consoleBackendAttrs(backend),
			slog.String("stage", "request"),
			slog.String("error", err.Error()),
		)...)
		return domain.Backend{}, "", err
	}
	if !loginResult.success() {
		h.logConsoleEvent(ctx, slog.LevelWarn, "newapi_console_login_failed", append(append(consoleBackendAttrs(backend),
			slog.String("stage", "result"),
		), consoleResultAttrs(loginResult)...)...)
		return domain.Backend{}, "", errors.New(loginResult.errorMessage("new-api login failed"))
	}
	session := sessionCookie(loginResult.Header)
	if session == nil {
		h.logConsoleEvent(ctx, slog.LevelWarn, "newapi_console_login_failed", append(append(consoleBackendAttrs(backend),
			slog.String("stage", "session_cookie"),
		), consoleResultAttrs(loginResult)...)...)
		return domain.Backend{}, "", errors.New("new-api login did not return session cookie")
	}
	accountID := consoleAccountID(loginResult.Payload)
	previousCookie := backend.ConsoleCookie
	backend.ConsoleCookie = mergeCookieValue(backend.ConsoleCookie, session)
	h.logConsoleEvent(ctx, slog.LevelInfo, "newapi_console_login_cookie_refreshed", append(consoleBackendAttrs(backend),
		slog.Bool("previous_cookie_present", strings.TrimSpace(previousCookie) != ""),
		slog.Int("previous_cookie_bytes", len(strings.TrimSpace(previousCookie))),
		slog.Bool("updated_cookie_present", strings.TrimSpace(backend.ConsoleCookie) != ""),
		slog.Int("updated_cookie_bytes", len(strings.TrimSpace(backend.ConsoleCookie))),
	)...)
	updated, err := h.store.UpdateBackend(ctx, backend)
	if err != nil {
		h.logConsoleEvent(ctx, slog.LevelError, "newapi_console_login_failed", append(consoleBackendAttrs(backend),
			slog.String("stage", "save_cookie"),
			slog.String("error", err.Error()),
		)...)
		return domain.Backend{}, accountID, err
	}
	h.logConsoleEvent(ctx, slog.LevelInfo, "newapi_console_login_completed", append(append(consoleBackendAttrs(updated),
		slog.Bool("new_api_user_present", accountID != ""),
	), consoleResultAttrs(loginResult)...)...)
	return updated, accountID, nil
}

func (h *BackendHandler) doNewAPIConsoleJSON(ctx context.Context, backend domain.Backend, method, path string, body []byte, cookie string, newAPIUser string, recorder *newAPIConsoleRequestRecorder) (newAPIConsoleResult, error) {
	target := consoleAPIURL(backend.ConsoleURL, path)
	request, err := http.NewRequestWithContext(ctx, method, target, bytes.NewReader(body))
	if err != nil {
		h.logConsoleEvent(ctx, slog.LevelWarn, "newapi_console_request_build_failed", append(consoleRequestAttrs(backend, method, path, body, cookie, newAPIUser),
			slog.String("error", err.Error()),
		)...)
		return newAPIConsoleResult{}, err
	}
	request.Header.Set("Accept", "application/json")
	request.Header.Set("User-Agent", h.backendConsoleUserAgent())
	if body != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	if cookie = strings.TrimSpace(cookie); cookie != "" {
		request.Header.Set("Cookie", cookie)
	}
	if newAPIUser = strings.TrimSpace(newAPIUser); newAPIUser != "" {
		request.Header.Set("new-user-id", newAPIUser)
		request.Header.Set("New-Api-User", newAPIUser)
	}
	defer h.sleepAfterNewAPIConsoleRequest(ctx, backend, method, path)

	client, err := h.consoleClientForBackend(backend)
	if err != nil {
		recorder.record(method, path, 0, err.Error())
		return newAPIConsoleResult{}, err
	}
	startedAt := time.Now()
	h.logConsoleEvent(ctx, slog.LevelInfo, "newapi_console_request_started", consoleRequestAttrs(backend, method, path, body, cookie, newAPIUser)...)
	response, err := client.Do(request)
	if err != nil {
		recorder.record(method, path, 0, err.Error())
		h.logConsoleEvent(ctx, slog.LevelWarn, "newapi_console_request_failed", append(consoleRequestAttrs(backend, method, path, body, cookie, newAPIUser),
			slog.Duration("duration", time.Since(startedAt)),
			slog.String("error", err.Error()),
		)...)
		return newAPIConsoleResult{}, err
	}
	defer response.Body.Close()

	responseBody, err := io.ReadAll(response.Body)
	if err != nil {
		recorder.record(method, path, response.StatusCode, err.Error())
		h.logConsoleEvent(ctx, slog.LevelWarn, "newapi_console_response_read_failed", append(consoleRequestAttrs(backend, method, path, body, cookie, newAPIUser),
			slog.Int("http_status", response.StatusCode),
			slog.String("http_status_text", response.Status),
			slog.String("content_type", response.Header.Get("Content-Type")),
			slog.Duration("duration", time.Since(startedAt)),
			slog.String("error", err.Error()),
		)...)
		return newAPIConsoleResult{}, err
	}
	raw := compactJSON(responseBody)
	recorder.record(method, path, response.StatusCode, raw)
	var payload map[string]any
	if err := json.Unmarshal(responseBody, &payload); err != nil {
		h.logConsoleEvent(ctx, slog.LevelWarn, "newapi_console_response_decode_failed", append(consoleRequestAttrs(backend, method, path, body, cookie, newAPIUser),
			slog.Int("http_status", response.StatusCode),
			slog.String("http_status_text", response.Status),
			slog.String("content_type", response.Header.Get("Content-Type")),
			slog.Int("response_bytes", len(responseBody)),
			slog.Duration("duration", time.Since(startedAt)),
			slog.String("error", err.Error()),
		)...)
		return newAPIConsoleResult{}, fmt.Errorf("decode new-api console response: %w", err)
	}
	result := newAPIConsoleResult{
		StatusCode: response.StatusCode,
		Header:     response.Header.Clone(),
		Raw:        raw,
		Payload:    payload,
	}
	h.logConsoleEvent(ctx, slog.LevelInfo, "newapi_console_request_finished", append(append(consoleRequestAttrs(backend, method, path, body, cookie, newAPIUser),
		slog.Int("http_status", response.StatusCode),
		slog.String("http_status_text", response.Status),
		slog.String("content_type", response.Header.Get("Content-Type")),
		slog.Int("response_bytes", len(responseBody)),
		slog.Duration("duration", time.Since(startedAt)),
	), consoleResultAttrs(result)...)...)
	return result, nil
}

type sub2APIConsoleResult struct {
	StatusCode int
	Raw        string
	Payload    map[string]any
}

func (h *BackendHandler) doSub2APIConsoleJSON(ctx context.Context, backend domain.Backend, method, path string, body []byte, recorder *newAPIConsoleRequestRecorder) (sub2APIConsoleResult, error) {
	target := consoleAPIURL(backend.ConsoleURL, path)
	request, err := http.NewRequestWithContext(ctx, method, target, bytes.NewReader(body))
	if err != nil {
		return sub2APIConsoleResult{}, err
	}
	request.Header.Set("Accept", "application/json")
	request.Header.Set("User-Agent", h.backendConsoleUserAgent())
	request.Header.Set("Authorization", strings.TrimSpace(backend.ConsoleAuthorization))
	if body != nil {
		request.Header.Set("Content-Type", "application/json")
	}

	client, err := h.consoleClientForBackend(backend)
	if err != nil {
		recorder.record(method, normalizeConsoleAPIPath(path), 0, err.Error())
		return sub2APIConsoleResult{}, err
	}
	response, err := client.Do(request)
	if err != nil {
		recorder.record(method, normalizeConsoleAPIPath(path), 0, err.Error())
		return sub2APIConsoleResult{}, err
	}
	defer response.Body.Close()

	responseBody, err := io.ReadAll(response.Body)
	if err != nil {
		recorder.record(method, normalizeConsoleAPIPath(path), response.StatusCode, err.Error())
		return sub2APIConsoleResult{}, err
	}
	raw := compactJSON(responseBody)
	recorder.record(method, normalizeConsoleAPIPath(path), response.StatusCode, raw)

	var payload map[string]any
	if err := json.Unmarshal(responseBody, &payload); err != nil {
		return sub2APIConsoleResult{}, fmt.Errorf("decode sub2api console response: %w", err)
	}
	return sub2APIConsoleResult{
		StatusCode: response.StatusCode,
		Raw:        raw,
		Payload:    payload,
	}, nil
}

func (h *BackendHandler) consoleClientForBackend(backend domain.Backend) (*http.Client, error) {
	if h.consoleHTTPClient != nil {
		return h.consoleHTTPClient, nil
	}
	return proxypkg.NewHTTPClientForBackend(backend, 30*time.Second, 30*time.Second)
}

func (h *BackendHandler) sleepAfterNewAPIConsoleRequest(ctx context.Context, backend domain.Backend, method, path string) {
	// Custom clients are used by tests and local probes; avoid turning those into slow sleeps.
	if h.consoleHTTPClient != nil {
		return
	}
	delay := time.Duration(rand.IntN(10)+1) * time.Second
	h.logConsoleEvent(ctx, slog.LevelInfo, "newapi_console_request_delay_started", append(consoleBackendAttrs(backend),
		slog.String("method", method),
		slog.String("path", path),
		slog.Duration("delay", delay),
	)...)
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-ctx.Done():
	case <-timer.C:
	}
}

func (h *BackendHandler) backendConsoleUserAgent() string {
	if h.cfg == nil {
		return config.DefaultBackendConsoleUserAgent
	}
	value := strings.TrimSpace(h.cfg.BackendConsoleUserAgent)
	if value == "" {
		return config.DefaultBackendConsoleUserAgent
	}
	return value
}

func (r newAPIConsoleResult) success() bool {
	if r.StatusCode < 200 || r.StatusCode >= 300 {
		return false
	}
	if value, ok := r.Payload["success"].(bool); ok {
		return value
	}
	return true
}

func (r newAPIConsoleResult) loginRequired() bool {
	if r.StatusCode == http.StatusUnauthorized || r.StatusCode == http.StatusForbidden {
		return true
	}
	if r.success() {
		return false
	}
	message := strings.ToLower(strings.TrimSpace(fmt.Sprint(r.Payload["message"])))
	return strings.Contains(message, "未登录") ||
		strings.Contains(message, "登录") ||
		strings.Contains(message, "login") ||
		strings.Contains(message, "not logged") ||
		strings.Contains(message, "unauthorized")
}

func (r newAPIConsoleResult) alreadyCheckedIn() bool {
	message := strings.ToLower(strings.TrimSpace(fmt.Sprint(r.Payload["message"])))
	return strings.Contains(message, "已签到") ||
		strings.Contains(message, "已经签到") ||
		strings.Contains(message, "今日已签") ||
		strings.Contains(message, "今天已签") ||
		(strings.Contains(message, "already") && (strings.Contains(message, "check") || strings.Contains(message, "sign")))
}

func (r newAPIConsoleResult) errorMessage(fallback string) string {
	message := strings.TrimSpace(fmt.Sprint(r.Payload["message"]))
	if message != "" && message != "<nil>" {
		return message
	}
	return fallback
}

func newAPIStatusCheckinEnabled(statusPayload map[string]any) bool {
	statusData, ok := statusPayload["data"].(map[string]any)
	if !ok {
		return false
	}
	enabled, ok := statusData["checkin_enabled"].(bool)
	return ok && enabled
}

func (r sub2APIConsoleResult) success() bool {
	if r.StatusCode < 200 || r.StatusCode >= 300 {
		return false
	}
	switch value := r.Payload["code"].(type) {
	case float64:
		return value == 0
	case int:
		return value == 0
	case int64:
		return value == 0
	case json.Number:
		code, err := value.Int64()
		return err == nil && code == 0
	case string:
		return strings.TrimSpace(value) == "0"
	default:
		return true
	}
}

func (r sub2APIConsoleResult) errorMessage(fallback string) string {
	message := strings.TrimSpace(fmt.Sprint(r.Payload["message"]))
	if message != "" && message != "<nil>" {
		return message
	}
	return fallback
}

func consoleAPIURL(consoleURL, path string) string {
	base := strings.TrimRight(strings.TrimSpace(consoleURL), "/")
	path = normalizeConsoleAPIPath(path)
	if path == "" {
		return base
	}
	return base + path
}

func compactJSON(data []byte) string {
	var out bytes.Buffer
	if err := json.Compact(&out, data); err != nil {
		return strings.TrimSpace(string(data))
	}
	return out.String()
}

func sessionCookie(header http.Header) *http.Cookie {
	response := http.Response{Header: header}
	for _, cookie := range response.Cookies() {
		if cookie.Name == "session" {
			return cookie
		}
	}
	return nil
}

func mergeCookieValue(raw string, cookie *http.Cookie) string {
	if cookie == nil || strings.TrimSpace(cookie.Name) == "" {
		return strings.TrimSpace(raw)
	}
	replacement := cookie.Name + "=" + cookie.Value
	parts := strings.Split(raw, ";")
	out := make([]string, 0, len(parts)+1)
	replaced := false
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		name, _, ok := strings.Cut(part, "=")
		if ok && strings.TrimSpace(name) == cookie.Name {
			out = append(out, replacement)
			replaced = true
			continue
		}
		out = append(out, part)
	}
	if !replaced {
		out = append(out, replacement)
	}
	return strings.Join(out, "; ")
}

func normalizeConsoleAPIPath(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	if !strings.HasPrefix(value, "/") {
		value = "/" + value
	}
	return value
}

func consoleAccountSummaryJSON(payload map[string]any, statusPayload map[string]any, lastCheckinAt time.Time) (string, error) {
	data, ok := payload["data"].(map[string]any)
	if !ok {
		return "", errors.New("new-api self response missing data")
	}
	summary := map[string]any{
		"display_name": data["display_name"],
		"group":        data["group"],
		"id":           data["id"],
		"quota":        data["quota"],
		"role":         data["role"],
		"status":       data["status"],
		"used_quota":   data["used_quota"],
		"username":     data["username"],
	}
	if !lastCheckinAt.IsZero() {
		summary["last_checkin_at"] = lastCheckinAt.UTC().Format(time.RFC3339)
	}
	if statusData, ok := statusPayload["data"].(map[string]any); ok {
		for _, key := range []string{"custom_currency_exchange_rate", "custom_currency_symbol", "quota_display_type", "quota_per_unit"} {
			if value, ok := statusData[key]; ok {
				summary[key] = value
			}
		}
	}
	encoded, err := json.Marshal(summary)
	if err != nil {
		return "", err
	}
	return string(encoded), nil
}

func sub2APIConsoleAccountSummaryJSON(payload map[string]any, existingRaw string, lastCheckinAt time.Time) (string, error) {
	data, ok := payload["data"].(map[string]any)
	if !ok {
		return "", errors.New("sub2api auth/me response missing data")
	}
	summary := map[string]any{
		"id":       data["id"],
		"username": data["username"],
		"email":    data["email"],
		"balance":  data["balance"],
	}
	if !lastCheckinAt.IsZero() {
		summary["last_checkin_at"] = lastCheckinAt.UTC().Format(time.RFC3339)
	} else if value, ok := decodeJSONMap(existingRaw)["last_checkin_at"]; ok && value != nil && strings.TrimSpace(fmt.Sprint(value)) != "" {
		summary["last_checkin_at"] = value
	}
	encoded, err := json.Marshal(summary)
	if err != nil {
		return "", err
	}
	return string(encoded), nil
}

func consoleLastCheckinStatus(backend domain.Backend, now time.Time) (time.Time, bool) {
	payload := decodeJSONMap(backend.ConsoleAccountJSON)
	parsed, ok := consoleLastCheckinTime(payload, now)
	if !ok {
		return time.Time{}, false
	}
	return parsed, sameConsoleDate(parsed, now)
}

func consoleLastCheckinTime(payload map[string]any, now time.Time) (time.Time, bool) {
	for _, key := range []string{
		"last_checkin_at",
		"last_checkin_time",
		"checkin_time",
		"checkin_at",
		"last_checkin_date",
		"checkin_date",
	} {
		parsed, ok := consoleCheckinTimeValue(payload[key], now)
		if ok {
			return parsed, true
		}
	}
	return time.Time{}, false
}

func consoleCheckinTimeValue(value any, now time.Time) (time.Time, bool) {
	switch value := value.(type) {
	case string:
		return parseConsoleCheckinTime(value, now)
	case float64:
		if value <= 0 {
			return time.Time{}, false
		}
		return time.Unix(int64(value), 0), true
	case int:
		if value <= 0 {
			return time.Time{}, false
		}
		return time.Unix(int64(value), 0), true
	case int64:
		if value <= 0 {
			return time.Time{}, false
		}
		return time.Unix(value, 0), true
	default:
		return time.Time{}, false
	}
}

func parseConsoleCheckinTime(raw string, now time.Time) (time.Time, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return time.Time{}, false
	}
	for _, layout := range []string{
		time.RFC3339Nano,
		time.RFC3339,
		"2006-01-02 15:04:05",
		"2006-01-02 15:04",
		"2006/01/02 15:04:05",
		"2006/01/02 15:04",
	} {
		if parsed, err := time.ParseInLocation(layout, raw, consoleCheckinLocation(now)); err == nil {
			return parsed, true
		}
	}
	for _, layout := range []string{"2006-01-02", "2006/01/02"} {
		if parsed, err := time.ParseInLocation(layout, raw, consoleCheckinLocation(now)); err == nil {
			return parsed, true
		}
	}
	return time.Time{}, false
}

func consoleCheckinLocation(now time.Time) *time.Location {
	if now.Location() != nil && now.Location() != time.UTC {
		return now.Location()
	}
	if time.Local != nil {
		return time.Local
	}
	return time.UTC
}

func sameConsoleDate(value, now time.Time) bool {
	for _, location := range []*time.Location{consoleCheckinLocation(now), value.Location(), now.Location(), time.UTC} {
		if location == nil {
			continue
		}
		valueInLocation := value.In(location)
		nowInLocation := now.In(location)
		if valueInLocation.Year() == nowInLocation.Year() && valueInLocation.YearDay() == nowInLocation.YearDay() {
			return true
		}
	}
	return false
}

func filterConsolePricingPayload(payload map[string]any, focusPatterns string) map[string]any {
	out := cloneJSONMap(payload)
	if strings.TrimSpace(focusPatterns) == "" {
		return out
	}
	data, ok := out["data"].([]any)
	if !ok {
		return out
	}
	filtered := make([]any, 0, len(data))
	for _, item := range data {
		record, ok := item.(map[string]any)
		if !ok {
			continue
		}
		if modelNameMatchesFocusPatterns(fmt.Sprint(record["model_name"]), focusPatterns) {
			filtered = append(filtered, item)
		}
	}
	out["data"] = filtered
	return out
}

func cloneJSONMap(value map[string]any) map[string]any {
	encoded, err := json.Marshal(value)
	if err != nil {
		out := make(map[string]any, len(value))
		for key, item := range value {
			out[key] = item
		}
		return out
	}
	var out map[string]any
	if err := json.Unmarshal(encoded, &out); err != nil {
		out = make(map[string]any, len(value))
		for key, item := range value {
			out[key] = item
		}
	}
	return out
}

func modelNameMatchesFocusPatterns(modelName, patterns string) bool {
	modelName = strings.TrimSpace(modelName)
	if modelName == "" {
		return false
	}
	for _, pattern := range strings.FieldsFunc(patterns, func(r rune) bool {
		return r == ',' || r == '\n' || r == '\r' || r == '\t'
	}) {
		pattern = strings.TrimSpace(pattern)
		if pattern == "" {
			continue
		}
		if pattern == "*" || pattern == modelName {
			return true
		}
		if strings.ContainsAny(pattern, "*?") {
			if ok, err := pathpkg.Match(pattern, modelName); err == nil && ok {
				return true
			}
		}
	}
	return false
}

func consoleAccountID(payload map[string]any) string {
	data, ok := payload["data"].(map[string]any)
	if !ok {
		return ""
	}
	return consoleIDValue(data["id"])
}

func consoleStoredAccountID(backend domain.Backend) string {
	payload := decodeJSONMap(backend.ConsoleAccountJSON)
	return consoleIDValue(payload["id"])
}

func hasNewAPIDirectCheckinCredentials(backend domain.Backend, accountID string) bool {
	return strings.TrimSpace(backend.ConsoleCookie) != "" && strings.TrimSpace(accountID) != ""
}

func consoleAccountJSONWithUserID(raw string, userID string) (string, error) {
	payload := decodeJSONMap(raw)
	userID = strings.TrimSpace(userID)
	if userID == "" {
		delete(payload, "id")
	} else {
		payload["id"] = userID
	}
	encoded, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	return string(encoded), nil
}

func consoleIDValue(value any) string {
	switch value := value.(type) {
	case float64:
		if value <= 0 {
			return ""
		}
		return strconv.FormatInt(int64(value), 10)
	case int:
		if value <= 0 {
			return ""
		}
		return strconv.Itoa(value)
	case int64:
		if value <= 0 {
			return ""
		}
		return strconv.FormatInt(value, 10)
	case json.Number:
		id, err := value.Int64()
		if err != nil || id <= 0 {
			return ""
		}
		return strconv.FormatInt(id, 10)
	case string:
		return strings.TrimSpace(value)
	default:
		return ""
	}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value = strings.TrimSpace(value); value != "" {
			return value
		}
	}
	return ""
}

func decodeJSONMap(raw string) map[string]any {
	var payload map[string]any
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		return map[string]any{}
	}
	return payload
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
	copy.ConsoleCookie = secretPresenceValue(copy.ConsoleCookie)
	return copy
}
