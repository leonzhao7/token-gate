<template>
  <div class="proxy-list">
    <div v-if="proxies.length === 0" class="empty-state">
      <EmptyState
        icon="🌐"
        title="No proxies configured"
        description="Add a SOCKS proxy to route backend requests"
      >
        <template #action>
          <Button @click="$emit('create')">Add Proxy</Button>
        </template>
      </EmptyState>
    </div>

    <div v-else class="proxy-grid">
      <div
        v-for="proxy in proxies"
        :key="proxy.id"
        class="proxy-card"
      >
        <div class="proxy-header">
          <div class="proxy-title">
            <h3>{{ proxy.name }}</h3>
            <StatusBadge
              :variant="proxy.enabled ? 'success' : 'default'"
              :label="proxy.enabled ? 'Enabled' : 'Disabled'"
            />
          </div>
          <div class="proxy-actions">
            <button
              class="icon-button"
              title="Edit"
              @click="$emit('edit', proxy)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor"><path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h357l-80 80H200v560h560v-278l80-80v358q0 33-23.5 56.5T760-120H200Zm280-360ZM360-360v-170l367-367q12-12 27-18t30-6q16 0 30.5 6t26.5 18l56 57q11 12 17 26.5t6 29.5q0 15-5.5 29.5T897-728L530-360H360Zm481-424-56-56 56 56ZM440-440h56l232-232-28-28-29-28-231 231v57Zm260-260-29-28 29 28 28 28-28-28Z"/></svg>
            </button>
            <button
              class="icon-button"
              title="Delete"
              @click="$emit('delete', proxy)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/></svg>
            </button>
          </div>
        </div>

        <div class="proxy-info">
          <div class="info-item">
            <span class="info-label">Address:</span>
            <span class="info-value">{{ proxy.address }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Authentication:</span>
            <span class="info-value">
              {{ proxy.username ? 'Yes' : 'No' }}
            </span>
          </div>
        </div>

        <div class="proxy-footer">
          <span class="footer-text">
            Updated {{ formatTime(proxy.updated_at) }}
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
import type { SocksProxy } from '@/api'

interface Props {
  proxies: SocksProxy[]
}

defineProps<Props>()

const emit = defineEmits<{
  create: []
  edit: [proxy: SocksProxy]
  delete: [proxy: SocksProxy]
}>()

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
.proxy-list {
  width: 100%;
}

.empty-state {
  padding: var(--spacing-2xl) 0;
}

.proxy-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: var(--spacing-lg);
}

.proxy-card {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  background: var(--bg-base);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  transition: all 150ms ease;
}

.proxy-card:hover {
  border-color: var(--border-hover);
  box-shadow: var(--shadow-sm);
}

.proxy-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--spacing-md);
}

.proxy-title {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  flex: 1;
  min-width: 0;
}

.proxy-title h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.proxy-actions {
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

.proxy-info {
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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.proxy-footer {
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--border);
}

.footer-text {
  font-size: 12px;
  color: var(--text-tertiary);
}
</style>
