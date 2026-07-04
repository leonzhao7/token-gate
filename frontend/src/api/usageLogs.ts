import apiClient from './client'
import type {
  UsageLog,
  UsageLogFilters,
  ListResponse,
  ClearResponse
} from './types'
import { buildUsageLogListParams } from './usageLogParams'

export const usageLogsApi = {
  // List usage logs
  async list(filters?: UsageLogFilters): Promise<ListResponse<UsageLog>> {
    const params = buildUsageLogListParams(filters)

    const { data } = await apiClient.get<ListResponse<UsageLog>>('/usage-logs', { params })
    return data
  },

  // Get usage log detail
  async get(id: number): Promise<UsageLog> {
    const { data } = await apiClient.get<UsageLog>(`/usage-logs/${id}`)
    return data
  },

  // Delete usage logs (batch)
  async delete(filters?: UsageLogFilters): Promise<void> {
    const params = buildUsageLogListParams(filters)
    await apiClient.delete('/usage-logs', { params })
  },

  // Clear all usage logs
  async clear(): Promise<ClearResponse> {
    const { data } = await apiClient.delete<ClearResponse>('/usage-logs')
    return data
  }
}
