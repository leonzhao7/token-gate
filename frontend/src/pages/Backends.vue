<template>
  <DefaultLayout>
    <div class="backends-page">

      <!-- Search & Filters -->
      <Card class="filters-card">
        <div class="filters">
          <input
            v-model="searchQuery"
            type="text"
            class="search-input"
            placeholder="Search backends..."
            @input="handleSearch"
          />
          <select v-model="statusFilter" class="filter-select" @change="handleFilterChange">
            <option value="">All Status</option>
            <option value="normal">Normal</option>
            <option value="abnormal">Abnormal</option>
            <option value="disabled">Disabled</option>
          </select>
          <select
            v-model="modelFilter"
            class="filter-select model-filter-input"
            @change="handleFilterChange"
          >
            <option value="">All Models</option>
            <option value="gpt">gpt</option>
            <option value="claude">claude</option>
            <option value="glm">glm</option>
            <option value="deepseek">deepseek</option>
            <option value="image">image</option>
          </select>
          <div class="filter-group">
            <label class="filter-label">Per Page </label>
            <select v-model.number="pageSize" class="filter-select" @change="handlePageSizeChange">
              <option :value="10">10</option>
              <option :value="25">25</option>
              <option :value="50">50</option>
              <option :value="100">100</option>
            </select>
          </div>
          <Button variant="secondary" size="sm" :loading="exporting" @click="exportBackends">
            <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor"><path d="M480-480ZM202-65l-56-57 118-118h-90v-80h226v226h-80v-89L202-65Zm278-15v-80h240v-440H520v-200H240v400h-80v-400q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H480Z"/></svg>
            Export
          </Button>
          <Button variant="secondary" size="sm" :loading="importing" @click="openImportPicker">
            <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor"><path d="M240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v240h-80v-200H520v-200H240v640h360v80H240Zm638 15L760-183v89h-80v-226h226v80h-90l118 118-56 57Zm-638-95v-640 640Z"/></svg>
            Import
          </Button>
          <Button variant="secondary" size="sm"  @click="showCreateModal = true">
            <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor"><path d="M440-440H200v-80h240v-240h80v240h240v80H520v240h-80v-240Z"/></svg>
            Add
          </Button>
          <Button
            variant="secondary"
            size="sm"
            :loading="syncingAllBackends"
            :disabled="!syncableBackends.length"
            @click="handleSyncAllBackends"
          >
            <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor"><path d="M280-120 80-320l200-200 57 56-104 104h607v80H233l104 104-57 56Zm400-320-57-56 104-104H120v-80h607L623-784l57-56 200 200-200 200Z"/></svg>
            同步
          </Button>
          <Button variant="secondary" size="sm" @click="refreshBackends" :loading="loading">
            <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor"><path d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z"/></svg>
            Refresh
          </Button>
          <input
            ref="importFileInput"
            class="file-input"
            type="file"
            accept="application/json,.json"
            @change="handleImportFile"
          />
        </div>
      </Card>

      <!-- Loading State -->
      <LoadingSpinner v-if="loading && !backends.length" message="Loading backends..." />

      <!-- Error State -->
      <Card v-else-if="error">
        <EmptyState icon="⚠️" title="Failed to load backends" :description="error">
          <template #action>
            <Button @click="refreshBackends">Retry</Button>
          </template>
        </EmptyState>
      </Card>

      <!-- Backend List -->
      <BackendList
        v-else
        :backends="paginatedBackends"
        :focus-model-patterns="focusModelPatterns"
        :running-console-sync-ids="runningConsoleSyncIds"
        @create="showCreateModal = true"
        @edit="handleEdit"
        @delete="handleDelete"
        @sync-console="handleConsoleSync"
        @toggle-status="handleToggleStatus"
      />

      <!-- Pagination -->
      <Pagination
        v-if="totalPages > 1"
        :current-page="currentPage"
        :total-pages="totalPages"
        @change="handlePageChange"
      />

      <div v-if="filteredBackends.length > 0" class="backends-footer">
        <span class="backends-count">
          Showing {{ paginatedBackends.length }} of {{ filteredBackends.length }} backends
        </span>
      </div>

      <!-- Create/Edit Modal -->
      <Modal
        :show="showCreateModal || showEditModal"
        :title="editingBackend ? '编辑 Backend' : '新增 Backend'"
        width="580px"
        @close="closeModals"
      >
        <BackendForm
          :backend="editingBackend"
          :proxies="proxies"
          :loading="submitting"
          :submit-label="editingBackend ? '更新' : '创建'"
          @submit="handleSubmit"
          @cancel="closeModals"
        />
      </Modal>

      <!-- Delete Confirmation Modal -->
      <Modal
        :show="showDeleteModal"
        title="Delete Backend"
        width="500px"
        @close="showDeleteModal = false"
      >
        <div class="delete-confirmation">
          <p>Are you sure you want to delete <strong>{{ deletingBackend?.name }}</strong>?</p>
          <p class="warning-text">This action cannot be undone.</p>
          <div class="modal-actions">
            <Button variant="secondary" @click="showDeleteModal = false">
              Cancel
            </Button>
            <Button variant="danger" :loading="submitting" @click="confirmDelete">
              Delete Backend
            </Button>
          </div>
        </div>
      </Modal>

      <!-- Console Request Log Modal -->
      <Modal
        :show="showConsoleActionLogModal"
        title="Console Request Log"
        width="960px"
        @close="showConsoleActionLogModal = false"
      >
        <div class="console-log-modal">
          <div class="console-log-toolbar">
            <div class="console-log-context">
              <strong>{{ consoleActionLogTitle }}</strong>
              <span>{{ consoleRequestLogRows.length }} requests</span>
            </div>
            <Button variant="ghost" size="sm" @click="clearConsoleRequestLogRows">
              <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor"><path d="M120-280v-80h560v80H120Zm80-160v-80h560v80H200Zm80-160v-80h560v80H280Z"/></svg>
              Clear
            </Button>
          </div>

          <div class="console-log-table-wrap">
            <table class="console-log-table">
              <thead>
                <tr>
                  <th>{{ batchSyncFailureMode ? 'Backend' : 'Time' }}</th>
                  <th>Path</th>
                  <th>HTTP Status</th>
                  <th>Response Body</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="consoleRequestLogRows.length === 0">
                  <td colspan="4" class="console-log-empty">Waiting for request results...</td>
                </tr>
                <template v-for="row in consoleRequestLogRows" :key="row.id">
                  <tr class="console-log-row" @click="toggleConsoleLogRow(row.id)">
                    <td class="console-log-time">{{ batchSyncFailureMode ? row.backendName : row.time }}</td>
                    <td class="console-log-path">
                      <span v-if="row.method" class="console-log-method">{{ row.method }}</span>
                      <span>{{ row.path }}</span>
                    </td>
                    <td>
                      <span :class="['console-log-status', statusClass(row.statusCode)]">
                        {{ formatConsoleLogStatus(row.statusCode) }}
                      </span>
                    </td>
                    <td class="console-log-body-cell">
                      <button
                        type="button"
                        class="console-log-body-toggle"
                        @click.stop="toggleConsoleLogRow(row.id)"
                      >
                        {{ expandedConsoleLogRowIds.has(row.id) ? 'Hide' : 'Show' }}
                      </button>
                      <code>{{ formatConsoleLogPreview(row.body) }}</code>
                    </td>
                  </tr>
                  <tr v-if="expandedConsoleLogRowIds.has(row.id)" class="console-log-expanded">
                    <td colspan="4">
                      <pre>{{ formatConsoleLogBody(row.body) }}</pre>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
        </div>
      </Modal>
    </div>
  </DefaultLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import Card from '@/components/ui/Card.vue'
import Button from '@/components/ui/Button.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import Modal from '@/components/ui/Modal.vue'
import Pagination from '@/components/ui/Pagination.vue'
import BackendList from '@/components/backends/BackendList.vue'
import BackendForm from '@/components/backends/BackendForm.vue'
import { useBackendsStore } from '@/stores/backends'
import { useSettingsStore } from '@/stores/settings'
import {
  backendsApi,
  proxiesApi,
  type Backend,
  type BackendConsoleRequestLog,
  type CreateBackendRequest,
  type SocksProxy,
} from '@/api'
import {
  formatModelMappingForInput,
  normalizeBackendProxyId,
  parseModelMappingInput,
} from '@/components/backends/backendPayload'
import {
  canSyncBackendConsole,
  runBackendConsoleSyncBatch,
  type BackendConsoleSyncBatchResult,
} from './backendsBatchSync'

type BackendConsoleActionKind = 'sync'

interface ConsoleRequestLogRow {
  id: string
  backendId: number
  backendName: string
  action: BackendConsoleActionKind
  actionLabel: string
  time: string
  method?: string
  path: string
  statusCode: number | null
  body: string
}

const backendsStore = useBackendsStore()
const settingsStore = useSettingsStore()

const backends = computed(() => backendsStore.backends)
const loading = computed(() => backendsStore.loading)
const error = computed(() => backendsStore.error)
const focusModelPatterns = computed(() => settingsStore.config?.focus_models || '')

const searchQuery = ref('')
const statusFilter = ref('')
const modelFilter = ref('')
const proxies = ref<SocksProxy[]>([])
const currentPage = ref(1)
const pageSize = ref(25)

const showCreateModal = ref(false)
const showEditModal = ref(false)
const showDeleteModal = ref(false)
const editingBackend = ref<Backend | null>(null)
const deletingBackend = ref<Backend | null>(null)
const submitting = ref(false)
const exporting = ref(false)
const importing = ref(false)
const syncingAllBackends = ref(false)
const importFileInput = ref<HTMLInputElement | null>(null)
const runningConsoleSyncIds = ref<Set<number>>(new Set())
const showConsoleActionLogModal = ref(false)
const consoleActionLogTitle = ref('')
const consoleRequestLogRows = ref<ConsoleRequestLogRow[]>([])
const expandedConsoleLogRowIds = ref<Set<string>>(new Set())
const nextConsoleRequestLogRowId = ref(0)
const batchSyncFailureMode = ref(false)

const filteredBackends = computed(() => {
  let result = backends.value

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(b =>
      b.name.toLowerCase().includes(query) ||
      b.base_url.toLowerCase().includes(query)
    )
  }

  if (statusFilter.value) {
    result = result.filter(b => b.status === statusFilter.value)
  }

  if (modelFilter.value) {
    const keyword = modelFilter.value.toLowerCase()
    result = result.filter(b =>
      b.models && b.models.some(m => m.toLowerCase().includes(keyword))
    )
  }

  return result
})

const syncableBackends = computed(() => backends.value.filter(canSyncBackendConsole))

const totalPages = computed(() => {
  return Math.ceil(filteredBackends.value.length / pageSize.value)
})

const paginatedBackends = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredBackends.value.slice(start, end)
})

const refreshBackends = async () => {
  await backendsStore.fetchBackends()
}

const exportBackends = async () => {
  try {
    exporting.value = true
    const payload = await backendsApi.exportAll()
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'token-gate-backends.json'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  } catch (err: any) {
    alert(err.response?.data?.error || err.message || 'Export failed')
  } finally {
    exporting.value = false
  }
}

const openImportPicker = () => {
  importFileInput.value?.click()
}

const handleImportFile = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  try {
    importing.value = true
    const payload = JSON.parse(await file.text())
    const response = await backendsApi.importAll(payload)
    alert(`Imported ${response.imported} backends`)
    await refreshBackends()
    currentPage.value = 1
  } catch (err: any) {
    alert(err.response?.data?.error || err.message || 'Import failed')
  } finally {
    importing.value = false
  }
}

const handlePageChange = (page: number) => {
  currentPage.value = page
}

const handlePageSizeChange = () => {
  currentPage.value = 1
}

const handleSearch = () => {
  currentPage.value = 1
}

const handleFilterChange = () => {
  currentPage.value = 1
}

const loadProxies = async () => {
  try {
    const response = await proxiesApi.list()
    proxies.value = response.items
  } catch (err) {
    console.error('Failed to load proxies:', err)
  }
}

const handleEdit = (backend: Backend) => {
  editingBackend.value = backend
  showEditModal.value = true
}

const handleDelete = (backend: Backend) => {
  deletingBackend.value = backend
  showDeleteModal.value = true
}

const handleToggleStatus = async (backend: Backend) => {
  const nextStatus = (() => {
    switch (backend.status) {
      case 'normal': return 'disabled'
      case 'disabled': return 'normal'
      case 'abnormal': return 'disabled'
      default: return 'disabled'
    }
  })()
  try {
    await backendsApi.update(backend.id, {
      name: backend.name,
      backend_type: backend.backend_type ?? 'new-api',
      base_url: backend.base_url,
      api_key: backend.api_key || '',
      console_url: backend.console_url || '',
      console_cookie: backend.console_cookie || '',
      tags: backend.tags || [],
      console_username: backend.console_username || '',
      console_password: backend.console_password || '',
      notes: backend.notes || '',
      status: nextStatus,
      weight: backend.weight,
      models: backend.models || [],
      model_mapping: parseModelMappingInput(formatModelMappingForInput(backend.model_mapping)),
      protocol: backend.protocol,
      proxy_id: normalizeBackendProxyId(backend),
    })
    await backendsStore.fetchBackends()
  } catch (err: any) {
    alert(err.message || 'Status update failed')
  }
}

const setConsoleSyncRunning = (backendId: number, running: boolean) => {
  const next = new Set(runningConsoleSyncIds.value)
  if (running) {
    next.add(backendId)
  } else {
    next.delete(backendId)
  }
  runningConsoleSyncIds.value = next
}

const consoleActionLabel = () => {
  return '同步'
}

const openConsoleActionLog = (backend: Backend) => {
  batchSyncFailureMode.value = false
  consoleActionLogTitle.value = `${backend.name} · ${consoleActionLabel()}`
  consoleRequestLogRows.value = []
  expandedConsoleLogRowIds.value = new Set()
  showConsoleActionLogModal.value = true
}

const showBatchSyncFailures = (result: BackendConsoleSyncBatchResult) => {
  batchSyncFailureMode.value = true
  consoleActionLogTitle.value = `批量同步结果 — 失败 ${result.failureCount}/${result.total}`
  expandedConsoleLogRowIds.value = new Set()

  const rows: ConsoleRequestLogRow[] = result.failures.map((entry) => {
    const err = entry.error as any
    const requests: BackendConsoleRequestLog[] | undefined = err?.response?.data?.requests
    const failedRequest = Array.isArray(requests) && requests.length > 0
      ? requests[requests.length - 1]
      : null

    const method = failedRequest?.method || 'POST'
    const path = failedRequest?.path || actionAdminPath(entry.backend)
    const statusCode = failedRequest?.status_code ?? err?.response?.status ?? null
    const body = failedRequest?.body || stringifyConsoleBody(normalizeConsoleActionError(err))

    return {
      id: `batch-fail-${entry.backend.id}-${nextConsoleRequestLogRowId.value++}`,
      backendId: entry.backend.id,
      backendName: entry.backend.name,
      action: 'sync' as BackendConsoleActionKind,
      actionLabel: consoleActionLabel(),
      time: '',
      method,
      path,
      statusCode: Number.isFinite(statusCode) ? statusCode : null,
      body,
    }
  })

  consoleRequestLogRows.value = rows
  showConsoleActionLogModal.value = true
}

const normalizeConsoleActionError = (err: any) => {
  if (err?.response?.data) {
    return err.response.data
  }
  if (err?.message) {
    return { message: err.message }
  }
  return { message: 'Unknown console request error' }
}

const stringifyConsoleBody = (value: unknown) => {
  if (typeof value === 'string') {
    return value
  }
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

const formatConsoleLogTime = (value: string) => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value || new Date().toLocaleString()
  }
  return parsed.toLocaleString()
}

const actionAdminPath = (backend: Backend) => {
  return `/admin/api/backends/${backend.id}/console/sync`
}

const fallbackConsoleRequestLog = (
  backend: Backend,
  statusCode: number | null,
  body: unknown
): BackendConsoleRequestLog => ({
  time: new Date().toISOString(),
  method: 'POST',
  path: actionAdminPath(backend),
  status_code: statusCode ?? 0,
  body: stringifyConsoleBody(body),
})

const extractConsoleRequestLogs = (
  requests: BackendConsoleRequestLog[] | undefined,
  backend: Backend,
  fallback?: BackendConsoleRequestLog
): ConsoleRequestLogRow[] => {
  const source = Array.isArray(requests) && requests.length > 0
    ? requests
    : fallback
      ? [fallback]
      : []

  return source.map((request) => ({
    id: `${backend.id}-sync-${nextConsoleRequestLogRowId.value++}`,
    backendId: backend.id,
    backendName: backend.name,
    action: 'sync',
    actionLabel: consoleActionLabel(),
    time: formatConsoleLogTime(request.time),
    method: request.method,
    path: request.path,
    statusCode: Number.isFinite(request.status_code) ? request.status_code : null,
    body: request.body || '',
  }))
}

const setConsoleRequestLogRows = (rows: ConsoleRequestLogRow[]) => {
  consoleRequestLogRows.value = rows
  expandedConsoleLogRowIds.value = new Set()
}

const appendConsoleRequestLogRows = (rows: ConsoleRequestLogRow[]) => {
  if (rows.length === 0) return
  consoleRequestLogRows.value = [...consoleRequestLogRows.value, ...rows]
}

const toggleConsoleLogRow = (id: string) => {
  const next = new Set(expandedConsoleLogRowIds.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  expandedConsoleLogRowIds.value = next
}

const formatConsoleLogBody = (body: string) => {
  const text = body || ''
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return text
  }
}

const formatConsoleLogPreview = (body: string) => {
  const text = body ? body.replace(/\s+/g, ' ').trim() : ''
  if (text.length <= 140) {
    return text
  }
  return `${text.slice(0, 140)}...`
}

const formatConsoleLogStatus = (statusCode: number | null) => {
  return statusCode && statusCode > 0 ? String(statusCode) : 'No response'
}

const statusClass = (statusCode: number | null) => {
  if (!statusCode) return 'status-none'
  if (statusCode >= 200 && statusCode < 300) return 'status-success'
  if (statusCode >= 400) return 'status-error'
  return 'status-other'
}

const clearConsoleRequestLogRows = () => {
  consoleRequestLogRows.value = []
  expandedConsoleLogRowIds.value = new Set()
}

const syncBackendConsole = async (backend: Backend) => {
  setConsoleSyncRunning(backend.id, true)
  openConsoleActionLog(backend)
  try {
    const response = await backendsApi.syncConsoleStream(backend.id, (request) => {
      appendConsoleRequestLogRows(extractConsoleRequestLogs([request], backend))
    })
    if (consoleRequestLogRows.value.length === 0) {
      setConsoleRequestLogRows(extractConsoleRequestLogs(response.requests, backend))
    }
    await refreshBackends()
  } catch (err: any) {
    const errorPayload = normalizeConsoleActionError(err)
    const fallback = fallbackConsoleRequestLog(backend, err?.response?.status ?? null, errorPayload)
    if (consoleRequestLogRows.value.length === 0) {
      setConsoleRequestLogRows(extractConsoleRequestLogs(errorPayload.requests, backend, fallback))
    }
    throw err
  } finally {
    setConsoleSyncRunning(backend.id, false)
  }
}

const handleConsoleSync = async (backend: Backend) => {
  try {
    await syncBackendConsole(backend)
  } catch {
    // The request log modal already contains the failure details.
  }
}

const handleSyncAllBackends = async () => {
  if (!syncableBackends.value.length || syncingAllBackends.value) return

  syncingAllBackends.value = true
  try {
    const result = await runBackendConsoleSyncBatch({
      backends: backends.value,
      syncBackend: syncBackendConsole,
    })
    await refreshBackends()
    if (result.failureCount > 0) {
      showBatchSyncFailures(result)
    }
  } catch (err: any) {
    alert(err?.message || '批量同步失败')
  } finally {
    syncingAllBackends.value = false
  }
}

const handleSubmit = async (data: CreateBackendRequest) => {
  try {
    submitting.value = true
    if (editingBackend.value) {
      await backendsStore.updateBackend(editingBackend.value.id, data)
    } else {
      await backendsStore.createBackend(data)
    }
    closeModals()
  } catch (err: any) {
    alert(err.message || 'Operation failed')
  } finally {
    submitting.value = false
  }
}

const confirmDelete = async () => {
  if (!deletingBackend.value) return
  try {
    submitting.value = true
    await backendsStore.deleteBackend(deletingBackend.value.id)
    showDeleteModal.value = false
    deletingBackend.value = null
  } catch (err: any) {
    alert(err.message || 'Delete failed')
  } finally {
    submitting.value = false
  }
}

const closeModals = () => {
  showCreateModal.value = false
  showEditModal.value = false
  editingBackend.value = null
}

onMounted(() => {
  refreshBackends()
  loadProxies()
  settingsStore.fetchConfig()
})
</script>

<style scoped>
.backends-page {
  max-width: 1400px;
}

.file-input {
  display: none;
}

.filters-card {
  margin-bottom: var(--spacing-xl);
}

.console-log-modal {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.console-log-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
}

.console-log-context {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  color: var(--text-secondary);
  font-size: 13px;
}

.console-log-context strong {
  color: var(--text-primary);
  font-size: 14px;
}

.console-log-table-wrap {
  max-height: 62vh;
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}

.console-log-table {
  width: 100%;
  min-width: 760px;
  border-collapse: collapse;
  table-layout: fixed;
  color: var(--text-primary);
  font-size: 13px;
}

.console-log-table th,
.console-log-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  text-align: left;
  vertical-align: top;
}

.console-log-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--bg-subtle);
  color: var(--text-secondary);
  font-weight: 600;
}

.console-log-table th:nth-child(1),
.console-log-table td:nth-child(1) {
  width: 190px;
}

.console-log-table th:nth-child(2),
.console-log-table td:nth-child(2) {
  width: 230px;
}

.console-log-table th:nth-child(3),
.console-log-table td:nth-child(3) {
  width: 120px;
}

.console-log-row {
  cursor: pointer;
}

.console-log-row:hover {
  background: var(--bg-muted);
}

.console-log-time {
  color: var(--text-secondary);
  white-space: nowrap;
}

.console-log-path {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  min-width: 0;
}

.console-log-path span:last-child {
  overflow-wrap: anywhere;
}

.console-log-method {
  flex: 0 0 auto;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  background: var(--bg-muted);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 700;
}

.console-log-status {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  background: var(--bg-muted);
  color: var(--text-secondary);
  font-weight: 700;
}

.status-success {
  background: rgba(22, 163, 74, 0.1);
  color: var(--success);
}

.status-error {
  background: rgba(239, 68, 68, 0.1);
  color: var(--danger);
}

.status-other,
.status-none {
  background: var(--bg-muted);
  color: var(--text-secondary);
}

.console-log-body-cell {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
  min-width: 0;
}

.console-log-body-cell code {
  display: block;
  min-width: 0;
  overflow: hidden;
  color: var(--text-secondary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  line-height: 1.5;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.console-log-body-toggle {
  flex: 0 0 auto;
  min-width: 48px;
  min-height: 26px;
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-base);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
}

.console-log-body-toggle:hover {
  border-color: var(--accent-primary);
}

.console-log-expanded td {
  padding: 0;
  background: var(--bg-subtle);
}

.console-log-expanded pre {
  max-height: 360px;
  margin: 0;
  padding: var(--spacing-md);
  overflow: auto;
  color: var(--text-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.console-log-empty {
  height: 96px;
  color: var(--text-secondary);
  text-align: center;
  vertical-align: middle;
}

.filters {
  display: flex;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--spacing-md);
  align-items: flex-end;
}

.search-input,
.filter-select {
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 14px;
  color: var(--text-primary);
  background: var(--bg-base);
  transition: all 150ms ease;
}

.search-input {
  flex: 1;
  min-width: 200px;
}

.search-input:focus,
.filter-select:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px rgba(0, 112, 243, 0.1);
}

.filter-select {
  width: 150px;
}

.model-filter-input {
  width: 170px;
}

.delete-confirmation {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.delete-confirmation p {
  margin: 0;
  font-size: 14px;
  color: var(--text-primary);
}

.warning-text {
  color: var(--danger);
  font-weight: 500;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-md);
  margin-top: var(--spacing-lg);
}

.filter-group {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.filter-label {
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.backends-footer {
  display: flex;
  justify-content: center;
  padding: var(--spacing-lg) 0;
}

.backends-count {
  font-size: 13px;
  color: var(--text-secondary);
}
</style>
