package store

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"slices"
	"strconv"
	"strings"
	"time"

	_ "github.com/mattn/go-sqlite3"

	"token-gate/internal/domain"
)

type Store struct {
	db *sql.DB
}

type BackendRequestStats struct {
	Successes int
	Failures  int
}

type ClientKeyUsageSummary struct {
	UsageCount int
	LastUsedAt time.Time
}

type ProxyUsageSummary struct {
	RequestCount int
	TrafficBytes int64
	AvgLatencyMS float64
	LastUsedAt   time.Time
}

type BackendUsageSummary struct {
	RequestCount int
	AvgLatencyMS float64
	LastUsedAt   time.Time
}

type UsageLogFilter struct {
	BackendName string
	Model       string
	ClientName  string
	PolicyName  string
	ProxyName   string
	Status      string
	Query       string
	DateFrom    time.Time
	DateTo      time.Time
}

type UsageLogOptions struct {
	Backends   []string
	Models     []string
	ClientKeys []string
	Policies   []string
	Proxies    []string
}

type EventFilter struct {
	Category string
	Severity string
	Actor    string
	Backend  string
	Query    string
	DateFrom time.Time
	DateTo   time.Time
}

type DashboardSummaryData struct {
	Backends        int
	ClientKeys      int
	ModelPolicies   int
	SocksProxies    int
	HealthyBackends int
	RecentErrors    int
	ActiveClients   int
	RequestGrowth   float64
	ErrorGrowth     float64
	Sparkline       []DashboardSparkPoint
}

type DashboardSparkPoint struct {
	Label    string
	Requests int
}

type DashboardUsageSeriesPoint struct {
	Label        string
	Requests     int
	TrafficBytes int64
	ErrorRate    float64
}

type DashboardActivityData struct {
	Events  []domain.AuditEvent
	Usage   []domain.UsageLog
	Summary []DashboardActivitySummary
}

type DashboardActivitySummary struct {
	Category string
	Count    int
}

type SearchResults struct {
	Backends   []SearchResult
	ClientKeys []SearchResult
	Policies   []SearchResult
	Proxies    []SearchResult
	UsageLogs  []SearchResult
	Events     []SearchResult
}

type SearchResult struct {
	Kind       string
	ID         int64
	Title      string
	Subtitle   string
	Meta       map[string]any
	Status     string
	TargetPage string
	TargetID   int64
}

type BackendDetailData struct {
	Backend domain.Backend
	Usage   []domain.UsageLog
	Events  []domain.AuditEvent
}

type ClientKeyDetailData struct {
	Client domain.ClientKey
	Usage  []domain.UsageLog
	Events []domain.AuditEvent
}

type ModelPolicyDetailData struct {
	Policy domain.ModelPolicy
	Events []domain.AuditEvent
}

type SocksProxyDetailData struct {
	Proxy    domain.SocksProxy
	Backends []domain.Backend
}

type UsageLogStats struct {
	Requests       int
	Successes      int
	Failures       int
	AvgDurationMS  float64
	P95DurationMS  int64
	StatusFamilies []StatusFamilyCount
}

type StatusFamilyCount struct {
	Family string
	Count  int
}

type EventSummary struct {
	Total      int
	Categories []CategoryCount
	Severities []CategoryCount
	Actors     []CategoryCount
}

type CategoryCount struct {
	Name  string
	Count int
}

func Open(ctx context.Context, path string) (*Store, error) {
	db, err := sql.Open("sqlite3", path)
	if err != nil {
		return nil, err
	}

	db.SetMaxOpenConns(4)
	db.SetMaxIdleConns(4)
	db.SetConnMaxLifetime(0)

	stmts := []string{
		`PRAGMA journal_mode = WAL;`,
		`PRAGMA busy_timeout = 5000;`,
		`PRAGMA foreign_keys = ON;`,
		`CREATE TABLE IF NOT EXISTS client_keys (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			token_hash TEXT NOT NULL UNIQUE,
			token TEXT NOT NULL DEFAULT '',
			token_prefix TEXT NOT NULL,
			enabled INTEGER NOT NULL DEFAULT 1,
			route_mode_override TEXT NOT NULL DEFAULT '',
			route_group TEXT NOT NULL DEFAULT '',
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		);`,
		`CREATE INDEX IF NOT EXISTS idx_client_keys_enabled ON client_keys(enabled);`,
		`CREATE TABLE IF NOT EXISTS socks_proxies (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL UNIQUE,
			address TEXT NOT NULL,
			username TEXT NOT NULL DEFAULT '',
			password TEXT NOT NULL DEFAULT '',
			enabled INTEGER NOT NULL DEFAULT 1,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		);`,
		`CREATE INDEX IF NOT EXISTS idx_socks_proxies_enabled ON socks_proxies(enabled);`,
		`CREATE TABLE IF NOT EXISTS backends (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL UNIQUE,
			pool TEXT NOT NULL DEFAULT '',
			protocol TEXT NOT NULL DEFAULT 'openai',
			base_url TEXT NOT NULL,
			api_key TEXT NOT NULL,
			proxy_id INTEGER NOT NULL DEFAULT 0,
			enabled INTEGER NOT NULL DEFAULT 1,
			weight INTEGER NOT NULL DEFAULT 1,
			model_list TEXT NOT NULL,
			model_mapping TEXT NOT NULL DEFAULT '{}',
			endpoint_list TEXT NOT NULL,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		);`,
		`CREATE INDEX IF NOT EXISTS idx_backends_enabled ON backends(enabled);`,
		`CREATE TABLE IF NOT EXISTS model_policies (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			pattern TEXT NOT NULL,
			endpoint TEXT NOT NULL,
			placement_policy TEXT NOT NULL,
			backend_pool TEXT NOT NULL DEFAULT '',
			failover_enabled INTEGER NOT NULL DEFAULT 1,
			priority INTEGER NOT NULL DEFAULT 100,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		);`,
		`CREATE INDEX IF NOT EXISTS idx_model_policies_priority ON model_policies(priority, endpoint);`,
		`CREATE TABLE IF NOT EXISTS audit_events (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			level TEXT NOT NULL,
			type TEXT NOT NULL,
			category TEXT NOT NULL DEFAULT '',
			severity TEXT NOT NULL DEFAULT '',
			actor TEXT NOT NULL DEFAULT '',
			resource_type TEXT NOT NULL DEFAULT '',
			resource_id INTEGER NOT NULL DEFAULT 0,
			message TEXT NOT NULL,
			client_name TEXT NOT NULL DEFAULT '',
			model TEXT NOT NULL DEFAULT '',
			endpoint TEXT NOT NULL DEFAULT '',
			backend_name TEXT NOT NULL DEFAULT '',
			created_at TEXT NOT NULL
		);`,
		`CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events(created_at DESC);`,
		`CREATE TABLE IF NOT EXISTS usage_logs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			request_id TEXT NOT NULL,
			client_id INTEGER NOT NULL DEFAULT 0,
			client_name TEXT NOT NULL DEFAULT '',
			client_token_prefix TEXT NOT NULL DEFAULT '',
			route_mode_override TEXT NOT NULL DEFAULT '',
			route_group TEXT NOT NULL DEFAULT '',
			method TEXT NOT NULL DEFAULT '',
			path TEXT NOT NULL DEFAULT '',
			query TEXT NOT NULL DEFAULT '',
			endpoint TEXT NOT NULL DEFAULT '',
			model TEXT NOT NULL DEFAULT '',
			policy_id INTEGER NOT NULL DEFAULT 0,
			policy_name TEXT NOT NULL DEFAULT '',
			backend_id INTEGER NOT NULL DEFAULT 0,
			backend_name TEXT NOT NULL DEFAULT '',
			proxy_id INTEGER NOT NULL DEFAULT 0,
			proxy_name TEXT NOT NULL DEFAULT '',
			attempts INTEGER NOT NULL DEFAULT 0,
			status_code INTEGER NOT NULL DEFAULT 0,
			status_family TEXT NOT NULL DEFAULT '',
			duration_ms INTEGER NOT NULL DEFAULT 0,
			error_message TEXT NOT NULL DEFAULT '',
			client_ip TEXT NOT NULL DEFAULT '',
			user_agent TEXT NOT NULL DEFAULT '',
			trace_id TEXT NOT NULL DEFAULT '',
			request_bytes INTEGER NOT NULL DEFAULT 0,
			response_bytes INTEGER NOT NULL DEFAULT 0,
			request_headers_json TEXT NOT NULL DEFAULT '{}',
			request_body_preview TEXT NOT NULL DEFAULT '',
			response_headers_json TEXT NOT NULL DEFAULT '{}',
			response_body_preview TEXT NOT NULL DEFAULT '',
			preview_truncated INTEGER NOT NULL DEFAULT 0,
			is_stream INTEGER NOT NULL DEFAULT 0,
			created_at TEXT NOT NULL
		);`,
		`CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at DESC);`,
		`CREATE INDEX IF NOT EXISTS idx_usage_logs_client_id_created_at ON usage_logs(client_id, created_at DESC);`,
	}

	for _, stmt := range stmts {
		if _, err := db.ExecContext(ctx, stmt); err != nil {
			_ = db.Close()
			return nil, fmt.Errorf("exec schema: %w", err)
		}
	}

	if err := ensureColumn(ctx, db, "client_keys", "token", "TEXT NOT NULL DEFAULT ''"); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("migrate client_keys token: %w", err)
	}
	if err := ensureColumn(ctx, db, "backends", "proxy_id", "INTEGER NOT NULL DEFAULT 0"); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("migrate backends proxy_id: %w", err)
	}
	if err := ensureColumn(ctx, db, "backends", "protocol", "TEXT NOT NULL DEFAULT 'openai'"); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("migrate backends protocol: %w", err)
	}
	if err := ensureColumn(ctx, db, "backends", "model_mapping", "TEXT NOT NULL DEFAULT '{}'"); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("migrate backends model_mapping: %w", err)
	}
	if err := ensureColumn(ctx, db, "audit_events", "category", "TEXT NOT NULL DEFAULT ''"); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("migrate audit_events category: %w", err)
	}
	if err := ensureColumn(ctx, db, "audit_events", "severity", "TEXT NOT NULL DEFAULT ''"); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("migrate audit_events severity: %w", err)
	}
	if err := ensureColumn(ctx, db, "audit_events", "actor", "TEXT NOT NULL DEFAULT ''"); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("migrate audit_events actor: %w", err)
	}
	if err := ensureColumn(ctx, db, "audit_events", "resource_type", "TEXT NOT NULL DEFAULT ''"); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("migrate audit_events resource_type: %w", err)
	}
	if err := ensureColumn(ctx, db, "audit_events", "resource_id", "INTEGER NOT NULL DEFAULT 0"); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("migrate audit_events resource_id: %w", err)
	}
	for _, column := range []struct {
		name       string
		definition string
	}{
		{name: "policy_id", definition: "INTEGER NOT NULL DEFAULT 0"},
		{name: "policy_name", definition: "TEXT NOT NULL DEFAULT ''"},
		{name: "proxy_id", definition: "INTEGER NOT NULL DEFAULT 0"},
		{name: "proxy_name", definition: "TEXT NOT NULL DEFAULT ''"},
		{name: "status_family", definition: "TEXT NOT NULL DEFAULT ''"},
		{name: "trace_id", definition: "TEXT NOT NULL DEFAULT ''"},
		{name: "request_bytes", definition: "INTEGER NOT NULL DEFAULT 0"},
		{name: "response_bytes", definition: "INTEGER NOT NULL DEFAULT 0"},
		{name: "request_headers_json", definition: "TEXT NOT NULL DEFAULT '{}'"},
		{name: "request_body_preview", definition: "TEXT NOT NULL DEFAULT ''"},
		{name: "response_headers_json", definition: "TEXT NOT NULL DEFAULT '{}'"},
		{name: "response_body_preview", definition: "TEXT NOT NULL DEFAULT ''"},
		{name: "preview_truncated", definition: "INTEGER NOT NULL DEFAULT 0"},
		{name: "is_stream", definition: "INTEGER NOT NULL DEFAULT 0"},
	} {
		if err := ensureColumn(ctx, db, "usage_logs", column.name, column.definition); err != nil {
			_ = db.Close()
			return nil, fmt.Errorf("migrate usage_logs %s: %w", column.name, err)
		}
	}

	return &Store{db: db}, nil
}

func (s *Store) Close() error {
	return s.db.Close()
}

func ensureColumn(ctx context.Context, db *sql.DB, table, column, definition string) error {
	rows, err := db.QueryContext(ctx, fmt.Sprintf("PRAGMA table_info(%s)", table))
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var (
			cid          int
			name         string
			columnType   string
			notNull      int
			defaultValue sql.NullString
			primaryKey   int
		)
		if err := rows.Scan(&cid, &name, &columnType, &notNull, &defaultValue, &primaryKey); err != nil {
			return err
		}
		if name == column {
			return nil
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}

	_, err = db.ExecContext(ctx, fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s %s", table, column, definition))
	return err
}

func HashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func (s *Store) FindClientKeyByToken(ctx context.Context, token string) (*domain.ClientKey, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT id, name, token_hash, token, token_prefix, enabled, route_mode_override, route_group, created_at, updated_at
		FROM client_keys
		WHERE token_hash = ? AND enabled = 1
	`, HashToken(strings.TrimSpace(token)))

	client, err := scanClientKey(row)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &client, nil
}

func (s *Store) ListClientKeys(ctx context.Context) ([]domain.ClientKey, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, name, token_hash, token, token_prefix, enabled, route_mode_override, route_group, created_at, updated_at
		FROM client_keys
		ORDER BY id DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var clients []domain.ClientKey
	for rows.Next() {
		client, err := scanClientKey(rows)
		if err != nil {
			return nil, err
		}
		clients = append(clients, client)
	}
	return clients, rows.Err()
}

func (s *Store) CountClientKeys(ctx context.Context) (int, error) {
	return countRows(ctx, s.db, "client_keys")
}

func (s *Store) ListClientKeysPage(ctx context.Context, limit, offset int) ([]domain.ClientKey, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, name, token_hash, token, token_prefix, enabled, route_mode_override, route_group, created_at, updated_at
		FROM client_keys
		ORDER BY id DESC
		LIMIT ? OFFSET ?
	`, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var clients []domain.ClientKey
	for rows.Next() {
		client, err := scanClientKey(rows)
		if err != nil {
			return nil, err
		}
		clients = append(clients, client)
	}
	return clients, rows.Err()
}

func (s *Store) CreateClientKey(ctx context.Context, client domain.ClientKey) (domain.ClientKey, error) {
	now := time.Now().UTC()
	client.CreatedAt = now
	client.UpdatedAt = now

	result, err := s.db.ExecContext(ctx, `
		INSERT INTO client_keys(name, token_hash, token, token_prefix, enabled, route_mode_override, route_group, created_at, updated_at)
		VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		strings.TrimSpace(client.Name),
		client.TokenHash,
		strings.TrimSpace(client.Token),
		client.TokenPrefix,
		boolToInt(client.Enabled),
		strings.TrimSpace(client.RouteModeOverride),
		strings.TrimSpace(client.RouteGroup),
		formatTime(now),
		formatTime(now),
	)
	if err != nil {
		return domain.ClientKey{}, err
	}

	client.ID, err = result.LastInsertId()
	return client, err
}

func (s *Store) UpdateClientKey(ctx context.Context, client domain.ClientKey) (domain.ClientKey, error) {
	now := time.Now().UTC()
	client.UpdatedAt = now

	_, err := s.db.ExecContext(ctx, `
		UPDATE client_keys
		SET name = ?, token_hash = ?, token = ?, token_prefix = ?, enabled = ?, route_mode_override = ?, route_group = ?, updated_at = ?
		WHERE id = ?
	`,
		strings.TrimSpace(client.Name),
		client.TokenHash,
		strings.TrimSpace(client.Token),
		client.TokenPrefix,
		boolToInt(client.Enabled),
		strings.TrimSpace(client.RouteModeOverride),
		strings.TrimSpace(client.RouteGroup),
		formatTime(now),
		client.ID,
	)
	if err != nil {
		return domain.ClientKey{}, err
	}
	return s.GetClientKey(ctx, client.ID)
}

func (s *Store) GetClientKey(ctx context.Context, id int64) (domain.ClientKey, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT id, name, token_hash, token, token_prefix, enabled, route_mode_override, route_group, created_at, updated_at
		FROM client_keys
		WHERE id = ?
	`, id)
	return scanClientKey(row)
}

func (s *Store) DeleteClientKey(ctx context.Context, id int64) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM client_keys WHERE id = ?`, id)
	return err
}

func (s *Store) ListSocksProxies(ctx context.Context) ([]domain.SocksProxy, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, name, address, username, password, enabled, created_at, updated_at
		FROM socks_proxies
		ORDER BY id DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var proxies []domain.SocksProxy
	for rows.Next() {
		proxy, err := scanSocksProxy(rows)
		if err != nil {
			return nil, err
		}
		proxies = append(proxies, proxy)
	}
	return proxies, rows.Err()
}

func (s *Store) CountSocksProxies(ctx context.Context) (int, error) {
	return countRows(ctx, s.db, "socks_proxies")
}

func (s *Store) ListSocksProxiesPage(ctx context.Context, limit, offset int) ([]domain.SocksProxy, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, name, address, username, password, enabled, created_at, updated_at
		FROM socks_proxies
		ORDER BY id DESC
		LIMIT ? OFFSET ?
	`, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var proxies []domain.SocksProxy
	for rows.Next() {
		proxy, err := scanSocksProxy(rows)
		if err != nil {
			return nil, err
		}
		proxies = append(proxies, proxy)
	}
	return proxies, rows.Err()
}

func (s *Store) CreateSocksProxy(ctx context.Context, proxy domain.SocksProxy) (domain.SocksProxy, error) {
	now := time.Now().UTC()
	proxy.CreatedAt = now
	proxy.UpdatedAt = now

	result, err := s.db.ExecContext(ctx, `
		INSERT INTO socks_proxies(name, address, username, password, enabled, created_at, updated_at)
		VALUES(?, ?, ?, ?, ?, ?, ?)
	`,
		strings.TrimSpace(proxy.Name),
		strings.TrimSpace(proxy.Address),
		strings.TrimSpace(proxy.Username),
		strings.TrimSpace(proxy.Password),
		boolToInt(proxy.Enabled),
		formatTime(now),
		formatTime(now),
	)
	if err != nil {
		return domain.SocksProxy{}, err
	}

	proxy.ID, err = result.LastInsertId()
	return proxy, err
}

func (s *Store) UpdateSocksProxy(ctx context.Context, proxy domain.SocksProxy) (domain.SocksProxy, error) {
	now := time.Now().UTC()
	proxy.UpdatedAt = now

	_, err := s.db.ExecContext(ctx, `
		UPDATE socks_proxies
		SET name = ?, address = ?, username = ?, password = ?, enabled = ?, updated_at = ?
		WHERE id = ?
	`,
		strings.TrimSpace(proxy.Name),
		strings.TrimSpace(proxy.Address),
		strings.TrimSpace(proxy.Username),
		strings.TrimSpace(proxy.Password),
		boolToInt(proxy.Enabled),
		formatTime(now),
		proxy.ID,
	)
	if err != nil {
		return domain.SocksProxy{}, err
	}
	return s.GetSocksProxy(ctx, proxy.ID)
}

func (s *Store) GetSocksProxy(ctx context.Context, id int64) (domain.SocksProxy, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT id, name, address, username, password, enabled, created_at, updated_at
		FROM socks_proxies
		WHERE id = ?
	`, id)
	return scanSocksProxy(row)
}

func (s *Store) DeleteSocksProxy(ctx context.Context, id int64) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, `UPDATE backends SET proxy_id = 0 WHERE proxy_id = ?`, id); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM socks_proxies WHERE id = ?`, id); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Store) ListBackends(ctx context.Context) ([]domain.Backend, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT
			b.id, b.name, b.pool, b.protocol, b.base_url, b.api_key, b.proxy_id, b.enabled, b.weight, b.model_list, b.model_mapping, b.endpoint_list, b.created_at, b.updated_at,
			p.id, p.name, p.address, p.username, p.password, p.enabled, p.created_at, p.updated_at
		FROM backends b
		LEFT JOIN socks_proxies p ON p.id = b.proxy_id
		ORDER BY b.id DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var backends []domain.Backend
	for rows.Next() {
		backend, err := scanBackendWithProxy(rows)
		if err != nil {
			return nil, err
		}
		backends = append(backends, backend)
	}
	return backends, rows.Err()
}

func (s *Store) CountBackends(ctx context.Context) (int, error) {
	return countRows(ctx, s.db, "backends")
}

func (s *Store) DashboardSummary(ctx context.Context, now time.Time) (DashboardSummaryData, error) {
	backendsCount, err := s.CountBackends(ctx)
	if err != nil {
		return DashboardSummaryData{}, err
	}
	clientCount, err := s.CountClientKeys(ctx)
	if err != nil {
		return DashboardSummaryData{}, err
	}
	policyCount, err := s.CountModelPolicies(ctx)
	if err != nil {
		return DashboardSummaryData{}, err
	}
	proxyCount, err := s.CountSocksProxies(ctx)
	if err != nil {
		return DashboardSummaryData{}, err
	}
	backends, err := s.ListBackends(ctx)
	if err != nil {
		return DashboardSummaryData{}, err
	}

	now = now.UTC()
	currentStart := startOfUTCDay(now).AddDate(0, 0, -6)
	previousStart := currentStart.AddDate(0, 0, -7)
	recentErrorSince := now.Add(-24 * time.Hour)

	logs, err := s.listUsageLogsSince(ctx, previousStart)
	if err != nil {
		return DashboardSummaryData{}, err
	}
	_, usageSeries, err := s.DashboardUsageSeries(ctx, now, "7d")
	if err != nil {
		return DashboardSummaryData{}, err
	}

	var (
		healthyBackends  int
		recentErrors     int
		currentRequests  int
		previousRequests int
		currentErrors    int
		previousErrors   int
	)
	activeClients := make(map[string]struct{})

	for _, backend := range backends {
		if backend.Enabled {
			healthyBackends++
		}
	}

	for _, log := range logs {
		if !log.CreatedAt.Before(recentErrorSince) && domain.IsBackendFailureStatus(log.StatusCode) {
			recentErrors++
		}
		if !log.CreatedAt.Before(currentStart) {
			currentRequests++
			if domain.IsBackendFailureStatus(log.StatusCode) {
				currentErrors++
			}
			if key := activityClientKey(log); key != "" {
				activeClients[key] = struct{}{}
			}
			continue
		}
		if !log.CreatedAt.Before(previousStart) {
			previousRequests++
			if domain.IsBackendFailureStatus(log.StatusCode) {
				previousErrors++
			}
		}
	}

	sparkline := make([]DashboardSparkPoint, 0, len(usageSeries))
	for _, point := range usageSeries {
		sparkline = append(sparkline, DashboardSparkPoint{
			Label:    point.Label,
			Requests: point.Requests,
		})
	}

	return DashboardSummaryData{
		Backends:        backendsCount,
		ClientKeys:      clientCount,
		ModelPolicies:   policyCount,
		SocksProxies:    proxyCount,
		HealthyBackends: healthyBackends,
		RecentErrors:    recentErrors,
		ActiveClients:   len(activeClients),
		RequestGrowth:   growthPercent(previousRequests, currentRequests),
		ErrorGrowth:     growthPercent(previousErrors, currentErrors),
		Sparkline:       sparkline,
	}, nil
}

func (s *Store) DashboardUsageSeries(ctx context.Context, now time.Time, rangeKey string) (string, []DashboardUsageSeriesPoint, error) {
	now = now.UTC()
	rangeKey = normalizeDashboardRange(rangeKey)

	if rangeKey == "24h" {
		start := now.Truncate(time.Hour).Add(-23 * time.Hour)
		logs, err := s.listUsageLogsSince(ctx, start)
		if err != nil {
			return rangeKey, nil, err
		}

		series := make([]DashboardUsageSeriesPoint, 24)
		failures := make([]int, 24)
		for i := 0; i < 24; i++ {
			bucketStart := start.Add(time.Duration(i) * time.Hour)
			series[i] = DashboardUsageSeriesPoint{
				Label: bucketStart.Format("15:04"),
			}
		}
		for _, log := range logs {
			index := int(log.CreatedAt.Sub(start) / time.Hour)
			if index < 0 || index >= len(series) {
				continue
			}
			series[index].Requests++
			if domain.IsBackendFailureStatus(log.StatusCode) {
				failures[index]++
			}
		}
		for i := range series {
			if series[i].Requests > 0 {
				series[i].ErrorRate = float64(failures[i]) / float64(series[i].Requests) * 100
			}
		}
		return rangeKey, series, nil
	}

	days := 7
	if rangeKey == "30d" {
		days = 30
	}
	start := startOfUTCDay(now).AddDate(0, 0, -(days - 1))
	logs, err := s.listUsageLogsSince(ctx, start)
	if err != nil {
		return rangeKey, nil, err
	}

	series := make([]DashboardUsageSeriesPoint, days)
	failures := make([]int, days)
	for i := 0; i < days; i++ {
		bucketStart := start.AddDate(0, 0, i)
		series[i] = DashboardUsageSeriesPoint{
			Label: bucketStart.Format("Jan 2"),
		}
	}
	for _, log := range logs {
		index := int(startOfUTCDay(log.CreatedAt).Sub(start) / (24 * time.Hour))
		if index < 0 || index >= len(series) {
			continue
		}
		series[index].Requests++
		if domain.IsBackendFailureStatus(log.StatusCode) {
			failures[index]++
		}
	}
	for i := range series {
		if series[i].Requests > 0 {
			series[i].ErrorRate = float64(failures[i]) / float64(series[i].Requests) * 100
		}
	}
	return rangeKey, series, nil
}

func (s *Store) DashboardRecentActivity(ctx context.Context, limit int) (DashboardActivityData, error) {
	limit = normalizeLimit(limit, 10, 50)
	events, err := s.ListAuditEvents(ctx, limit)
	if err != nil {
		return DashboardActivityData{}, err
	}
	usage, err := s.ListUsageLogsPage(ctx, limit, 0)
	if err != nil {
		return DashboardActivityData{}, err
	}

	errorCount := 0
	for _, entry := range usage {
		if domain.IsBackendFailureStatus(entry.StatusCode) {
			errorCount++
		}
	}

	summary := eventCategorySummary(events)
	if len(summary) == 0 {
		summary = []DashboardActivitySummary{
			{Category: "events", Count: len(events)},
			{Category: "requests", Count: len(usage)},
			{Category: "errors", Count: errorCount},
		}
	}

	return DashboardActivityData{
		Events:  ensureAuditEventSlice(events),
		Usage:   ensureUsageLogSlice(usage),
		Summary: summary,
	}, nil
}

func (s *Store) Search(ctx context.Context, query string, limit int) (SearchResults, error) {
	results := SearchResults{
		Backends:   []SearchResult{},
		ClientKeys: []SearchResult{},
		Policies:   []SearchResult{},
		Proxies:    []SearchResult{},
		UsageLogs:  []SearchResult{},
		Events:     []SearchResult{},
	}

	term := strings.ToLower(strings.TrimSpace(query))
	if term == "" {
		return results, nil
	}
	like := "%" + term + "%"
	prefix := term + "%"
	limit = normalizeLimit(limit, 5, 20)

	backendRows, err := s.db.QueryContext(ctx, `
		SELECT id, name, pool, base_url, enabled
		FROM backends
		WHERE lower(name) LIKE ? OR lower(pool) LIKE ? OR lower(base_url) LIKE ?
		ORDER BY
			CASE
				WHEN lower(name) = ? THEN 0
				WHEN lower(name) LIKE ? THEN 1
				WHEN lower(pool) = ? THEN 2
				WHEN lower(pool) LIKE ? THEN 3
				WHEN lower(base_url) = ? THEN 4
				WHEN lower(base_url) LIKE ? THEN 5
				ELSE 6
			END,
			id DESC
		LIMIT ?
	`, like, like, like, term, prefix, term, prefix, term, prefix, limit)
	if err != nil {
		return SearchResults{}, err
	}
	defer backendRows.Close()
	for backendRows.Next() {
		var (
			id      int64
			name    string
			pool    string
			baseURL string
			enabled int
		)
		if err := backendRows.Scan(&id, &name, &pool, &baseURL, &enabled); err != nil {
			return SearchResults{}, err
		}
		results.Backends = append(results.Backends, SearchResult{
			Kind:       "backend",
			ID:         id,
			Title:      name,
			Subtitle:   firstNonEmpty(pool, baseURL),
			Meta:       map[string]any{"pool": pool, "base_url": baseURL},
			Status:     enabledStatus(enabled == 1),
			TargetPage: "backends",
			TargetID:   id,
		})
	}
	if err := backendRows.Err(); err != nil {
		return SearchResults{}, err
	}

	clientRows, err := s.db.QueryContext(ctx, `
		SELECT id, name, token_prefix, enabled, route_group
		FROM client_keys
		WHERE lower(name) LIKE ? OR lower(token_prefix) LIKE ? OR lower(route_group) LIKE ?
		ORDER BY
			CASE
				WHEN lower(name) = ? THEN 0
				WHEN lower(name) LIKE ? THEN 1
				WHEN lower(token_prefix) = ? THEN 2
				WHEN lower(token_prefix) LIKE ? THEN 3
				WHEN lower(route_group) = ? THEN 4
				WHEN lower(route_group) LIKE ? THEN 5
				ELSE 6
			END,
			id DESC
		LIMIT ?
	`, like, like, like, term, prefix, term, prefix, term, prefix, limit)
	if err != nil {
		return SearchResults{}, err
	}
	defer clientRows.Close()
	for clientRows.Next() {
		var (
			id          int64
			name        string
			tokenPrefix string
			enabled     int
			routeGroup  string
		)
		if err := clientRows.Scan(&id, &name, &tokenPrefix, &enabled, &routeGroup); err != nil {
			return SearchResults{}, err
		}
		results.ClientKeys = append(results.ClientKeys, SearchResult{
			Kind:       "client_key",
			ID:         id,
			Title:      name,
			Subtitle:   tokenPrefix,
			Meta:       map[string]any{"route_group": routeGroup},
			Status:     enabledStatus(enabled == 1),
			TargetPage: "client-keys",
			TargetID:   id,
		})
	}
	if err := clientRows.Err(); err != nil {
		return SearchResults{}, err
	}

	policyRows, err := s.db.QueryContext(ctx, `
		SELECT id, pattern, endpoint, placement_policy, backend_pool
		FROM model_policies
		WHERE lower(pattern) LIKE ? OR lower(endpoint) LIKE ? OR lower(backend_pool) LIKE ?
		ORDER BY
			CASE
				WHEN lower(pattern) = ? THEN 0
				WHEN lower(pattern) LIKE ? THEN 1
				WHEN lower(endpoint) = ? THEN 2
				WHEN lower(endpoint) LIKE ? THEN 3
				WHEN lower(backend_pool) = ? THEN 4
				WHEN lower(backend_pool) LIKE ? THEN 5
				ELSE 6
			END,
			priority ASC,
			id DESC
		LIMIT ?
	`, like, like, like, term, prefix, term, prefix, term, prefix, limit)
	if err != nil {
		return SearchResults{}, err
	}
	defer policyRows.Close()
	for policyRows.Next() {
		var (
			id              int64
			pattern         string
			endpoint        string
			placementPolicy string
			backendPool     string
		)
		if err := policyRows.Scan(&id, &pattern, &endpoint, &placementPolicy, &backendPool); err != nil {
			return SearchResults{}, err
		}
		results.Policies = append(results.Policies, SearchResult{
			Kind:       "policy",
			ID:         id,
			Title:      pattern,
			Subtitle:   endpoint,
			Meta:       map[string]any{"placement_policy": placementPolicy, "backend_pool": backendPool},
			Status:     "configured",
			TargetPage: "model-policies",
			TargetID:   id,
		})
	}
	if err := policyRows.Err(); err != nil {
		return SearchResults{}, err
	}

	proxyRows, err := s.db.QueryContext(ctx, `
		SELECT id, name, address, username, enabled
		FROM socks_proxies
		WHERE lower(name) LIKE ? OR lower(address) LIKE ? OR lower(username) LIKE ?
		ORDER BY
			CASE
				WHEN lower(name) = ? THEN 0
				WHEN lower(name) LIKE ? THEN 1
				WHEN lower(address) = ? THEN 2
				WHEN lower(address) LIKE ? THEN 3
				WHEN lower(username) = ? THEN 4
				WHEN lower(username) LIKE ? THEN 5
				ELSE 6
			END,
			id DESC
		LIMIT ?
	`, like, like, like, term, prefix, term, prefix, term, prefix, limit)
	if err != nil {
		return SearchResults{}, err
	}
	defer proxyRows.Close()
	for proxyRows.Next() {
		var (
			id       int64
			name     string
			address  string
			username string
			enabled  int
		)
		if err := proxyRows.Scan(&id, &name, &address, &username, &enabled); err != nil {
			return SearchResults{}, err
		}
		results.Proxies = append(results.Proxies, SearchResult{
			Kind:       "socks_proxy",
			ID:         id,
			Title:      name,
			Subtitle:   address,
			Meta:       map[string]any{"username": username},
			Status:     enabledStatus(enabled == 1),
			TargetPage: "socks-proxies",
			TargetID:   id,
		})
	}
	if err := proxyRows.Err(); err != nil {
		return SearchResults{}, err
	}

	usageRows, err := s.db.QueryContext(ctx, `
		SELECT id, request_id, client_name, model, backend_name, status_code
		FROM usage_logs
		WHERE lower(request_id) LIKE ? OR lower(client_name) LIKE ? OR lower(model) LIKE ? OR lower(backend_name) LIKE ?
		ORDER BY
			CASE
				WHEN lower(request_id) = ? THEN 0
				WHEN lower(request_id) LIKE ? THEN 1
				WHEN lower(client_name) = ? THEN 2
				WHEN lower(client_name) LIKE ? THEN 3
				WHEN lower(model) = ? THEN 4
				WHEN lower(model) LIKE ? THEN 5
				WHEN lower(backend_name) = ? THEN 6
				WHEN lower(backend_name) LIKE ? THEN 7
				ELSE 8
			END,
			id DESC
		LIMIT ?
	`, like, like, like, like, term, prefix, term, prefix, term, prefix, term, prefix, limit)
	if err != nil {
		return SearchResults{}, err
	}
	defer usageRows.Close()
	for usageRows.Next() {
		var (
			id          int64
			requestID   string
			clientName  string
			model       string
			backendName string
			statusCode  int
		)
		if err := usageRows.Scan(&id, &requestID, &clientName, &model, &backendName, &statusCode); err != nil {
			return SearchResults{}, err
		}
		results.UsageLogs = append(results.UsageLogs, SearchResult{
			Kind:       "usage_log",
			ID:         id,
			Title:      requestID,
			Subtitle:   firstNonEmpty(model, clientName),
			Meta:       map[string]any{"client_name": clientName, "backend_name": backendName},
			Status:     strconv.Itoa(statusCode),
			TargetPage: "usage-logs",
			TargetID:   id,
		})
	}
	if err := usageRows.Err(); err != nil {
		return SearchResults{}, err
	}

	eventRows, err := s.db.QueryContext(ctx, `
		SELECT id, type, message, backend_name, model, level
		FROM audit_events
		WHERE lower(type) LIKE ? OR lower(message) LIKE ? OR lower(backend_name) LIKE ? OR lower(model) LIKE ?
		ORDER BY
			CASE
				WHEN lower(type) = ? THEN 0
				WHEN lower(type) LIKE ? THEN 1
				WHEN lower(message) = ? THEN 2
				WHEN lower(message) LIKE ? THEN 3
				WHEN lower(backend_name) = ? THEN 4
				WHEN lower(backend_name) LIKE ? THEN 5
				WHEN lower(model) = ? THEN 6
				WHEN lower(model) LIKE ? THEN 7
				ELSE 8
			END,
			id DESC
		LIMIT ?
	`, like, like, like, like, term, prefix, term, prefix, term, prefix, term, prefix, limit)
	if err != nil {
		return SearchResults{}, err
	}
	defer eventRows.Close()
	for eventRows.Next() {
		var (
			id          int64
			eventType   string
			message     string
			backendName string
			model       string
			level       string
		)
		if err := eventRows.Scan(&id, &eventType, &message, &backendName, &model, &level); err != nil {
			return SearchResults{}, err
		}
		results.Events = append(results.Events, SearchResult{
			Kind:       "event",
			ID:         id,
			Title:      eventType,
			Subtitle:   message,
			Meta:       map[string]any{"backend_name": backendName, "model": model},
			Status:     level,
			TargetPage: "events",
			TargetID:   id,
		})
	}
	if err := eventRows.Err(); err != nil {
		return SearchResults{}, err
	}

	return results, nil
}

func (s *Store) BackendDetail(ctx context.Context, id int64, limit int) (BackendDetailData, error) {
	backend, err := s.GetBackend(ctx, id)
	if err != nil {
		return BackendDetailData{}, err
	}
	usage, err := s.listUsageLogsByBackendID(ctx, id, limit)
	if err != nil {
		return BackendDetailData{}, err
	}
	events, err := s.listAuditEventsByBackendName(ctx, backend.Name, limit)
	if err != nil {
		return BackendDetailData{}, err
	}
	return BackendDetailData{
		Backend: backend,
		Usage:   ensureUsageLogSlice(usage),
		Events:  ensureAuditEventSlice(events),
	}, nil
}

func (s *Store) ClientKeyDetail(ctx context.Context, id int64, limit int) (ClientKeyDetailData, error) {
	client, err := s.GetClientKey(ctx, id)
	if err != nil {
		return ClientKeyDetailData{}, err
	}
	usage, err := s.listUsageLogsByClientID(ctx, id, limit)
	if err != nil {
		return ClientKeyDetailData{}, err
	}
	events, err := s.listAuditEventsByClientName(ctx, client.Name, limit)
	if err != nil {
		return ClientKeyDetailData{}, err
	}
	return ClientKeyDetailData{
		Client: client,
		Usage:  ensureUsageLogSlice(usage),
		Events: ensureAuditEventSlice(events),
	}, nil
}

func (s *Store) ModelPolicyDetail(ctx context.Context, id int64, limit int) (ModelPolicyDetailData, error) {
	policy, err := s.GetModelPolicy(ctx, id)
	if err != nil {
		return ModelPolicyDetailData{}, err
	}
	events, err := s.listAuditEventsByModel(ctx, policy.Pattern, limit)
	if err != nil {
		return ModelPolicyDetailData{}, err
	}
	return ModelPolicyDetailData{
		Policy: policy,
		Events: ensureAuditEventSlice(events),
	}, nil
}

func (s *Store) SocksProxyDetail(ctx context.Context, id int64) (SocksProxyDetailData, error) {
	proxy, err := s.GetSocksProxy(ctx, id)
	if err != nil {
		return SocksProxyDetailData{}, err
	}
	backends, err := s.listBackendsByProxyID(ctx, id)
	if err != nil {
		return SocksProxyDetailData{}, err
	}
	return SocksProxyDetailData{
		Proxy:    proxy,
		Backends: ensureBackendSlice(backends),
	}, nil
}

func (s *Store) BackendRequestStatsSince(ctx context.Context, since time.Time) (map[int64]BackendRequestStats, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT
			backend_id,
			SUM(CASE WHEN status_code >= 200 AND status_code < 400 THEN 1 ELSE 0 END) AS successes,
			SUM(CASE WHEN status_code >= 500 OR (status_code >= 400 AND status_code < 500 AND status_code != 400) THEN 1 ELSE 0 END) AS failures
		FROM usage_logs
		WHERE backend_id > 0 AND created_at >= ?
		GROUP BY backend_id
	`, formatTime(since.UTC()))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make(map[int64]BackendRequestStats)
	for rows.Next() {
		var (
			backendID int64
			stats     BackendRequestStats
		)
		if err := rows.Scan(&backendID, &stats.Successes, &stats.Failures); err != nil {
			return nil, err
		}
		out[backendID] = stats
	}
	return out, rows.Err()
}

func (s *Store) ClientKeyUsageSummaryByIDs(ctx context.Context, ids []int64) (map[int64]ClientKeyUsageSummary, error) {
	if len(ids) == 0 {
		return map[int64]ClientKeyUsageSummary{}, nil
	}

	placeholders := strings.TrimSuffix(strings.Repeat("?,", len(ids)), ",")
	args := make([]any, 0, len(ids))
	for _, id := range ids {
		args = append(args, id)
	}

	rows, err := s.db.QueryContext(ctx, `
		SELECT client_id, COUNT(*), MAX(created_at)
		FROM usage_logs
		WHERE client_id IN (`+placeholders+`)
		GROUP BY client_id
	`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make(map[int64]ClientKeyUsageSummary, len(ids))
	for rows.Next() {
		var (
			clientID int64
			count    int
			lastUsed string
			summary  ClientKeyUsageSummary
		)
		if err := rows.Scan(&clientID, &count, &lastUsed); err != nil {
			return nil, err
		}
		summary.UsageCount = count
		summary.LastUsedAt = parseTime(lastUsed)
		out[clientID] = summary
	}
	return out, rows.Err()
}

func (s *Store) ProxyUsageSummaryByIDs(ctx context.Context, ids []int64) (map[int64]ProxyUsageSummary, error) {
	if len(ids) == 0 {
		return map[int64]ProxyUsageSummary{}, nil
	}

	placeholders := strings.TrimSuffix(strings.Repeat("?,", len(ids)), ",")
	args := make([]any, 0, len(ids))
	for _, id := range ids {
		args = append(args, id)
	}

	rows, err := s.db.QueryContext(ctx, `
		SELECT proxy_id, COUNT(*), SUM(request_bytes + response_bytes), AVG(duration_ms), MAX(created_at)
		FROM usage_logs
		WHERE proxy_id IN (`+placeholders+`)
		GROUP BY proxy_id
	`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make(map[int64]ProxyUsageSummary, len(ids))
	for rows.Next() {
		var (
			proxyID    int64
			requests   int
			traffic    int64
			avgLatency float64
			lastUsed   string
		)
		if err := rows.Scan(&proxyID, &requests, &traffic, &avgLatency, &lastUsed); err != nil {
			return nil, err
		}
		out[proxyID] = ProxyUsageSummary{
			RequestCount: requests,
			TrafficBytes: traffic,
			AvgLatencyMS: avgLatency,
			LastUsedAt:   parseTime(lastUsed),
		}
	}
	return out, rows.Err()
}

func (s *Store) BackendUsageSummaryByIDs(ctx context.Context, ids []int64) (map[int64]BackendUsageSummary, error) {
	if len(ids) == 0 {
		return map[int64]BackendUsageSummary{}, nil
	}

	placeholders := strings.TrimSuffix(strings.Repeat("?,", len(ids)), ",")
	args := make([]any, 0, len(ids))
	for _, id := range ids {
		args = append(args, id)
	}

	rows, err := s.db.QueryContext(ctx, `
		SELECT backend_id, COUNT(*), AVG(duration_ms), MAX(created_at)
		FROM usage_logs
		WHERE backend_id IN (`+placeholders+`)
		GROUP BY backend_id
	`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make(map[int64]BackendUsageSummary, len(ids))
	for rows.Next() {
		var (
			backendID  int64
			requests   int
			avgLatency float64
			lastUsed   string
		)
		if err := rows.Scan(&backendID, &requests, &avgLatency, &lastUsed); err != nil {
			return nil, err
		}
		out[backendID] = BackendUsageSummary{
			RequestCount: requests,
			AvgLatencyMS: avgLatency,
			LastUsedAt:   parseTime(lastUsed),
		}
	}
	return out, rows.Err()
}

func (s *Store) BackendBindingCountByProxyIDs(ctx context.Context, ids []int64) (map[int64]int, error) {
	if len(ids) == 0 {
		return map[int64]int{}, nil
	}

	placeholders := strings.TrimSuffix(strings.Repeat("?,", len(ids)), ",")
	args := make([]any, 0, len(ids))
	for _, id := range ids {
		args = append(args, id)
	}

	rows, err := s.db.QueryContext(ctx, `
		SELECT proxy_id, COUNT(*)
		FROM backends
		WHERE proxy_id IN (`+placeholders+`)
		GROUP BY proxy_id
	`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make(map[int64]int, len(ids))
	for rows.Next() {
		var (
			proxyID int64
			count   int
		)
		if err := rows.Scan(&proxyID, &count); err != nil {
			return nil, err
		}
		out[proxyID] = count
	}
	return out, rows.Err()
}

func (s *Store) ListBackendsPage(ctx context.Context, limit, offset int) ([]domain.Backend, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT
			b.id, b.name, b.pool, b.protocol, b.base_url, b.api_key, b.proxy_id, b.enabled, b.weight, b.model_list, b.model_mapping, b.endpoint_list, b.created_at, b.updated_at,
			p.id, p.name, p.address, p.username, p.password, p.enabled, p.created_at, p.updated_at
		FROM backends b
		LEFT JOIN socks_proxies p ON p.id = b.proxy_id
		ORDER BY b.id DESC
		LIMIT ? OFFSET ?
	`, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var backends []domain.Backend
	for rows.Next() {
		backend, err := scanBackendWithProxy(rows)
		if err != nil {
			return nil, err
		}
		backends = append(backends, backend)
	}
	return backends, rows.Err()
}

func (s *Store) CreateBackend(ctx context.Context, backend domain.Backend) (domain.Backend, error) {
	now := time.Now().UTC()
	backend.CreatedAt = now
	backend.UpdatedAt = now

	result, err := s.db.ExecContext(ctx, `
		INSERT INTO backends(name, pool, protocol, base_url, api_key, proxy_id, enabled, weight, model_list, model_mapping, endpoint_list, created_at, updated_at)
		VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		strings.TrimSpace(backend.Name),
		strings.TrimSpace(backend.Pool),
		domain.NormalizeBackendProtocol(backend.Protocol),
		strings.TrimSpace(backend.BaseURL),
		strings.TrimSpace(backend.APIKey),
		backend.ProxyID,
		boolToInt(backend.Enabled),
		normalizeWeight(backend.Weight),
		mustEncodeList(backend.Models),
		mustEncodeMap(backend.ModelMapping),
		mustEncodeList(backend.Endpoints),
		formatTime(now),
		formatTime(now),
	)
	if err != nil {
		return domain.Backend{}, err
	}

	backend.ID, err = result.LastInsertId()
	if err != nil {
		return domain.Backend{}, err
	}
	return s.GetBackend(ctx, backend.ID)
}

func (s *Store) UpdateBackend(ctx context.Context, backend domain.Backend) (domain.Backend, error) {
	now := time.Now().UTC()
	backend.UpdatedAt = now

	_, err := s.db.ExecContext(ctx, `
		UPDATE backends
		SET name = ?, pool = ?, protocol = ?, base_url = ?, api_key = ?, proxy_id = ?, enabled = ?, weight = ?, model_list = ?, model_mapping = ?, endpoint_list = ?, updated_at = ?
		WHERE id = ?
	`,
		strings.TrimSpace(backend.Name),
		strings.TrimSpace(backend.Pool),
		domain.NormalizeBackendProtocol(backend.Protocol),
		strings.TrimSpace(backend.BaseURL),
		strings.TrimSpace(backend.APIKey),
		backend.ProxyID,
		boolToInt(backend.Enabled),
		normalizeWeight(backend.Weight),
		mustEncodeList(backend.Models),
		mustEncodeMap(backend.ModelMapping),
		mustEncodeList(backend.Endpoints),
		formatTime(now),
		backend.ID,
	)
	if err != nil {
		return domain.Backend{}, err
	}
	return s.GetBackend(ctx, backend.ID)
}

func (s *Store) GetBackend(ctx context.Context, id int64) (domain.Backend, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT
			b.id, b.name, b.pool, b.protocol, b.base_url, b.api_key, b.proxy_id, b.enabled, b.weight, b.model_list, b.model_mapping, b.endpoint_list, b.created_at, b.updated_at,
			p.id, p.name, p.address, p.username, p.password, p.enabled, p.created_at, p.updated_at
		FROM backends b
		LEFT JOIN socks_proxies p ON p.id = b.proxy_id
		WHERE b.id = ?
	`, id)
	return scanBackendWithProxy(row)
}

func (s *Store) DeleteBackend(ctx context.Context, id int64) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM backends WHERE id = ?`, id)
	return err
}

func (s *Store) ListModelPolicies(ctx context.Context) ([]domain.ModelPolicy, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, pattern, endpoint, placement_policy, backend_pool, failover_enabled, priority, created_at, updated_at
		FROM model_policies
		ORDER BY priority ASC, id DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var policies []domain.ModelPolicy
	for rows.Next() {
		policy, err := scanModelPolicy(rows)
		if err != nil {
			return nil, err
		}
		policies = append(policies, policy)
	}
	return policies, rows.Err()
}

func (s *Store) CountModelPolicies(ctx context.Context) (int, error) {
	return countRows(ctx, s.db, "model_policies")
}

func (s *Store) ListModelPoliciesPage(ctx context.Context, limit, offset int) ([]domain.ModelPolicy, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, pattern, endpoint, placement_policy, backend_pool, failover_enabled, priority, created_at, updated_at
		FROM model_policies
		ORDER BY priority ASC, id DESC
		LIMIT ? OFFSET ?
	`, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var policies []domain.ModelPolicy
	for rows.Next() {
		policy, err := scanModelPolicy(rows)
		if err != nil {
			return nil, err
		}
		policies = append(policies, policy)
	}
	return policies, rows.Err()
}

func (s *Store) CreateModelPolicy(ctx context.Context, policy domain.ModelPolicy) (domain.ModelPolicy, error) {
	now := time.Now().UTC()
	policy.CreatedAt = now
	policy.UpdatedAt = now

	result, err := s.db.ExecContext(ctx, `
		INSERT INTO model_policies(pattern, endpoint, placement_policy, backend_pool, failover_enabled, priority, created_at, updated_at)
		VALUES(?, ?, ?, ?, ?, ?, ?, ?)
	`,
		strings.TrimSpace(policy.Pattern),
		strings.TrimSpace(policy.Endpoint),
		strings.TrimSpace(policy.PlacementPolicy),
		strings.TrimSpace(policy.BackendPool),
		boolToInt(policy.FailoverEnabled),
		normalizePriority(policy.Priority),
		formatTime(now),
		formatTime(now),
	)
	if err != nil {
		return domain.ModelPolicy{}, err
	}

	policy.ID, err = result.LastInsertId()
	return policy, err
}

func (s *Store) UpdateModelPolicy(ctx context.Context, policy domain.ModelPolicy) (domain.ModelPolicy, error) {
	now := time.Now().UTC()
	policy.UpdatedAt = now

	_, err := s.db.ExecContext(ctx, `
		UPDATE model_policies
		SET pattern = ?, endpoint = ?, placement_policy = ?, backend_pool = ?, failover_enabled = ?, priority = ?, updated_at = ?
		WHERE id = ?
	`,
		strings.TrimSpace(policy.Pattern),
		strings.TrimSpace(policy.Endpoint),
		strings.TrimSpace(policy.PlacementPolicy),
		strings.TrimSpace(policy.BackendPool),
		boolToInt(policy.FailoverEnabled),
		normalizePriority(policy.Priority),
		formatTime(now),
		policy.ID,
	)
	if err != nil {
		return domain.ModelPolicy{}, err
	}
	return s.GetModelPolicy(ctx, policy.ID)
}

func (s *Store) GetModelPolicy(ctx context.Context, id int64) (domain.ModelPolicy, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT id, pattern, endpoint, placement_policy, backend_pool, failover_enabled, priority, created_at, updated_at
		FROM model_policies
		WHERE id = ?
	`, id)
	return scanModelPolicy(row)
}

func (s *Store) DeleteModelPolicy(ctx context.Context, id int64) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM model_policies WHERE id = ?`, id)
	return err
}

func (s *Store) AppendAuditEvent(ctx context.Context, event domain.AuditEvent) error {
	if strings.TrimSpace(event.Message) == "" {
		return nil
	}

	_, err := s.db.ExecContext(ctx, `
		INSERT INTO audit_events(level, type, category, severity, actor, resource_type, resource_id, message, client_name, model, endpoint, backend_name, created_at)
		VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		nonEmpty(event.Level, "info"),
		nonEmpty(event.Type, "system"),
		nonEmpty(event.Category, event.Type),
		nonEmpty(event.Severity, nonEmpty(event.Level, "info")),
		event.Actor,
		event.ResourceType,
		event.ResourceID,
		event.Message,
		event.ClientName,
		event.Model,
		event.Endpoint,
		event.BackendName,
		formatTime(time.Now().UTC()),
	)
	return err
}

func (s *Store) ListAuditEvents(ctx context.Context, limit int) ([]domain.AuditEvent, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}

	rows, err := s.db.QueryContext(ctx, `
		SELECT id, level, type, category, severity, actor, resource_type, resource_id, message, client_name, model, endpoint, backend_name, created_at
		FROM audit_events
		ORDER BY id DESC
		LIMIT ?
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []domain.AuditEvent
	for rows.Next() {
		event, err := scanAuditEvent(rows)
		if err != nil {
			return nil, err
		}
		events = append(events, event)
	}
	return events, rows.Err()
}

func (s *Store) CountAuditEvents(ctx context.Context) (int, error) {
	return countRows(ctx, s.db, "audit_events")
}

func (s *Store) CountAuditEventsFiltered(ctx context.Context, filter EventFilter) (int, error) {
	where, args := eventFilterClause(filter)
	row := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM audit_events`+where, args...)
	var total int
	if err := row.Scan(&total); err != nil {
		return 0, err
	}
	return total, nil
}

func (s *Store) ListAuditEventsPage(ctx context.Context, limit, offset int) ([]domain.AuditEvent, error) {
	return s.ListAuditEventsPageFiltered(ctx, EventFilter{}, limit, offset)
}

func (s *Store) ListAuditEventsPageFiltered(ctx context.Context, filter EventFilter, limit, offset int) ([]domain.AuditEvent, error) {
	where, args := eventFilterClause(filter)
	args = append(args, limit, offset)
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, level, type, category, severity, actor, resource_type, resource_id, message, client_name, model, endpoint, backend_name, created_at
		FROM audit_events
	`+where+`
		ORDER BY id DESC
		LIMIT ? OFFSET ?
	`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []domain.AuditEvent
	for rows.Next() {
		event, err := scanAuditEvent(rows)
		if err != nil {
			return nil, err
		}
		events = append(events, event)
	}
	return events, rows.Err()
}

func (s *Store) GetAuditEvent(ctx context.Context, id int64) (domain.AuditEvent, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT id, level, type, category, severity, actor, resource_type, resource_id, message, client_name, model, endpoint, backend_name, created_at
		FROM audit_events
		WHERE id = ?
	`, id)
	return scanAuditEvent(row)
}

func (s *Store) EventSummary(ctx context.Context, filter EventFilter) (EventSummary, error) {
	where, args := eventFilterClause(filter)
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, level, type, category, severity, actor, resource_type, resource_id, message, client_name, model, endpoint, backend_name, created_at
		FROM audit_events
	`+where+`
		ORDER BY id DESC
	`, args...)
	if err != nil {
		return EventSummary{}, err
	}
	defer rows.Close()

	var (
		total          int
		categoryOrder  []string
		severityOrder  []string
		actorOrder     []string
		categoryCounts = make(map[string]int)
		severityCounts = make(map[string]int)
		actorCounts    = make(map[string]int)
	)

	for rows.Next() {
		event, err := scanAuditEvent(rows)
		if err != nil {
			return EventSummary{}, err
		}
		total++
		category := nonEmpty(strings.TrimSpace(event.Category), nonEmpty(strings.TrimSpace(event.Type), "system"))
		severity := normalizeEventSeverity(nonEmpty(strings.TrimSpace(event.Severity), nonEmpty(strings.TrimSpace(event.Level), "info")))
		actor := nonEmpty(strings.TrimSpace(event.Actor), nonEmpty(strings.TrimSpace(event.ClientName), "system"))
		if _, ok := categoryCounts[category]; !ok {
			categoryOrder = append(categoryOrder, category)
		}
		if _, ok := severityCounts[severity]; !ok {
			severityOrder = append(severityOrder, severity)
		}
		if _, ok := actorCounts[actor]; !ok {
			actorOrder = append(actorOrder, actor)
		}
		categoryCounts[category]++
		severityCounts[severity]++
		actorCounts[actor]++
	}
	if err := rows.Err(); err != nil {
		return EventSummary{}, err
	}

	return EventSummary{
		Total:      total,
		Categories: orderedCategoryCounts(categoryOrder, categoryCounts),
		Severities: orderedCategoryCounts(severityOrder, severityCounts),
		Actors:     orderedCategoryCounts(actorOrder, actorCounts),
	}, nil
}

func (s *Store) AppendUsageLog(ctx context.Context, log domain.UsageLog) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO usage_logs(
			request_id, client_id, client_name, client_token_prefix, route_mode_override, route_group,
			method, path, query, endpoint, model, policy_id, policy_name, backend_id, backend_name, proxy_id, proxy_name,
			attempts, status_code, status_family, duration_ms, error_message, client_ip, user_agent, trace_id,
			request_bytes, response_bytes, request_headers_json, request_body_preview, response_headers_json, response_body_preview,
			preview_truncated, is_stream, created_at
		)
		VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		strings.TrimSpace(log.RequestID),
		log.ClientID,
		log.ClientName,
		log.ClientTokenPrefix,
		log.RouteModeOverride,
		log.RouteGroup,
		strings.TrimSpace(log.Method),
		strings.TrimSpace(log.Path),
		strings.TrimSpace(log.Query),
		strings.TrimSpace(log.Endpoint),
		strings.TrimSpace(log.Model),
		log.PolicyID,
		strings.TrimSpace(log.PolicyName),
		log.BackendID,
		log.BackendName,
		log.ProxyID,
		strings.TrimSpace(log.ProxyName),
		log.Attempts,
		log.StatusCode,
		nonEmpty(log.StatusFamily, statusFamily(log.StatusCode)),
		log.DurationMS,
		strings.TrimSpace(log.ErrorMessage),
		strings.TrimSpace(log.ClientIP),
		strings.TrimSpace(log.UserAgent),
		strings.TrimSpace(log.TraceID),
		log.RequestBytes,
		log.ResponseBytes,
		nonEmpty(log.RequestHeadersJSON, "{}"),
		log.RequestBodyPreview,
		nonEmpty(log.ResponseHeadersJSON, "{}"),
		log.ResponseBodyPreview,
		boolToInt(log.PreviewTruncated),
		boolToInt(log.IsStream),
		formatTime(time.Now().UTC()),
	)
	return err
}

func (s *Store) CountUsageLogs(ctx context.Context) (int, error) {
	return s.CountUsageLogsFiltered(ctx, UsageLogFilter{})
}

func (s *Store) GetUsageLog(ctx context.Context, id int64) (domain.UsageLog, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT id, request_id, client_id, client_name, client_token_prefix, route_mode_override, route_group,
			method, path, query, endpoint, model, policy_id, policy_name, backend_id, backend_name, proxy_id, proxy_name,
			attempts, status_code, status_family, duration_ms, error_message, client_ip, user_agent, trace_id,
			request_bytes, response_bytes, request_headers_json, request_body_preview, response_headers_json, response_body_preview,
			preview_truncated, is_stream, created_at
		FROM usage_logs
		WHERE id = ?
	`, id)
	return scanUsageLog(row)
}

func (s *Store) UsageLogStats(ctx context.Context, filter UsageLogFilter) (UsageLogStats, error) {
	where, args := usageLogFilterClause(filter)
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, request_id, client_id, client_name, client_token_prefix, route_mode_override, route_group,
			method, path, query, endpoint, model, policy_id, policy_name, backend_id, backend_name, proxy_id, proxy_name,
			attempts, status_code, status_family, duration_ms, error_message, client_ip, user_agent, trace_id,
			request_bytes, response_bytes, request_headers_json, request_body_preview, response_headers_json, response_body_preview,
			preview_truncated, is_stream, created_at
		FROM usage_logs
	`+where+`
		ORDER BY id DESC
	`, args...)
	if err != nil {
		return UsageLogStats{}, err
	}
	defer rows.Close()

	var (
		logs         []domain.UsageLog
		totalLatency int64
	)
	statusCounts := make(map[string]int)

	for rows.Next() {
		entry, err := scanUsageLog(rows)
		if err != nil {
			return UsageLogStats{}, err
		}
		logs = append(logs, entry)
		totalLatency += entry.DurationMS
		statusCounts[nonEmpty(entry.StatusFamily, statusFamily(entry.StatusCode))]++
	}
	if err := rows.Err(); err != nil {
		return UsageLogStats{}, err
	}

	if len(logs) == 0 {
		return UsageLogStats{StatusFamilies: []StatusFamilyCount{}}, nil
	}

	stats := UsageLogStats{
		Requests:      len(logs),
		AvgDurationMS: float64(totalLatency) / float64(len(logs)),
	}
	durations := make([]int64, 0, len(logs))
	for _, entry := range logs {
		if entry.StatusCode >= 200 && entry.StatusCode < 400 {
			stats.Successes++
		}
		if domain.IsBackendFailureStatus(entry.StatusCode) {
			stats.Failures++
		}
		durations = append(durations, entry.DurationMS)
	}
	slices.Sort(durations)
	p95Index := int(float64(len(durations)-1) * 0.95)
	if p95Index < 0 {
		p95Index = 0
	}
	stats.P95DurationMS = durations[p95Index]
	for _, family := range []string{"2xx", "3xx", "4xx", "5xx", "other"} {
		if count := statusCounts[family]; count > 0 {
			stats.StatusFamilies = append(stats.StatusFamilies, StatusFamilyCount{Family: family, Count: count})
		}
	}
	if stats.StatusFamilies == nil {
		stats.StatusFamilies = []StatusFamilyCount{}
	}
	return stats, nil
}

func (s *Store) CountUsageLogsFiltered(ctx context.Context, filter UsageLogFilter) (int, error) {
	where, args := usageLogFilterClause(filter)
	row := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM usage_logs`+where, args...)
	var total int
	if err := row.Scan(&total); err != nil {
		return 0, err
	}
	return total, nil
}

func (s *Store) ListUsageLogsPage(ctx context.Context, limit, offset int) ([]domain.UsageLog, error) {
	return s.ListUsageLogsPageFiltered(ctx, UsageLogFilter{}, limit, offset)
}

func (s *Store) ListUsageLogsPageFiltered(ctx context.Context, filter UsageLogFilter, limit, offset int) ([]domain.UsageLog, error) {
	where, args := usageLogFilterClause(filter)
	args = append(args, limit, offset)
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, request_id, client_id, client_name, client_token_prefix, route_mode_override, route_group,
			method, path, query, endpoint, model, policy_id, policy_name, backend_id, backend_name, proxy_id, proxy_name,
			attempts, status_code, status_family, duration_ms, error_message, client_ip, user_agent, trace_id,
			request_bytes, response_bytes, request_headers_json, request_body_preview, response_headers_json, response_body_preview,
			preview_truncated, is_stream, created_at
		FROM usage_logs
	`+where+`
		ORDER BY id DESC
		LIMIT ? OFFSET ?
	`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []domain.UsageLog
	for rows.Next() {
		entry, err := scanUsageLog(rows)
		if err != nil {
			return nil, err
		}
		logs = append(logs, entry)
	}
	return logs, rows.Err()
}

func (s *Store) DeleteUsageLog(ctx context.Context, id int64) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM usage_logs WHERE id = ?`, id)
	return err
}

func (s *Store) ClearUsageLogs(ctx context.Context) (int64, error) {
	result, err := s.db.ExecContext(ctx, `DELETE FROM usage_logs`)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

func (s *Store) DeleteUsageLogsFiltered(ctx context.Context, filter UsageLogFilter) (int64, error) {
	where, args := usageLogFilterClause(filter)
	result, err := s.db.ExecContext(ctx, `DELETE FROM usage_logs`+where, args...)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

func (s *Store) UsageLogOptions(ctx context.Context) (UsageLogOptions, error) {
	backends, err := s.ListBackends(ctx)
	if err != nil {
		return UsageLogOptions{}, err
	}
	clients, err := s.ListClientKeys(ctx)
	if err != nil {
		return UsageLogOptions{}, err
	}
	policies, err := s.ListModelPolicies(ctx)
	if err != nil {
		return UsageLogOptions{}, err
	}
	proxies, err := s.ListSocksProxies(ctx)
	if err != nil {
		return UsageLogOptions{}, err
	}

	backendSet := make(map[string]struct{})
	modelSet := make(map[string]struct{})
	clientSet := make(map[string]struct{})
	policySet := make(map[string]struct{})
	proxySet := make(map[string]struct{})

	for _, backend := range backends {
		if name := strings.TrimSpace(backend.Name); name != "" {
			backendSet[name] = struct{}{}
		}
		for _, model := range backend.Models {
			model = strings.TrimSpace(model)
			if model != "" {
				modelSet[model] = struct{}{}
			}
		}
		for clientModel := range backend.ModelMapping {
			clientModel = strings.TrimSpace(clientModel)
			if clientModel != "" {
				modelSet[clientModel] = struct{}{}
			}
		}
	}

	for _, client := range clients {
		if name := strings.TrimSpace(client.Name); name != "" {
			clientSet[name] = struct{}{}
		}
	}
	for _, policy := range policies {
		if pattern := strings.TrimSpace(policy.Pattern); pattern != "" {
			policySet[pattern] = struct{}{}
		}
	}
	for _, proxy := range proxies {
		if name := strings.TrimSpace(proxy.Name); name != "" {
			proxySet[name] = struct{}{}
		}
	}

	return UsageLogOptions{
		Backends:   sortedKeys(backendSet),
		Models:     sortedKeys(modelSet),
		ClientKeys: sortedKeys(clientSet),
		Policies:   sortedKeys(policySet),
		Proxies:    sortedKeys(proxySet),
	}, nil
}

func usageLogFilterClause(filter UsageLogFilter) (string, []any) {
	var (
		clauses []string
		args    []any
	)
	if value := strings.TrimSpace(filter.BackendName); value != "" {
		clauses = append(clauses, `backend_name = ?`)
		args = append(args, value)
	}
	if value := strings.TrimSpace(filter.Model); value != "" {
		clauses = append(clauses, `model = ?`)
		args = append(args, value)
	}
	if value := strings.TrimSpace(filter.ClientName); value != "" {
		clauses = append(clauses, `client_name = ?`)
		args = append(args, value)
	}
	if value := strings.TrimSpace(filter.PolicyName); value != "" {
		clauses = append(clauses, `policy_name = ?`)
		args = append(args, value)
	}
	if value := strings.TrimSpace(filter.ProxyName); value != "" {
		clauses = append(clauses, `proxy_name = ?`)
		args = append(args, value)
	}
	if value := strings.TrimSpace(filter.Status); value != "" {
		switch strings.ToLower(value) {
		case "2xx", "3xx", "4xx", "5xx":
			clauses = append(clauses, `status_family = ?`)
			args = append(args, value)
		}
	}
	if value := strings.TrimSpace(filter.Query); value != "" {
		like := "%" + strings.ToLower(value) + "%"
		clauses = append(clauses, `(lower(request_id) LIKE ? OR lower(trace_id) LIKE ? OR lower(path) LIKE ? OR lower(client_name) LIKE ? OR lower(model) LIKE ? OR lower(backend_name) LIKE ? OR lower(error_message) LIKE ?)`)
		args = append(args, like, like, like, like, like, like, like)
	}
	if !filter.DateFrom.IsZero() {
		clauses = append(clauses, `created_at >= ?`)
		args = append(args, formatTime(filter.DateFrom.UTC()))
	}
	if !filter.DateTo.IsZero() {
		clauses = append(clauses, `created_at <= ?`)
		args = append(args, formatTime(filter.DateTo.UTC()))
	}
	if len(clauses) == 0 {
		return "", nil
	}
	return " WHERE " + strings.Join(clauses, " AND "), args
}

func eventFilterClause(filter EventFilter) (string, []any) {
	var (
		clauses []string
		args    []any
	)
	if value := strings.TrimSpace(filter.Category); value != "" {
		clauses = append(clauses, `(category = ? OR type = ?)`)
		args = append(args, value, value)
	}
	if value := strings.TrimSpace(filter.Severity); value != "" {
		normalized := normalizeEventSeverity(value)
		alternatives := []string{normalized}
		if normalized == "warning" {
			alternatives = append(alternatives, "warn")
		}
		if normalized == "warn" {
			alternatives = append(alternatives, "warning")
		}
		clauses = append(clauses, `(severity IN (`+strings.TrimSuffix(strings.Repeat("?,", len(alternatives)), ",")+`) OR level IN (`+strings.TrimSuffix(strings.Repeat("?,", len(alternatives)), ",")+`))`)
		for _, item := range alternatives {
			args = append(args, item)
		}
		for _, item := range alternatives {
			args = append(args, item)
		}
	}
	if value := strings.TrimSpace(filter.Actor); value != "" {
		clauses = append(clauses, `(actor = ? OR client_name = ?)`)
		args = append(args, value, value)
	}
	if value := strings.TrimSpace(filter.Backend); value != "" {
		clauses = append(clauses, `backend_name = ?`)
		args = append(args, value)
	}
	if value := strings.TrimSpace(filter.Query); value != "" {
		like := "%" + strings.ToLower(value) + "%"
		clauses = append(clauses, `(lower(type) LIKE ? OR lower(category) LIKE ? OR lower(message) LIKE ? OR lower(client_name) LIKE ? OR lower(model) LIKE ? OR lower(backend_name) LIKE ?)`)
		args = append(args, like, like, like, like, like, like)
	}
	if !filter.DateFrom.IsZero() {
		clauses = append(clauses, `created_at >= ?`)
		args = append(args, formatTime(filter.DateFrom.UTC()))
	}
	if !filter.DateTo.IsZero() {
		clauses = append(clauses, `created_at <= ?`)
		args = append(args, formatTime(filter.DateTo.UTC()))
	}
	if len(clauses) == 0 {
		return "", nil
	}
	return " WHERE " + strings.Join(clauses, " AND "), args
}

func normalizeEventSeverity(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "warn", "warning":
		return "warning"
	default:
		return strings.ToLower(strings.TrimSpace(value))
	}
}

func sortedKeys(set map[string]struct{}) []string {
	if len(set) == 0 {
		return []string{}
	}
	items := make([]string, 0, len(set))
	for item := range set {
		items = append(items, item)
	}
	slices.Sort(items)
	return items
}

type scanner interface {
	Scan(dest ...any) error
}

func scanClientKey(s scanner) (domain.ClientKey, error) {
	var (
		client               domain.ClientKey
		createdAt, updatedAt string
		enabled              int
	)
	err := s.Scan(
		&client.ID,
		&client.Name,
		&client.TokenHash,
		&client.Token,
		&client.TokenPrefix,
		&enabled,
		&client.RouteModeOverride,
		&client.RouteGroup,
		&createdAt,
		&updatedAt,
	)
	if err != nil {
		return domain.ClientKey{}, err
	}
	client.Enabled = enabled == 1
	client.CreatedAt = parseTime(createdAt)
	client.UpdatedAt = parseTime(updatedAt)
	return client, nil
}

func scanSocksProxy(s scanner) (domain.SocksProxy, error) {
	var (
		proxy                domain.SocksProxy
		createdAt, updatedAt string
		enabled              int
	)
	err := s.Scan(
		&proxy.ID,
		&proxy.Name,
		&proxy.Address,
		&proxy.Username,
		&proxy.Password,
		&enabled,
		&createdAt,
		&updatedAt,
	)
	if err != nil {
		return domain.SocksProxy{}, err
	}
	proxy.Enabled = enabled == 1
	proxy.CreatedAt = parseTime(createdAt)
	proxy.UpdatedAt = parseTime(updatedAt)
	return proxy, nil
}

func scanBackend(s scanner) (domain.Backend, error) {
	var (
		backend                    domain.Backend
		modelList, modelMappingRaw string
		endpointList               string
		createdAt, updatedAt       string
		enabled                    int
	)
	err := s.Scan(
		&backend.ID,
		&backend.Name,
		&backend.Pool,
		&backend.Protocol,
		&backend.BaseURL,
		&backend.APIKey,
		&backend.ProxyID,
		&enabled,
		&backend.Weight,
		&modelList,
		&modelMappingRaw,
		&endpointList,
		&createdAt,
		&updatedAt,
	)
	if err != nil {
		return domain.Backend{}, err
	}
	backend.Enabled = enabled == 1
	backend.Protocol = domain.NormalizeBackendProtocol(backend.Protocol)
	backend.Models = decodeList(modelList)
	backend.ModelMapping = decodeMap(modelMappingRaw)
	backend.Endpoints = decodeList(endpointList)
	backend.CreatedAt = parseTime(createdAt)
	backend.UpdatedAt = parseTime(updatedAt)
	return backend, nil
}

func scanBackendWithProxy(s scanner) (domain.Backend, error) {
	var (
		backend                    domain.Backend
		modelList, modelMappingRaw string
		endpointList               string
		createdAt, updatedAt       string
		enabled                    int
		proxyID                    sql.NullInt64
		proxyName                  sql.NullString
		proxyAddress               sql.NullString
		proxyUsername              sql.NullString
		proxyPassword              sql.NullString
		proxyEnabled               sql.NullInt64
		proxyCreatedAt             sql.NullString
		proxyUpdatedAt             sql.NullString
	)
	err := s.Scan(
		&backend.ID,
		&backend.Name,
		&backend.Pool,
		&backend.Protocol,
		&backend.BaseURL,
		&backend.APIKey,
		&backend.ProxyID,
		&enabled,
		&backend.Weight,
		&modelList,
		&modelMappingRaw,
		&endpointList,
		&createdAt,
		&updatedAt,
		&proxyID,
		&proxyName,
		&proxyAddress,
		&proxyUsername,
		&proxyPassword,
		&proxyEnabled,
		&proxyCreatedAt,
		&proxyUpdatedAt,
	)
	if err != nil {
		return domain.Backend{}, err
	}

	backend.Enabled = enabled == 1
	backend.Protocol = domain.NormalizeBackendProtocol(backend.Protocol)
	backend.Models = decodeList(modelList)
	backend.ModelMapping = decodeMap(modelMappingRaw)
	backend.Endpoints = decodeList(endpointList)
	backend.CreatedAt = parseTime(createdAt)
	backend.UpdatedAt = parseTime(updatedAt)
	if proxyID.Valid {
		backend.Proxy = &domain.SocksProxy{
			ID:        proxyID.Int64,
			Name:      proxyName.String,
			Address:   proxyAddress.String,
			Username:  proxyUsername.String,
			Password:  proxyPassword.String,
			Enabled:   proxyEnabled.Int64 == 1,
			CreatedAt: parseTime(proxyCreatedAt.String),
			UpdatedAt: parseTime(proxyUpdatedAt.String),
		}
	}
	return backend, nil
}

func scanModelPolicy(s scanner) (domain.ModelPolicy, error) {
	var (
		policy               domain.ModelPolicy
		createdAt, updatedAt string
		failover             int
	)
	err := s.Scan(
		&policy.ID,
		&policy.Pattern,
		&policy.Endpoint,
		&policy.PlacementPolicy,
		&policy.BackendPool,
		&failover,
		&policy.Priority,
		&createdAt,
		&updatedAt,
	)
	if err != nil {
		return domain.ModelPolicy{}, err
	}
	policy.FailoverEnabled = failover == 1
	policy.CreatedAt = parseTime(createdAt)
	policy.UpdatedAt = parseTime(updatedAt)
	return policy, nil
}

func scanAuditEvent(s scanner) (domain.AuditEvent, error) {
	var (
		event     domain.AuditEvent
		createdAt string
	)
	err := s.Scan(
		&event.ID,
		&event.Level,
		&event.Type,
		&event.Category,
		&event.Severity,
		&event.Actor,
		&event.ResourceType,
		&event.ResourceID,
		&event.Message,
		&event.ClientName,
		&event.Model,
		&event.Endpoint,
		&event.BackendName,
		&createdAt,
	)
	if err != nil {
		return domain.AuditEvent{}, err
	}
	event.CreatedAt = parseTime(createdAt)
	return event, nil
}

func scanUsageLog(s scanner) (domain.UsageLog, error) {
	var (
		entry            domain.UsageLog
		createdAt        string
		previewTruncated int
		isStream         int
	)
	err := s.Scan(
		&entry.ID,
		&entry.RequestID,
		&entry.ClientID,
		&entry.ClientName,
		&entry.ClientTokenPrefix,
		&entry.RouteModeOverride,
		&entry.RouteGroup,
		&entry.Method,
		&entry.Path,
		&entry.Query,
		&entry.Endpoint,
		&entry.Model,
		&entry.PolicyID,
		&entry.PolicyName,
		&entry.BackendID,
		&entry.BackendName,
		&entry.ProxyID,
		&entry.ProxyName,
		&entry.Attempts,
		&entry.StatusCode,
		&entry.StatusFamily,
		&entry.DurationMS,
		&entry.ErrorMessage,
		&entry.ClientIP,
		&entry.UserAgent,
		&entry.TraceID,
		&entry.RequestBytes,
		&entry.ResponseBytes,
		&entry.RequestHeadersJSON,
		&entry.RequestBodyPreview,
		&entry.ResponseHeadersJSON,
		&entry.ResponseBodyPreview,
		&previewTruncated,
		&isStream,
		&createdAt,
	)
	if err != nil {
		return domain.UsageLog{}, err
	}
	entry.PreviewTruncated = previewTruncated == 1
	entry.IsStream = isStream == 1
	entry.CreatedAt = parseTime(createdAt)
	return entry, nil
}

func parseTime(value string) time.Time {
	parsed, err := time.Parse(time.RFC3339Nano, value)
	if err != nil {
		return time.Time{}
	}
	return parsed
}

func countRows(ctx context.Context, db *sql.DB, table string) (int, error) {
	row := db.QueryRowContext(ctx, fmt.Sprintf("SELECT COUNT(*) FROM %s", table))
	var total int
	if err := row.Scan(&total); err != nil {
		return 0, err
	}
	return total, nil
}

func formatTime(value time.Time) string {
	return value.UTC().Format(time.RFC3339Nano)
}

func mustEncodeList(values []string) string {
	normalized := normalizeList(values)
	data, _ := json.Marshal(normalized)
	return string(data)
}

func mustEncodeMap(values map[string]string) string {
	normalized := normalizeMap(values)
	data, _ := json.Marshal(normalized)
	return string(data)
}

func decodeList(raw string) []string {
	var values []string
	if err := json.Unmarshal([]byte(raw), &values); err != nil {
		return nil
	}
	return normalizeList(values)
}

func decodeMap(raw string) map[string]string {
	var values map[string]string
	if err := json.Unmarshal([]byte(raw), &values); err != nil {
		return map[string]string{}
	}
	return normalizeMap(values)
}

func (s *Store) listUsageLogsSince(ctx context.Context, since time.Time) ([]domain.UsageLog, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, request_id, client_id, client_name, client_token_prefix, route_mode_override, route_group,
			method, path, query, endpoint, model, policy_id, policy_name, backend_id, backend_name, proxy_id, proxy_name,
			attempts, status_code, status_family, duration_ms, error_message, client_ip, user_agent, trace_id,
			request_bytes, response_bytes, request_headers_json, request_body_preview, response_headers_json, response_body_preview,
			preview_truncated, is_stream, created_at
		FROM usage_logs
		WHERE created_at >= ?
		ORDER BY created_at ASC, id ASC
	`, formatTime(since.UTC()))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []domain.UsageLog
	for rows.Next() {
		entry, err := scanUsageLog(rows)
		if err != nil {
			return nil, err
		}
		logs = append(logs, entry)
	}
	return logs, rows.Err()
}

func (s *Store) listUsageLogsByBackendID(ctx context.Context, id int64, limit int) ([]domain.UsageLog, error) {
	return s.listUsageLogsByColumn(ctx, "backend_id", id, limit)
}

func (s *Store) listUsageLogsByClientID(ctx context.Context, id int64, limit int) ([]domain.UsageLog, error) {
	return s.listUsageLogsByColumn(ctx, "client_id", id, limit)
}

func (s *Store) listUsageLogsByColumn(ctx context.Context, column string, id int64, limit int) ([]domain.UsageLog, error) {
	switch column {
	case "backend_id", "client_id":
	default:
		return nil, fmt.Errorf("unsupported usage log lookup column %q", column)
	}

	limit = normalizeLimit(limit, 10, 100)
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, request_id, client_id, client_name, client_token_prefix, route_mode_override, route_group,
			method, path, query, endpoint, model, policy_id, policy_name, backend_id, backend_name, proxy_id, proxy_name,
			attempts, status_code, status_family, duration_ms, error_message, client_ip, user_agent, trace_id,
			request_bytes, response_bytes, request_headers_json, request_body_preview, response_headers_json, response_body_preview,
			preview_truncated, is_stream, created_at
		FROM usage_logs
		WHERE `+column+` = ?
		ORDER BY id DESC
		LIMIT ?
	`, id, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []domain.UsageLog
	for rows.Next() {
		entry, err := scanUsageLog(rows)
		if err != nil {
			return nil, err
		}
		logs = append(logs, entry)
	}
	return logs, rows.Err()
}

func (s *Store) listAuditEventsByBackendName(ctx context.Context, backendName string, limit int) ([]domain.AuditEvent, error) {
	return s.listAuditEventsByColumn(ctx, "backend_name", backendName, limit)
}

func (s *Store) listAuditEventsByClientName(ctx context.Context, clientName string, limit int) ([]domain.AuditEvent, error) {
	return s.listAuditEventsByColumn(ctx, "client_name", clientName, limit)
}

func (s *Store) listAuditEventsByModel(ctx context.Context, model string, limit int) ([]domain.AuditEvent, error) {
	return s.listAuditEventsByColumn(ctx, "model", model, limit)
}

func (s *Store) listAuditEventsByColumn(ctx context.Context, column, value string, limit int) ([]domain.AuditEvent, error) {
	switch column {
	case "backend_name", "client_name", "model":
	default:
		return nil, fmt.Errorf("unsupported audit event lookup column %q", column)
	}

	value = strings.TrimSpace(value)
	if value == "" {
		return []domain.AuditEvent{}, nil
	}
	limit = normalizeLimit(limit, 10, 100)
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, level, type, category, severity, actor, resource_type, resource_id, message, client_name, model, endpoint, backend_name, created_at
		FROM audit_events
		WHERE `+column+` = ?
		ORDER BY id DESC
		LIMIT ?
	`, value, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []domain.AuditEvent
	for rows.Next() {
		event, err := scanAuditEvent(rows)
		if err != nil {
			return nil, err
		}
		events = append(events, event)
	}
	return events, rows.Err()
}

func (s *Store) listBackendsByProxyID(ctx context.Context, proxyID int64) ([]domain.Backend, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT
			b.id, b.name, b.pool, b.protocol, b.base_url, b.api_key, b.proxy_id, b.enabled, b.weight, b.model_list, b.model_mapping, b.endpoint_list, b.created_at, b.updated_at,
			p.id, p.name, p.address, p.username, p.password, p.enabled, p.created_at, p.updated_at
		FROM backends b
		LEFT JOIN socks_proxies p ON p.id = b.proxy_id
		WHERE b.proxy_id = ?
		ORDER BY b.id DESC
	`, proxyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var backends []domain.Backend
	for rows.Next() {
		backend, err := scanBackendWithProxy(rows)
		if err != nil {
			return nil, err
		}
		backends = append(backends, backend)
	}
	return backends, rows.Err()
}

func startOfUTCDay(value time.Time) time.Time {
	value = value.UTC()
	return time.Date(value.Year(), value.Month(), value.Day(), 0, 0, 0, 0, time.UTC)
}

func growthPercent(previous, current int) float64 {
	if previous <= 0 {
		if current <= 0 {
			return 0
		}
		return 100
	}
	return (float64(current-previous) / float64(previous)) * 100
}

func normalizeDashboardRange(value string) string {
	switch strings.TrimSpace(strings.ToLower(value)) {
	case "24h", "1d":
		return "24h"
	case "30d":
		return "30d"
	default:
		return "7d"
	}
}

func eventCategorySummary(events []domain.AuditEvent) []DashboardActivitySummary {
	if len(events) == 0 {
		return []DashboardActivitySummary{}
	}

	counts := make(map[string]int)
	order := make([]string, 0)
	for _, event := range events {
		category := strings.TrimSpace(event.Type)
		if category == "" {
			category = strings.TrimSpace(event.Level)
		}
		if category == "" {
			category = "system"
		}
		if _, ok := counts[category]; !ok {
			order = append(order, category)
		}
		counts[category]++
	}

	summary := make([]DashboardActivitySummary, 0, len(order))
	for _, category := range order {
		summary = append(summary, DashboardActivitySummary{
			Category: category,
			Count:    counts[category],
		})
	}
	return summary
}

func normalizeLimit(value, fallback, max int) int {
	if value <= 0 {
		return fallback
	}
	if max > 0 && value > max {
		return max
	}
	return value
}

func activityClientKey(log domain.UsageLog) string {
	if log.ClientID > 0 {
		return fmt.Sprintf("id:%d", log.ClientID)
	}
	if name := strings.TrimSpace(log.ClientName); name != "" {
		return "name:" + name
	}
	return ""
}

func enabledStatus(enabled bool) string {
	if enabled {
		return "enabled"
	}
	return "disabled"
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value != "" {
			return value
		}
	}
	return ""
}

func orderedCategoryCounts(order []string, counts map[string]int) []CategoryCount {
	if len(order) == 0 {
		return []CategoryCount{}
	}
	items := make([]CategoryCount, 0, len(order))
	for _, name := range order {
		items = append(items, CategoryCount{Name: name, Count: counts[name]})
	}
	return items
}

func statusFamily(statusCode int) string {
	switch {
	case statusCode >= 200 && statusCode < 300:
		return "2xx"
	case statusCode >= 300 && statusCode < 400:
		return "3xx"
	case statusCode >= 400 && statusCode < 500:
		return "4xx"
	case statusCode >= 500 && statusCode < 600:
		return "5xx"
	default:
		return "other"
	}
}

func ensureBackendSlice(values []domain.Backend) []domain.Backend {
	if values == nil {
		return []domain.Backend{}
	}
	return values
}

func ensureAuditEventSlice(values []domain.AuditEvent) []domain.AuditEvent {
	if values == nil {
		return []domain.AuditEvent{}
	}
	return values
}

func ensureUsageLogSlice(values []domain.UsageLog) []domain.UsageLog {
	if values == nil {
		return []domain.UsageLog{}
	}
	return values
}

func normalizeList(values []string) []string {
	if len(values) == 0 {
		return []string{}
	}

	seen := make(map[string]struct{}, len(values))
	var normalized []string
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		if _, ok := seen[trimmed]; ok {
			continue
		}
		seen[trimmed] = struct{}{}
		normalized = append(normalized, trimmed)
	}
	return normalized
}

func normalizeMap(values map[string]string) map[string]string {
	if len(values) == 0 {
		return map[string]string{}
	}
	normalized := make(map[string]string, len(values))
	for key, value := range values {
		key = strings.TrimSpace(key)
		value = strings.TrimSpace(value)
		if key == "" || value == "" {
			continue
		}
		normalized[key] = value
	}
	if len(normalized) == 0 {
		return map[string]string{}
	}
	return normalized
}

func boolToInt(value bool) int {
	if value {
		return 1
	}
	return 0
}

func normalizeWeight(value int) int {
	if value < 1 {
		return 1
	}
	return value
}

func normalizePriority(value int) int {
	if value == 0 {
		return 100
	}
	return value
}

func nonEmpty(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}
