package store

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	_ "github.com/mattn/go-sqlite3"

	"token-gate/internal/domain"
)

type Store struct {
	db *sql.DB
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
			backend_id INTEGER NOT NULL DEFAULT 0,
			backend_name TEXT NOT NULL DEFAULT '',
			attempts INTEGER NOT NULL DEFAULT 0,
			status_code INTEGER NOT NULL DEFAULT 0,
			duration_ms INTEGER NOT NULL DEFAULT 0,
			error_message TEXT NOT NULL DEFAULT '',
			client_ip TEXT NOT NULL DEFAULT '',
			user_agent TEXT NOT NULL DEFAULT '',
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
		INSERT INTO audit_events(level, type, message, client_name, model, endpoint, backend_name, created_at)
		VALUES(?, ?, ?, ?, ?, ?, ?, ?)
	`,
		nonEmpty(event.Level, "info"),
		nonEmpty(event.Type, "system"),
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
		SELECT id, level, type, message, client_name, model, endpoint, backend_name, created_at
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

func (s *Store) ListAuditEventsPage(ctx context.Context, limit, offset int) ([]domain.AuditEvent, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, level, type, message, client_name, model, endpoint, backend_name, created_at
		FROM audit_events
		ORDER BY id DESC
		LIMIT ? OFFSET ?
	`, limit, offset)
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

func (s *Store) AppendUsageLog(ctx context.Context, log domain.UsageLog) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO usage_logs(
			request_id, client_id, client_name, client_token_prefix, route_mode_override, route_group,
			method, path, query, endpoint, model, backend_id, backend_name, attempts, status_code,
			duration_ms, error_message, client_ip, user_agent, created_at
		)
		VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
		log.BackendID,
		log.BackendName,
		log.Attempts,
		log.StatusCode,
		log.DurationMS,
		strings.TrimSpace(log.ErrorMessage),
		strings.TrimSpace(log.ClientIP),
		strings.TrimSpace(log.UserAgent),
		formatTime(time.Now().UTC()),
	)
	return err
}

func (s *Store) CountUsageLogs(ctx context.Context) (int, error) {
	return countRows(ctx, s.db, "usage_logs")
}

func (s *Store) ListUsageLogsPage(ctx context.Context, limit, offset int) ([]domain.UsageLog, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, request_id, client_id, client_name, client_token_prefix, route_mode_override, route_group,
			method, path, query, endpoint, model, backend_id, backend_name, attempts, status_code,
			duration_ms, error_message, client_ip, user_agent, created_at
		FROM usage_logs
		ORDER BY id DESC
		LIMIT ? OFFSET ?
	`, limit, offset)
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
		entry     domain.UsageLog
		createdAt string
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
		&entry.BackendID,
		&entry.BackendName,
		&entry.Attempts,
		&entry.StatusCode,
		&entry.DurationMS,
		&entry.ErrorMessage,
		&entry.ClientIP,
		&entry.UserAgent,
		&createdAt,
	)
	if err != nil {
		return domain.UsageLog{}, err
	}
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
