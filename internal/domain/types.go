package domain

import "time"

const (
	EndpointChat       = "chat"
	EndpointResponses  = "responses"
	EndpointEmbeddings = "embeddings"
	EndpointImages     = "images"
	EndpointModels     = "models"

	PlacementSticky = "sticky"
	PlacementPack   = "pack"
	PlacementSpread = "spread"
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
	ID        int64       `json:"id"`
	Name      string      `json:"name"`
	Pool      string      `json:"pool"`
	BaseURL   string      `json:"base_url"`
	APIKey    string      `json:"api_key,omitempty"`
	ProxyID   int64       `json:"proxy_id"`
	Proxy     *SocksProxy `json:"proxy,omitempty"`
	Enabled   bool        `json:"enabled"`
	Weight    int         `json:"weight"`
	Models    []string    `json:"models"`
	Endpoints []string    `json:"endpoints"`
	CreatedAt time.Time   `json:"created_at"`
	UpdatedAt time.Time   `json:"updated_at"`
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
