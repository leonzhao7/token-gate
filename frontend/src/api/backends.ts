import apiClient from './client'
import type {
  Backend,
  CreateBackendRequest,
  UpdateBackendRequest,
  BackendFilters,
  ListResponse
} from './types'

export const backendsApi = {
  // List backends
  async list(filters?: BackendFilters): Promise<ListResponse<Backend>> {
    const params = new URLSearchParams()
    if (filters?.search) params.append('search', filters.search)
    if (filters?.status) params.append('status', filters.status)
    if (filters?.page) params.append('page', filters.page.toString())
    if (filters?.limit) params.append('limit', filters.limit.toString())

    const { data } = await apiClient.get<Backend[]>('/backends', { params })

    // Note: Current API returns array directly, not paginated
    // We'll wrap it for future pagination support
    return {
      items: data,
      total: data.length,
      page: filters?.page || 1,
      limit: filters?.limit || 50
    }
  },

  // Get backend detail
  async get(id: number): Promise<Backend> {
    const { data } = await apiClient.get<Backend>(`/backends/${id}/detail`)
    return data
  },

  // Create backend
  async create(backend: CreateBackendRequest): Promise<Backend> {
    const { data } = await apiClient.post<Backend>('/backends', backend)
    return data
  },

  // Update backend
  async update(id: number, backend: Partial<UpdateBackendRequest>): Promise<Backend> {
    const { data } = await apiClient.put<Backend>(`/backends/${id}`, backend)
    return data
  },

  // Delete backend
  async delete(id: number): Promise<void> {
    await apiClient.delete(`/backends/${id}`)
  }
}
