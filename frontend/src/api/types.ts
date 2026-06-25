// API Response Types

export interface Backend {
  id: number
  name: string
  url: string
  api_key: string
  protocol: 'openai' | 'anthropic'
  weight: number
  status: 'normal' | 'abnormal' | 'disabled'
  consecutive_failures: number
  recover_at: string | null
  model_mapping: Record<string, string>
  socks_proxy_id: number | null
  console_url?: string
  console_username?: string
  console_password?: string
  tags?: string[]
  notes?: string
  created_at: string
  updated_at: string
  // List view extra fields
  hourly_requests?: number
  hourly_failures?: number
  avg_latency_ms?: number
  last_used_at?: string
}

export interface SocksProxy {
  id: number
  name: string
  address: string
  port: number
  username?: string
  password?: string
  created_at: string
  updated_at: string
}

export interface ClientKey {
  id: number
  name: string
  token: string
  created_at: string
  updated_at: string
  usage_count?: number
  last_used_at?: string
}

export interface UsageLog {
  id: number
  client_key_id: number
  client_key_name?: string
  endpoint: string
  model: string
  backend_id: number | null
  backend_name?: string
  backend_status?: string
  status_code: number
  latency_ms: number
  input_tokens: number
  output_tokens: number
  total_tokens: number
  error_message?: string
  created_at: string
}

export interface AuditEvent {
  id: number
  action: string
  resource_type: string
  resource_id: number
  details: Record<string, any>
  created_at: string
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
  listen_addr: string
  db_path: string
  log_level: string
  backend_cooldown: string
  backend_fails: number
  request_timeout: string
  shutdown_timeout: string
}

// API Request Types

export interface CreateBackendRequest {
  name: string
  url: string
  api_key: string
  protocol: 'openai' | 'anthropic'
  weight: number
  status?: 'normal' | 'disabled'
  model_mapping: Record<string, string>
  socks_proxy_id?: number | null
  console_url?: string
  console_username?: string
  console_password?: string
  tags?: string[]
  notes?: string
}

export interface UpdateBackendRequest extends Partial<CreateBackendRequest> {
  id: number
}

export interface CreateProxyRequest {
  name: string
  address: string
  port: number
  username?: string
  password?: string
}

export interface UpdateProxyRequest extends Partial<CreateProxyRequest> {
  id: number
}

export interface CreateClientKeyRequest {
  name: string
}

export interface UpdateClientKeyRequest {
  id: number
  name: string
}

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
