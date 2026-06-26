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
            Export
          </Button>
          <Button variant="secondary" size="sm" :loading="importing" @click="openImportPicker">
            Import
          </Button>
          <Button variant="secondary" size="sm"  @click="showCreateModal = true">
            ➕ Add
          </Button>
          <Button variant="secondary" size="sm" @click="refreshBackends" :loading="loading">
            🔄 Refresh
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
        @create="showCreateModal = true"
        @edit="handleEdit"
        @delete="handleDelete"
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
        :title="editingBackend ? 'Edit Backend' : 'Create Backend'"
        width="700px"
        @close="closeModals"
      >
        <BackendForm
          :backend="editingBackend"
          :proxies="proxies"
          :loading="submitting"
          :submit-label="editingBackend ? 'Update Backend' : 'Create Backend'"
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
import { backendsApi, proxiesApi, type Backend, type CreateBackendRequest, type SocksProxy } from '@/api'

const backendsStore = useBackendsStore()

const backends = computed(() => backendsStore.backends)
const loading = computed(() => backendsStore.loading)
const error = computed(() => backendsStore.error)

const searchQuery = ref('')
const statusFilter = ref('')
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
const importFileInput = ref<HTMLInputElement | null>(null)

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

  return result
})

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
      base_url: backend.base_url,
      api_key: backend.api_key || '',
      status: nextStatus,
      weight: backend.weight,
      models: backend.models,
      tags: backend.tags,
      protocol: backend.protocol,
      proxy_id: backend.proxy?.id || 0,
    } as any)
    await backendsStore.fetchBackends()
  } catch (err: any) {
    alert(err.message || 'Status update failed')
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
