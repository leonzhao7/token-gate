<template>
  <div class="client-key-list">
    <div v-if="clientKeys.length === 0" class="empty-state">
      <EmptyState
        icon="🔑"
        title="No client keys"
        description="Create your first client key to access the API"
      >
        <template #action>
          <Button @click="$emit('create')">Create Key</Button>
        </template>
      </EmptyState>
    </div>

    <div v-else class="key-grid">
      <div
        v-for="key in clientKeys"
        :key="key.id"
        class="key-card"
      >
        <div class="key-header">
          <div class="key-title">
            <h3>{{ key.name }}</h3>
            <StatusBadge
              :variant="key.enabled ? 'success' : 'default'"
              :label="key.enabled ? 'Active' : 'Disabled'"
            />
          </div>
          <div class="key-actions">
            <button
              class="icon-button"
              title="Copy Token"
              @click="copyToken(key)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor"><path d="M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z"/></svg>
            </button>
            <button
              class="icon-button"
              title="Edit"
              @click="$emit('edit', key)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor"><path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h357l-80 80H200v560h560v-278l80-80v358q0 33-23.5 56.5T760-120H200Zm280-360ZM360-360v-170l367-367q12-12 27-18t30-6q16 0 30.5 6t26.5 18l56 57q11 12 17 26.5t6 29.5q0 15-5.5 29.5T897-728L530-360H360Zm481-424-56-56 56 56ZM440-440h56l232-232-28-28-29-28-231 231v57Zm260-260-29-28 29 28 28 28-28-28Z"/></svg>
            </button>
            <button
              class="icon-button"
              title="Delete"
              @click="$emit('delete', key)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/></svg>
            </button>
          </div>
        </div>

        <div class="key-token">
          <span class="token-label">Token:</span>
          <code class="token-value">{{ key.token }}</code>
        </div>

        <div class="key-info">
          <div class="info-item">
            <span class="info-label">Models:</span>
            <span class="info-value">{{ key.allowed_models }}</span>
          </div>
        </div>

        <div class="key-stats">
          <div class="stat-item">
            <span class="stat-label">Total Requests</span>
            <span class="stat-value">{{ key.usage_count || key.total_requests || 0 }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Last Used</span>
            <span class="stat-value">
              {{ key.last_used_at ? formatTime(key.last_used_at) : 'Never' }}
            </span>
          </div>
        </div>

        <div class="key-footer">
          <span class="footer-text">
            Created {{ formatTime(key.created_at) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import StatusBadge from '@/components/ui/StatusBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Button from '@/components/ui/Button.vue'
import type { ClientKey } from '@/api'

interface Props {
  clientKeys: ClientKey[]
}

defineProps<Props>()

const emit = defineEmits<{
  create: []
  edit: [key: ClientKey]
  delete: [key: ClientKey]
}>()

const maskToken = (token: string) => {
  if (token.length <= 12) return token
  return `${token.substring(0, 8)}...${token.substring(token.length - 4)}`
}

const copyToken = async (key: ClientKey) => {
  try {
    await navigator.clipboard.writeText(key.token)
    alert('Token copied to clipboard!')
  } catch (err) {
    console.error('Failed to copy token:', err)
    alert('Failed to copy token')
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
.client-key-list {
  width: 100%;
}

.empty-state {
  padding: var(--spacing-2xl) 0;
}

.key-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: var(--spacing-lg);
}

.key-card {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  background: var(--bg-base);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  transition: all 150ms ease;
}

.key-card:hover {
  border-color: var(--border-hover);
  box-shadow: var(--shadow-sm);
}

.key-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--spacing-md);
}

.key-title {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  flex: 1;
  min-width: 0;
}

.key-title h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.key-actions {
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

.key-token {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--bg-muted);
  border-radius: var(--radius-md);
  font-size: 13px;
}

.token-label {
  color: var(--text-secondary);
  font-weight: 500;
}

.token-value {
  flex: 1;
  color: var(--text-primary);
  font-family: 'Monaco', 'Menlo', monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.key-info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--border);
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
}

.key-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
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
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.key-footer {
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--border);
}

.footer-text {
  font-size: 12px;
  color: var(--text-tertiary);
}
</style>
