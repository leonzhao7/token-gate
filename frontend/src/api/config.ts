import apiClient from './client'
import type {
  Config,
  UpdateConfigRequest
} from './types'

export const configApi = {
  // Get current config
  async get(): Promise<Config> {
    const { data } = await apiClient.get<Config>('/admin/api/config')
    return data
  },

  // Update config
  async update(config: UpdateConfigRequest): Promise<Config> {
    const { data } = await apiClient.put<Config>('/admin/api/config', config)
    return data
  },

  // Reload config (hot-reload)
  async reload(): Promise<void> {
    await apiClient.post('/admin/api/config/reload')
  }
}
