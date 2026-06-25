// API Response Types

export interface Backend {
  id: number
  name: string
  base_url: string
  api_key: string
  protocol: 'openai' | 'anthropic'
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
  tags?: string[]
  notes?: string
  created_at: string
  updated_at: string
  request_count?: number
  avg_latency_ms?: number
  avg_latency?: number
  last_used_at?: string
  model_count?: number
  endpoint_count?: number
  hourly_requests?: number
  hourly_failures?: number
  total_requests?: number
  error_count?: number
  models?: string[]
  endpoints?: string[]
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
  backends_total: number
  backends_healthy: number
  backends_abnormal: number
  client_keys_total: number
  client_keys_active_24h: number
  requests_24h: number
  requests_growth: number
  error_rate: number
  recent_errors: number
}

export interface UsageData {
  timestamp: string
  success_count: number
  failure_count: number
}

export interface Config {
  listen_addr?: string
  db_path?: string
  log_level?: string
  backend_cooldown?: string
  backend_fails?: string
  request_timeout?: string
  shutdown_timeout?: string
}

// API Request Types

export interface CreateBackendRequest {
  name: string
  base_url: string  // Changed from 'url' to match backend API
  api_key: string
  model_mapping?: string  // JSON string or empty
  socks_proxy_id?: number | null
  weight?: number
  priority?: number
  max_requests_per_minute?: number
  enabled?: boolean
}

export interface UpdateBackendRequest extends Partial<CreateBackendRequest> {}

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
