<template>
  <div class="events-timeline">
    <div v-if="events.length === 0" class="empty-state">
      <EmptyState
        icon="📋"
        title="No events"
        description="Activity events will appear here as you manage resources"
      />
    </div>

    <div v-else class="timeline">
      <div
        v-for="event in events"
        :key="event.id"
        class="timeline-item"
      >
        <div class="timeline-marker">
          <div :class="['timeline-dot', `timeline-dot-${getActionType(event.action)}`]"></div>
          <div class="timeline-line"></div>
        </div>

        <div class="timeline-content">
          <div class="event-header">
            <div class="event-title">
              <span class="event-icon">{{ getActionIcon(event.action) }}</span>
              <span class="event-action">{{ formatAction(event.action) }}</span>
              <span class="event-resource">{{ event.resource_type }}</span>
              <span v-if="event.resource_name" class="event-name">{{ event.resource_name }}</span>
            </div>
            <div class="event-time">{{ formatTime(event.created_at) }}</div>
          </div>

          <div v-if="event.details" class="event-details">
            <div class="details-grid">
              <div
                v-for="(value, key) in parseDetails(event.details)"
                :key="key"
                class="detail-item"
              >
                <span class="detail-key">{{ key }}:</span>
                <span class="detail-value">{{ value }}</span>
              </div>
            </div>
          </div>

          <div class="event-footer">
            <span class="event-user">by {{ event.user || 'System' }}</span>
            <span v-if="event.ip_address" class="event-ip">from {{ event.ip_address }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import EmptyState from '@/components/ui/EmptyState.vue'
import type { AuditEvent } from '@/api'

interface Props {
  events: AuditEvent[]
}

defineProps<Props>()

const getActionType = (action: string): 'create' | 'update' | 'delete' | 'default' => {
  if (action.includes('create') || action.includes('add')) return 'create'
  if (action.includes('update') || action.includes('edit') || action.includes('modify')) return 'update'
  if (action.includes('delete') || action.includes('remove')) return 'delete'
  return 'default'
}

const getActionIcon = (action: string): string => {
  const type = getActionType(action)
  switch (type) {
    case 'create': return '➕'
    case 'update': return '✏️'
    case 'delete': return '🗑️'
    default: return '📝'
  }
}

const formatAction = (action: string): string => {
  return action
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

const formatTime = (timestamp: string) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

const parseDetails = (details: string): Record<string, any> => {
  try {
    return JSON.parse(details)
  } catch {
    return {}
  }
}
</script>

<style scoped>
.events-timeline {
  width: 100%;
}

.empty-state {
  padding: var(--spacing-2xl) 0;
}

.timeline {
  display: flex;
  flex-direction: column;
}

.timeline-item {
  display: flex;
  gap: var(--spacing-lg);
  position: relative;
}

.timeline-item:last-child .timeline-line {
  display: none;
}

.timeline-marker {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 4px;
}

.timeline-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid var(--bg-base);
  box-shadow: 0 0 0 2px var(--border);
  flex-shrink: 0;
  z-index: 1;
}

.timeline-dot-create {
  background: var(--success);
  box-shadow: 0 0 0 2px var(--success);
}

.timeline-dot-update {
  background: var(--info);
  box-shadow: 0 0 0 2px var(--info);
}

.timeline-dot-delete {
  background: var(--danger);
  box-shadow: 0 0 0 2px var(--danger);
}

.timeline-dot-default {
  background: var(--text-tertiary);
  box-shadow: 0 0 0 2px var(--text-tertiary);
}

.timeline-line {
  width: 2px;
  flex: 1;
  background: var(--border);
  margin-top: 4px;
}

.timeline-content {
  flex: 1;
  padding-bottom: var(--spacing-2xl);
  min-width: 0;
}

.event-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-sm);
}

.event-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}

.event-icon {
  font-size: 16px;
}

.event-action {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.event-resource {
  font-size: 14px;
  color: var(--text-secondary);
  padding: 2px 8px;
  background: var(--bg-muted);
  border-radius: var(--radius-sm);
}

.event-name {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
}

.event-time {
  font-size: 13px;
  color: var(--text-tertiary);
  white-space: nowrap;
}

.event-details {
  padding: var(--spacing-md);
  background: var(--bg-subtle);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-sm);
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacing-sm);
}

.detail-item {
  display: flex;
  gap: var(--spacing-xs);
  font-size: 13px;
}

.detail-key {
  color: var(--text-secondary);
  font-weight: 500;
}

.detail-value {
  color: var(--text-primary);
}

.event-footer {
  display: flex;
  gap: var(--spacing-md);
  font-size: 13px;
  color: var(--text-tertiary);
}

.event-user,
.event-ip {
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
