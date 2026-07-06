import type { Backend, BackendConsoleSyncResponse } from '@/api'

export interface BackendConsoleSyncBatchSuccess {
  backend: Backend
  response: BackendConsoleSyncResponse
}

export interface BackendConsoleSyncBatchFailure {
  backend: Backend
  error: unknown
}

export interface RunBackendConsoleSyncBatchOptions {
  backends: Backend[]
  syncBackend: (backend: Backend) => Promise<BackendConsoleSyncResponse>
  onBackendStart?: (backend: Backend) => void
  onBackendSuccess?: (backend: Backend, response: BackendConsoleSyncResponse) => void
  onBackendError?: (backend: Backend, error: unknown) => void
}

export interface BackendConsoleSyncBatchResult {
  total: number
  successCount: number
  failureCount: number
  skipped: Backend[]
  successes: BackendConsoleSyncBatchSuccess[]
  failures: BackendConsoleSyncBatchFailure[]
}

export const canSyncBackendConsole = (backend: Backend) => backend.backend_type === 'new-api' || backend.backend_type === 'sub2api'

export const runBackendConsoleSyncBatch = async (
  options: RunBackendConsoleSyncBatchOptions
): Promise<BackendConsoleSyncBatchResult> => {
  const { backends, syncBackend, onBackendStart, onBackendSuccess, onBackendError } = options
  const skipped = backends.filter((backend) => !canSyncBackendConsole(backend))
  const syncableBackends = backends.filter(canSyncBackendConsole)
  const successes: BackendConsoleSyncBatchSuccess[] = []
  const failures: BackendConsoleSyncBatchFailure[] = []

  for (const backend of syncableBackends) {
    onBackendStart?.(backend)
    try {
      const response = await syncBackend(backend)
      const success = { backend, response }
      successes.push(success)
      onBackendSuccess?.(backend, response)
    } catch (error) {
      failures.push({ backend, error })
      onBackendError?.(backend, error)
      continue
    }
  }

  return {
    total: syncableBackends.length,
    successCount: successes.length,
    failureCount: failures.length,
    skipped,
    successes,
    failures,
  }
}

export const formatBackendConsoleSyncBatchSummary = (
  result: BackendConsoleSyncBatchResult
): string => {
  const base = result.failureCount === 0
    ? `已完成 ${result.successCount}/${result.total} 个 backend 同步`
    : `已完成 ${result.successCount}/${result.total} 个 backend 同步，失败 ${result.failureCount} 个`

  if (result.failureCount === 0) {
    return base
  }

  const failedBackendNames = result.failures
    .map((entry) => entry.backend.name)
    .filter((name, index, names) => Boolean(name) && names.indexOf(name) === index)

  if (failedBackendNames.length === 0) {
    return base
  }

  return `${base}：${failedBackendNames.join('、')}`
}
