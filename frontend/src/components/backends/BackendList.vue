<template>
  <div class="backend-list">
    <div v-if="backends.length === 0" class="empty-state">
      <EmptyState
        icon="🔌"
        title="No backends configured"
        description="Add your first AI backend to get started"
      >
        <template #action>
          <Button @click="$emit('create')">Add Backend</Button>
        </template>
      </EmptyState>
    </div>

    <div v-else class="backend-grid">
      <div
        v-for="backend in backends"
        :key="backend.id"
        class="backend-card"
        :class="getStatusClass(backend.status)"
      >
        <div class="backend-header">
          <div class="backend-title">
            <h3>{{ backend.name }}</h3>
            <StatusBadge
              :variant="getStatusVariant(backend.status)"
              :label="backend.status"
            />
          </div>
          <div class="backend-actions">
            <button
              class="icon-button"
              title="Edit"
              @click="$emit('edit', backend)"
            >
              ✏️
            </button>
            <button
              class="icon-button"
              title="Delete"
              @click="$emit('delete', backend)"
            >
              🗑️
            </button>
          </div>
        </div>

        <div class="backend-info">
          <div class="info-item">
            <span class="info-label">Base URL:</span>
            <span class="info-value">{{ backend.base_url }}</span>
          </div>
          <div v-if="backend.tags && backend.tags.length > 0" class="info-item">
            <span class="info-label">Tags:</span>
            <span class="info-value">
              <span v-for="tag in backend.tags" :key="tag" class="tag">{{ tag }}</span>
            </span>
          </div>
          <div v-if="backend.models && backend.models.length > 0" class="info-item">
            <span class="info-label">Models:</span>
            <span class="info-value">{{ backend.models.join(', ') }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Weight:</span>
            <span class="info-value">{{ backend.weight }}</span>
          </div>
        </div>

        <div class="backend-stats">
          <div class="stat-item">
            <span class="stat-label">Requests</span>
            <span class="stat-value">{{ backend.request_count || 0 }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Avg Latency</span>
            <span class="stat-value">
              {{ backend.avg_latency_ms ? `${backend.avg_latency_ms.toFixed(0)}ms` : 'N/A' }}
            </span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Failures</span>
            <span class="stat-value error-count">{{ backend.consecutive_failures || 0 }}</span>
          </div>
        </div>

        <div class="backend-footer">
          <span class="footer-text">
            Updated {{ formatTime(backend.updated_at) }}
          </span>
          <router-link :to="`/backends/${backend.id}`" class="detail-link">
            View Details →
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import StatusBadge from '@/components/ui/StatusBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Button from '@/components/ui/Button.vue'
import type { Backend } from '@/api'

interface Props {
  backends: Backend[]
}

defineProps<Props>()

const emit = defineEmits<{
  create: []
  edit: [backend: Backend]
  delete: [backend: Backend]
}>()

const getStatusVariant = (status: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  switch (status) {
    case 'normal':
      return 'success'
    case 'abnormal':
      return 'warning'
    case 'disable':
      return 'default'
    default:
      return 'default'
  }
}

const getStatusClass = (status: string): string => {
  switch (status) {
    case 'normal':
      return 'status-normal'
    case 'abnormal':
      return 'status-abnormal'
    case 'disable':
      return 'status-disable'
    default:
      return ''
  }
}

const formatTime = (timestamp: string) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}
</script>

<style scoped>
.backend-list {
  width: 100%;
}

.empty-state {
  padding: var(--spacing-2xl) 0;
}

.backend-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: var(--spacing-lg);
}

.backend-card {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  background: var(--bg-base);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  transition: all 150ms ease;
}

.backend-card:hover {
  border-color: var(--border-hover);
  box-shadow: var(--shadow-sm);
}

.backend-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--spacing-md);
}

.backend-title {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  flex: 1;
  min-width: 0;
}

.backend-title h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.backend-actions {
  display: flex;
  gap: var(--spacing-xs);
}

.icon-button {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: var(--bg-subtle);
  border-radius: var(--radius-sm);
  font-size: 16px;
  cursor: pointer;
  transition: all 150ms ease;
}

.icon-button:hover {
  background: var(--bg-muted);
  transform: scale(1.05);
}

.backend-info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.info-item {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}

.info-label {
  color: var(--text-secondary);
}

.info-value {
  color: var(--text-primary);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.backend-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-md);
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--border);
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-label {
  font-size: 11px;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.error-count {
  color: var(--danger);
}

.backend-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--border);
}

.footer-text {
  font-size: 12px;
  color: var(--text-tertiary);
}

.detail-link {
  font-size: 13px;
  color: var(--accent-primary);
  text-decoration: none;
  font-weight: 500;
  transition: opacity 150ms ease;
}

.detail-link:hover {
  opacity: 0.8;
}

/* Status background colors */
.status-normal {
  background: rgba(16, 185, 129, 0.05);
  border-color: rgba(16, 185, 129, 0.2);
}

.status-abnormal {
  background: rgba(245, 158, 11, 0.05);
  border-color: rgba(245, 158, 11, 0.2);
}

.status-disable {
  background: rgba(148, 163, 184, 0.05);
  border-color: rgba(148, 163, 184, 0.2);
  opacity: 0.7;
}

/* Tag styles */
.tag {
  display: inline-block;
  padding: 2px 8px;
  margin-right: 4px;
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--text-secondary);
}
</style>
