<template>
  <DefaultLayout>
    <div class="events-page">
      <div class="page-header">
        <div>
          <h1>Audit Events</h1>
          <p class="page-description">Track system activity and changes</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          @click="refreshEvents"
          :loading="loading"
        >
          🔄 Refresh
        </Button>
      </div>

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

onMounted(() => {
  eventsStore.setLimit(pageSize.value)
  refreshEvents()
})
</script>

<style scoped>
.events-page {
  max-width: 1200px;
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
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--spacing-lg);
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
</style>
