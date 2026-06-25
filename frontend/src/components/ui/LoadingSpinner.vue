<template>
  <div :class="['spinner-wrapper', { 'spinner-fullscreen': fullscreen }]">
    <div :class="['spinner', `spinner-${size}`]">
      <div class="spinner-circle"></div>
    </div>
    <p v-if="message" class="spinner-message">{{ message }}</p>
  </div>
</template>

<script setup lang="ts">
interface Props {
  size?: 'sm' | 'md' | 'lg'
  message?: string
  fullscreen?: boolean
}

withDefaults(defineProps<Props>(), {
  size: 'md',
  fullscreen: false
})
</script>

<style scoped>
.spinner-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-md);
}

.spinner-fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 9999;
}

.spinner {
  display: inline-block;
}

.spinner-circle {
  border: 3px solid var(--bg-muted);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.spinner-sm .spinner-circle {
  width: 20px;
  height: 20px;
  border-width: 2px;
}

.spinner-md .spinner-circle {
  width: 40px;
  height: 40px;
}

.spinner-lg .spinner-circle {
  width: 60px;
  height: 60px;
  border-width: 4px;
}

.spinner-message {
  font-size: 14px;
  color: var(--text-secondary);
}

.spinner-fullscreen .spinner-message {
  color: white;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
