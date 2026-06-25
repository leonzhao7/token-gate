<template>
  <div v-if="totalPages > 1" class="pagination">
    <button
      class="page-button"
      :disabled="currentPage === 1"
      @click="$emit('change', currentPage - 1)"
    >
      ← Previous
    </button>

    <div class="page-numbers">
      <button
        v-for="pageNum in visiblePages"
        :key="pageNum"
        :class="['page-number', { active: pageNum === currentPage, ellipsis: pageNum === -1 }]"
        :disabled="pageNum === -1"
        @click="pageNum !== -1 && $emit('change', pageNum)"
      >
        {{ pageNum === -1 ? '...' : pageNum }}
      </button>
    </div>

    <button
      class="page-button"
      :disabled="currentPage === totalPages"
      @click="$emit('change', currentPage + 1)"
    >
      Next →
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  currentPage: number
  totalPages: number
}

const props = defineProps<Props>()

defineEmits<{
  change: [page: number]
}>()

const visiblePages = computed(() => {
  const pages: number[] = []
  const total = props.totalPages
  const current = props.currentPage

  if (total <= 7) {
    for (let i = 1; i <= total; i++) {
      pages.push(i)
    }
  } else {
    pages.push(1)

    if (current > 3) {
      pages.push(-1) // ellipsis
    }

    const start = Math.max(2, current - 1)
    const end = Math.min(total - 1, current + 1)

    for (let i = start; i <= end; i++) {
      pages.push(i)
    }

    if (current < total - 2) {
      pages.push(-1) // ellipsis
    }

    pages.push(total)
  }

  return pages
})
</script>

<style scoped>
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-lg) 0;
}

.page-button,
.page-number {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-base);
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 150ms ease;
}

.page-button:hover:not(:disabled),
.page-number:hover:not(:disabled):not(.ellipsis) {
  border-color: var(--accent-primary);
  background: var(--bg-subtle);
}

.page-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-numbers {
  display: flex;
  gap: var(--spacing-xs);
}

.page-number {
  min-width: 36px;
}

.page-number.active {
  background: var(--accent-primary);
  color: white;
  border-color: var(--accent-primary);
}

.page-number.ellipsis {
  border-color: transparent;
  background: transparent;
  cursor: default;
}
</style>
