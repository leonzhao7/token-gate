<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="modal-overlay" @click="handleOverlayClick">
        <div class="modal-container" :style="{ width: containerWidth }">
          <div class="modal-header">
            <h2 class="modal-title">{{ title }}</h2>
            <button class="modal-close" @click="$emit('close')" aria-label="Close">
              ✕
            </button>
          </div>
          <div class="modal-body">
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { watch } from 'vue'

interface Props {
  show: boolean
  title: string
  width?: string
  closeOnOverlay?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  width: '600px',
  closeOnOverlay: true
})

const emit = defineEmits<{
  close: []
}>()

const containerWidth = props.width

const handleOverlayClick = (e: MouseEvent) => {
  if (props.closeOnOverlay && e.target === e.currentTarget) {
    emit('close')
  }
}

// Prevent body scroll when modal is open
watch(() => props.show, (show) => {
  if (show) {
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--spacing-lg);
}

.modal-container {
  background: var(--bg-base);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-lg);
  border-bottom: 1px solid var(--border);
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.modal-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 20px;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all 150ms ease;
}

.modal-close:hover {
  background: var(--bg-subtle);
  color: var(--text-primary);
}

.modal-body {
  padding: var(--spacing-lg);
  overflow-y: auto;
}

/* Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 200ms ease;
}

.modal-enter-active .modal-container,
.modal-leave-active .modal-container {
  transition: transform 200ms ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  transform: scale(0.95) translateY(-20px);
}
</style>
