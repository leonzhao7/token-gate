import { defineStore } from 'pinia'
import { ref } from 'vue'
import { proxiesApi, type SocksProxy, type CreateProxyRequest } from '@/api'

export const useProxiesStore = defineStore('proxies', () => {
  const proxies = ref<SocksProxy[]>([])
  const currentProxy = ref<SocksProxy | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchProxies = async () => {
    try {
      loading.value = true
      error.value = null
      const response = await proxiesApi.list()
      proxies.value = response.items
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to load proxies'
      console.error('Failed to fetch proxies:', err)
    } finally {
      loading.value = false
    }
  }

  const fetchProxy = async (id: number) => {
    try {
      currentProxy.value = await proxiesApi.get(id)
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to load proxy'
      console.error('Failed to fetch proxy:', err)
    }
  }

  const createProxy = async (proxy: CreateProxyRequest) => {
    try {
      const newProxy = await proxiesApi.create(proxy)
      proxies.value.push(newProxy)
      return newProxy
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Failed to create proxy'
      console.error('Failed to create proxy:', err)
      throw new Error(errorMsg)
    }
  }

  const updateProxy = async (id: number, proxy: Partial<CreateProxyRequest>) => {
    try {
      const updated = await proxiesApi.update(id, proxy)
      const index = proxies.value.findIndex(p => p.id === id)
      if (index !== -1) {
        proxies.value[index] = updated
      }
      return updated
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Failed to update proxy'
      console.error('Failed to update proxy:', err)
      throw new Error(errorMsg)
    }
  }

  const deleteProxy = async (id: number) => {
    try {
      await proxiesApi.delete(id)
      proxies.value = proxies.value.filter(p => p.id !== id)
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Failed to delete proxy'
      console.error('Failed to delete proxy:', err)
      throw new Error(errorMsg)
    }
  }

  return {
    proxies,
    currentProxy,
    loading,
    error,
    fetchProxies,
    fetchProxy,
    createProxy,
    updateProxy,
    deleteProxy
  }
})
