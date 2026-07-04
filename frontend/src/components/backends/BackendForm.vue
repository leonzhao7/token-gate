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
        <label class="form-label" for="protocol">Protocol</label>
        <select
          id="protocol"
          v-model="formData.protocol"
          class="form-select"
        >
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label" for="backend-type">Backend Type</label>
        <select
          id="backend-type"
          v-model="formData.backend_type"
          class="form-select"
        >
          <option value="">None</option>
          <option value="new-api">new-api</option>
        </select>
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
        <label class="form-label" for="models">Models *</label>
        <input
          id="models"
          v-model="formData.models"
          type="text"
          class="form-input"
          placeholder="gpt-4o, claude-3-5-sonnet, gpt-image-*"
          required
        />
        <p class="form-hint">Comma-separated client model names this backend can serve.</p>
      </div>

      <div class="form-group">
        <label class="form-label" for="model">Model Mapping</label>
        <textarea
          id="model"
          v-model="formData.model_mapping"
          class="form-input form-textarea"
          rows="5"
          placeholder="{&#10;  &quot;gpt-4o&quot;: &quot;azure-gpt-4o&quot;&#10;}"
        ></textarea>
        <p class="form-hint">JSON object: client model to upstream model.</p>
        <p v-if="modelMappingError" class="form-error">{{ modelMappingError }}</p>
      </div>
    </div>

    <!-- Console Settings -->
    <div class="form-section">
      <h3 class="section-title">Console Settings</h3>

      <div class="form-group">
        <label class="form-label" for="console-url">Console URL</label>
        <input
          id="console-url"
          v-model="formData.console_url"
          type="url"
          class="form-input"
          placeholder="https://console.example.com"
        />
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="console-username">Console Username</label>
          <input
            id="console-username"
            v-model="formData.console_username"
            type="text"
            class="form-input"
            placeholder="tom"
          />
        </div>
        <div class="form-group">
          <label class="form-label" for="console-password">Console Password</label>
          <input
            id="console-password"
            v-model="formData.console_password"
            type="password"
            class="form-input"
            placeholder="tom_passwd"
          />
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" for="console-cookie">Console Cookie</label>
        <textarea
          id="console-cookie"
          v-model="formData.console_cookie"
          class="form-input form-textarea"
          rows="3"
          placeholder="session=..."
        ></textarea>
      </div>
    </div>

    <!-- Proxy Settings -->
    <div class="form-section">
      <h3 class="section-title">Proxy Settings</h3>

      <div class="form-group">
        <label class="form-label" for="proxy">SOCKS Proxy</label>
        <select
          id="proxy"
          v-model.number="formData.proxy_id"
          class="form-select"
        >
          <option :value="0">No Proxy</option>
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
import {
  formatModelMappingForInput,
  normalizeBackendProxyId,
  parseModelListInput,
  parseModelMappingInput,
} from './backendPayload'

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

interface BackendFormData {
  name: string
  protocol: 'openai' | 'anthropic'
  backend_type: '' | 'new-api'
  base_url: string
  api_key: string
  model_mapping: string
  proxy_id: number
  weight: number
  models: string
  endpoints: string[]
  console_url: string
  console_cookie: string
  tags?: string[]
  console_username: string
  console_password: string
  notes?: string
}

const defaultFormData = (): BackendFormData => ({
  name: '',
  protocol: 'openai',
  backend_type: 'new-api',
  base_url: '',
  api_key: '',
  model_mapping: '',
  proxy_id: 0,
  weight: 10,
  models: '',
  endpoints: [],
  console_url: '',
  console_cookie: '',
  console_username: '',
  console_password: ''
})

const formData = ref<BackendFormData>(defaultFormData())

const modelMappingError = computed(() => {
  try {
    parseModelMappingInput(formData.value.model_mapping)
    return ''
  } catch (err) {
    return err instanceof Error ? err.message : 'Model mapping is invalid'
  }
})

const isValid = computed(() => {
  return !!(
    formData.value.name?.trim() &&
    formData.value.base_url?.trim() &&
    formData.value.api_key?.trim() &&
    parseModelListInput(formData.value.models).length > 0 &&
    !modelMappingError.value
  )
})

const handleSubmit = () => {
  if (!isValid.value) return
  emit('submit', {
    name: formData.value.name.trim(),
    protocol: formData.value.protocol,
    backend_type: formData.value.backend_type,
    base_url: formData.value.base_url.trim(),
    api_key: formData.value.api_key,
    console_url: formData.value.console_url.trim(),
    console_cookie: formData.value.console_cookie.trim(),
    tags: formData.value.tags || [],
    console_username: formData.value.console_username.trim(),
    console_password: formData.value.console_password.trim(),
    notes: formData.value.notes || '',
    proxy_id: formData.value.proxy_id || 0,
    weight: formData.value.weight,
    models: parseModelListInput(formData.value.models),
    model_mapping: parseModelMappingInput(formData.value.model_mapping),
    endpoints: formData.value.endpoints || []
  })
}

// Initialize form with existing backend data
watch(() => props.backend, (backend) => {
  if (backend) {
    formData.value = {
      name: backend.name,
      protocol: backend.protocol || 'openai',
      backend_type: backend.backend_type ?? 'new-api',
      base_url: backend.base_url,
      api_key: backend.api_key || '',
      model_mapping: formatModelMappingForInput(backend.model_mapping),
      proxy_id: normalizeBackendProxyId(backend),
      weight: backend.weight,
      models: (backend.models || []).join(', '),
      endpoints: backend.endpoints || [],
      console_url: backend.console_url || '',
      console_cookie: backend.console_cookie || '',
      tags: backend.tags || [],
      console_username: backend.console_username || '',
      console_password: backend.console_password || '',
      notes: backend.notes || ''
    }
  } else {
    formData.value = defaultFormData()
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

.form-textarea {
  min-height: 112px;
  resize: vertical;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  line-height: 1.5;
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

.form-error {
  font-size: 12px;
  color: var(--danger);
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
