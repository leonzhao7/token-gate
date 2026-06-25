<template>
  <div class="events-timeline">
    <div v-if="events.length === 0" class="empty-state">
      <EmptyState
        icon="📋"
        title="No events"
        description="System events will appear here as the service runs"
      />
    </div>

    <div v-else class="timeline">
      <div
        v-for="event in events"
        :key="event.id"
        class="timeline-item"
      >
        <div class="timeline-marker">
          <div :class="['timeline-dot', `timeline-dot-${getSeverityType(event.severity || event.level)}`]"></div>
          <div class="timeline-line"></div>
        </div>

        <div class="timeline-content">
          <div class="event-header">
            <div class="event-title">
              <span class="event-icon">{{ getSeverityIcon(event.severity || event.level) }}</span>
              <span class="event-action">{{ formatType(event.type) }}</span>
              <span v-if="event.category" class="event-resource">{{ event.category }}</span>
            </div>
            <div class="event-time">{{ formatTime(event.created_at) }}</div>
          </div>

          <div class="event-message">
            {{ event.message }}
          </div>

          <div v-if="hasEventDetails(event)" class="event-details">
            <div class="details-grid">
              <div v-if="event.client_name" class="detail-item">
                <span class="detail-key">Client:</span>
                <span class="detail-value">{{ event.client_name }}</span>
              </div>
              <div v-if="event.model" class="detail-item">
                <span class="detail-key">Model:</span>
                <span class="detail-value">{{ event.model }}</span>
              </div>
              <div v-if="event.endpoint" class="detail-item">
                <span class="detail-key">Endpoint:</span>
                <span class="detail-value">{{ event.endpoint }}</span>
              </div>
              <div v-if="event.backend_name" class="detail-item">
                <span class="detail-key">Backend:</span>
                <span class="detail-value">{{ event.backend_name }}</span>
              </div>
            </div>
          </div>

          <div class="event-footer">
            <span class="event-level">{{ event.level }}</span>
            <span v-if="event.resource_type" class="event-type">{{ event.resource_type }}</span>
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

const getSeverityType = (severity: string): 'warn' | 'error' | 'info' | 'default' => {
  const s = severity?.toLowerCase()
  if (s === 'warn' || s === 'warning') return 'warn'
  if (s === 'error') return 'error'
  if (s === 'info') return 'info'
  return 'default'
}

const getSeverityIcon = (severity: string): string => {
  const type = getSeverityType(severity)
  switch (type) {
    case 'error': return '❌'
    case 'warn': return '⚠️'
    case 'info': return 'ℹ️'
    default: return '📝'
  }
}

const formatType = (type: string): string => {
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

const hasEventDetails = (event: AuditEvent): boolean => {
  return !!(event.client_name || event.model || event.endpoint || event.backend_name)
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

.timeline-dot-error {
  background: var(--danger);
  box-shadow: 0 0 0 2px var(--danger);
}

.timeline-dot-warn {
  background: var(--warning);
  box-shadow: 0 0 0 2px var(--warning);
}

.timeline-dot-info {
  background: var(--info);
  box-shadow: 0 0 0 2px var(--info);
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

.event-time {
  font-size: 13px;
  color: var(--text-tertiary);
  white-space: nowrap;
}

.event-message {
  font-size: 14px;
  color: var(--text-primary);
  line-height: 1.5;
  margin-bottom: var(--spacing-sm);
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

.event-level,
.event-type {
  text-transform: uppercase;
  font-weight: 500;
  font-size: 11px;
  letter-spacing: 0.5px;
}
</style>
