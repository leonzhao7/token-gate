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

    <div v-else class="backend-table">
      <!-- Table Header -->
      <div class="table-header">
        <div class="col col-name">Name</div>
        <div class="col col-status">Status</div>
        <div class="col col-protocol">Protocol</div>
        <div class="col col-models">Models</div>
        <div class="col col-tags">Tags</div>
        <div class="col col-proxy">Proxy</div>
        <div class="col col-weight">Weight</div>
        <div class="col col-latency">Latency</div>
        <div class="col col-actions">Actions</div>
      </div>

      <!-- Table Body -->
      <div class="table-body">
        <div
          v-for="backend in backends"
          :key="backend.id"
          class="backend-row"
          :class="[getStatusClass(backend.status), { expanded: expandedId === backend.id }]"
        >
          <!-- Main Row -->
          <div class="row-main" @click="toggleExpand(backend.id)">
            <div class="col col-name">
              <div class="name-cell">
                <span class="expand-icon">{{ expandedId === backend.id ? '▼' : '▶' }}</span>
                <span class="name-text">{{ backend.name }}</span>
              </div>
            </div>
            <div class="col col-status">
              <StatusBadge
                :variant="getStatusVariant(backend.status)"
                :label="backend.status"
              />
            </div>
            <div class="col col-protocol">
              <span class="protocol-badge">{{ backend.protocol }}</span>
            </div>
            <div class="col col-models">
              <span v-if="backend.models && backend.models.length > 0" class="models-preview">
                {{ backend.models.length }} model{{ backend.models.length > 1 ? 's' : '' }}
              </span>
              <span v-else class="text-muted">—</span>
            </div>
            <div class="col col-tags">
              <span v-if="backend.tags && backend.tags.length > 0" class="tags-preview">
                <span class="tag-chip-inline">{{ backend.tags[0] }}</span>
                <span v-if="backend.tags.length > 1" class="tag-more">+{{ backend.tags.length - 1 }}</span>
              </span>
              <span v-else class="text-muted">—</span>
            </div>
            <div class="col col-proxy">
              <span v-if="backend.proxy" class="proxy-name">{{ backend.proxy.name }}</span>
              <span v-else class="text-muted">—</span>
            </div>
            <div class="col col-weight">
              <span class="weight-value">{{ backend.weight }}</span>
            </div>
            <div class="col col-latency">
              <span class="metric-value">
                {{ backend.avg_latency_ms ? `${backend.avg_latency_ms.toFixed(0)}ms` : 'N/A' }}
              </span>
            </div>
            <div class="col col-actions" @click.stop>
              <button
                class="action-btn"
                title="Edit"
                @click="$emit('edit', backend)"
              >
                ✏️
              </button>
              <button
                class="action-btn"
                title="Delete"
                @click="$emit('delete', backend)"
              >
                🗑️
              </button>
            </div>
          </div>

          <!-- Expanded Details -->
          <div v-if="expandedId === backend.id" class="row-details">
            <div class="details-grid">
              <div class="detail-section">
                <h4 class="section-title">Connection</h4>
                <div class="detail-item">
                  <span class="detail-label">Base URL</span>
                  <span class="detail-value">{{ backend.base_url }}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">API Key</span>
                  <span class="detail-value api-key">{{ backend.api_key || 'N/A' }}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Protocol</span>
                  <span class="detail-value">{{ backend.protocol }}</span>
                </div>
                <div v-if="backend.proxy" class="detail-item">
                  <span class="detail-label">Proxy</span>
                  <span class="detail-value">{{ backend.proxy.name }} ({{ backend.proxy.address }})</span>
                </div>
                <div v-if="backend.console_url" class="detail-item">
                  <span class="detail-label">Console URL</span>
                  <a :href="backend.console_url" target="_blank" class="detail-link">
                    {{ backend.console_url }} ↗
                  </a>
                </div>
              </div>

              <div class="detail-section">
                <h4 class="section-title">Configuration</h4>
                <div v-if="backend.models && backend.models.length > 0" class="detail-item">
                  <span class="detail-label">Models</span>
                  <div class="detail-value">
                    <span v-for="model in backend.models" :key="model" class="model-chip">
                      {{ model }}
                    </span>
                  </div>
                </div>
                <div v-if="backend.tags && backend.tags.length > 0" class="detail-item">
                  <span class="detail-label">Tags</span>
                  <div class="detail-value">
                    <span v-for="tag in backend.tags" :key="tag" class="tag-chip">
                      {{ tag }}
                    </span>
                  </div>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Weight</span>
                  <span class="detail-value">{{ backend.weight }}</span>
                </div>
                <div v-if="backend.max_requests_per_minute" class="detail-item">
                  <span class="detail-label">Rate Limit</span>
                  <span class="detail-value">{{ backend.max_requests_per_minute }}/min</span>
                </div>
              </div>

              <div class="detail-section">
                <h4 class="section-title">Statistics</h4>
                <div class="detail-item">
                  <span class="detail-label">Total Requests</span>
                  <span class="detail-value">{{ backend.request_count || 0 }}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Consecutive Failures</span>
                  <span class="detail-value" :class="{ 'error-text': (backend.consecutive_failures || 0) > 0 }">
                    {{ backend.consecutive_failures || 0 }}
                  </span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Avg Latency</span>
                  <span class="detail-value">
                    {{ backend.avg_latency_ms ? `${backend.avg_latency_ms.toFixed(0)}ms` : 'N/A' }}
                  </span>
                </div>
                <div v-if="backend.hourly_requests !== undefined" class="detail-item">
                  <span class="detail-label">Hourly Requests</span>
                  <span class="detail-value">{{ backend.hourly_requests }}</span>
                </div>
                <div v-if="backend.hourly_failures !== undefined" class="detail-item">
                  <span class="detail-label">Hourly Failures</span>
                  <span class="detail-value" :class="{ 'error-text': backend.hourly_failures > 0 }">
                    {{ backend.hourly_failures }}
                  </span>
                </div>
                <div v-if="backend.last_used_at" class="detail-item">
                  <span class="detail-label">Last Used</span>
                  <span class="detail-value">{{ formatTime(backend.last_used_at) }}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Updated</span>
                  <span class="detail-value">{{ formatTime(backend.updated_at) }}</span>
                </div>
              </div>

              <div v-if="backend.notes" class="detail-section full-width">
                <h4 class="section-title">Notes</h4>
                <p class="notes-text">{{ backend.notes }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
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

const expandedId = ref<number | null>(null)

const toggleExpand = (id: number) => {
  expandedId.value = expandedId.value === id ? null : id
}

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

/* Table Structure */
.backend-table {
  background: var(--bg-base);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.table-header {
  display: flex;
  align-items: center;
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--bg-subtle);
  border-bottom: 1px solid var(--border);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.table-body {
  display: flex;
  flex-direction: column;
}

/* Column Layout */
.col {
  padding: 0 var(--spacing-sm);
}

.col-name {
  flex: 1.5;
  min-width: 150px;
}

.col-status {
  flex: 0 0 100px;
}

.col-protocol {
  flex: 0 0 90px;
}

.col-models {
  flex: 0 0 90px;
}

.col-tags {
  flex: 0 0 100px;
}

.col-proxy {
  flex: 0 0 100px;
}

.col-weight {
  flex: 0 0 70px;
  text-align: right;
}

.col-latency {
  flex: 0 0 90px;
  text-align: right;
}

.col-actions {
  flex: 0 0 90px;
  text-align: right;
}

/* Backend Row */
.backend-row {
  border-left: 3px solid transparent;
  border-bottom: 1px solid var(--border);
  transition: all 150ms ease;
}

.backend-row:last-child {
  border-bottom: none;
}

.backend-row.status-normal {
  border-left-color: rgba(16, 185, 129, 0.6);
}

.backend-row.status-abnormal {
  border-left-color: rgba(245, 158, 11, 0.6);
}

.backend-row.status-disable {
  border-left-color: rgba(148, 163, 184, 0.4);
  opacity: 0.7;
}

.backend-row:hover {
  background: var(--bg-subtle);
}

.backend-row.expanded {
  background: var(--bg-subtle);
}

/* Main Row */
.row-main {
  display: flex;
  align-items: center;
  padding: var(--spacing-md) var(--spacing-lg);
  cursor: pointer;
  user-select: none;
}

.name-cell {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.expand-icon {
  font-size: 10px;
  color: var(--text-tertiary);
  transition: transform 150ms ease;
}

.name-text {
  font-weight: 600;
  color: var(--text-primary);
}

.protocol-badge {
  display: inline-block;
  padding: 2px 8px;
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
}

.models-preview {
  font-size: 12px;
  color: var(--text-secondary);
}

.tags-preview {
  display: flex;
  align-items: center;
  gap: 4px;
}

.tag-chip-inline {
  display: inline-block;
  padding: 2px 6px;
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 11px;
  color: var(--text-secondary);
  max-width: 70px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag-more {
  font-size: 11px;
  color: var(--text-tertiary);
}

.proxy-name {
  font-size: 12px;
  color: var(--text-secondary);
}

.text-muted {
  color: var(--text-tertiary);
  font-size: 12px;
}

.weight-value {
  font-weight: 600;
  color: var(--text-primary);
}

.metric-value {
  color: var(--text-primary);
}

.metric-value.has-failures {
  color: var(--danger);
  font-weight: 600;
}

.error-text {
  color: var(--danger);
  font-weight: 600;
}

.api-key {
  font-family: monospace;
  font-size: 12px;
  word-break: break-all;
  user-select: all;
}

.action-btn {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  font-size: 14px;
  cursor: pointer;
  transition: all 150ms ease;
  margin-left: 4px;
}

.action-btn:hover {
  background: var(--bg-muted);
  transform: scale(1.1);
}

/* Expanded Details */
.row-details {
  padding: var(--spacing-lg);
  background: var(--bg-base);
  border-top: 1px solid var(--border);
  animation: slideDown 200ms ease;
}

@keyframes slideDown {
  from {
    opacity: 0;
    max-height: 0;
  }
  to {
    opacity: 1;
    max-height: 500px;
  }
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--spacing-lg);
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.detail-section.full-width {
  grid-column: 1 / -1;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 var(--spacing-xs) 0;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--spacing-md);
  font-size: 13px;
}

.detail-label {
  color: var(--text-secondary);
  flex-shrink: 0;
  min-width: 100px;
}

.detail-value {
  color: var(--text-primary);
  font-weight: 500;
  text-align: right;
  word-break: break-all;
}

.detail-link {
  color: var(--accent-primary);
  text-decoration: none;
  transition: opacity 150ms ease;
}

.detail-link:hover {
  opacity: 0.8;
}

.model-chip,
.tag-chip {
  display: inline-block;
  padding: 3px 8px;
  margin: 2px;
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--text-secondary);
}

.notes-text {
  margin: 0;
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.6;
  white-space: pre-wrap;
}

/* Responsive */
@media (max-width: 1200px) {
  .col-proxy,
  .col-tags {
    display: none;
  }
}

@media (max-width: 900px) {
  .col-models,
  .col-latency {
    display: none;
  }
}
</style>
