<template>
  <DefaultLayout>
    <div class="settings-page">
      <div class="page-header">
        <div>
          <h1>Settings</h1>
          <p class="page-description">Configure system settings and behavior</p>
        </div>
        <div class="header-actions">
          <Button
            variant="secondary"
            size="sm"
            @click="handleReload"
            :loading="reloading"
          >
            🔄 Reload Config
          </Button>
        </div>
      </div>

      <!-- Loading State -->
      <LoadingSpinner v-if="loading && !config" message="Loading settings..." />

      <!-- Error State -->
      <Card v-else-if="error">
        <EmptyState icon="⚠️" title="Failed to load settings" :description="error">
          <template #action>
            <Button @click="loadSettings">Retry</Button>
          </template>
        </EmptyState>
      </Card>

      <!-- Settings Form -->
      <form v-else @submit.prevent="handleSave" class="settings-form">
        <!-- Server Settings -->
        <Card class="settings-section">
          <h2 class="section-title">Server Settings</h2>

          <div class="form-group">
            <label class="form-label" for="server-host">Server Host</label>
            <input
              id="server-host"
              v-model="formData.server_host"
              type="text"
              class="form-input"
              placeholder="0.0.0.0"
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="server-port">Server Port</label>
            <input
              id="server-port"
              v-model.number="formData.server_port"
              type="number"
              class="form-input"
              placeholder="4000"
            />
          </div>

          <div class="form-group checkbox-group">
            <label class="checkbox-label">
              <input
                v-model="formData.enable_admin"
                type="checkbox"
                class="form-checkbox"
              />
              <span>Enable Admin UI</span>
            </label>
          </div>
        </Card>

        <!-- Routing Settings -->
        <Card class="settings-section">
          <h2 class="section-title">Routing & Load Balancing</h2>

          <div class="form-group">
            <label class="form-label" for="routing-strategy">Routing Strategy</label>
            <select
              id="routing-strategy"
              v-model="formData.routing_strategy"
              class="form-select"
            >
              <option value="round_robin">Round Robin</option>
              <option value="weighted">Weighted</option>
              <option value="priority">Priority-based</option>
              <option value="least_latency">Least Latency</option>
            </select>
            <p class="form-hint">How requests are distributed across backends</p>
          </div>

          <div class="form-group">
            <label class="form-label" for="health-check-interval">Health Check Interval (seconds)</label>
            <input
              id="health-check-interval"
              v-model.number="formData.health_check_interval"
              type="number"
              min="10"
              class="form-input"
              placeholder="60"
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="max-retries">Max Retries</label>
            <input
              id="max-retries"
              v-model.number="formData.max_retries"
              type="number"
              min="0"
              max="5"
              class="form-input"
              placeholder="2"
            />
          </div>
        </Card>

        <!-- Rate Limiting -->
        <Card class="settings-section">
          <h2 class="section-title">Rate Limiting</h2>

          <div class="form-group">
            <label class="form-label" for="global-rate-limit">Global Rate Limit (requests/minute)</label>
            <input
              id="global-rate-limit"
              v-model.number="formData.global_rate_limit"
              type="number"
              min="0"
              class="form-input"
              placeholder="0 = unlimited"
            />
          </div>

          <div class="form-group checkbox-group">
            <label class="checkbox-label">
              <input
                v-model="formData.enable_rate_limiting"
                type="checkbox"
                class="form-checkbox"
              />
              <span>Enable Rate Limiting</span>
            </label>
          </div>
        </Card>

        <!-- Logging & Monitoring -->
        <Card class="settings-section">
          <h2 class="section-title">Logging & Monitoring</h2>

          <div class="form-group">
            <label class="form-label" for="log-level">Log Level</label>
            <select
              id="log-level"
              v-model="formData.log_level"
              class="form-select"
            >
              <option value="debug">Debug</option>
              <option value="info">Info</option>
              <option value="warn">Warning</option>
              <option value="error">Error</option>
            </select>
          </div>

          <div class="form-group checkbox-group">
            <label class="checkbox-label">
              <input
                v-model="formData.enable_usage_logging"
                type="checkbox"
                class="form-checkbox"
              />
              <span>Enable Usage Logging</span>
            </label>
          </div>

          <div class="form-group checkbox-group">
            <label class="checkbox-label">
              <input
                v-model="formData.enable_audit_logging"
                type="checkbox"
                class="form-checkbox"
              />
              <span>Enable Audit Logging</span>
            </label>
          </div>
        </Card>

        <!-- Actions -->
        <div class="form-actions">
          <Button type="button" variant="secondary" @click="resetForm">
            Reset
          </Button>
          <Button type="submit" :loading="saving">
            Save Settings
          </Button>
        </div>
      </form>
    </div>
  </DefaultLayout>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import Card from '@/components/ui/Card.vue'
import Button from '@/components/ui/Button.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import { useSettingsStore } from '@/stores/settings'
import type { UpdateConfigRequest } from '@/api'

const settingsStore = useSettingsStore()

const config = ref(settingsStore.config)
const loading = ref(settingsStore.loading)
const error = ref(settingsStore.error)
const saving = ref(false)
const reloading = ref(false)

const formData = ref<UpdateConfigRequest>({
  server_host: '0.0.0.0',
  server_port: 4000,
  enable_admin: true,
  routing_strategy: 'round_robin',
  health_check_interval: 60,
  max_retries: 2,
  global_rate_limit: 0,
  enable_rate_limiting: true,
  log_level: 'info',
  enable_usage_logging: true,
  enable_audit_logging: true
})

const loadSettings = async () => {
  await settingsStore.fetchConfig()
  if (settingsStore.config) {
    formData.value = { ...settingsStore.config }
  }
}

const resetForm = () => {
  if (settingsStore.config) {
    formData.value = { ...settingsStore.config }
  }
}

const handleSave = async () => {
  try {
    saving.value = true
    await settingsStore.updateConfig(formData.value)
    alert('Settings saved successfully!')
  } catch (err: any) {
    alert(err.message || 'Failed to save settings')
  } finally {
    saving.value = false
  }
}

const handleReload = async () => {
  try {
    reloading.value = true
    await settingsStore.reloadConfig()
    if (settingsStore.config) {
      formData.value = { ...settingsStore.config }
    }
    alert('Configuration reloaded successfully!')
  } catch (err: any) {
    alert(err.message || 'Failed to reload config')
  } finally {
    reloading.value = false
  }
}

watch(() => settingsStore.config, (newConfig) => {
  if (newConfig) {
    config.value = newConfig
  }
})

watch(() => settingsStore.loading, (newLoading) => {
  loading.value = newLoading
})

watch(() => settingsStore.error, (newError) => {
  error.value = newError
})

onMounted(() => {
  loadSettings()
})
</script>

<style scoped>
.settings-page {
  max-width: 900px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing-2xl);
  gap: var(--spacing-lg);
}

.page-header h1 {
  font-size: 32px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 var(--spacing-xs) 0;
}

.page-description {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
}

.header-actions {
  display: flex;
  gap: var(--spacing-sm);
}

.settings-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  padding-bottom: var(--spacing-md);
  border-bottom: 1px solid var(--border);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.form-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
}

.form-input,
.form-select {
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 14px;
  color: var(--text-primary);
  background: var(--bg-base);
  transition: all 150ms ease;
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px rgba(0, 112, 243, 0.1);
}

.form-input::placeholder {
  color: var(--text-tertiary);
}

.form-hint {
  font-size: 12px;
  color: var(--text-tertiary);
  margin: 0;
}

.checkbox-group {
  flex-direction: row;
  align-items: center;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: 14px;
  color: var(--text-secondary);
  cursor: pointer;
}

.form-checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-md);
  padding-top: var(--spacing-lg);
}
</style>
