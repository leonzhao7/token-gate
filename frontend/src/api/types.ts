// API Response Types

export interface Backend {
  id: number
  name: string
  base_url: string
  api_key: string
  protocol: 'openai' | 'anthropic' | 'both'
  backend_type?: '' | 'new-api'
  weight: number
  priority?: number
  max_requests_per_minute?: number
  enabled?: boolean
  status: string
  consecutive_failures: number
  model_mapping: string | Record<string, any>
  proxy_id: number | null
  socks_proxy_id?: number | null  // alias
  console_url?: string
  console_username?: string
  console_password?: string
  console_cookie?: string
  console_account_json?: string
  console_pricing_json?: string
  tags?: string[]
  notes?: string
  created_at: string
  updated_at: string
  request_count?: number
  avg_latency_ms?: number
  avg_latency?: number
  last_used_at?: string
  model_count?: number
  hourly_requests?: number
  hourly_failures?: number
  total_requests?: number
  error_count?: number
  models?: string[]
  proxy?: SocksProxy
}

export interface SocksProxy {
  id: number
  name: string
  address: string  // Full address like "host:port" or "socks5://host:port"
  username?: string
  password?: string
  enabled: boolean
  created_at: string
  updated_at: string
}

export interface ClientKey {
  id: number
  name: string
  token: string
  token_prefix?: string
  masked_token?: string
  allowed_models?: string
  enabled: boolean
  created_at: string
  updated_at: string
  usage_count?: number
  last_used_at?: string
}

export interface CreateClientKeyRequest {
  name: string
  allowed_models?: string
  enabled?: boolean
}

export interface UpdateClientKeyRequest {
  name?: string
  allowed_models?: string
  enabled?: boolean
}

export interface UsageLog {
  id: number
  request_id: string
  client_id: number
  client_name?: string
  client_token_prefix?: string
  client_key_id?: number
  client_key_name?: string
  method: string
  path: string
  query?: string
  endpoint: string
  model: string
  backend_id: number | null
  backend_name?: string
  proxy_id?: number | null
  proxy_name?: string
  status_code: number
  status_family?: string
  duration_ms: number
  latency_ms?: number
  request_bytes?: number
  response_bytes?: number
  input_tokens?: number
  input_cache_tokens?: number
  output_tokens?: number
  request_body_preview?: string
  response_body_preview?: string
  request_headers_json?: string
  response_headers_json?: string
  is_stream?: boolean
  attempts?: number
  trace_id?: string
  error_message?: string
  client_ip?: string
  ip_address?: string
  user_agent?: string
  preview_truncated?: boolean
  created_at: string
}

export interface AuditEvent {
  id: number
  level: string  // warn, info, error
  type: string  // backend_failover, proxy_retry, etc.
  category: string
  severity: string
  actor?: string
  resource_type?: string
  resource_id?: number
  resource_name?: string
  message: string
  client_name?: string
  model?: string
  endpoint?: string
  backend_name?: string
  details?: string  // JSON string
  ip_address?: string
  created_at: string

  // Backward compatibility aliases
  action?: string  // Maps to type
}

export interface DashboardSummary {
  cards?: Record<string, {
    count: number
    enabled?: number
    successes?: number
    failures?: number
  }>
  counts: {
    backends: number
    client_keys: number
    socks_proxies: number
  }
  growth: {
    requests: number
    errors: number
  }
  status: {
    healthy_backends: number
    recent_errors: number
    active_clients: number
  }
  sparkline: Array<{
    label: string
    requests: number
  }>
}

export interface UsageData {
  timestamp: string
  success_count: number
  failure_count: number
}

export interface DashboardUsagePoint {
  label: string
  requests: number
  successes?: number
  failures?: number
  latency_ms?: number
  traffic_bytes?: number
  error_rate: number
}

export interface DashboardUsageResponse {
  range: string
  series: DashboardUsagePoint[]
}

export interface DashboardActivityResponse {
  events: AuditEvent[]
  usage: UsageLog[]
  usage_logs: UsageLog[]
  summary: Array<{
    category: string
    count: number
  }>
}

export interface BackendHourlyModelStatsItem {
  backend_id: number
  backend: string
  model: string
  hour: string
  requests: number
  successes: number
  failures: number
  input_tokens: number
  output_tokens: number
  input_cache_tokens: number
  success_avg_duration_ms: number
  success_request_bytes: number
  success_response_bytes: number
}

export interface BackendHourlyModelStatsResponse {
  query: {
    backend: string | null
    model: string | null
    start_hour: string | null
    end_hour: string | null
  }
  scope: {
    backends: Array<{
      id: number
      name: string
    }>
    models: string[]
    time_range: {
      start_hour: string | null
      end_hour: string | null
      timezone: string
    }
  }
  items: BackendHourlyModelStatsItem[]
}

export interface BackendHourlyModelStatsParams {
  backend?: string
  model?: string
  start_hour?: string
  end_hour?: string
}

export interface Config {
  listen_addr?: string
  db_path?: string
  log_level?: string
  backend_cooldown?: string
  backend_fails?: string
  backend_console_user_agent?: string
  focus_models?: string
  request_timeout?: string
  shutdown_timeout?: string
}

// API Request Types

export interface CreateBackendRequest {
  name: string
  protocol?: 'openai' | 'anthropic' | 'both'
  backend_type?: '' | 'new-api'
  base_url: string
  api_key: string
  console_url?: string
  console_cookie?: string
  console_user_id?: string
  tags?: string[]
  console_username?: string
  console_password?: string
  notes?: string
  proxy_id?: number
  status?: string
  model_mapping?: Record<string, string>
  models?: string[]
  weight?: number
}

export interface UpdateBackendRequest extends Partial<CreateBackendRequest> {
  status?: string
}

export interface BackendImportExportItem {
  name: string
  protocol: 'openai' | 'anthropic' | 'both'
  backend_type?: '' | 'new-api'
  base_url: string
  api_key: string
  console_url?: string
  console_cookie?: string
  console_account_json?: string
  console_pricing_json?: string
  tags?: string[]
  console_username?: string
  console_password?: string
  notes?: string
  proxy_id: number
  status: string
  consecutive_failures: number
  weight: number
  models: string[]
  model_mapping: Record<string, string>
}

export interface BackendImportExportPayload {
  backends: BackendImportExportItem[]
}

export interface BackendImportResponse {
  imported: number
  backends: Backend[]
}

export interface BackendConsoleRequestLog {
  time: string
  method?: string
  path: string
  status_code: number
  body: string
}

export interface BackendConsoleSyncResponse {
  backend: Backend
  status?: Record<string, any>
  checkin?: Record<string, any>
  account?: Record<string, any>
  pricing?: Record<string, any>
  requests?: BackendConsoleRequestLog[]
}

export type BackendConsoleStreamEvent =
  | { type: 'request'; request: BackendConsoleRequestLog }
  | { type: 'complete'; response: BackendConsoleSyncResponse }
  | { type: 'error'; status?: number; message?: string; requests?: BackendConsoleRequestLog[] }

export interface CreateProxyRequest {
  name: string
  address: string  // Full address like "socks5://host:port"
  username?: string
  password?: string
  enabled?: boolean
}

export interface UpdateProxyRequest extends Partial<CreateProxyRequest> {}

export interface UpdateConfigRequest extends Partial<Config> {}

// Pagination & Filters

export interface PaginationParams {
  page?: number
  limit?: number
}

export interface BackendFilters extends PaginationParams {
  search?: string
  status?: string
}

export interface UsageLogFilters extends PaginationParams {
  time_range?: string
  date_from?: string
  date_to?: string
  status?: string
  model?: string
  client_key?: string
  backend?: string
  proxy?: string
  start_time?: string
  end_time?: string
  status_code?: number[]
  backend_id?: number[]
  client_key_id?: number[]
}

export interface EventFilters extends PaginationParams {
  start_time?: string
  end_time?: string
  action?: string
  resource_type?: string
}

// API Response Wrappers

export interface ListResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

export interface ApiError {
  error: string
  details?: Record<string, any>
}

export interface ClearResponse {
  cleared: boolean
  deleted: number
}
