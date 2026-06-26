import apiClient from './client'
import type {
  AuditEvent,
  EventFilters,
  ListResponse,
  ClearResponse
} from './types'

export const eventsApi = {
  // List events
  async list(filters?: EventFilters): Promise<ListResponse<AuditEvent>> {
    const params = new URLSearchParams()
    if (filters?.start_time) params.append('start_time', filters.start_time)
    if (filters?.end_time) params.append('end_time', filters.end_time)
    if (filters?.action) params.append('action', filters.action)
    if (filters?.resource_type) params.append('resource_type', filters.resource_type)
    if (filters?.page) params.append('page', filters.page.toString())
    if (filters?.limit) params.append('limit', filters.limit.toString())

    const { data } = await apiClient.get<ListResponse<AuditEvent>>('/events', { params })
    return data
  },

  // Get event detail
  async get(id: number): Promise<AuditEvent> {
    const { data } = await apiClient.get<AuditEvent>(`/events/${id}`)
    return data
  },

  // Clear all events
  async clear(): Promise<ClearResponse> {
    const { data } = await apiClient.delete<ClearResponse>('/events')
    return data
  }
}
