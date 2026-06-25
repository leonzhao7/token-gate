<template>
  <aside :class="['sidebar', { collapsed: isCollapsed }]">
    <div class="sidebar-header">
      <h1 class="logo">
        <span v-if="!isCollapsed">Token Gate</span>
        <span v-else>TG</span>
      </h1>
    </div>

    <nav class="sidebar-nav">
      <router-link
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        class="nav-item"
        :class="{ active: isActive(item.path) }"
      >
        <span class="nav-icon">{{ item.icon }}</span>
        <span v-if="!isCollapsed" class="nav-label">{{ item.label }}</span>
      </router-link>
    </nav>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAppStore } from '@/stores/app'

const route = useRoute()
const appStore = useAppStore()

const isCollapsed = computed(() => appStore.sidebarCollapsed)

const navItems = [
  { path: '/', label: 'Dashboard', icon: '📊' },
  { path: '/backends', label: 'Backends', icon: '🔌' },
  { path: '/proxies', label: 'Proxies', icon: '🌐' },
  { path: '/client-keys', label: 'Client Keys', icon: '🔑' },
  { path: '/usage-logs', label: 'Usage Logs', icon: '📝' },
  { path: '/events', label: 'Events', icon: '📋' },
  { path: '/settings', label: 'Settings', icon: '⚙️' }
]

const isActive = (path: string) => {
  if (path === '/') {
    return route.path === '/'
  }
  return route.path.startsWith(path)
}
</script>

<style scoped>
.sidebar {
  width: 240px;
  height: 100vh;
  background: var(--bg-subtle);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  transition: width 200ms ease;
  position: fixed;
  left: 0;
  top: 0;
  z-index: 100;
}

.sidebar.collapsed {
  width: 64px;
}

.sidebar-header {
  height: 64px;
  display: flex;
  align-items: center;
  padding: 0 var(--spacing-lg);
  border-bottom: 1px solid var(--border);
}

.logo {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
}

.sidebar-nav {
  flex: 1;
  padding: var(--spacing-md) 0;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  padding: var(--spacing-sm) var(--spacing-lg);
  color: var(--text-secondary);
  text-decoration: none;
  transition: all 150ms ease;
  cursor: pointer;
  margin: 2px var(--spacing-sm);
  border-radius: var(--radius-sm);
}

.nav-item:hover {
  background: var(--bg-muted);
  color: var(--text-primary);
}

.nav-item.active {
  background: var(--accent-primary);
  color: white;
}

.nav-icon {
  font-size: 20px;
  min-width: 24px;
  text-align: center;
}

.nav-label {
  margin-left: var(--spacing-md);
  font-size: 14px;
  white-space: nowrap;
}

.sidebar.collapsed .nav-label {
  display: none;
}

.sidebar.collapsed .nav-item {
  justify-content: center;
  padding: var(--spacing-sm);
}
</style>
