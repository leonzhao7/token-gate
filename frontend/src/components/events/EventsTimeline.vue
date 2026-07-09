<template>
  <div class="events-table">
    <div v-if="events.length === 0" class="empty-state">
      <EmptyState
        icon="📋"
        title="No events"
        description="System events will appear here as the service runs"
      />
    </div>

    <div v-else class="table-container">
      <table class="logs-table">
        <thead>
          <tr>
            <th></th>
            <th>Time</th>
            <th>Level</th>
            <th>Type</th>
            <th>Category</th>
            <th>Message</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="event in events" :key="event.id">
            <tr class="log-row" @click="toggleExpand(event.id)">
              <td class="expand-cell">
                <button class="expand-button">
                  {{ expandedRows.has(event.id) ? '▼' : '▶' }}
                </button>
              </td>
              <td class="time-cell">
                <div class="time-primary">{{ formatTime(event.created_at) }}</div>
                <div class="time-secondary">{{ formatDate(event.created_at) }}</div>
              </td>
              <td>
                <StatusBadge
                  :variant="getLevelVariant(event.severity || event.level)"
                  :label="event.level || event.severity || ''"
                />
              </td>
              <td>
                <span class="event-type">{{ formatType(event.type) }}</span>
              </td>
              <td>
                <span v-if="event.category" class="category-badge">{{ event.category }}</span>
              </td>
              <td class="message-cell">
                <span class="event-message">{{ event.message }}</span>
              </td>
            </tr>
            <tr v-if="expandedRows.has(event.id)" class="expanded-row">
              <td colspan="6">
                <div class="expanded-content">
                  <div class="detail-grid">
                    <div v-if="event.resource_type" class="detail-item">
                      <span class="detail-label">Resource:</span>
                      <span class="detail-value">{{ event.resource_type }}<template v-if="event.resource_name"> / {{ event.resource_name }}</template></span>
                    </div>
                    <div v-if="event.client_name" class="detail-item">
                      <span class="detail-label">Client:</span>
                      <span class="detail-value">{{ event.client_name }}</span>
                    </div>
                    <div v-if="event.model" class="detail-item">
                      <span class="detail-label">Model:</span>
                      <span class="detail-value">{{ event.model }}</span>
                    </div>
                    <div v-if="event.endpoint" class="detail-item">
                      <span class="detail-label">Endpoint:</span>
                      <code class="detail-value detail-code">{{ event.endpoint }}</code>
                    </div>
                    <div v-if="event.backend_name" class="detail-item">
                      <span class="detail-label">Backend:</span>
                      <span class="detail-value">{{ event.backend_name }}</span>
                    </div>
                    <div v-if="event.ip_address" class="detail-item">
                      <span class="detail-label">IP:</span>
                      <span class="detail-value">{{ event.ip_address }}</span>
                    </div>
                    <div v-if="event.details" class="detail-item full-width">
                      <span class="detail-label">Details:</span>
                      <code class="detail-value detail-code">{{ event.details }}</code>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import type { AuditEvent } from '@/api'

interface Props {
  events: AuditEvent[]
}

defineProps<Props>()

const expandedRows = ref<Set<number>>(new Set())

const toggleExpand = (id: number) => {
  if (expandedRows.value.has(id)) {
    expandedRows.value.delete(id)
  } else {
    expandedRows.value.add(id)
  }
}

const getLevelVariant = (level: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  const l = level?.toLowerCase()
  if (l === 'error') return 'danger'
  if (l === 'warn' || l === 'warning') return 'warning'
  if (l === 'info') return 'info'
  return 'default'
}

const formatType = (type: string): string => {
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

const formatTime = (timestamp: string) => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString()
}

const formatDate = (timestamp: string) => {
  const date = new Date(timestamp)
  return date.toLocaleDateString()
}
</script>

<style scoped>
.events-table {
  width: 100%;
}

.empty-state {
  padding: var(--spacing-2xl) 0;
}

.table-container {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
}

.logs-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--bg-base);
}

.logs-table thead {
  background: var(--bg-subtle);
  border-bottom: 1px solid var(--border);
}

.logs-table th {
  padding: var(--spacing-md);
  text-align: left;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.log-row {
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  transition: background 150ms ease;
}

.log-row:hover {
  background: var(--bg-subtle);
}

.logs-table td {
  padding: var(--spacing-md);
  font-size: 14px;
  color: var(--text-primary);
}

.expand-cell {
  width: 40px;
}

.expand-button {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all 150ms ease;
}

.expand-button:hover {
  background: var(--bg-muted);
}

.time-cell {
  min-width: 120px;
}

.time-primary {
  font-weight: 500;
}

.time-secondary {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 2px;
}

.event-type {
  font-weight: 500;
}

.category-badge {
  font-size: 13px;
  color: var(--text-secondary);
  padding: 2px 8px;
  background: var(--bg-muted);
  border-radius: var(--radius-sm);
}

.message-cell {
  max-width: 400px;
}

.event-message {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.4;
}

.expanded-row {
  background: var(--bg-subtle);
  border-bottom: 1px solid var(--border);
}

.expanded-content {
  padding: var(--spacing-lg);
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--spacing-md);
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-item.full-width {
  grid-column: 1 / -1;
}

.detail-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-value {
  font-size: 14px;
  color: var(--text-primary);
}

.detail-code {
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 13px;
  overflow-wrap: anywhere;
}
</style>
