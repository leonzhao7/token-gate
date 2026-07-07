import apiClient from './client'
import type {
  ClientKey,
  CreateClientKeyRequest,
  UpdateClientKeyRequest,
  ListResponse
} from './types'

interface ClientKeyMutationResponse {
  client: ClientKey
  issued_token: string
}

export const clientKeysApi = {
  // List client keys
  async list(): Promise<ListResponse<ClientKey>> {
    const { data } = await apiClient.get<ListResponse<ClientKey>>('/client-keys')
    return data
  },

  // Get client key detail
  async get(id: number): Promise<ClientKey> {
    const { data } = await apiClient.get<ClientKey>(`/client-keys/${id}/detail`)
    return data
  },

  // Create client key
  async create(clientKey: CreateClientKeyRequest): Promise<ClientKey> {
    const { data } = await apiClient.post<ClientKeyMutationResponse | ClientKey>('/client-keys', clientKey)
    return 'client' in data ? data.client : data
  },

  // Update client key
  async update(id: number, clientKey: UpdateClientKeyRequest): Promise<ClientKey> {
    const { data } = await apiClient.put<ClientKeyMutationResponse | ClientKey>(`/client-keys/${id}`, clientKey)
    return 'client' in data ? data.client : data
  },

  // Delete client key
  async delete(id: number): Promise<void> {
    await apiClient.delete(`/client-keys/${id}`)
  }
}
