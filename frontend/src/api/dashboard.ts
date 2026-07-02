import apiClient from './client'
import type {
  BackendHourlyModelStatsParams,
  BackendHourlyModelStatsResponse,
  DashboardActivityResponse,
  DashboardSummary,
  DashboardUsageResponse,
} from './types'

export const dashboardApi = {
  // Get dashboard summary stats
  async getSummary(): Promise<DashboardSummary> {
    const { data } = await apiClient.get<DashboardSummary>('/dashboard/summary')
    return data
  },

  // Get usage data for charts
  async getUsage(range?: '1h' | '24h' | '7d'): Promise<DashboardUsageResponse> {
    const params = new URLSearchParams()
    if (range) params.append('range', range)
    const { data } = await apiClient.get<DashboardUsageResponse>('/dashboard/usage', { params })
    return data
  },

  // Get backend/model hourly stats from backend_hourly_model_stats
  async getBackendHourlyModelStats(
    filters: BackendHourlyModelStatsParams = {}
  ): Promise<BackendHourlyModelStatsResponse> {
    const params = new URLSearchParams()
    if (filters.backend) params.append('backend', filters.backend)
    if (filters.model) params.append('model', filters.model)
    if (filters.start_hour) params.append('start_hour', filters.start_hour)
    if (filters.end_hour) params.append('end_hour', filters.end_hour)
    const { data } = await apiClient.get<BackendHourlyModelStatsResponse>('/backend-hourly-model-stats', { params })
    return data
  },

  // Get recent activity
  async getActivity(limit?: number): Promise<DashboardActivityResponse> {
    const params = new URLSearchParams()
    if (limit) params.append('limit', limit.toString())
    const { data } = await apiClient.get<DashboardActivityResponse>('/dashboard/activity', { params })
    return data
  },

  // Get overview (fallback if specific endpoints not available)
  async getOverview(): Promise<any> {
    const { data } = await apiClient.get('/overview')
    return data
  }
}
