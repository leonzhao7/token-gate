import { defineStore } from 'pinia'
import { ref } from 'vue'
import { eventsApi, type AuditEvent, type EventFilters } from '@/api'

export const useEventsStore = defineStore('events', () => {
  const events = ref<AuditEvent[]>([])
  const total = ref(0)
  const page = ref(1)
  const limit = ref(50)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchEvents = async (filters?: EventFilters) => {
    try {
      loading.value = true
      error.value = null
      const response = await eventsApi.list({
        ...filters,
        page: page.value,
        limit: limit.value
      })
      events.value = response.items
      total.value = response.total
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to load events'
      console.error('Failed to fetch events:', err)
    } finally {
      loading.value = false
    }
  }

  const clearEvents = async () => {
    try {
      loading.value = true
      error.value = null
      await eventsApi.clear()
      events.value = []
      total.value = 0
      page.value = 1
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Failed to clear events'
      error.value = errorMsg
      console.error('Failed to clear events:', err)
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
    events,
    total,
    page,
    limit,
    loading,
    error,
    fetchEvents,
    clearEvents,
    setPage,
    setLimit
  }
})
