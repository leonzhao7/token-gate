<template>
  <DefaultLayout>
    <div class="client-keys-page">
      <div class="page-header">
        <div>
          <h1>Client Keys</h1>
          <p class="page-description">Manage API keys for client applications</p>
        </div>
        <Button @click="showCreateModal = true" size="md">
          ➕ Create Key
        </Button>
      </div>

      <!-- Search & Filters -->
      <Card class="filters-card">
        <div class="filters">
          <input
            v-model="searchQuery"
            type="text"
            class="search-input"
            placeholder="Search keys..."
          />
          <select v-model="statusFilter" class="filter-select">
            <option value="">All Keys</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
            <option value="expired">Expired</option>
          </select>
          <Button
            variant="secondary"
            size="sm"
            @click="refreshKeys"
            :loading="loading"
          >
            🔄 Refresh
          </Button>
        </div>
      </Card>

      <!-- Loading State -->
      <LoadingSpinner v-if="loading && !clientKeys.length" message="Loading client keys..." />

      <!-- Error State -->
      <Card v-else-if="error">
        <EmptyState icon="⚠️" title="Failed to load client keys" :description="error">
          <template #action>
            <Button @click="refreshKeys">Retry</Button>
          </template>
        </EmptyState>
      </Card>

      <!-- Client Key List -->
      <ClientKeyList
        v-else
        :client-keys="filteredKeys"
        @create="showCreateModal = true"
        @edit="handleEdit"
        @delete="handleDelete"
      />

      <!-- Create/Edit Modal -->
      <Modal
        :show="showCreateModal || showEditModal"
        :title="editingKey ? 'Edit Client Key' : 'Create Client Key'"
        width="650px"
        @close="closeModals"
      >
        <ClientKeyForm
          :client-key="editingKey"
          :loading="submitting"
          :submit-label="editingKey ? 'Update Key' : 'Create Key'"
          @submit="handleSubmit"
          @cancel="closeModals"
        />
      </Modal>

      <!-- Delete Confirmation Modal -->
      <Modal
        :show="showDeleteModal"
        title="Delete Client Key"
        width="500px"
        @close="showDeleteModal = false"
      >
        <div class="delete-confirmation">
          <p>Are you sure you want to delete <strong>{{ deletingKey?.name }}</strong>?</p>
          <p class="warning-text">This will immediately revoke access for all applications using this key.</p>
          <div class="modal-actions">
            <Button variant="secondary" @click="showDeleteModal = false">
              Cancel
            </Button>
            <Button variant="danger" :loading="submitting" @click="confirmDelete">
              Delete Key
            </Button>
          </div>
        </div>
      </Modal>

      <!-- Token Display Modal -->
      <Modal
        :show="showTokenModal"
        title="🎉 Client Key Created"
        width="600px"
        :close-on-overlay="false"
        @close="showTokenModal = false"
      >
        <div class="token-display">
          <p class="token-warning">⚠️ Copy this token now. You won't be able to see it again!</p>
          <div class="token-box">
            <code class="token-text">{{ newToken }}</code>
            <Button size="sm" @click="copyNewToken">📋 Copy</Button>
          </div>
          <div class="modal-actions">
            <Button @click="showTokenModal = false">Done</Button>
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
import ClientKeyList from '@/components/clientKeys/ClientKeyList.vue'
import ClientKeyForm from '@/components/clientKeys/ClientKeyForm.vue'
import { useClientKeysStore } from '@/stores/clientKeys'
import type { ClientKey, CreateClientKeyRequest } from '@/api'

const clientKeysStore = useClientKeysStore()

const clientKeys = computed(() => clientKeysStore.clientKeys)
const loading = computed(() => clientKeysStore.loading)
const error = computed(() => clientKeysStore.error)

const searchQuery = ref('')
const statusFilter = ref('')

const showCreateModal = ref(false)
const showEditModal = ref(false)
const showDeleteModal = ref(false)
const showTokenModal = ref(false)
const editingKey = ref<ClientKey | null>(null)
const deletingKey = ref<ClientKey | null>(null)
const newToken = ref('')
const submitting = ref(false)

const filteredKeys = computed(() => {
  let result = clientKeys.value

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(k =>
      k.name.toLowerCase().includes(query) ||
      k.description?.toLowerCase().includes(query)
    )
  }

  if (statusFilter.value === 'active') {
    result = result.filter(k => k.enabled && (!k.expires_at || new Date(k.expires_at) > new Date()))
  } else if (statusFilter.value === 'disabled') {
    result = result.filter(k => !k.enabled)
  } else if (statusFilter.value === 'expired') {
    result = result.filter(k => k.expires_at && new Date(k.expires_at) <= new Date())
  }

  return result
})

const refreshKeys = async () => {
  await clientKeysStore.fetchClientKeys()
}

const handleEdit = (key: ClientKey) => {
  editingKey.value = key
  showEditModal.value = true
}

const handleDelete = (key: ClientKey) => {
  deletingKey.value = key
  showDeleteModal.value = true
}

const handleSubmit = async (data: CreateClientKeyRequest) => {
  try {
    submitting.value = true
    if (editingKey.value) {
      await clientKeysStore.updateClientKey(editingKey.value.id, data)
      closeModals()
    } else {
      const created = await clientKeysStore.createClientKey(data)
      newToken.value = created.token
      closeModals()
      showTokenModal.value = true
    }
  } catch (err: any) {
    alert(err.message || 'Operation failed')
  } finally {
    submitting.value = false
  }
}

const confirmDelete = async () => {
  if (!deletingKey.value) return
  try {
    submitting.value = true
    await clientKeysStore.deleteClientKey(deletingKey.value.id)
    showDeleteModal.value = false
    deletingKey.value = null
  } catch (err: any) {
    alert(err.message || 'Delete failed')
  } finally {
    submitting.value = false
  }
}

const copyNewToken = async () => {
  try {
    await navigator.clipboard.writeText(newToken.value)
    alert('Token copied to clipboard!')
  } catch (err) {
    console.error('Failed to copy token:', err)
    alert('Failed to copy token')
  }
}

const closeModals = () => {
  showCreateModal.value = false
  showEditModal.value = false
  editingKey.value = null
}

onMounted(() => {
  refreshKeys()
})
</script>

<style scoped>
.client-keys-page {
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

.delete-confirmation,
.token-display {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.delete-confirmation p,
.token-display p {
  margin: 0;
  font-size: 14px;
  color: var(--text-primary);
}

.warning-text {
  color: var(--danger);
  font-weight: 500;
}

.token-warning {
  color: var(--warning);
  font-weight: 600;
  padding: var(--spacing-md);
  background: rgba(245, 158, 11, 0.1);
  border-radius: var(--radius-md);
}

.token-box {
  display: flex;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--bg-muted);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}

.token-text {
  flex: 1;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 13px;
  color: var(--text-primary);
  word-break: break-all;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-md);
  margin-top: var(--spacing-lg);
}
</style>
