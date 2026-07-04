import type { UsageLogFilters } from './types'

const statusParamByFilter: Record<string, string> = {
  success: '2xx',
  client_error: '4xx',
  server_error: '5xx',
  '2xx': '2xx',
  '3xx': '3xx',
  '4xx': '4xx',
  '5xx': '5xx',
}

const timeRangeMsByFilter: Record<string, number> = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
}

export function buildUsageLogListParams(filters?: UsageLogFilters, now = new Date()): URLSearchParams {
  const params = new URLSearchParams()
  if (!filters) {
    return params
  }

  const dateFrom = normalizedDateFrom(filters, now)
  const dateTo = normalizedDateTo(filters, now)
  appendParam(params, 'date_from', dateFrom)
  appendParam(params, 'date_to', dateTo)
  appendParam(params, 'status', normalizeStatusFilter(filters.status))
  appendParam(params, 'model', filters.model)
  appendParam(params, 'client_key', filters.client_key)
  appendParam(params, 'backend', filters.backend)
  appendParam(params, 'proxy', filters.proxy)

  if (filters.page) params.append('page', filters.page.toString())
  if (filters.limit) params.append('limit', filters.limit.toString())

  return params
}

function normalizedDateFrom(filters: UsageLogFilters, now: Date): string {
  if (filters.date_from) return filters.date_from
  if (filters.start_time) return filters.start_time
  const rangeMs = timeRangeMsByFilter[String(filters.time_range || '').trim()]
  if (!rangeMs) return ''
  return new Date(now.getTime() - rangeMs).toISOString()
}

function normalizedDateTo(filters: UsageLogFilters, now: Date): string {
  if (filters.date_to) return filters.date_to
  if (filters.end_time) return filters.end_time
  if (!filters.time_range) return ''
  return now.toISOString()
}

function normalizeStatusFilter(value?: string): string {
  return statusParamByFilter[String(value || '').trim().toLowerCase()] || ''
}

function appendParam(params: URLSearchParams, key: string, value?: string): void {
  const normalized = String(value || '').trim()
  if (normalized) {
    params.append(key, normalized)
  }
}

