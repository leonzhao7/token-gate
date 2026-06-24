package domain

import (
	"net/http"
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

	BackendStatusNormal   = "normal"
	BackendStatusAbnormal = "abnormal"
	BackendStatusDisabled = "disabled"

	BackendProtocolOpenAI    = "openai"
	BackendProtocolAnthropic = "anthropic"
)

type ClientKey struct {
	ID          int64     `json:"id"`
	Name        string    `json:"name"`
	TokenHash   string    `json:"-"`
	Token       string    `json:"token,omitempty"`
	TokenPrefix string    `json:"token_prefix"`
	Enabled     bool      `json:"enabled"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Backend struct {
	ID                  int64             `json:"id"`
	Name                string            `json:"name"`
	Protocol            string            `json:"protocol"`
	BaseURL             string            `json:"base_url"`
	APIKey              string            `json:"api_key,omitempty"`
	ConsoleURL          string            `json:"console_url"`
	Tags                []string          `json:"tags"`
	ConsoleUsername     string            `json:"console_username"`
	ConsolePassword     string            `json:"console_password,omitempty"`
	Notes               string            `json:"notes"`
	ProxyID             int64             `json:"proxy_id"`
	Proxy               *SocksProxy       `json:"proxy,omitempty"`
	Status              string            `json:"status"`
	ConsecutiveFailures int               `json:"consecutive_failures"`
	RecoverAt           *time.Time        `json:"recover_at,omitempty"`
	Weight              int               `json:"weight"`
	Models              []string          `json:"models"`
	ModelMapping        map[string]string `json:"model_mapping"`
	Endpoints           []string          `json:"endpoints"`
	CreatedAt           time.Time         `json:"created_at"`
	UpdatedAt           time.Time         `json:"updated_at"`
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

type AuditEvent struct {
	ID           int64     `json:"id"`
	Level        string    `json:"level"`
	Type         string    `json:"type"`
	Category     string    `json:"category"`
	Severity     string    `json:"severity"`
	Actor        string    `json:"actor"`
	ResourceType string    `json:"resource_type"`
	ResourceID   int64     `json:"resource_id"`
	Message      string    `json:"message"`
	ClientName   string    `json:"client_name"`
	Model        string    `json:"model"`
	Endpoint     string    `json:"endpoint"`
	BackendName  string    `json:"backend_name"`
	CreatedAt    time.Time `json:"created_at"`
}

type UsageLog struct {
	ID                  int64     `json:"id"`
	RequestID           string    `json:"request_id"`
	ClientID            int64     `json:"client_id"`
	ClientName          string    `json:"client_name"`
	ClientTokenPrefix   string    `json:"client_token_prefix"`
	Method              string    `json:"method"`
	Path                string    `json:"path"`
	Query               string    `json:"query"`
	Endpoint            string    `json:"endpoint"`
	Model               string    `json:"model"`
	BackendID           int64     `json:"backend_id"`
	BackendName         string    `json:"backend_name"`
	ProxyID             int64     `json:"proxy_id"`
	ProxyName           string    `json:"proxy_name"`
	Attempts            int       `json:"attempts"`
	StatusCode          int       `json:"status_code"`
	StatusFamily        string    `json:"status_family"`
	DurationMS          int64     `json:"duration_ms"`
	ErrorMessage        string    `json:"error_message"`
	ClientIP            string    `json:"client_ip"`
	UserAgent           string    `json:"user_agent"`
	TraceID             string    `json:"trace_id"`
	RequestBytes        int64     `json:"request_bytes"`
	ResponseBytes       int64     `json:"response_bytes"`
	RequestHeadersJSON  string    `json:"request_headers_json"`
	RequestBodyPreview  string    `json:"request_body_preview"`
	ResponseHeadersJSON string    `json:"response_headers_json"`
	ResponseBodyPreview string    `json:"response_body_preview"`
	PreviewTruncated    bool      `json:"preview_truncated"`
	IsStream            bool      `json:"is_stream"`
	CreatedAt           time.Time `json:"created_at"`
}

func NormalizeBackendProtocol(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case BackendProtocolAnthropic, "claude":
		return BackendProtocolAnthropic
	default:
		return BackendProtocolOpenAI
	}
}

func IsBackendFailureStatus(status int) bool {
	if status >= http.StatusInternalServerError {
		return true
	}
	return status >= http.StatusBadRequest && status < http.StatusInternalServerError && status != http.StatusBadRequest
}
