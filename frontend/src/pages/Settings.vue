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
        <!-- Backend Management -->
        <Card class="settings-section">
          <h2 class="section-title">Backend Management</h2>

          <div class="form-group">
            <label class="form-label" for="backend-cooldown">Backend Cooldown</label>
            <input
              id="backend-cooldown"
              v-model="formData.backend_cooldown"
              type="text"
              class="form-input"
              placeholder="10m"
            />
            <p class="form-hint">How long to wait before retrying a failed backend (e.g., 5m, 10m, 1h). ✓ Hot-reload.</p>
          </div>

          <div class="form-group">
            <label class="form-label" for="backend-fails">Max Backend Failures</label>
            <input
              id="backend-fails"
              v-model="formData.backend_fails"
              type="text"
              class="form-input"
              placeholder="3"
            />
            <p class="form-hint">Number of consecutive failures before marking backend as unhealthy. ✓ Hot-reload.</p>
          </div>
        </Card>

        <!-- Request Handling -->
        <Card class="settings-section">
          <h2 class="section-title">Request Handling</h2>

          <div class="form-group">
            <label class="form-label" for="request-timeout">Request Timeout</label>
            <input
              id="request-timeout"
              v-model="formData.request_timeout"
              type="text"
              class="form-input"
              placeholder="30s"
            />
            <p class="form-hint">Maximum time to wait for upstream response (e.g., 30s, 1m, 2m). ✓ Hot-reload.</p>
          </div>
        </Card>

        <!-- Logging -->
        <Card class="settings-section">
          <h2 class="section-title">Logging</h2>

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
            <p class="form-hint">Control log verbosity. ✓ Hot-reload.</p>
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
import type { Config } from '@/api'

const settingsStore = useSettingsStore()

const config = ref(settingsStore.config)
const loading = ref(settingsStore.loading)
const error = ref(settingsStore.error)
const saving = ref(false)
const reloading = ref(false)

const formData = ref<Config>({
  listen_addr: ':8080',
  db_path: './token-gate.db',
  log_level: 'info',
  backend_cooldown: '10m',
  backend_fails: '3',
  request_timeout: '30s',
  shutdown_timeout: '10s'
})

const loadSettings = async () => {
  await settingsStore.fetchConfig()
  loading.value = settingsStore.loading
  error.value = settingsStore.error
  config.value = settingsStore.config

  if (settingsStore.config) {
    formData.value = { ...settingsStore.config }
  }
}

const resetForm = () => {
  if (config.value) {
    formData.value = { ...config.value }
  }
}

const handleSave = async () => {
  try {
    saving.value = true
    await settingsStore.updateConfig(formData.value)
    config.value = settingsStore.config
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
  } catch (err: any) {
    alert(err.message || 'Failed to reload configuration')
  } finally {
    reloading.value = false
  }
}

watch(() => settingsStore.config, (newConfig) => {
  config.value = newConfig
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
  font-size: 28px;
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
  padding: var(--spacing-xl);
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 var(--spacing-lg) 0;
  padding-bottom: var(--spacing-md);
  border-bottom: 1px solid var(--border);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-lg);
}

.form-group:last-of-type {
  margin-bottom: 0;
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
