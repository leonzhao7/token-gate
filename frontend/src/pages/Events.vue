<template>
  <DefaultLayout>
    <div class="events-page">

      <!-- Filters -->
      <Card class="filters-card">
        <div class="filters">
          <div class="filter-group">
            <label class="filter-label">Resource Type</label>
            <select v-model="filters.resource_type" class="filter-select" @change="applyFilters">
              <option value="">All Resources</option>
              <option value="backend">Backend</option>
              <option value="socks_proxy">SOCKS Proxy</option>
              <option value="client_key">Client Key</option>
              <option value="config">Config</option>
            </select>
          </div>

          <div class="filter-group">
            <label class="filter-label">Action</label>
            <select v-model="filters.action" class="filter-select" @change="applyFilters">
              <option value="">All Actions</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
            </select>
          </div>

          <div class="filter-group">
            <label class="filter-label">Time Range</label>
            <select v-model="filters.time_range" class="filter-select" @change="applyFilters">
              <option value="1h">Last Hour</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>

          <div class="filter-group">
            <label class="filter-label">Per Page</label>
            <select v-model.number="pageSize" class="filter-select" @change="handlePageSizeChange">
              <option :value="25">25</option>
              <option :value="50">50</option>
              <option :value="100">100</option>
            </select>
          </div>
          <Button variant="secondary" size="sm" @click="showClearModal = true">
            <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor"><path d="M120-280v-80h560v80H120Zm80-160v-80h560v80H200Zm80-160v-80h560v80H280Z"/></svg>
            Clear
          </Button>
          <Button variant="secondary" size="sm" @click="refreshEvents" :loading="loading">
            <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor"><path d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z"/></svg>
            Refresh
          </Button>
        </div>
      </Card>

      <!-- Loading State -->
      <LoadingSpinner v-if="loading && !events.length" message="Loading events..." />

      <!-- Error State -->
      <Card v-else-if="error">
        <EmptyState icon="⚠️" title="Failed to load events" :description="error">
          <template #action>
            <Button @click="refreshEvents">Retry</Button>
          </template>
        </EmptyState>
      </Card>

      <!-- Events Timeline -->
      <template v-else>
        <Card class="timeline-card">
          <EventsTimeline :events="events" />
        </Card>

        <Pagination
          v-if="totalPages > 1"
          :current-page="currentPage"
          :total-pages="totalPages"
          @change="handlePageChange"
        />

        <div class="events-footer">
          <span class="events-count">
            Showing {{ events.length }} of {{ total }} events
          </span>
        </div>
      </template>

      <Modal
        :show="showClearModal"
        title="Clear Events"
        width="500px"
        @close="showClearModal = false"
      >
        <div class="clear-confirmation">
          <p>Are you sure you want to clear all audit events?</p>
          <p class="warning-text">This permanently deletes every event, not just the current page or filters.</p>
          <div class="modal-actions">
            <Button variant="secondary" @click="showClearModal = false">
              Cancel
            </Button>
            <Button variant="danger" :loading="clearing" @click="confirmClearEvents">
              Clear Events
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
import EventsTimeline from '@/components/events/EventsTimeline.vue'
import { useEventsStore } from '@/stores/events'

const eventsStore = useEventsStore()

const events = computed(() => eventsStore.events)
const total = computed(() => eventsStore.total)
const currentPage = computed(() => eventsStore.page)
const loading = computed(() => eventsStore.loading)
const error = computed(() => eventsStore.error)

const pageSize = ref(50)
const showClearModal = ref(false)
const clearing = ref(false)
const filters = ref({
  resource_type: '',
  action: '',
  time_range: '24h'
})

const totalPages = computed(() => Math.ceil(total.value / pageSize.value))

const applyFilters = () => {
  eventsStore.setPage(1)
  refreshEvents()
}

const refreshEvents = async () => {
  await eventsStore.fetchEvents(filters.value)
}

const handlePageChange = (page: number) => {
  eventsStore.setPage(page)
  refreshEvents()
}

const handlePageSizeChange = () => {
  eventsStore.setLimit(pageSize.value)
  refreshEvents()
}

const confirmClearEvents = async () => {
  try {
    clearing.value = true
    await eventsStore.clearEvents()
    showClearModal.value = false
    await refreshEvents()
  } catch (err: any) {
    alert(err.message || 'Clear events failed')
  } finally {
    clearing.value = false
  }
}

onMounted(() => {
  eventsStore.setLimit(pageSize.value)
  refreshEvents()
})
</script>

<style scoped>
.events-page {
  max-width: 1200px;
}

.filters-card {
  margin-bottom: var(--spacing-xl);
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-lg);
  align-items: flex-end;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.filter-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.filter-select {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 14px;
  color: var(--text-primary);
  background: var(--bg-base);
  transition: all 150ms ease;
}

.filter-select:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px rgba(0, 112, 243, 0.1);
}

.timeline-card {
  margin-bottom: var(--spacing-lg);
}

.events-footer {
  display: flex;
  justify-content: center;
  padding: var(--spacing-lg) 0;
}

.events-count {
  font-size: 14px;
  color: var(--text-secondary);
}

.clear-confirmation {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.clear-confirmation p {
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
