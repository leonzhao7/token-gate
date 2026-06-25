import { defineStore } from 'pinia'
import { ref } from 'vue'
import { backendsApi, type Backend, type CreateBackendRequest, type BackendFilters } from '@/api'

export const useBackendsStore = defineStore('backends', () => {
  const backends = ref<Backend[]>([])
  const currentBackend = ref<Backend | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchBackends = async (filters?: BackendFilters) => {
    try {
      loading.value = true
      error.value = null
      // Fetch all backends by setting a high limit
      const response = await backendsApi.list({ ...filters, limit: 1000 })
      // Sort by weight descending
      backends.value = response.items.sort((a, b) => (b.weight || 0) - (a.weight || 0))
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to load backends'
      console.error('Failed to fetch backends:', err)
    } finally {
      loading.value = false
    }
  }

  const fetchBackend = async (id: number) => {
    try {
      currentBackend.value = await backendsApi.get(id)
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to load backend'
      console.error('Failed to fetch backend:', err)
    }
  }

  const createBackend = async (backend: CreateBackendRequest) => {
    try {
      const newBackend = await backendsApi.create(backend)
      backends.value.push(newBackend)
      return newBackend
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Failed to create backend'
      console.error('Failed to create backend:', err)
      throw new Error(errorMsg)
    }
  }

  const updateBackend = async (id: number, backend: Partial<CreateBackendRequest>) => {
    try {
      const updated = await backendsApi.update(id, backend)
      const index = backends.value.findIndex(b => b.id === id)
      if (index !== -1) {
        backends.value[index] = updated
      }
      return updated
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Failed to update backend'
      console.error('Failed to update backend:', err)
      throw new Error(errorMsg)
    }
  }

  const deleteBackend = async (id: number) => {
    try {
      await backendsApi.delete(id)
      backends.value = backends.value.filter(b => b.id !== id)
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Failed to delete backend'
      console.error('Failed to delete backend:', err)
      throw new Error(errorMsg)
    }
  }

  return {
    backends,
    currentBackend,
    loading,
    error,
    fetchBackends,
    fetchBackend,
    createBackend,
    updateBackend,
    deleteBackend
  }
})
