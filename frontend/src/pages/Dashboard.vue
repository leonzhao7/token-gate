<template>
  <DefaultLayout>
    <div class="dashboard">
      <div class="dashboard-header">
        <h1>Dashboard</h1>
        <Button @click="refreshData" :loading="loading" size="sm" variant="secondary">
          🔄 Refresh
        </Button>
      </div>

      <!-- Loading State -->
      <LoadingSpinner v-if="loading && !summary" message="Loading dashboard..." />

      <!-- Error State -->
      <Card v-else-if="error">
        <EmptyState icon="⚠️" title="Failed to load dashboard" :description="error">
          <template #action>
            <Button @click="refreshData">Retry</Button>
          </template>
        </EmptyState>
      </Card>

      <!-- Dashboard Content -->
      <div v-else class="dashboard-content">
        <!-- Stats Grid -->
        <div class="stats-grid">
          <StatCard
            label="Total Backends"
            :value="summary?.backends_total || 0"
            icon="🔌"
            iconBg="rgba(0, 112, 243, 0.1)"
          />
          <StatCard
            label="Healthy Backends"
            :value="summary?.backends_healthy || 0"
            icon="✅"
            iconBg="rgba(22, 163, 74, 0.1)"
          />
          <StatCard
            label="Abnormal Backends"
            :value="summary?.backends_abnormal || 0"
            icon="⚠️"
            iconBg="rgba(245, 158, 11, 0.1)"
          />
          <StatCard
            label="Client Keys"
            :value="summary?.client_keys_total || 0"
            icon="🔑"
            iconBg="rgba(168, 85, 247, 0.1)"
          />
          <StatCard
            label="Requests (24h)"
            :value="summary?.requests_24h || 0"
            icon="📊"
            iconBg="rgba(59, 130, 246, 0.1)"
            :change="summary?.requests_growth"
          />
          <StatCard
            label="Error Rate"
            :value="`${((summary?.error_rate || 0) * 100).toFixed(1)}%`"
            icon="🔴"
            iconBg="rgba(239, 68, 68, 0.1)"
          />
        </div>

        <!-- Recent Activity -->
        <Card title="Recent Activity" class="activity-card">
          <div v-if="recentActivity.length === 0" class="activity-empty">
            <EmptyState icon="📋" title="No recent activity" description="Activity will appear here as you manage resources" />
          </div>
          <div v-else class="activity-list">
            <div v-for="event in recentActivity" :key="event.id" class="activity-item">
              <div class="activity-icon">📝</div>
              <div class="activity-content">
                <p class="activity-action">
                  <strong>{{ event.action }}</strong> on {{ event.resource_type }}
                </p>
                <p class="activity-time">{{ formatTime(event.created_at) }}</p>
              </div>
            </div>
          </div>
        </Card>

        <!-- Quick Actions -->
        <Card title="Quick Actions" class="actions-card">
          <div class="actions-grid">
            <router-link to="/backends" class="action-link">
              <div class="action-icon">🔌</div>
              <div class="action-text">
                <h4>Manage Backends</h4>
                <p>Add or configure AI backends</p>
              </div>
            </router-link>
            <router-link to="/client-keys" class="action-link">
              <div class="action-icon">🔑</div>
              <div class="action-text">
                <h4>Create Client Key</h4>
                <p>Generate new API keys</p>
              </div>
            </router-link>
            <router-link to="/usage-logs" class="action-link">
              <div class="action-icon">📝</div>
              <div class="action-text">
                <h4>View Usage Logs</h4>
                <p>Monitor API requests</p>
              </div>
            </router-link>
            <router-link to="/settings" class="action-link">
              <div class="action-icon">⚙️</div>
              <div class="action-text">
                <h4>System Settings</h4>
                <p>Configure the gateway</p>
              </div>
            </router-link>
          </div>
        </Card>
      </div>
    </div>
  </DefaultLayout>
</template>

<script setup lang="ts">
import { onMounted, computed } from 'vue'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import Card from '@/components/ui/Card.vue'
import Button from '@/components/ui/Button.vue'
import StatCard from '@/components/ui/StatCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import { useDashboardStore } from '@/stores/dashboard'

const dashboardStore = useDashboardStore()

const summary = computed(() => dashboardStore.summary)
const recentActivity = computed(() => dashboardStore.recentActivity)
const loading = computed(() => dashboardStore.loading)
const error = computed(() => dashboardStore.error)

const refreshData = async () => {
  await dashboardStore.fetchAll()
}

const formatTime = (timestamp: string) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} minutes ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours} hours ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays} days ago`
}

onMounted(() => {
  refreshData()
})
</script>

<style scoped>
.dashboard {
  max-width: 1400px;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-2xl);
}

.dashboard-header h1 {
  font-size: 32px;
  font-weight: 600;
  color: var(--text-primary);
}

.dashboard-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2xl);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--spacing-lg);
}

.activity-card,
.actions-card {
  margin-top: var(--spacing-lg);
}

.activity-empty {
  padding: var(--spacing-xl) 0;
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.activity-item {
  display: flex;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  transition: background 150ms ease;
}

.activity-item:hover {
  background: var(--bg-subtle);
}

.activity-icon {
  font-size: 20px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-muted);
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.activity-content {
  flex: 1;
}

.activity-action {
  font-size: 14px;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.activity-time {
  font-size: 12px;
  color: var(--text-tertiary);
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--spacing-md);
}

.action-link {
  display: flex;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  text-decoration: none;
  transition: all 150ms ease;
}

.action-link:hover {
  border-color: var(--accent-primary);
  background: var(--bg-subtle);
  transform: translateY(-2px);
}

.action-icon {
  font-size: 32px;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.action-text h4 {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.action-text p {
  font-size: 13px;
  color: var(--text-secondary);
}
</style>
