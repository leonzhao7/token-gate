<template>
  <span :class="['badge', `badge-${variant}`, `badge-${size}`]">
    <slot />
  </span>
</template>

<script setup lang="ts">
interface Props {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  size?: 'sm' | 'md'
}

withDefaults(defineProps<Props>(), {
  variant: 'default',
  size: 'md'
})
</script>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  font-weight: 500;
  white-space: nowrap;
}

/* Sizes */
.badge-sm {
  padding: 2px 6px;
  font-size: 11px;
}

.badge-md {
  padding: 4px 8px;
  font-size: 12px;
}

/* Variants */
.badge-default {
  background: var(--bg-muted);
  color: var(--text-secondary);
}

.badge-success {
  background: rgba(22, 163, 74, 0.1);
  color: var(--success);
}

.badge-warning {
  background: rgba(245, 158, 11, 0.1);
  color: var(--warning);
}

.badge-danger {
  background: rgba(239, 68, 68, 0.1);
  color: var(--danger);
}

.badge-info {
  background: rgba(0, 112, 243, 0.1);
  color: var(--accent-primary);
}
</style>
