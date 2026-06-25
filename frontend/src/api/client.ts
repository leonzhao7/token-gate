import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios'

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: '/admin/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request counter for loading state
let pendingRequests = 0

// Request interceptor
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    pendingRequests++
    return config
  },
  (error: AxiosError) => {
    pendingRequests--
    return Promise.reject(error)
  }
)

// Response interceptor
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    pendingRequests--
    return response
  },
  (error: AxiosError) => {
    pendingRequests--

    // Handle common errors
    if (error.response) {
      const status = error.response.status
      const data = error.response.data as any

      switch (status) {
        case 400:
          console.error('Bad Request:', data.error || 'Invalid request')
          break
        case 401:
          console.error('Unauthorized:', data.error || 'Authentication required')
          break
        case 403:
          console.error('Forbidden:', data.error || 'Access denied')
          break
        case 404:
          console.error('Not Found:', data.error || 'Resource not found')
          break
        case 500:
          console.error('Server Error:', data.error || 'Internal server error')
          break
        default:
          console.error(`Error ${status}:`, data.error || 'Unknown error')
      }
    } else if (error.request) {
      console.error('Network Error:', 'No response from server')
    } else {
      console.error('Request Error:', error.message)
    }

    return Promise.reject(error)
  }
)

// Helper to check if there are pending requests
export const hasPendingRequests = (): boolean => {
  return pendingRequests > 0
}

export default apiClient
