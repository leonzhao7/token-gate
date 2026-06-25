import { defineStore } from 'pinia'
import { ref } from 'vue'
import { dashboardApi, type DashboardSummary, type UsageData, type AuditEvent } from '@/api'

export const useDashboardStore = defineStore('dashboard', () => {
  const summary = ref<DashboardSummary | null>(null)
  const usageData = ref<UsageData[]>([])
  const recentActivity = ref<AuditEvent[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchSummary = async () => {
    try {
      loading.value = true
      error.value = null
      summary.value = await dashboardApi.getSummary()
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to load dashboard summary'
      console.error('Failed to fetch dashboard summary:', err)
    } finally {
      loading.value = false
    }
  }

  const fetchUsage = async (range: '1h' | '24h' | '7d' = '24h') => {
    try {
      usageData.value = await dashboardApi.getUsage(range)
    } catch (err: any) {
      console.error('Failed to fetch usage data:', err)
    }
  }

  const fetchActivity = async (limit = 10) => {
    try {
      recentActivity.value = await dashboardApi.getActivity(limit)
    } catch (err: any) {
      console.error('Failed to fetch activity:', err)
    }
  }

  const fetchAll = async () => {
    await Promise.all([
      fetchSummary(),
      fetchUsage(),
      fetchActivity()
    ])
  }

  return {
    summary,
    usageData,
    recentActivity,
    loading,
    error,
    fetchSummary,
    fetchUsage,
    fetchActivity,
    fetchAll
  }
})
