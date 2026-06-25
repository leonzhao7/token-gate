import apiClient from './client'
import type {
  SocksProxy,
  CreateProxyRequest,
  UpdateProxyRequest,
  ListResponse
} from './types'

export const proxiesApi = {
  // List proxies
  async list(): Promise<ListResponse<SocksProxy>> {
    const { data } = await apiClient.get<ListResponse<SocksProxy>>('/socks-proxies')
    return data
  },

  // Get proxy detail
  async get(id: number): Promise<SocksProxy> {
    const { data } = await apiClient.get<SocksProxy>(`/socks-proxies/${id}/detail`)
    return data
  },

  // Create proxy
  async create(proxy: CreateProxyRequest): Promise<SocksProxy> {
    const { data } = await apiClient.post<SocksProxy>('/socks-proxies', proxy)
    return data
  },

  // Update proxy
  async update(id: number, proxy: Partial<UpdateProxyRequest>): Promise<SocksProxy> {
    const { data } = await apiClient.put<SocksProxy>(`/socks-proxies/${id}`, proxy)
    return data
  },

  // Delete proxy
  async delete(id: number): Promise<void> {
    await apiClient.delete(`/socks-proxies/${id}`)
  }
}
