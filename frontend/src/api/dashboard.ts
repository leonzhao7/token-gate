import apiClient from './client'
import type {
  DashboardSummary,
  UsageData,
  Backend,
  AuditEvent
} from './types'

export const dashboardApi = {
  // Get dashboard summary stats
  async getSummary(): Promise<DashboardSummary> {
    const { data } = await apiClient.get<DashboardSummary>('/dashboard/summary')
    return data
  },

  // Get usage data for charts
  async getUsage(range?: '1h' | '24h' | '7d'): Promise<UsageData[]> {
    const params = new URLSearchParams()
    if (range) params.append('range', range)
    const { data } = await apiClient.get<UsageData[]>('/dashboard/usage', { params })
    return data
  },

  // Get recent activity
  async getActivity(limit?: number): Promise<AuditEvent[]> {
    const params = new URLSearchParams()
    if (limit) params.append('limit', limit.toString())
    const { data } = await apiClient.get<AuditEvent[]>('/dashboard/activity', { params })
    return data
  },

  // Get overview (fallback if specific endpoints not available)
  async getOverview(): Promise<any> {
    const { data } = await apiClient.get('/overview')
    return data
  }
}
