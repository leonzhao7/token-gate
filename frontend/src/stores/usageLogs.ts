import { defineStore } from 'pinia'
import { ref } from 'vue'
import { usageLogsApi, type UsageLog, type UsageLogFilters } from '@/api'

export const useUsageLogsStore = defineStore('usageLogs', () => {
  const logs = ref<UsageLog[]>([])
  const total = ref(0)
  const page = ref(1)
  const limit = ref(50)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchLogs = async (filters?: UsageLogFilters) => {
    try {
      loading.value = true
      error.value = null
      const response = await usageLogsApi.list({
        ...filters,
        page: page.value,
        limit: limit.value
      })
      logs.value = response.items
      total.value = response.total
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to load usage logs'
      console.error('Failed to fetch usage logs:', err)
    } finally {
      loading.value = false
    }
  }

  const clearLogs = async () => {
    try {
      loading.value = true
      error.value = null
      await usageLogsApi.clear()
      logs.value = []
      total.value = 0
      page.value = 1
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Failed to clear usage logs'
      error.value = errorMsg
      console.error('Failed to clear usage logs:', err)
      throw new Error(errorMsg)
    } finally {
      loading.value = false
    }
  }

  const setPage = (newPage: number) => {
    page.value = newPage
  }

  const setLimit = (newLimit: number) => {
    limit.value = newLimit
    page.value = 1
  }

  return {
    logs,
    total,
    page,
    limit,
    loading,
    error,
    fetchLogs,
    clearLogs,
    setPage,
    setLimit
  }
})
