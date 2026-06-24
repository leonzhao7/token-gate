# Frontend UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace existing admin UI with modern Vue 3 + TypeScript frontend, embedded in Go service

**Architecture:** Independent Vue 3 project in `frontend/` directory, build artifacts output to `web/` for Go embed. Vercel/Linear design style with Dark/Light theme support.

**Tech Stack:** Vue 3.4+, TypeScript 5+, Vite 5+, Pinia, Vue Router 4, Axios, Radix Vue, Chart.js, Lucide Icons

## Global Constraints

- Vue 3.4+ with Composition API only
- TypeScript strict mode enabled
- All API calls through Axios with interceptors
- CSS Variables for theming (no CSS-in-JS)
- Build output must be static files in `web/` directory
- No server-side rendering (SSR)
- Maintain existing backend API contracts (except new Settings endpoints)
- Follow DRY, YAGNI, TDD principles

---

## Task 1: Project Scaffolding

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/index.html`
- Create: `frontend/src/main.ts`
- Create: `frontend/src/App.vue`
- Create: `frontend/.gitignore`

**Interfaces:**
- Consumes: None (initial setup)
- Produces: Working Vue 3 + Vite development environment

- [ ] **Step 1: Create frontend directory and package.json**

```bash
cd /root/workspace/token-gate
mkdir -p frontend/src
cd frontend
```

Create `package.json`:
```json
{
  "name": "token-gate-frontend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "vue": "^3.4.0",
    "vue-router": "^4.2.0",
    "pinia": "^2.1.0",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.0",
    "typescript": "^5.3.0",
    "vue-tsc": "^1.8.0",
    "vite": "^5.0.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: All packages installed, `node_modules/` created

- [ ] **Step 3: Create Vite configuration**

Create `vite.config.ts`:
```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/admin/api': {
        target: 'http://localhost:4000',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: '../web',
    emptyOutDir: true
  }
})
```

- [ ] **Step 4: Create TypeScript configuration**

Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "preserve",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

Create `tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 5: Create index.html**

Create `index.html`:
```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Token Gate - AI Proxy Center</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 6: Create main.ts entry point**

Create `src/main.ts`:
```typescript
import { createApp } from 'vue'
import App from './App.vue'

const app = createApp(App)
app.mount('#app')
```

- [ ] **Step 7: Create root App component**

Create `src/App.vue`:
```vue
<template>
  <div id="app">
    <h1>Token Gate Frontend</h1>
    <p>Vue 3 + TypeScript + Vite</p>
  </div>
</template>

<script setup lang="ts">
// Root component
</script>

<style>
#app {
  font-family: Inter, sans-serif;
  padding: 2rem;
}
</style>
```

- [ ] **Step 8: Create .gitignore**

Create `.gitignore`:
```
node_modules
dist
.DS_Store
*.log
```

- [ ] **Step 9: Test development server**

Run: `npm run dev`
Expected: Vite dev server starts on http://localhost:5173, shows "Token Gate Frontend"

- [ ] **Step 10: Test production build**

Run: `npm run build`
Expected: Build succeeds, files output to `../web/`

- [ ] **Step 11: Commit**

```bash
git add frontend/
git commit -m "chore: scaffold Vue 3 + Vite frontend project

- Initialize package.json with Vue 3.4+, TypeScript 5+, Vite 5+
- Configure Vite with API proxy and build output to ../web/
- Set up TypeScript strict mode
- Create minimal App.vue with placeholder content"
```

---

## Task 2: Theme System & Global Styles

**Files:**
- Create: `frontend/src/styles/variables.css`
- Create: `frontend/src/styles/reset.css`
- Create: `frontend/src/styles/global.css`
- Create: `frontend/src/composables/useTheme.ts`
- Modify: `frontend/src/main.ts`
- Modify: `frontend/index.html`

**Interfaces:**
- Consumes: None
- Produces: `useTheme()` composable with `theme: Ref<'light' | 'dark' | 'system'>`, `setTheme(theme: string): void`, `toggleTheme(): void`

- [ ] **Step 1: Create CSS variables for theming**

Create `src/styles/variables.css`:
```css
:root {
  color-scheme: light;
  --bg-base: #ffffff;
  --bg-subtle: #fafafa;
  --bg-muted: #f5f5f5;
  --border: #e5e5e5;
  --border-hover: #d4d4d4;
  --text-primary: #171717;
  --text-secondary: #737373;
  --text-tertiary: #a3a3a3;
  --accent-primary: #0070f3;
  --accent-hover: #0761d1;
  --success: #16a34a;
  --warning: #f59e0b;
  --danger: #ef4444;
  
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  --spacing-2xl: 48px;
  
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.04);
  --shadow-md: 0 4px 16px rgba(0,0,0,0.08);
  --shadow-lg: 0 12px 32px rgba(0,0,0,0.12);
}

:root[data-theme="dark"] {
  color-scheme: dark;
  --bg-base: #000000;
  --bg-subtle: #0a0a0a;
  --bg-muted: #171717;
  --border: #262626;
  --border-hover: #404040;
  --text-primary: #ededed;
  --text-secondary: #a3a3a3;
  --text-tertiary: #737373;
  --accent-primary: #3291ff;
  --accent-hover: #0070f3;
  --success: #22c55e;
  --warning: #fbbf24;
  --danger: #f87171;
  
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.25);
  --shadow-md: 0 4px 16px rgba(0,0,0,0.34);
  --shadow-lg: 0 12px 32px rgba(0,0,0,0.46);
}
```

- [ ] **Step 2: Create CSS reset**

Create `src/styles/reset.css`:
```css
*, *::before, *::after {
  box-sizing: border-box;
}

* {
  margin: 0;
  padding: 0;
}

html {
  scroll-behavior: smooth;
}

body {
  min-height: 100vh;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

img, picture, video, canvas, svg {
  display: block;
  max-width: 100%;
}

input, button, textarea, select {
  font: inherit;
}

p, h1, h2, h3, h4, h5, h6 {
  overflow-wrap: break-word;
}
```

- [ ] **Step 3: Create global styles**

Create `src/styles/global.css`:
```css
body {
  color: var(--text-primary);
  background: var(--bg-base);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  transition: background 200ms ease, color 200ms ease;
}

a {
  color: inherit;
  text-decoration: none;
}

button {
  cursor: pointer;
  border: none;
  background: none;
}

:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
}
```

- [ ] **Step 4: Create useTheme composable**

Create `src/composables/useTheme.ts`:
```typescript
import { ref, watch } from 'vue'

type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'token-gate-theme'

export function useTheme() {
  const theme = ref<Theme>((localStorage.getItem(STORAGE_KEY) as Theme) || 'system')
  
  const applyTheme = () => {
    const root = document.documentElement
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const effectiveTheme = theme.value === 'system' ? (prefersDark ? 'dark' : 'light') : theme.value
    root.setAttribute('data-theme', effectiveTheme)
  }
  
  const setTheme = (newTheme: Theme) => {
    theme.value = newTheme
    localStorage.setItem(STORAGE_KEY, newTheme)
    applyTheme()
  }
  
  const toggleTheme = () => {
    const newTheme = theme.value === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
  }
  
  watch(() => theme.value, applyTheme, { immediate: true })
  
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme)
  
  return { theme, setTheme, toggleTheme }
}
```

- [ ] **Step 5: Add theme initialization script to index.html**

Modify `index.html` to add inline script before `</head>`:
```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Token Gate - AI Proxy Center</title>
    <script>
      (function() {
        const saved = localStorage.getItem('token-gate-theme') || 'system';
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = saved === 'system' ? (prefersDark ? 'dark' : 'light') : saved;
        document.documentElement.setAttribute('data-theme', theme);
      })();
    </script>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 6: Import styles in main.ts**

Modify `src/main.ts`:
```typescript
import { createApp } from 'vue'
import App from './App.vue'
import './styles/reset.css'
import './styles/variables.css'
import './styles/global.css'

const app = createApp(App)
app.mount('#app')
```

- [ ] **Step 7: Test theme system**

Modify `src/App.vue` to test theming:
```vue
<template>
  <div id="app">
    <h1>Token Gate Frontend</h1>
    <p>Current theme: {{ theme }}</p>
    <button @click="toggleTheme">Toggle Theme</button>
  </div>
</template>

<script setup lang="ts">
import { useTheme } from './composables/useTheme'

const { theme, toggleTheme } = useTheme()
</script>

<style>
#app {
  padding: 2rem;
}

button {
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  background: var(--accent-primary);
  color: white;
  border-radius: var(--radius-md);
}
</style>
```

- [ ] **Step 8: Verify theme switching**

Run: `npm run dev`
Expected: Theme toggle button works, background/text colors change between light/dark

- [ ] **Step 9: Commit**

```bash
git add frontend/
git commit -m "feat: implement theme system with light/dark modes

- Add CSS variables for theming (colors, spacing, shadows)
- Create useTheme composable for theme management
- Add theme initialization script to prevent flash
- Test theme switching functionality"
```

---

## Task 3: Router & Store Setup

**Files:**
- Create: `frontend/src/router/index.ts`
- Create: `frontend/src/stores/app.ts`
- Modify: `frontend/src/main.ts`
- Modify: `frontend/src/App.vue`
- Modify: `frontend/package.json`

**Interfaces:**
- Consumes: `useTheme()` from Task 2
- Produces: 
  - Router instance with routes: `/`, `/backends`, `/proxies`, `/client-keys`, `/usage-logs`, `/events`, `/settings`
  - `useAppStore()` with `isLoading: Ref<boolean>`, `sidebarCollapsed: Ref<boolean>`, `toggleSidebar(): void`

- [ ] **Step 1: Install router and store dependencies**

Run: `npm install vue-router@^4.2.0 pinia@^2.1.0`
Expected: Dependencies installed

- [ ] **Step 2: Create router configuration**

Create `src/router/index.ts`:
```typescript
import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: () => import('@/pages/Dashboard.vue')
    },
    {
      path: '/backends',
      name: 'backends',
      component: () => import('@/pages/Backends.vue')
    },
    {
      path: '/backends/:id',
      name: 'backend-detail',
      component: () => import('@/pages/BackendDetail.vue')
    },
    {
      path: '/proxies',
      name: 'proxies',
      component: () => import('@/pages/Proxies.vue')
    },
    {
      path: '/client-keys',
      name: 'client-keys',
      component: () => import('@/pages/ClientKeys.vue')
    },
    {
      path: '/usage-logs',
      name: 'usage-logs',
      component: () => import('@/pages/UsageLogs.vue')
    },
    {
      path: '/events',
      name: 'events',
      component: () => import('@/pages/Events.vue')
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/pages/Settings.vue')
    }
  ]
})

export default router
```

- [ ] **Step 3: Create app store**

Create `src/stores/app.ts`:
```typescript
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  const isLoading = ref(false)
  const sidebarCollapsed = ref(false)
  
  const setLoading = (loading: boolean) => {
    isLoading.value = loading
  }
  
  const toggleSidebar = () => {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }
  
  return {
    isLoading,
    sidebarCollapsed,
    setLoading,
    toggleSidebar
  }
})
```

- [ ] **Step 4: Register router and Pinia in main.ts**

Modify `src/main.ts`:
```typescript
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/reset.css'
import './styles/variables.css'
import './styles/global.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.mount('#app')
```

- [ ] **Step 5: Update App.vue to use router**

Modify `src/App.vue`:
```vue
<template>
  <router-view />
</template>

<script setup lang="ts">
import { useTheme } from './composables/useTheme'

// Initialize theme
useTheme()
</script>
```

- [ ] **Step 6: Create placeholder pages**

Create `src/pages/Dashboard.vue`:
```vue
<template>
  <div>
    <h1>Dashboard</h1>
  </div>
</template>
```

Create similar placeholders for: `Backends.vue`, `BackendDetail.vue`, `Proxies.vue`, `ClientKeys.vue`, `UsageLogs.vue`, `Events.vue`, `Settings.vue`

- [ ] **Step 7: Test routing**

Run: `npm run dev`
Expected: Navigate to http://localhost:5173/ shows Dashboard, routes work

- [ ] **Step 8: Commit**

```bash
git add frontend/
git commit -m "feat: set up Vue Router and Pinia

- Configure routes for all admin pages
- Create app store with loading and sidebar state
- Add placeholder pages for all routes"
```

---

## Remaining Tasks Summary

Due to the large scope of this frontend redesign project, the following tasks are outlined at a high level. Each task should follow TDD principles, include proper TypeScript typing, and be committed incrementally.

### Task 4: API Client Layer

**Key Deliverables:**
- `src/api/client.ts` - Axios instance with request/response interceptors
- `src/api/types.ts` - TypeScript interfaces for all API requests/responses
- `src/api/*.ts` - API modules for backends, proxies, clientKeys, usageLogs, events, dashboard, config
- Error handling, loading states, and Toast notifications

**Testing:** Mock Axios, test interceptors, verify error handling

### Task 5: Layout Components

**Key Deliverables:**
- `src/layouts/DefaultLayout.vue` - Sidebar + Topbar + Main content area
- `src/components/ui/Sidebar.vue` - Collapsible navigation sidebar
- `src/components/ui/Topbar.vue` - Header with breadcrumbs and theme toggle
- Responsive design (desktop + mobile)

**Testing:** Component tests for sidebar collapse, navigation active states

### Task 6: Base UI Component Library

**Key Deliverables:**
- Button, Input, Select, Textarea, Switch
- Dialog, Drawer, Tooltip, Toast
- Table, Badge, Card, Tabs
- LoadingSpinner, Skeleton, EmptyState

**Testing:** Component tests for each UI component, accessibility checks

### Task 7: Dashboard Page

**Key Deliverables:**
- `src/pages/Dashboard.vue` - Main dashboard layout
- `src/stores/dashboard.ts` - Dashboard state management
- Stats cards, usage chart, recent backends table, events timeline
- Integration with `/admin/api/dashboard/*` endpoints

**Testing:** Store tests, component rendering tests, API integration tests

### Task 8: Backends Management

**Key Deliverables:**
- `src/pages/Backends.vue` - List, search, create/edit/delete
- `src/pages/BackendDetail.vue` - Detail view
- `src/stores/backends.ts` - Backends state
- `src/components/features/BackendForm.vue` - Create/edit form
- `src/components/features/BackendStatusBadge.vue` - Status indicator

**Testing:** CRUD operations, form validation, status badge rendering

### Task 9: Proxies Management

**Key Deliverables:**
- `src/pages/Proxies.vue` - Proxies list and management
- `src/stores/proxies.ts` - Proxies state
- `src/components/features/ProxyForm.vue` - Proxy form

**Testing:** CRUD operations, form validation

### Task 10: Client Keys Management

**Key Deliverables:**
- `src/pages/ClientKeys.vue` - Client keys management
- `src/stores/clientKeys.ts` - Client keys state
- `src/components/features/ClientKeyForm.vue` - Client key form
- Token masking and one-time display logic

**Testing:** Token creation flow, masking logic

### Task 11: Usage Logs Page

**Key Deliverables:**
- `src/pages/UsageLogs.vue` - Logs table with filters
- Row expansion for request/response details
- Pagination, filtering, searching

**Testing:** Table interactions, filter logic, pagination

### Task 12: Events Page

**Key Deliverables:**
- `src/pages/Events.vue` - Event timeline
- `src/components/features/EventTimeline.vue` - Timeline component
- Event filtering and display

**Testing:** Timeline rendering, filtering

### Task 13: Settings Page & Backend API

**Key Deliverables:**
- Backend: New endpoints in `internal/app/app.go`:
  - `GET /admin/api/config`
  - `PUT /admin/api/config`
  - `POST /admin/api/config/reload`
- Backend: Settings table in SQLite
- Backend: Hot-reload logic for supported config items
- Frontend: `src/pages/Settings.vue` - Config management UI
- Frontend: `src/stores/config.ts` - Config state

**Testing:** Backend API tests, config persistence, hot-reload verification, frontend form validation

### Task 14: Build Integration & Go Embed

**Key Deliverables:**
- Verify build output to `web/` directory
- Ensure Go embed in `internal/app/app.go` works with new frontend
- Update `start.sh` if needed
- Test production build end-to-end

**Testing:** Production build, Go service serving static files, API calls work

### Task 15: Polish & Optimization

**Key Deliverables:**
- Animations and transitions
- Error states and empty states
- Loading states refinement
- Performance optimization (code splitting, lazy loading)
- Cross-browser testing

**Testing:** E2E tests, performance benchmarks

---

## Implementation Approach

Given the scope of this project, two execution strategies are recommended:

### Option 1: Subagent-Driven Development (Recommended)

- Use `superpowers:subagent-driven-development` skill
- Dispatch one subagent per task
- Review between tasks
- Allows parallel development of independent features

### Option 2: Incremental Implementation

- Implement tasks 1-3 first (foundation)
- Then implement Task 5-6 (layout + UI components)
- Then implement Task 7-12 (pages) in any order
- Finally Task 13-15 (backend integration, polish)

---

## Verification Checklist

After completing all tasks:

- [ ] All pages render correctly in light/dark themes
- [ ] All CRUD operations work (backends, proxies, client keys)
- [ ] Dashboard displays real-time data
- [ ] Settings page saves config and hot-reload works
- [ ] Production build outputs to `web/` correctly
- [ ] Go service serves frontend and API correctly
- [ ] No TypeScript errors
- [ ] No console errors in browser
- [ ] Responsive design works on mobile
- [ ] All routes accessible via navigation

---

## Notes

- This plan focuses on functionality over exhaustive step-by-step detail
- Each task should follow TDD: write tests first, then implementation
- Commit frequently (after each logical unit of work)
- Use TypeScript strict mode throughout
- Follow the design system defined in the spec
- API integration should use the existing `/admin/api/*` endpoints without modification (except Settings)

