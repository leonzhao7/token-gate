<template>
  <form @submit.prevent="handleSubmit" class="backend-form">
    <!-- Basic Info -->
    <div class="form-section">
      <h3 class="section-title">Basic Information</h3>

      <div class="form-group">
        <label class="form-label" for="name">Name *</label>
        <input
          id="name"
          v-model="formData.name"
          type="text"
          class="form-input"
          placeholder="e.g., OpenAI GPT-4"
          required
        />
      </div>

      <div class="form-group">
        <label class="form-label" for="base-url">Base URL *</label>
        <input
          id="base-url"
          v-model="formData.base_url"
          type="url"
          class="form-input"
          placeholder="https://api.openai.com/v1"
          required
        />
      </div>

      <div class="form-group">
        <label class="form-label" for="api-key">API Key *</label>
        <input
          id="api-key"
          v-model="formData.api_key"
          type="password"
          class="form-input"
          placeholder="sk-..."
          required
        />
      </div>

      <div class="form-group">
        <label class="form-label" for="model">Model Mapping</label>
        <input
          id="model"
          v-model="formData.model_mapping"
          type="text"
          class="form-input"
          placeholder="gpt-4:gpt-4-turbo,gpt-3.5-turbo:gpt-3.5-turbo-16k"
        />
        <p class="form-hint">Format: client_model:backend_model (comma-separated)</p>
      </div>
    </div>

    <!-- Proxy Settings -->
    <div class="form-section">
      <h3 class="section-title">Proxy Settings</h3>

      <div class="form-group">
        <label class="form-label" for="proxy">SOCKS Proxy</label>
        <select
          id="proxy"
          v-model="formData.socks_proxy_id"
          class="form-select"
        >
          <option :value="null">No Proxy</option>
          <option
            v-for="proxy in proxies"
            :key="proxy.id"
            :value="proxy.id"
          >
            {{ proxy.name }} ({{ proxy.address }})
          </option>
        </select>
      </div>
    </div>

    <!-- Advanced Settings -->
    <div class="form-section">
      <h3 class="section-title">Advanced Settings</h3>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="weight">Weight</label>
          <input
            id="weight"
            v-model.number="formData.weight"
            type="number"
            min="1"
            max="100"
            class="form-input"
          />
          <p class="form-hint">Load balancing weight (1-100)</p>
        </div>

        <div class="form-group">
          <label class="form-label" for="priority">Priority</label>
          <input
            id="priority"
            v-model.number="formData.priority"
            type="number"
            min="1"
            max="10"
            class="form-input"
          />
          <p class="form-hint">Routing priority (1=highest)</p>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" for="max-rpm">Max RPM</label>
        <input
          id="max-rpm"
          v-model.number="formData.max_requests_per_minute"
          type="number"
          min="0"
          class="form-input"
          placeholder="0 = unlimited"
        />
      </div>

      <div class="form-group checkbox-group">
        <label class="checkbox-label">
          <input
            v-model="formData.enabled"
            type="checkbox"
            class="form-checkbox"
          />
          <span>Enabled</span>
        </label>
      </div>
    </div>

    <!-- Actions -->
    <div class="form-actions">
      <Button type="button" variant="secondary" @click="$emit('cancel')">
        Cancel
      </Button>
      <Button type="submit" :loading="loading" :disabled="!isValid">
        {{ submitLabel }}
      </Button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import Button from '@/components/ui/Button.vue'
import type { Backend, SocksProxy, CreateBackendRequest } from '@/api'

interface Props {
  backend?: Backend
  proxies: SocksProxy[]
  loading?: boolean
  submitLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  submitLabel: 'Save Backend'
})

const emit = defineEmits<{
  submit: [data: CreateBackendRequest]
  cancel: []
}>()

const formData = ref<CreateBackendRequest>({
  name: '',
  base_url: '',
  api_key: '',
  model_mapping: '',
  socks_proxy_id: null,
  weight: 10,
  priority: 5,
  max_requests_per_minute: 0,
  enabled: true
})

const isValid = computed(() => {
  return !!(
    formData.value.name?.trim() &&
    formData.value.base_url?.trim() &&
    formData.value.api_key?.trim()
  )
})

const handleSubmit = () => {
  if (!isValid.value) return
  emit('submit', formData.value)
}

// Initialize form with existing backend data
watch(() => props.backend, (backend) => {
  if (backend) {
    formData.value = {
      name: backend.name,
      base_url: backend.base_url,
      api_key: backend.api_key || '',
      model_mapping: backend.model_mapping || '',
      socks_proxy_id: backend.socks_proxy_id,
      weight: backend.weight,
      priority: backend.priority,
      max_requests_per_minute: backend.max_requests_per_minute || 0,
      enabled: backend.enabled
    }
  }
}, { immediate: true })
</script>

<style scoped>
.backend-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2xl);
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--spacing-sm);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacing-lg);
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
  border-top: 1px solid var(--border);
}
</style>
