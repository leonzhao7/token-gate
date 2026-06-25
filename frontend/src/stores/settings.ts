import { defineStore } from 'pinia'
import { ref } from 'vue'
import { configApi, type Config, type UpdateConfigRequest } from '@/api'

export const useSettingsStore = defineStore('settings', () => {
  const config = ref<Config | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchConfig = async () => {
    try {
      loading.value = true
      error.value = null
      config.value = await configApi.get()
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to load config'
      console.error('Failed to fetch config:', err)
    } finally {
      loading.value = false
    }
  }

  const updateConfig = async (updates: UpdateConfigRequest) => {
    try {
      config.value = await configApi.update(updates)
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Failed to update config'
      console.error('Failed to update config:', err)
      throw new Error(errorMsg)
    }
  }

  const reloadConfig = async () => {
    try {
      await configApi.reload()
      await fetchConfig()
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Failed to reload config'
      console.error('Failed to reload config:', err)
      throw new Error(errorMsg)
    }
  }

  return {
    config,
    loading,
    error,
    fetchConfig,
    updateConfig,
    reloadConfig
  }
})
