<template>
  <div class="layout">
    <Sidebar />
    <div :class="['main-container', { 'sidebar-collapsed': sidebarCollapsed }]">
      <Topbar />
      <main class="main-content">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Sidebar from '@/components/ui/Sidebar.vue'
import Topbar from '@/components/ui/Topbar.vue'
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()
const sidebarCollapsed = computed(() => appStore.sidebarCollapsed)
</script>

<style scoped>
.layout {
  display: flex;
  min-height: 100vh;
  background: var(--bg-base);
}

.main-container {
  flex: 1;
  margin-left: 240px;
  display: flex;
  flex-direction: column;
  transition: margin-left 200ms ease;
}

.main-container.sidebar-collapsed {
  margin-left: 64px;
}

.main-content {
  flex: 1;
  padding: var(--spacing-2xl);
  overflow-y: auto;
}

/* Responsive */
@media (max-width: 768px) {
  .main-container {
    margin-left: 0;
  }

  .main-content {
    padding: var(--spacing-lg);
  }
}
</style>
