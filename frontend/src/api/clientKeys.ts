import apiClient from './client'
import type {
  ClientKey,
  CreateClientKeyRequest,
  UpdateClientKeyRequest,
  ListResponse
} from './types'

export const clientKeysApi = {
  // List client keys
  async list(): Promise<ListResponse<ClientKey>> {
    const { data } = await apiClient.get<ClientKey[]>('/client-keys')
    return {
      items: data,
      total: data.length,
      page: 1,
      limit: 50
    }
  },

  // Get client key detail
  async get(id: number): Promise<ClientKey> {
    const { data } = await apiClient.get<ClientKey>(`/client-keys/${id}/detail`)
    return data
  },

  // Create client key
  async create(clientKey: CreateClientKeyRequest): Promise<ClientKey> {
    const { data } = await apiClient.post<ClientKey>('/client-keys', clientKey)
    return data
  },

  // Update client key
  async update(id: number, clientKey: UpdateClientKeyRequest): Promise<ClientKey> {
    const { data } = await apiClient.put<ClientKey>(`/client-keys/${id}`, clientKey)
    return data
  },

  // Delete client key
  async delete(id: number): Promise<void> {
    await apiClient.delete(`/client-keys/${id}`)
  }
}
