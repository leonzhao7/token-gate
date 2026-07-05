import apiClient from './client'
import type {
  Backend,
  CreateBackendRequest,
  UpdateBackendRequest,
  BackendFilters,
  ListResponse,
  BackendImportExportPayload,
  BackendImportResponse,
  BackendConsoleRequestLog,
  BackendConsoleStreamEvent,
  BackendConsoleSyncResponse
} from './types'

const consoleStreamError = (message: string, status: number, requests: BackendConsoleRequestLog[] = []) => {
  const error = new Error(message) as Error & { response?: { status: number; data: any } }
  error.response = {
    status,
    data: {
      error: {
        message,
        type: 'token_gate_error'
      },
      requests
    }
  }
  return error
}

const parseConsoleStreamLine = (line: string): BackendConsoleStreamEvent | null => {
  const trimmed = line.trim()
  if (!trimmed) return null
  return JSON.parse(trimmed) as BackendConsoleStreamEvent
}

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

  async syncConsole(id: number): Promise<BackendConsoleSyncResponse> {
    const { data } = await apiClient.post<BackendConsoleSyncResponse>(`/backends/${id}/console/sync`)
    return data
  },

  async syncConsoleStream(id: number, onRequest: (request: BackendConsoleRequestLog) => void): Promise<BackendConsoleSyncResponse> {
    const response = await fetch(`/admin/api/backends/${id}/console/sync?stream=1`, {
      method: 'POST',
      headers: {
        Accept: 'application/x-ndjson'
      }
    })
    if (!response.ok) {
      let message = `Backend console sync failed (${response.status})`
      try {
        const payload = await response.json()
        message = payload?.error?.message || payload?.message || message
      } catch {
        // Keep fallback message.
      }
      throw consoleStreamError(message, response.status)
    }
    if (!response.body) {
      throw consoleStreamError('Console sync stream is not available', response.status || 0)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let finalResponse: BackendConsoleSyncResponse | null = null

    const handleLine = (line: string) => {
      const event = parseConsoleStreamLine(line)
      if (!event) return
      switch (event.type) {
        case 'request':
          onRequest(event.request)
          break
        case 'complete':
          finalResponse = event.response
          break
        case 'error':
          throw consoleStreamError(event.message || 'Backend console sync failed', event.status || 500, event.requests || [])
      }
    }

    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        handleLine(line)
      }
    }

    buffer += decoder.decode()
    if (buffer.trim()) {
      handleLine(buffer)
    }

    if (!finalResponse) {
      throw consoleStreamError('Console sync stream ended before completion', response.status || 0)
    }
    return finalResponse
  }
}
