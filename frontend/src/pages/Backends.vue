<template>
  <DefaultLayout>
    <div class="backends-page">
      <div class="page-header">
        <div>
          <h1>Backends</h1>
          <p class="page-description">Manage AI backend configurations and routing</p>
        </div>
        <Button @click="showCreateModal = true" size="md">
          ➕ Add Backend
        </Button>
      </div>

      <!-- Search & Filters -->
      <Card class="filters-card">
        <div class="filters">
          <input
            v-model="searchQuery"
            type="text"
            class="search-input"
            placeholder="Search backends..."
          />
          <select v-model="statusFilter" class="filter-select">
            <option value="">All Status</option>
            <option value="normal">Normal</option>
            <option value="abnormal">Abnormal</option>
            <option value="disable">Disable</option>
          </select>
          <Button
            variant="secondary"
            size="sm"
            @click="refreshBackends"
            :loading="loading"
          >
            🔄 Refresh
          </Button>
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
        :backends="filteredBackends"
        @create="showCreateModal = true"
        @edit="handleEdit"
        @delete="handleDelete"
      />

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
import BackendList from '@/components/backends/BackendList.vue'
import BackendForm from '@/components/backends/BackendForm.vue'
import { useBackendsStore } from '@/stores/backends'
import { proxiesApi, type Backend, type CreateBackendRequest, type SocksProxy } from '@/api'

const backendsStore = useBackendsStore()

const backends = computed(() => backendsStore.backends)
const loading = computed(() => backendsStore.loading)
const error = computed(() => backendsStore.error)

const searchQuery = ref('')
const statusFilter = ref('')
const proxies = ref<SocksProxy[]>([])

const showCreateModal = ref(false)
const showEditModal = ref(false)
const showDeleteModal = ref(false)
const editingBackend = ref<Backend | null>(null)
const deletingBackend = ref<Backend | null>(null)
const submitting = ref(false)

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

const refreshBackends = async () => {
  await backendsStore.fetchBackends()
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

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing-2xl);
  gap: var(--spacing-lg);
}

.page-header h1 {
  font-size: 32px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 var(--spacing-xs) 0;
}

.page-description {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
}

.filters-card {
  margin-bottom: var(--spacing-xl);
}

.filters {
  display: flex;
  gap: var(--spacing-md);
  align-items: center;
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
</style>
