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
