<template>
  <header class="topbar">
    <div class="topbar-left">
      <button class="icon-button" @click="toggleSidebar" aria-label="Toggle sidebar">
        <span>☰</span>
      </button>
      <div class="breadcrumbs">
        <span class="breadcrumb-item">{{ currentPageTitle }}</span>
      </div>
    </div>

    <div class="topbar-right">
      <button class="icon-button" @click="toggleTheme" :aria-label="`Switch to ${nextTheme} mode`">
        <span v-if="theme === 'light'">🌙</span>
        <span v-else-if="theme === 'dark'">☀️</span>
        <span v-else>🌓</span>
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { useTheme } from '@/composables/useTheme'

const route = useRoute()
const appStore = useAppStore()
const { theme, toggleTheme } = useTheme()

const toggleSidebar = () => {
  appStore.toggleSidebar()
}

const currentPageTitle = computed(() => {
  const titles: Record<string, string> = {
    '/': 'Dashboard',
    '/backends': 'Backends',
    '/proxies': 'Proxies',
    '/client-keys': 'Client Keys',
    '/usage-logs': 'Usage Logs',
    '/events': 'Audit Events',
    '/settings': 'Settings'
  }

  // Check if it's a detail page
  if (route.path.startsWith('/backends/') && route.path !== '/backends') {
    return 'Backend Detail'
  }

  return titles[route.path] || 'Token Gate'
})

const nextTheme = computed(() => {
  return theme.value === 'light' ? 'dark' : 'light'
})
</script>

<style scoped>
.topbar {
  height: 64px;
  background: var(--bg-base);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--spacing-lg);
  position: sticky;
  top: 0;
  z-index: 90;
  backdrop-filter: blur(12px);
  background: rgba(255, 255, 255, 0.8);
}

:root[data-theme="dark"] .topbar {
  background: rgba(0, 0, 0, 0.8);
}

.topbar-left,
.topbar-right {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.icon-button {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 150ms ease;
  font-size: 20px;
}

.icon-button:hover {
  background: var(--bg-muted);
  color: var(--text-primary);
}

.breadcrumbs {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.breadcrumb-item {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-primary);
}
</style>
