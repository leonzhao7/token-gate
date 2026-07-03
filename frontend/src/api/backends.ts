import apiClient from './client'
import type {
  Backend,
  CreateBackendRequest,
  UpdateBackendRequest,
  BackendFilters,
  ListResponse,
  BackendImportExportPayload,
  BackendImportResponse,
  BackendConsoleCheckinResponse,
  BackendConsolePricingResponse
} from './types'

export const backendsApi = {
  // List backends
  async list(filters?: BackendFilters): Promise<ListResponse<Backend>> {
    const params = new URLSearchParams()
    if (filters?.search) params.append('search', filters.search)
    if (filters?.status) params.append('status', filters.status)
    if (filters?.page) params.append('page', filters.page.toString())
    if (filters?.limit) params.append('limit', filters.limit.toString())

    const { data } = await apiClient.get<ListResponse<Backend>>('/backends', { params })
    return data
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
  },

  async exportAll(): Promise<BackendImportExportPayload> {
    const { data } = await apiClient.get<BackendImportExportPayload>('/backends/export')
    return data
  },

  async importAll(payload: BackendImportExportPayload): Promise<BackendImportResponse> {
    const { data } = await apiClient.post<BackendImportResponse>('/backends/import', payload)
    return data
  },

  async checkin(id: number): Promise<BackendConsoleCheckinResponse> {
    const { data } = await apiClient.post<BackendConsoleCheckinResponse>(`/backends/${id}/console/checkin`)
    return data
  },

  async pricing(id: number): Promise<BackendConsolePricingResponse> {
    const { data } = await apiClient.post<BackendConsolePricingResponse>(`/backends/${id}/console/pricing`)
    return data
  }
}
