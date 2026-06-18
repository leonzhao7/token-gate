package app

import (
	"context"
	"crypto/rand"
	"embed"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log/slog"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"token-gate/internal/config"
	"token-gate/internal/domain"
	"token-gate/internal/proxy"
	"token-gate/internal/scheduler"
	"token-gate/internal/store"
)

//go:embed web/*
var webFS embed.FS

type ctxKey string

const clientKeyContextKey ctxKey = "client-key"
const requestIDContextKey ctxKey = "request-id"

type App struct {
	cfg       config.Config
	store     *store.Store
	scheduler *scheduler.Service
	proxy     *proxy.Service
	mux       *http.ServeMux
	logger    *slog.Logger
}

type overviewResponse struct {
	Backends      []backendView       `json:"backends"`
	SocksProxies  int                 `json:"socks_proxies"`
	ClientKeys    int                 `json:"client_keys"`
	ModelPolicies int                 `json:"model_policies"`
	Events        []domain.AuditEvent `json:"events"`
}

type pagedListResponse struct {
	Items []any `json:"items"`
	Total int   `json:"total"`
	Page  int   `json:"page"`
	Limit int   `json:"limit"`
}

type backendView struct {
	domain.Backend
	RecentStats backendRecentStats `json:"recent_stats"`
}

type backendRecentStats struct {
	WindowMinutes int `json:"window_minutes"`
	Successes     int `json:"successes"`
	Failures      int `json:"failures"`
}

func New(ctx context.Context, cfg config.Config) (*App, error) {
	st, err := store.Open(ctx, cfg.DBPath)
	if err != nil {
		return nil, err
	}

	app := &App{
		cfg:       cfg,
		store:     st,
		scheduler: scheduler.New(st, cfg.BackendCooldown, cfg.BackendFails),
		proxy:     proxy.New(cfg.RequestTimeout),
		mux:       http.NewServeMux(),
		logger:    slog.Default().With("component", "app"),
	}
	app.routes()
	return app, nil
}

func (a *App) Close() error {
	return a.store.Close()
}

func (a *App) Handler() http.Handler {
	return a.accessLog(a.mux)
}

func (a *App) StartBackground(ctx context.Context) {
	// Intentionally empty. Token Gate does not automatically probe upstream
	// backends; runtime state is derived from real proxied requests only.
}

func (a *App) routes() {
	a.mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
	})

	a.mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		http.Redirect(w, r, "/admin/", http.StatusTemporaryRedirect)
	})

	subFS, err := fs.Sub(webFS, "web")
	if err == nil {
		a.mux.Handle("/admin/", http.StripPrefix("/admin/", http.FileServerFS(subFS)))
	}

	a.mux.Handle("GET /v1/models", a.clientAuth(http.HandlerFunc(a.handlePublicModels)))
	a.mux.Handle("/v1/", a.clientAuth(http.HandlerFunc(a.handleProxy)))

	a.mux.Handle("GET /admin/api/overview", a.adminAuth(http.HandlerFunc(a.handleOverview)))
	a.mux.Handle("GET /admin/api/socks-proxies", a.adminAuth(http.HandlerFunc(a.handleListSocksProxies)))
	a.mux.Handle("POST /admin/api/socks-proxies", a.adminAuth(http.HandlerFunc(a.handleCreateSocksProxy)))
	a.mux.Handle("PUT /admin/api/socks-proxies/{id}", a.adminAuth(http.HandlerFunc(a.handleUpdateSocksProxy)))
	a.mux.Handle("DELETE /admin/api/socks-proxies/{id}", a.adminAuth(http.HandlerFunc(a.handleDeleteSocksProxy)))
	a.mux.Handle("GET /admin/api/backends", a.adminAuth(http.HandlerFunc(a.handleListBackends)))
	a.mux.Handle("POST /admin/api/backends", a.adminAuth(http.HandlerFunc(a.handleCreateBackend)))
	a.mux.Handle("PUT /admin/api/backends/{id}", a.adminAuth(http.HandlerFunc(a.handleUpdateBackend)))
	a.mux.Handle("DELETE /admin/api/backends/{id}", a.adminAuth(http.HandlerFunc(a.handleDeleteBackend)))
	a.mux.Handle("GET /admin/api/client-keys", a.adminAuth(http.HandlerFunc(a.handleListClientKeys)))
	a.mux.Handle("POST /admin/api/client-keys", a.adminAuth(http.HandlerFunc(a.handleCreateClientKey)))
	a.mux.Handle("PUT /admin/api/client-keys/{id}", a.adminAuth(http.HandlerFunc(a.handleUpdateClientKey)))
	a.mux.Handle("DELETE /admin/api/client-keys/{id}", a.adminAuth(http.HandlerFunc(a.handleDeleteClientKey)))
	a.mux.Handle("GET /admin/api/model-policies", a.adminAuth(http.HandlerFunc(a.handleListPolicies)))
	a.mux.Handle("POST /admin/api/model-policies", a.adminAuth(http.HandlerFunc(a.handleCreatePolicy)))
	a.mux.Handle("PUT /admin/api/model-policies/{id}", a.adminAuth(http.HandlerFunc(a.handleUpdatePolicy)))
	a.mux.Handle("DELETE /admin/api/model-policies/{id}", a.adminAuth(http.HandlerFunc(a.handleDeletePolicy)))
	a.mux.Handle("GET /admin/api/events", a.adminAuth(http.HandlerFunc(a.handleListEvents)))
	a.mux.Handle("GET /admin/api/usage-logs", a.adminAuth(http.HandlerFunc(a.handleListUsageLogs)))
}

func (a *App) handlePublicModels(w http.ResponseWriter, r *http.Request) {
	backends, err := a.store.ListBackends(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	models := make(map[string]struct{})
	for _, backend := range backends {
		if !backend.Enabled {
			continue
		}
		mappedUpstreamModels := make(map[string]struct{}, len(backend.ModelMapping))
		for clientModel, upstreamModel := range backend.ModelMapping {
			clientModel = strings.TrimSpace(clientModel)
			upstreamModel = strings.TrimSpace(upstreamModel)
			if clientModel == "" || upstreamModel == "" {
				continue
			}
			mappedUpstreamModels[upstreamModel] = struct{}{}
			models[clientModel] = struct{}{}
		}
		for _, model := range backend.Models {
			model = strings.TrimSpace(model)
			if strings.ContainsAny(model, "*?") {
				continue
			}
			if _, mapped := mappedUpstreamModels[model]; mapped {
				continue
			}
			models[model] = struct{}{}
		}
	}

	type modelItem struct {
		ID      string `json:"id"`
		Object  string `json:"object"`
		OwnedBy string `json:"owned_by"`
	}
	var data []modelItem
	for model := range models {
		data = append(data, modelItem{ID: model, Object: "model", OwnedBy: "token-gate"})
	}
	if data == nil {
		data = []modelItem{}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"object": "list",
		"data":   data,
	})
}

func (a *App) handleProxy(w http.ResponseWriter, r *http.Request) {
	client, ok := a.clientFromContext(r.Context())
	if !ok {
		a.logEvent(r.Context(), slog.LevelWarn, "proxy_request_rejected",
			slog.String("reason", "missing_client_context"),
		)
		writeError(w, http.StatusUnauthorized, "missing client context")
		return
	}

	startedAt := time.Now()
	usageLog := domain.UsageLog{
		RequestID:         requestIDFromContext(r.Context()),
		ClientID:          client.ID,
		ClientName:        client.Name,
		ClientTokenPrefix: client.TokenPrefix,
		RouteModeOverride: client.RouteModeOverride,
		RouteGroup:        client.RouteGroup,
		Method:            r.Method,
		Path:              r.URL.Path,
		Query:             r.URL.RawQuery,
		ClientIP:          clientIP(r),
		UserAgent:         r.UserAgent(),
	}
	defer func() {
		usageLog.DurationMS = time.Since(startedAt).Milliseconds()
		_ = a.store.AppendUsageLog(r.Context(), usageLog)
	}()

	endpoint := proxy.EndpointForPath(r.URL.Path)
	usageLog.Endpoint = endpoint
	if endpoint == "" || endpoint == domain.EndpointModels {
		usageLog.StatusCode = http.StatusNotFound
		usageLog.ErrorMessage = "unsupported endpoint"
		a.logEvent(r.Context(), slog.LevelWarn, "proxy_request_rejected", append(clientAttrs(client),
			slog.String("reason", "unsupported_endpoint"),
			slog.String("path", r.URL.Path),
		)...)
		writeError(w, http.StatusNotFound, "unsupported endpoint")
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		usageLog.StatusCode = http.StatusBadRequest
		usageLog.ErrorMessage = err.Error()
		a.logEvent(r.Context(), slog.LevelWarn, "proxy_request_rejected", append(clientAttrs(client),
			slog.String("reason", "read_body_failed"),
			slog.String("error", err.Error()),
		)...)
		writeError(w, http.StatusBadRequest, "read request body failed")
		return
	}
	_ = r.Body.Close()

	model, err := proxy.ExtractModel(body)
	if err != nil {
		usageLog.StatusCode = http.StatusBadRequest
		usageLog.ErrorMessage = err.Error()
		a.logEvent(r.Context(), slog.LevelWarn, "proxy_request_rejected", append(clientAttrs(client),
			slog.String("reason", "invalid_request_body"),
			slog.String("endpoint", endpoint),
			slog.Int("body_bytes", len(body)),
			slog.String("error", err.Error()),
		)...)
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	a.logEvent(r.Context(), slog.LevelInfo, "proxy_request_received", append(clientAttrs(client),
		slog.String("endpoint", endpoint),
		slog.String("model", model),
		slog.Int("body_bytes", len(body)),
	)...)
	usageLog.Model = model

	selection, err := a.scheduler.SelectBackend(r.Context(), client, endpoint, model)
	if err != nil {
		usageLog.StatusCode = http.StatusBadGateway
		usageLog.ErrorMessage = err.Error()
		a.logEvent(r.Context(), slog.LevelWarn, "backend_selection_failed", append(clientAttrs(client),
			slog.String("endpoint", endpoint),
			slog.String("model", model),
			slog.String("error", err.Error()),
		)...)
		writeError(w, http.StatusBadGateway, "no backend available")
		return
	}
	a.logEvent(r.Context(), slog.LevelInfo, "backend_selection_completed", append(clientAttrs(client),
		slog.String("endpoint", endpoint),
		slog.String("model", model),
		slog.String("policy_pattern", selection.Policy.Pattern),
		slog.String("policy_endpoint", selection.Policy.Endpoint),
		slog.String("placement_policy", selection.Policy.PlacementPolicy),
		slog.String("backend_pool", selection.Policy.BackendPool),
		slog.Bool("failover_enabled", selection.Policy.FailoverEnabled),
		slog.Int("candidate_count", len(selection.Candidates)),
		slog.Any("candidate_backends", candidateNames(selection.Candidates)),
	)...)

	var (
		lastErr    error
		lastStatus int
	)

	for index, backend := range selection.Candidates {
		attempt := index + 1
		usageLog.Attempts = attempt
		usageLog.BackendID = backend.ID
		usageLog.BackendName = backend.Name
		upstreamModel := mappedBackendModel(backend, model)
		requestBody := body
		if upstreamModel != model {
			requestBody, err = proxy.RewriteModel(body, upstreamModel)
			if err != nil {
				usageLog.StatusCode = http.StatusBadGateway
				usageLog.ErrorMessage = "rewrite model failed: " + err.Error()
				a.logEvent(r.Context(), slog.LevelWarn, "backend_request_rewrite_failed", append(append(clientAttrs(client),
					backendAttemptAttrs(backend, attempt)...),
					slog.String("endpoint", endpoint),
					slog.String("model", model),
					slog.String("upstream_model", upstreamModel),
					slog.String("error", err.Error()),
				)...)
				lastErr = err
				break
			}
		}
		attemptStartedAt := time.Now()
		a.logEvent(r.Context(), slog.LevelInfo, "backend_request_started", append(append(clientAttrs(client),
			backendAttemptAttrs(backend, attempt)...),
			slog.String("endpoint", endpoint),
			slog.String("model", model),
			slog.String("upstream_model", upstreamModel),
			slog.String("method", r.Method),
			slog.String("path", r.URL.Path),
			slog.String("query", r.URL.RawQuery),
		)...)

		release := a.scheduler.Acquire(backend.ID)
		resp, err := a.proxy.Do(a.withBackendTrace(r.Context(), backend, attempt), r, backend, requestBody)
		if err != nil {
			release()
			a.scheduler.MarkFailure(backend.ID, err)
			lastErr = err
			usageLog.ErrorMessage = err.Error()
			a.logEvent(r.Context(), slog.LevelWarn, "backend_request_failed", append(append(clientAttrs(client),
				backendAttemptAttrs(backend, attempt)...),
				slog.String("endpoint", endpoint),
				slog.String("model", model),
				slog.Duration("duration", time.Since(attemptStartedAt)),
				slog.String("error", err.Error()),
				slog.Bool("will_failover", selection.Policy.FailoverEnabled && index < len(selection.Candidates)-1),
			)...)
			_ = a.store.AppendAuditEvent(r.Context(), domain.AuditEvent{
				Level:       "warn",
				Type:        "proxy_retry",
				Message:     fmt.Sprintf("backend request failed: %v", err),
				ClientName:  client.Name,
				Model:       model,
				Endpoint:    endpoint,
				BackendName: backend.Name,
			})
			if selection.Policy.FailoverEnabled && index < len(selection.Candidates)-1 {
				continue
			}
			break
		}

		if proxy.RetryableStatus(resp.StatusCode) && selection.Policy.FailoverEnabled && index < len(selection.Candidates)-1 {
			lastStatus = resp.StatusCode
			usageLog.StatusCode = resp.StatusCode
			usageLog.ErrorMessage = resp.Status
			a.scheduler.MarkFailure(backend.ID, errors.New(resp.Status))
			_, _ = io.Copy(io.Discard, resp.Body)
			_ = resp.Body.Close()
			release()
			a.logEvent(r.Context(), slog.LevelWarn, "backend_response_retryable", append(append(clientAttrs(client),
				backendAttemptAttrs(backend, attempt)...),
				slog.String("endpoint", endpoint),
				slog.String("model", model),
				slog.Int("status", resp.StatusCode),
				slog.String("status_text", resp.Status),
				slog.Duration("duration", time.Since(attemptStartedAt)),
				slog.Bool("will_failover", true),
			)...)
			_ = a.store.AppendAuditEvent(r.Context(), domain.AuditEvent{
				Level:       "warn",
				Type:        "backend_failover",
				Message:     "retryable upstream status triggered failover",
				ClientName:  client.Name,
				Model:       model,
				Endpoint:    endpoint,
				BackendName: backend.Name,
			})
			continue
		}

		if domain.IsBackendFailureStatus(resp.StatusCode) {
			a.scheduler.MarkFailure(backend.ID, errors.New(resp.Status))
		} else {
			a.scheduler.MarkSuccess(backend.ID)
		}
		usageLog.StatusCode = resp.StatusCode
		usageLog.ErrorMessage = ""

		a.logEvent(r.Context(), slog.LevelInfo, "backend_response_selected", append(append(clientAttrs(client),
			backendAttemptAttrs(backend, attempt)...),
			slog.String("endpoint", endpoint),
			slog.String("model", model),
			slog.Int("status", resp.StatusCode),
			slog.String("status_text", resp.Status),
			slog.String("content_type", resp.Header.Get("Content-Type")),
			slog.Duration("duration", time.Since(attemptStartedAt)),
		)...)
		err = proxy.WriteResponse(w, resp)
		release()
		if err != nil {
			usageLog.StatusCode = http.StatusBadGateway
			usageLog.ErrorMessage = err.Error()
			a.logEvent(r.Context(), slog.LevelWarn, "client_response_write_failed", append(append(clientAttrs(client),
				backendAttemptAttrs(backend, attempt)...),
				slog.String("endpoint", endpoint),
				slog.String("model", model),
				slog.String("error", err.Error()),
			)...)
			return
		}
		return
	}

	if lastErr != nil {
		usageLog.StatusCode = http.StatusBadGateway
		usageLog.ErrorMessage = lastErr.Error()
		a.logEvent(r.Context(), slog.LevelWarn, "proxy_request_failed", append(clientAttrs(client),
			slog.String("endpoint", endpoint),
			slog.String("model", model),
			slog.String("error", lastErr.Error()),
		)...)
		writeError(w, http.StatusBadGateway, "all candidate backends failed: "+lastErr.Error())
		return
	}
	if lastStatus != 0 {
		usageLog.StatusCode = lastStatus
		usageLog.ErrorMessage = fmt.Sprintf("all candidate backends failed with retryable status, last status=%d", lastStatus)
		a.logEvent(r.Context(), slog.LevelWarn, "proxy_request_failed", append(clientAttrs(client),
			slog.String("endpoint", endpoint),
			slog.String("model", model),
			slog.Int("last_status", lastStatus),
		)...)
		writeError(w, http.StatusBadGateway, fmt.Sprintf("all candidate backends failed with retryable status, last status=%d", lastStatus))
		return
	}
	usageLog.ErrorMessage = "all candidate backends failed"
	usageLog.StatusCode = http.StatusBadGateway
	a.logEvent(r.Context(), slog.LevelWarn, "proxy_request_failed", append(clientAttrs(client),
		slog.String("endpoint", endpoint),
		slog.String("model", model),
		slog.String("error", "all candidate backends failed"),
	)...)
	writeError(w, http.StatusBadGateway, "all candidate backends failed")
}

func (a *App) handleOverview(w http.ResponseWriter, r *http.Request) {
	backends, err := a.store.ListBackends(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	clients, err := a.store.ListClientKeys(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	proxies, err := a.store.ListSocksProxies(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	policies, err := a.store.ListModelPolicies(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	events, err := a.store.ListAuditEvents(r.Context(), 20)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	stats, err := a.store.BackendRequestStatsSince(r.Context(), time.Now().UTC().Add(-30*time.Minute))
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	var views []backendView
	for _, backend := range backends {
		stat := stats[backend.ID]
		views = append(views, backendView{
			Backend: backend,
			RecentStats: backendRecentStats{
				WindowMinutes: 30,
				Successes:     stat.Successes,
				Failures:      stat.Failures,
			},
		})
	}

	writeJSON(w, http.StatusOK, overviewResponse{
		Backends:      ensureBackendViews(views),
		SocksProxies:  len(proxies),
		ClientKeys:    len(clients),
		ModelPolicies: len(policies),
		Events:        ensureAuditEvents(events),
	})
}

func (a *App) handleListSocksProxies(w http.ResponseWriter, r *http.Request) {
	page, limit := parsePageQuery(r)
	total, err := a.store.CountSocksProxies(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	proxies, err := a.store.ListSocksProxiesPage(r.Context(), limit, pageOffset(page, limit))
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, pagedResponse(ensureSocksProxies(proxies), total, page, limit))
}

func (a *App) handleCreateSocksProxy(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		Name     string `json:"name"`
		Address  string `json:"address"`
		Username string `json:"username"`
		Password string `json:"password"`
		Enabled  bool   `json:"enabled"`
	}
	if err := decodeJSON(r, &payload); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := validateSocksProxyAddress(payload.Address); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	proxy, err := a.store.CreateSocksProxy(r.Context(), domain.SocksProxy{
		Name:     payload.Name,
		Address:  payload.Address,
		Username: payload.Username,
		Password: payload.Password,
		Enabled:  payload.Enabled,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	_ = a.store.AppendAuditEvent(r.Context(), domain.AuditEvent{
		Type:    "admin_socks_proxy_create",
		Message: "socks proxy created: " + proxy.Name,
	})
	writeJSON(w, http.StatusCreated, proxy)
}

func (a *App) handleUpdateSocksProxy(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	current, err := a.store.GetSocksProxy(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "socks proxy not found")
		return
	}

	var payload struct {
		Name     string `json:"name"`
		Address  string `json:"address"`
		Username string `json:"username"`
		Password string `json:"password"`
		Enabled  bool   `json:"enabled"`
	}
	if err := decodeJSON(r, &payload); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := validateSocksProxyAddress(payload.Address); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	current.Name = payload.Name
	current.Address = payload.Address
	current.Username = payload.Username
	current.Password = payload.Password
	current.Enabled = payload.Enabled

	proxy, err := a.store.UpdateSocksProxy(r.Context(), current)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	_ = a.store.AppendAuditEvent(r.Context(), domain.AuditEvent{
		Type:    "admin_socks_proxy_update",
		Message: "socks proxy updated: " + proxy.Name,
	})
	writeJSON(w, http.StatusOK, proxy)
}

func (a *App) handleDeleteSocksProxy(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := a.store.DeleteSocksProxy(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"deleted": id})
}

func (a *App) handleListBackends(w http.ResponseWriter, r *http.Request) {
	page, limit := parsePageQuery(r)
	total, err := a.store.CountBackends(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	backends, err := a.store.ListBackendsPage(r.Context(), limit, pageOffset(page, limit))
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	stats, err := a.store.BackendRequestStatsSince(r.Context(), time.Now().UTC().Add(-30*time.Minute))
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	var response []backendView
	for _, backend := range backends {
		stat := stats[backend.ID]
		response = append(response, backendView{
			Backend: backend,
			RecentStats: backendRecentStats{
				WindowMinutes: 30,
				Successes:     stat.Successes,
				Failures:      stat.Failures,
			},
		})
	}
	writeJSON(w, http.StatusOK, pagedResponse(ensureBackendViews(response), total, page, limit))
}

func (a *App) handleCreateBackend(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		Name         string            `json:"name"`
		Pool         string            `json:"pool"`
		Protocol     string            `json:"protocol"`
		BaseURL      string            `json:"base_url"`
		APIKey       string            `json:"api_key"`
		ProxyID      int64             `json:"proxy_id"`
		Enabled      bool              `json:"enabled"`
		Weight       int               `json:"weight"`
		Models       []string          `json:"models"`
		ModelMapping map[string]string `json:"model_mapping"`
		Endpoints    []string          `json:"endpoints"`
	}
	if err := decodeJSON(r, &payload); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := validateURL(payload.BaseURL); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := a.validateSocksProxyReference(r.Context(), payload.ProxyID); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	backend, err := a.store.CreateBackend(r.Context(), domain.Backend{
		Name:         payload.Name,
		Pool:         payload.Pool,
		Protocol:     domain.NormalizeBackendProtocol(payload.Protocol),
		BaseURL:      payload.BaseURL,
		APIKey:       payload.APIKey,
		ProxyID:      payload.ProxyID,
		Enabled:      payload.Enabled,
		Weight:       payload.Weight,
		Models:       payload.Models,
		ModelMapping: payload.ModelMapping,
		Endpoints:    payload.Endpoints,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	_ = a.store.AppendAuditEvent(r.Context(), domain.AuditEvent{
		Type:        "admin_backend_create",
		Message:     "backend created",
		BackendName: backend.Name,
	})
	writeJSON(w, http.StatusCreated, backend)
}

func (a *App) handleUpdateBackend(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	current, err := a.store.GetBackend(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "backend not found")
		return
	}

	var payload struct {
		Name         string            `json:"name"`
		Pool         string            `json:"pool"`
		Protocol     string            `json:"protocol"`
		BaseURL      string            `json:"base_url"`
		APIKey       string            `json:"api_key"`
		ProxyID      int64             `json:"proxy_id"`
		Enabled      bool              `json:"enabled"`
		Weight       int               `json:"weight"`
		Models       []string          `json:"models"`
		ModelMapping map[string]string `json:"model_mapping"`
		Endpoints    []string          `json:"endpoints"`
	}
	if err := decodeJSON(r, &payload); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := validateURL(payload.BaseURL); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := a.validateSocksProxyReference(r.Context(), payload.ProxyID); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	current.Name = payload.Name
	current.Pool = payload.Pool
	if strings.TrimSpace(payload.Protocol) != "" {
		current.Protocol = domain.NormalizeBackendProtocol(payload.Protocol)
	}
	current.BaseURL = payload.BaseURL
	if strings.TrimSpace(payload.APIKey) != "" {
		current.APIKey = payload.APIKey
	}
	current.ProxyID = payload.ProxyID
	current.Enabled = payload.Enabled
	current.Weight = payload.Weight
	current.Models = payload.Models
	current.ModelMapping = payload.ModelMapping
	current.Endpoints = payload.Endpoints

	backend, err := a.store.UpdateBackend(r.Context(), current)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	_ = a.store.AppendAuditEvent(r.Context(), domain.AuditEvent{
		Type:        "admin_backend_update",
		Message:     "backend updated",
		BackendName: backend.Name,
	})
	writeJSON(w, http.StatusOK, backend)
}

func (a *App) handleDeleteBackend(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := a.store.DeleteBackend(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"deleted": id})
}

func (a *App) handleListClientKeys(w http.ResponseWriter, r *http.Request) {
	page, limit := parsePageQuery(r)
	total, err := a.store.CountClientKeys(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	clients, err := a.store.ListClientKeysPage(r.Context(), limit, pageOffset(page, limit))
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, pagedResponse(ensureClientKeys(clients), total, page, limit))
}

func (a *App) handleCreateClientKey(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		Name              string `json:"name"`
		Token             string `json:"token"`
		Enabled           bool   `json:"enabled"`
		RouteModeOverride string `json:"route_mode_override"`
		RouteGroup        string `json:"route_group"`
	}
	if err := decodeJSON(r, &payload); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	token := strings.TrimSpace(payload.Token)
	if token == "" {
		generated, err := generateToken()
		if err != nil {
			writeError(w, http.StatusInternalServerError, "generate token failed")
			return
		}
		token = generated
	}

	client, err := a.store.CreateClientKey(r.Context(), domain.ClientKey{
		Name:              payload.Name,
		TokenHash:         store.HashToken(token),
		Token:             token,
		TokenPrefix:       tokenPrefix(token),
		Enabled:           payload.Enabled,
		RouteModeOverride: payload.RouteModeOverride,
		RouteGroup:        payload.RouteGroup,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	_ = a.store.AppendAuditEvent(r.Context(), domain.AuditEvent{
		Type:       "admin_client_create",
		Message:    "client key created",
		ClientName: client.Name,
	})
	writeJSON(w, http.StatusCreated, map[string]any{
		"client":       client,
		"issued_token": token,
	})
}

func (a *App) handleUpdateClientKey(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	client, err := a.store.GetClientKey(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "client key not found")
		return
	}

	var payload struct {
		Name              string `json:"name"`
		Token             string `json:"token"`
		Enabled           bool   `json:"enabled"`
		RouteModeOverride string `json:"route_mode_override"`
		RouteGroup        string `json:"route_group"`
	}
	if err := decodeJSON(r, &payload); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	client.Name = payload.Name
	client.Enabled = payload.Enabled
	client.RouteModeOverride = payload.RouteModeOverride
	client.RouteGroup = payload.RouteGroup

	issuedToken := ""
	if strings.TrimSpace(payload.Token) != "" && strings.TrimSpace(payload.Token) != client.Token {
		issuedToken = strings.TrimSpace(payload.Token)
		client.TokenHash = store.HashToken(issuedToken)
		client.Token = issuedToken
		client.TokenPrefix = tokenPrefix(issuedToken)
	}

	updated, err := a.store.UpdateClientKey(r.Context(), client)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"client":       updated,
		"issued_token": issuedToken,
	})
}

func (a *App) handleDeleteClientKey(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := a.store.DeleteClientKey(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"deleted": id})
}

func (a *App) handleListPolicies(w http.ResponseWriter, r *http.Request) {
	page, limit := parsePageQuery(r)
	total, err := a.store.CountModelPolicies(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	policies, err := a.store.ListModelPoliciesPage(r.Context(), limit, pageOffset(page, limit))
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, pagedResponse(ensureModelPolicies(policies), total, page, limit))
}

func (a *App) handleCreatePolicy(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		Pattern         string `json:"pattern"`
		Endpoint        string `json:"endpoint"`
		PlacementPolicy string `json:"placement_policy"`
		BackendPool     string `json:"backend_pool"`
		FailoverEnabled bool   `json:"failover_enabled"`
		Priority        int    `json:"priority"`
	}
	if err := decodeJSON(r, &payload); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	policy, err := a.store.CreateModelPolicy(r.Context(), domain.ModelPolicy{
		Pattern:         payload.Pattern,
		Endpoint:        payload.Endpoint,
		PlacementPolicy: payload.PlacementPolicy,
		BackendPool:     payload.BackendPool,
		FailoverEnabled: payload.FailoverEnabled,
		Priority:        payload.Priority,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, policy)
}

func (a *App) handleUpdatePolicy(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	policy, err := a.store.GetModelPolicy(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "policy not found")
		return
	}

	var payload struct {
		Pattern         string `json:"pattern"`
		Endpoint        string `json:"endpoint"`
		PlacementPolicy string `json:"placement_policy"`
		BackendPool     string `json:"backend_pool"`
		FailoverEnabled bool   `json:"failover_enabled"`
		Priority        int    `json:"priority"`
	}
	if err := decodeJSON(r, &payload); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	policy.Pattern = payload.Pattern
	policy.Endpoint = payload.Endpoint
	policy.PlacementPolicy = payload.PlacementPolicy
	policy.BackendPool = payload.BackendPool
	policy.FailoverEnabled = payload.FailoverEnabled
	policy.Priority = payload.Priority

	updated, err := a.store.UpdateModelPolicy(r.Context(), policy)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

func (a *App) handleDeletePolicy(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := a.store.DeleteModelPolicy(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"deleted": id})
}

func (a *App) handleListEvents(w http.ResponseWriter, r *http.Request) {
	page, limit := parsePageQuery(r)
	total, err := a.store.CountAuditEvents(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	events, err := a.store.ListAuditEventsPage(r.Context(), limit, pageOffset(page, limit))
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, pagedResponse(ensureAuditEvents(events), total, page, limit))
}

func (a *App) handleListUsageLogs(w http.ResponseWriter, r *http.Request) {
	page, limit := parsePageQuery(r)
	total, err := a.store.CountUsageLogs(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	logs, err := a.store.ListUsageLogsPage(r.Context(), limit, pageOffset(page, limit))
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, pagedResponse(ensureUsageLogs(logs), total, page, limit))
}

func (a *App) adminAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := strings.TrimSpace(extractBearer(r.Header.Get("Authorization")))
		if token == "" {
			token = strings.TrimSpace(r.Header.Get("X-Admin-Token"))
		}
		if token == "" || token != a.cfg.AdminToken {
			a.logEvent(r.Context(), slog.LevelWarn, "admin_auth_failed",
				slog.String("path", r.URL.Path),
				slog.String("method", r.Method),
				slog.String("reason", "invalid_admin_token"),
				slog.Bool("token_present", token != ""),
			)
			writeError(w, http.StatusUnauthorized, "invalid admin token")
			return
		}
		a.logEvent(r.Context(), slog.LevelInfo, "admin_auth_succeeded",
			slog.String("path", r.URL.Path),
			slog.String("method", r.Method),
		)
		next.ServeHTTP(w, r)
	})
}

func (a *App) clientAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := extractClientToken(r.Header)
		if token == "" {
			a.logEvent(r.Context(), slog.LevelWarn, "client_auth_failed",
				slog.String("path", r.URL.Path),
				slog.String("method", r.Method),
				slog.String("reason", "missing_api_key"),
			)
			writeError(w, http.StatusUnauthorized, "missing api key")
			return
		}

		client, err := a.store.FindClientKeyByToken(r.Context(), token)
		if err != nil {
			a.logEvent(r.Context(), slog.LevelError, "client_auth_lookup_failed",
				slog.String("path", r.URL.Path),
				slog.String("method", r.Method),
				slog.String("token_prefix", tokenPrefix(token)),
				slog.String("error", err.Error()),
			)
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		if client == nil {
			a.logEvent(r.Context(), slog.LevelWarn, "client_auth_failed",
				slog.String("path", r.URL.Path),
				slog.String("method", r.Method),
				slog.String("reason", "invalid_api_key"),
				slog.String("token_prefix", tokenPrefix(token)),
			)
			writeError(w, http.StatusUnauthorized, "invalid api key")
			return
		}

		a.logEvent(r.Context(), slog.LevelInfo, "client_auth_succeeded", append(clientAttrs(*client),
			slog.String("path", r.URL.Path),
			slog.String("method", r.Method),
		)...)
		ctx := context.WithValue(r.Context(), clientKeyContextKey, *client)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (a *App) clientFromContext(ctx context.Context) (domain.ClientKey, bool) {
	value := ctx.Value(clientKeyContextKey)
	client, ok := value.(domain.ClientKey)
	return client, ok
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

func extractBearer(value string) string {
	if len(value) >= 7 && strings.EqualFold(value[:7], "Bearer ") {
		return strings.TrimSpace(value[7:])
	}
	return strings.TrimSpace(value)
}

func extractClientToken(header http.Header) string {
	if token := strings.TrimSpace(extractBearer(header.Get("Authorization"))); token != "" {
		return token
	}
	return strings.TrimSpace(header.Get("X-Api-Key"))
}

func generateToken() (string, error) {
	var raw [24]byte
	if _, err := rand.Read(raw[:]); err != nil {
		return "", err
	}
	return "tg-" + base64.RawURLEncoding.EncodeToString(raw[:]), nil
}

func tokenPrefix(token string) string {
	token = strings.TrimSpace(token)
	if len(token) <= 8 {
		return token
	}
	return token[:8]
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

func validateSocksProxyAddress(value string) error {
	address := strings.TrimSpace(value)
	if address == "" {
		return errors.New("proxy address is required")
	}
	host, port, err := net.SplitHostPort(address)
	if err != nil {
		return errors.New("proxy address must be host:port")
	}
	if strings.TrimSpace(host) == "" {
		return errors.New("proxy address must include host")
	}
	parsedPort, err := strconv.Atoi(port)
	if err != nil || parsedPort < 1 || parsedPort > 65535 {
		return errors.New("proxy address port must be 1-65535")
	}
	return nil
}

func (a *App) validateSocksProxyReference(ctx context.Context, proxyID int64) error {
	if proxyID < 0 {
		return errors.New("proxy_id must be >= 0")
	}
	if proxyID == 0 {
		return nil
	}
	if _, err := a.store.GetSocksProxy(ctx, proxyID); err != nil {
		return errors.New("socks proxy not found")
	}
	return nil
}

func ensureBackendViews(values []backendView) []backendView {
	if values == nil {
		return []backendView{}
	}
	return values
}

func ensureSocksProxies(values []domain.SocksProxy) []domain.SocksProxy {
	if values == nil {
		return []domain.SocksProxy{}
	}
	return values
}

func ensureClientKeys(values []domain.ClientKey) []domain.ClientKey {
	if values == nil {
		return []domain.ClientKey{}
	}
	return values
}

func ensureModelPolicies(values []domain.ModelPolicy) []domain.ModelPolicy {
	if values == nil {
		return []domain.ModelPolicy{}
	}
	return values
}

func ensureAuditEvents(values []domain.AuditEvent) []domain.AuditEvent {
	if values == nil {
		return []domain.AuditEvent{}
	}
	return values
}

func ensureUsageLogs(values []domain.UsageLog) []domain.UsageLog {
	if values == nil {
		return []domain.UsageLog{}
	}
	return values
}

func mappedBackendModel(backend domain.Backend, clientModel string) string {
	if backend.ModelMapping == nil {
		return clientModel
	}
	if mapped := strings.TrimSpace(backend.ModelMapping[strings.TrimSpace(clientModel)]); mapped != "" {
		return mapped
	}
	return clientModel
}

func parsePageQuery(r *http.Request) (int, int) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if page < 1 {
		page = 1
	}
	switch limit {
	case 10, 20, 50:
	default:
		limit = 10
	}
	return page, limit
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
