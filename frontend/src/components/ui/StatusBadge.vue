<template>
  <span :class="['status-badge', `status-badge-${variant}`]">
    <span class="status-dot"></span>
    {{ label }}
  </span>
</template>

<script setup lang="ts">
interface Props {
  variant: 'success' | 'warning' | 'danger' | 'info' | 'default'
  label: string
}

defineProps<Props>()
</script>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: var(--radius-full);
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-badge-success {
  background: rgba(22, 163, 74, 0.1);
  color: var(--success);
}

.status-badge-success .status-dot {
  background: var(--success);
}

.status-badge-warning {
  background: rgba(245, 158, 11, 0.1);
  color: var(--warning);
}

.status-badge-warning .status-dot {
  background: var(--warning);
}

.status-badge-danger {
  background: rgba(239, 68, 68, 0.1);
  color: var(--danger);
}

.status-badge-danger .status-dot {
  background: var(--danger);
}

.status-badge-info {
  background: rgba(59, 130, 246, 0.1);
  color: var(--info);
}

.status-badge-info .status-dot {
  background: var(--info);
}

.status-badge-default {
  background: var(--bg-muted);
  color: var(--text-secondary);
}

.status-badge-default .status-dot {
  background: var(--text-tertiary);
}
</style>
