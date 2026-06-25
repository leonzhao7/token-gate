<template>
  <DefaultLayout>
    <div class="proxies-page">
      <div class="page-header">
        <div>
          <h1>SOCKS Proxies</h1>
          <p class="page-description">Manage SOCKS5 proxies for backend connections</p>
        </div>
        <Button @click="showCreateModal = true" size="md">
          ➕ Add Proxy
        </Button>
      </div>

      <!-- Search -->
      <Card class="filters-card">
        <div class="filters">
          <input
            v-model="searchQuery"
            type="text"
            class="search-input"
            placeholder="Search proxies..."
          />
          <Button
            variant="secondary"
            size="sm"
            @click="refreshProxies"
            :loading="loading"
          >
            🔄 Refresh
          </Button>
        </div>
      </Card>

      <!-- Loading State -->
      <LoadingSpinner v-if="loading && !proxies.length" message="Loading proxies..." />

      <!-- Error State -->
      <Card v-else-if="error">
        <EmptyState icon="⚠️" title="Failed to load proxies" :description="error">
          <template #action>
            <Button @click="refreshProxies">Retry</Button>
          </template>
        </EmptyState>
      </Card>

      <!-- Proxy List -->
      <ProxyList
        v-else
        :proxies="filteredProxies"
        @create="showCreateModal = true"
        @edit="handleEdit"
        @delete="handleDelete"
      />

      <!-- Create/Edit Modal -->
      <Modal
        :show="showCreateModal || showEditModal"
        :title="editingProxy ? 'Edit Proxy' : 'Create Proxy'"
        width="600px"
        @close="closeModals"
      >
        <ProxyForm
          :proxy="editingProxy"
          :loading="submitting"
          :submit-label="editingProxy ? 'Update Proxy' : 'Create Proxy'"
          @submit="handleSubmit"
          @cancel="closeModals"
        />
      </Modal>

      <!-- Delete Confirmation Modal -->
      <Modal
        :show="showDeleteModal"
        title="Delete Proxy"
        width="500px"
        @close="showDeleteModal = false"
      >
        <div class="delete-confirmation">
          <p>Are you sure you want to delete <strong>{{ deletingProxy?.name }}</strong>?</p>
          <p class="warning-text">Backends using this proxy will lose their proxy configuration.</p>
          <div class="modal-actions">
            <Button variant="secondary" @click="showDeleteModal = false">
              Cancel
            </Button>
            <Button variant="danger" :loading="submitting" @click="confirmDelete">
              Delete Proxy
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
import ProxyList from '@/components/proxies/ProxyList.vue'
import ProxyForm from '@/components/proxies/ProxyForm.vue'
import { useProxiesStore } from '@/stores/proxies'
import type { SocksProxy, CreateProxyRequest } from '@/api'

const proxiesStore = useProxiesStore()

const proxies = computed(() => proxiesStore.proxies)
const loading = computed(() => proxiesStore.loading)
const error = computed(() => proxiesStore.error)

const searchQuery = ref('')

const showCreateModal = ref(false)
const showEditModal = ref(false)
const showDeleteModal = ref(false)
const editingProxy = ref<SocksProxy | null>(null)
const deletingProxy = ref<SocksProxy | null>(null)
const submitting = ref(false)

const filteredProxies = computed(() => {
  if (!searchQuery.value) return proxies.value

  const query = searchQuery.value.toLowerCase()
  return proxies.value.filter(p =>
    p.name.toLowerCase().includes(query) ||
    p.address.toLowerCase().includes(query)
  )
})

const refreshProxies = async () => {
  await proxiesStore.fetchProxies()
}

const handleEdit = (proxy: SocksProxy) => {
  editingProxy.value = proxy
  showEditModal.value = true
}

const handleDelete = (proxy: SocksProxy) => {
  deletingProxy.value = proxy
  showDeleteModal.value = true
}

const handleSubmit = async (data: CreateProxyRequest) => {
  try {
    submitting.value = true
    if (editingProxy.value) {
      await proxiesStore.updateProxy(editingProxy.value.id, data)
    } else {
      await proxiesStore.createProxy(data)
    }
    closeModals()
  } catch (err: any) {
    alert(err.message || 'Operation failed')
  } finally {
    submitting.value = false
  }
}

const confirmDelete = async () => {
  if (!deletingProxy.value) return
  try {
    submitting.value = true
    await proxiesStore.deleteProxy(deletingProxy.value.id)
    showDeleteModal.value = false
    deletingProxy.value = null
  } catch (err: any) {
    alert(err.message || 'Delete failed')
  } finally {
    submitting.value = false
  }
}

const closeModals = () => {
  showCreateModal.value = false
  showEditModal.value = false
  editingProxy.value = null
}

onMounted(() => {
  refreshProxies()
})
</script>

<style scoped>
.proxies-page {
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

.search-input {
  flex: 1;
  min-width: 200px;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 14px;
  color: var(--text-primary);
  background: var(--bg-base);
  transition: all 150ms ease;
}

.search-input:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px rgba(0, 112, 243, 0.1);
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
