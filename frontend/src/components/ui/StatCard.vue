<template>
  <div class="stat-card">
    <div class="stat-icon" :style="{ background: iconBg }">{{ icon }}</div>
    <div class="stat-content">
      <p class="stat-label">{{ label }}</p>
      <h3 class="stat-value">{{ formattedValue }}</h3>
      <p v-if="change !== undefined" :class="['stat-change', changeClass]">
        <span class="stat-change-icon">{{ changeIcon }}</span>
        {{ Math.abs(change) }}% vs last period
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  label: string
  value: number | string
  icon: string
  iconBg?: string
  change?: number
}

const props = withDefaults(defineProps<Props>(), {
  iconBg: 'rgba(0, 112, 243, 0.1)'
})

const formattedValue = computed(() => {
  if (typeof props.value === 'number') {
    return props.value.toLocaleString()
  }
  return props.value
})

const changeClass = computed(() => {
  if (props.change === undefined) return ''
  return props.change >= 0 ? 'stat-change-positive' : 'stat-change-negative'
})

const changeIcon = computed(() => {
  if (props.change === undefined) return ''
  return props.change >= 0 ? '↑' : '↓'
})
</script>

<style scoped>
.stat-card {
  display: flex;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  background: var(--bg-base);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  transition: all 150ms ease;
}

.stat-card:hover {
  border-color: var(--border-hover);
  box-shadow: var(--shadow-sm);
}

.stat-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  font-size: 24px;
  flex-shrink: 0;
}

.stat-content {
  flex: 1;
  min-width: 0;
}

.stat-label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.stat-value {
  font-size: 28px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.stat-change {
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.stat-change-positive {
  color: var(--success);
}

.stat-change-negative {
  color: var(--danger);
}

.stat-change-icon {
  font-size: 14px;
}
</style>
