package domain

import (
	"strings"
	"time"
)

const (
	EndpointChat       = "chat"
	EndpointResponses  = "responses"
	EndpointEmbeddings = "embeddings"
	EndpointImages     = "images"
	EndpointMessages   = "messages"
	EndpointModels     = "models"

	PlacementSticky = "sticky"
	PlacementPack   = "pack"
	PlacementSpread = "spread"

	BackendProtocolOpenAI    = "openai"
	BackendProtocolAnthropic = "anthropic"
)

type ClientKey struct {
	ID                int64     `json:"id"`
	Name              string    `json:"name"`
	TokenHash         string    `json:"-"`
	Token             string    `json:"token,omitempty"`
	TokenPrefix       string    `json:"token_prefix"`
	Enabled           bool      `json:"enabled"`
	RouteModeOverride string    `json:"route_mode_override"`
	RouteGroup        string    `json:"route_group"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

type Backend struct {
	ID           int64             `json:"id"`
	Name         string            `json:"name"`
	Pool         string            `json:"pool"`
	Protocol     string            `json:"protocol"`
	BaseURL      string            `json:"base_url"`
	APIKey       string            `json:"api_key,omitempty"`
	ProxyID      int64             `json:"proxy_id"`
	Proxy        *SocksProxy       `json:"proxy,omitempty"`
	Enabled      bool              `json:"enabled"`
	Weight       int               `json:"weight"`
	Models       []string          `json:"models"`
	ModelMapping map[string]string `json:"model_mapping"`
	Endpoints    []string          `json:"endpoints"`
	CreatedAt    time.Time         `json:"created_at"`
	UpdatedAt    time.Time         `json:"updated_at"`
}

type SocksProxy struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	Address   string    `json:"address"`
	Username  string    `json:"username"`
	Password  string    `json:"password,omitempty"`
	Enabled   bool      `json:"enabled"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type ModelPolicy struct {
	ID              int64     `json:"id"`
	Pattern         string    `json:"pattern"`
	Endpoint        string    `json:"endpoint"`
	PlacementPolicy string    `json:"placement_policy"`
	BackendPool     string    `json:"backend_pool"`
	FailoverEnabled bool      `json:"failover_enabled"`
	Priority        int       `json:"priority"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type AuditEvent struct {
	ID          int64     `json:"id"`
	Level       string    `json:"level"`
	Type        string    `json:"type"`
	Message     string    `json:"message"`
	ClientName  string    `json:"client_name"`
	Model       string    `json:"model"`
	Endpoint    string    `json:"endpoint"`
	BackendName string    `json:"backend_name"`
	CreatedAt   time.Time `json:"created_at"`
}

type UsageLog struct {
	ID                int64     `json:"id"`
	RequestID         string    `json:"request_id"`
	ClientID          int64     `json:"client_id"`
	ClientName        string    `json:"client_name"`
	ClientTokenPrefix string    `json:"client_token_prefix"`
	RouteModeOverride string    `json:"route_mode_override"`
	RouteGroup        string    `json:"route_group"`
	Method            string    `json:"method"`
	Path              string    `json:"path"`
	Query             string    `json:"query"`
	Endpoint          string    `json:"endpoint"`
	Model             string    `json:"model"`
	BackendID         int64     `json:"backend_id"`
	BackendName       string    `json:"backend_name"`
	Attempts          int       `json:"attempts"`
	StatusCode        int       `json:"status_code"`
	DurationMS        int64     `json:"duration_ms"`
	ErrorMessage      string    `json:"error_message"`
	ClientIP          string    `json:"client_ip"`
	UserAgent         string    `json:"user_agent"`
	CreatedAt         time.Time `json:"created_at"`
}

func NormalizeBackendProtocol(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case BackendProtocolAnthropic, "claude":
		return BackendProtocolAnthropic
	default:
		return BackendProtocolOpenAI
	}
}
