import apiClient from './client'
import type {
  UsageLog,
  UsageLogFilters,
  ListResponse
} from './types'

export const usageLogsApi = {
  // List usage logs
  async list(filters?: UsageLogFilters): Promise<ListResponse<UsageLog>> {
    const params = new URLSearchParams()
    if (filters?.start_time) params.append('start_time', filters.start_time)
    if (filters?.end_time) params.append('end_time', filters.end_time)
    if (filters?.status_code?.length) {
      filters.status_code.forEach(code => params.append('status_code', code.toString()))
    }
    if (filters?.backend_id?.length) {
      filters.backend_id.forEach(id => params.append('backend_id', id.toString()))
    }
    if (filters?.client_key_id?.length) {
      filters.client_key_id.forEach(id => params.append('client_key_id', id.toString()))
    }
    if (filters?.page) params.append('page', filters.page.toString())
    if (filters?.limit) params.append('limit', filters.limit.toString())

    const { data } = await apiClient.get<UsageLog[]>('/usage-logs', { params })
    return {
      items: data,
      total: data.length,
      page: filters?.page || 1,
      limit: filters?.limit || 50
    }
  },

  // Get usage log detail
  async get(id: number): Promise<UsageLog> {
    const { data } = await apiClient.get<UsageLog>(`/usage-logs/${id}`)
    return data
  },

  // Delete usage logs (batch)
  async delete(filters?: UsageLogFilters): Promise<void> {
    const params = new URLSearchParams()
    if (filters?.start_time) params.append('start_time', filters.start_time)
    if (filters?.end_time) params.append('end_time', filters.end_time)
    await apiClient.delete('/usage-logs', { params })
  }
}
