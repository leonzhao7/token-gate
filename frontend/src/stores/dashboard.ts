import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  dashboardApi,
  type BackendHourlyModelStatsResponse,
  type DashboardSummary,
  type DashboardUsageResponse,
  type AuditEvent
} from '@/api'
import {
  buildDashboardStats,
  buildStatsPresetRange,
  type DashboardStatsBucket,
  type DashboardStatsPreset,
  type DashboardStatsPresetRange,
} from '@/utils/dashboardStats'

const DEFAULT_STATS_PRESET: DashboardStatsPreset = 'today'
const defaultStatsRange = (): DashboardStatsPresetRange => buildStatsPresetRange(DEFAULT_STATS_PRESET)

export const useDashboardStore = defineStore('dashboard', () => {
  const summary = ref<DashboardSummary | null>(null)
  const usageData = ref<DashboardUsageResponse | null>(null)
  const backendModelStats = ref<BackendHourlyModelStatsResponse | null>(null)
  const recentActivity = ref<AuditEvent[]>([])
  const statsRangePreset = ref<DashboardStatsPreset>(DEFAULT_STATS_PRESET)
  const statsRange = ref<DashboardStatsPresetRange>(defaultStatsRange())
  const statsBucket = ref<DashboardStatsBucket>(statsRange.value.bucket)
  const loading = ref(false)
  const modelStatsLoading = ref(false)
  const error = ref<string | null>(null)
  const modelStatsError = ref<string | null>(null)

  const modelStats = computed(() => buildDashboardStats(
    backendModelStats.value?.items ?? [],
    {
      startHour: statsRange.value.startHour,
      endHour: statsRange.value.endHour,
      bucket: statsRange.value.bucket,
    },
  ))

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

  const fetchBackendModelStats = async (preset = statsRangePreset.value) => {
    try {
      statsRangePreset.value = preset
      modelStatsLoading.value = true
      modelStatsError.value = null
      const range = buildStatsPresetRange(preset)
      statsRange.value = range
      statsBucket.value = range.bucket
      backendModelStats.value = await dashboardApi.getBackendHourlyModelStats({
        start_hour: range.startHour,
        end_hour: range.endHour,
      })
    } catch (err: any) {
      modelStatsError.value = err.response?.data?.error || 'Failed to load backend model statistics'
      console.error('Failed to fetch backend model statistics:', err)
    } finally {
      modelStatsLoading.value = false
    }
  }

  const setStatsRangePreset = async (preset: DashboardStatsPreset) => {
    await fetchBackendModelStats(preset)
  }

  const fetchActivity = async (limit = 10) => {
    try {
      const activity = await dashboardApi.getActivity(limit)
      recentActivity.value = activity.events
    } catch (err: any) {
      console.error('Failed to fetch activity:', err)
    }
  }

  const fetchAll = async () => {
    await fetchBackendModelStats(statsRangePreset.value)
  }

  return {
    summary,
    usageData,
    backendModelStats,
    modelStats,
    recentActivity,
    statsRangePreset,
    statsRange,
    statsBucket,
    loading,
    modelStatsLoading,
    error,
    modelStatsError,
    fetchSummary,
    fetchUsage,
    fetchBackendModelStats,
    setStatsRangePreset,
    fetchActivity,
    fetchAll
  }
})
