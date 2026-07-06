<template>
  <form @submit.prevent="handleSubmit" class="backend-form">
    <!-- Section: Backend Service -->
    <section class="form-section">
      <div class="section-header">
        <div class="section-icon">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="4" rx="1.5" stroke="currentColor" stroke-width="1.4"/><rect x="2" y="9" width="12" height="4" rx="1.5" stroke="currentColor" stroke-width="1.4"/><circle cx="4.5" cy="5" r="0.75" fill="currentColor"/><circle cx="4.5" cy="11" r="0.75" fill="currentColor"/></svg>
        </div>
        <h3 class="section-title">后端服务</h3>
        <span class="section-desc">上游 API 服务的连接信息</span>
      </div>

      <div class="field-grid cols-2">
        <div class="form-field">
          <label for="name">名称 <span class="required">*</span></label>
          <input
            id="name"
            v-model="formData.name"
            type="text"
            placeholder="e.g. OpenAI Primary"
            required
          />
        </div>
        <div class="form-field">
          <label for="backend-type">后端类型</label>
          <select id="backend-type" v-model="formData.backend_type">
            <option value="">通用</option>
            <option value="new-api">new-api</option>
            <option value="sub2api">sub2api</option>
          </select>
        </div>
      </div>

      <div class="form-field">
        <label for="console-url">Server URL</label>
        <input
          id="console-url"
          v-model="formData.console_url"
          type="url"
          placeholder="https://console.example.com"
        />
      </div>

      <div class="field-grid cols-2">
        <div class="form-field">
          <label for="console-username">用户名</label>
          <input
            id="console-username"
            v-model="formData.console_username"
            type="text"
            placeholder="admin"
          />
        </div>
        <div class="form-field">
          <label for="console-password">密码</label>
          <div class="input-with-action">
            <input
              id="console-password"
              v-model="formData.console_password"
              :type="showConsolePassword ? 'text' : 'password'"
              placeholder="••••••"
            />
            <button type="button" class="input-action-btn" @click="showConsolePassword = !showConsolePassword" tabindex="-1">
              <svg v-if="!showConsolePassword" width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" stroke-width="1.4"/><circle cx="8" cy="8" r="2.5" stroke="currentColor" stroke-width="1.4"/></svg>
              <svg v-else width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" stroke-width="1.4"/><line x1="2" y1="14" x2="14" y2="2" stroke="currentColor" stroke-width="1.4"/></svg>
            </button>
          </div>
        </div>
      </div>

      <div v-if="isSub2APIBackendType" class="form-field">
        <label for="console-authorization">Authorization</label>
        <textarea
          id="console-authorization"
          v-model="formData.console_authorization"
          rows="2"
          placeholder="Bearer sk-..."
        ></textarea>
      </div>

      <div v-if="isSub2APIBackendType" class="form-field">
        <label for="console-checkin-path">签到 Path</label>
        <input
          id="console-checkin-path"
          v-model="formData.console_checkin_path"
          type="text"
          placeholder="/api/v1/checkin"
        />
      </div>

      <div v-if="isSub2APIBackendType" class="form-field">
        <label for="channel-url">渠道 URL</label>
        <input
          id="channel-url"
          v-model="formData.channel_url"
          type="text"
          placeholder="/api/v1/channels"
        />
      </div>

      <div v-if="isNewAPIBackendType" class="form-field">
        <label for="console-cookie">Cookie</label>
        <textarea
          id="console-cookie"
          v-model="formData.console_cookie"
          rows="2"
          placeholder="session=abc123..."
        ></textarea>
      </div>

      <div v-if="isNewAPIBackendType" class="form-field">
        <label for="console-user-id">用户 ID</label>
        <input
          id="console-user-id"
          v-model="formData.console_user_id"
          type="text"
          placeholder="1929"
        />
      </div>

      <div class="field-grid cols-2">
        <div class="form-field">
          <label for="tags">标签</label>
          <input
            id="tags"
            v-model="formData.tags"
            type="text"
            placeholder="hk, priority, vip"
          />
        </div>
        <div class="form-field">
          <label for="notes">备注</label>
          <input
            id="notes"
            v-model="formData.notes"
            type="text"
            placeholder="运维备注..."
          />
        </div>
      </div>
    </section>

    <!-- Section: Relay Configuration -->
    <section class="form-section">
      <div class="section-header">
        <div class="section-icon">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 8h4m4 0h4M8 2v4m0 4v4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="8" cy="8" r="2.5" stroke="currentColor" stroke-width="1.4"/></svg>
        </div>
        <h3 class="section-title">转发配置</h3>
        <span class="section-desc">模型路由与负载均衡</span>
      </div>

      <div class="form-field">
        <label for="base-url">Base URL <span class="required">*</span></label>
        <input
          id="base-url"
          v-model="formData.base_url"
          type="url"
          placeholder="https://api.openai.com/v1"
          required
        />
      </div>

      <div class="form-field">
        <label for="api-key">API Key <span class="required">*</span></label>
        <div class="input-with-action">
          <input
            id="api-key"
            v-model="formData.api_key"
            :type="showApiKey ? 'text' : 'password'"
            placeholder="sk-..."
            required
          />
          <button type="button" class="input-action-btn" @click="showApiKey = !showApiKey" tabindex="-1">
            <svg v-if="!showApiKey" width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" stroke-width="1.4"/><circle cx="8" cy="8" r="2.5" stroke="currentColor" stroke-width="1.4"/></svg>
            <svg v-else width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" stroke-width="1.4"/><line x1="2" y1="14" x2="14" y2="2" stroke="currentColor" stroke-width="1.4"/></svg>
          </button>
        </div>
      </div>

      <div class="field-grid cols-2">
        <div class="form-field">
          <label for="protocol">上游协议</label>
          <select id="protocol" v-model="formData.protocol">
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="both">OpenAI + Anthropic</option>
          </select>
        </div>
        <div class="form-field">
          <label for="weight">权重</label>
          <input
            id="weight"
            v-model.number="formData.weight"
            type="number"
            min="1"
            max="100"
            placeholder="10"
          />
          <span class="field-hint">负载均衡权重 1-100</span>
        </div>
      </div>

      <div class="form-field">
        <label for="models">Models <span class="required">*</span></label>
        <input
          id="models"
          v-model="formData.models"
          type="text"
          placeholder="gpt-4o, claude-3-5-sonnet, gpt-image-*"
          required
        />
        <span class="field-hint">逗号分隔，此 backend 可服务的模型列表</span>
      </div>

      <div class="form-field">
        <label for="model-mapping">Model Mapping</label>
        <textarea
          id="model-mapping"
          v-model="formData.model_mapping"
          rows="3"
          class="mono"
          placeholder='{ "gpt-4o": "azure-gpt-4o" }'
        ></textarea>
        <span v-if="modelMappingError" class="field-error">{{ modelMappingError }}</span>
        <span v-else class="field-hint">JSON: 客户端模型名 → 上游模型名</span>
      </div>

      <div class="form-field">
        <label for="proxy">代理</label>
        <select id="proxy" v-model.number="formData.proxy_id">
          <option :value="0">无代理</option>
          <option
            v-for="proxy in proxies"
            :key="proxy.id"
            :value="proxy.id"
          >
            {{ proxy.name }} ({{ proxy.address }})
          </option>
        </select>
      </div>
    </section>

    <!-- Actions -->
    <div class="form-actions">
      <Button type="button" variant="secondary" @click="$emit('cancel')">
        取消
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
  extractConsoleUserID,
  formatModelMappingForInput,
  normalizeBackendProxyId,
  parseBackendTagInput,
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
  submitLabel: '保存'
})

const emit = defineEmits<{
  submit: [data: CreateBackendRequest]
  cancel: []
}>()

interface BackendFormData {
  name: string
  protocol: 'openai' | 'anthropic' | 'both'
  backend_type: '' | 'new-api' | 'sub2api'
  base_url: string
  api_key: string
  model_mapping: string
  proxy_id: number
  weight: number
  models: string
  console_url: string
  console_authorization: string
  console_checkin_path: string
  channel_url: string
  console_cookie: string
  console_user_id: string
  tags: string
  console_username: string
  console_password: string
  notes: string
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
  console_url: '',
  console_authorization: '',
  console_checkin_path: '',
  channel_url: '',
  console_cookie: '',
  console_user_id: '',
  tags: '',
  console_username: '',
  console_password: '',
  notes: ''
})

const formData = ref<BackendFormData>(defaultFormData())
const showApiKey = ref(false)
const showConsolePassword = ref(false)
const isNewAPIBackendType = computed(() => formData.value.backend_type === 'new-api')
const isSub2APIBackendType = computed(() => formData.value.backend_type === 'sub2api')

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
    console_authorization: formData.value.backend_type === 'sub2api' ? formData.value.console_authorization.trim() : '',
    console_checkin_path: formData.value.backend_type === 'sub2api' ? formData.value.console_checkin_path.trim() : '',
    channel_url: formData.value.backend_type === 'sub2api' ? formData.value.channel_url.trim() : '',
    console_cookie: formData.value.backend_type === 'new-api' ? formData.value.console_cookie.trim() : '',
    console_user_id: formData.value.backend_type === 'new-api' ? formData.value.console_user_id.trim() : '',
    tags: parseBackendTagInput(formData.value.tags),
    console_username: formData.value.console_username.trim(),
    console_password: formData.value.console_password.trim(),
    notes: formData.value.notes.trim(),
    proxy_id: formData.value.proxy_id || 0,
    weight: formData.value.weight,
    models: parseModelListInput(formData.value.models),
    model_mapping: parseModelMappingInput(formData.value.model_mapping)
  })
}

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
      console_url: backend.console_url || '',
      console_authorization: backend.console_authorization || '',
      console_checkin_path: backend.console_checkin_path || '',
      channel_url: backend.channel_url || '',
      console_cookie: backend.console_cookie || '',
      console_user_id: extractConsoleUserID(backend.console_account_json),
      tags: (backend.tags || []).join(', '),
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
  gap: var(--spacing-lg);
}

/* --- Section --- */
.form-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: var(--bg-subtle);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.section-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  background: var(--bg-muted);
  color: var(--text-secondary);
  flex-shrink: 0;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.section-desc {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-left: auto;
}

/* --- Fields --- */
.form-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-field label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  line-height: 1;
}

.required {
  color: var(--danger);
}

.form-field input,
.form-field select,
.form-field textarea {
  padding: 7px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 13px;
  color: var(--text-primary);
  background: var(--bg-base);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
  line-height: 1.4;
}

.form-field input:focus,
.form-field select:focus,
.form-field textarea:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 2px rgba(0, 112, 243, 0.08);
}

.form-field input::placeholder,
.form-field textarea::placeholder {
  color: var(--text-tertiary);
}

.form-field textarea {
  resize: vertical;
  min-height: 48px;
}

.form-field textarea.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}

.field-hint {
  font-size: 11px;
  color: var(--text-tertiary);
  line-height: 1.3;
}

.field-error {
  font-size: 11px;
  color: var(--danger);
  line-height: 1.3;
}

/* --- Grid --- */
.field-grid {
  display: grid;
  gap: 12px;
}

.field-grid.cols-2 {
  grid-template-columns: 1fr 1fr;
}

/* --- Input with action button --- */
.input-with-action {
  position: relative;
  display: flex;
}

.input-with-action input {
  flex: 1;
  padding-right: 32px;
}

.input-action-btn {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  border-radius: var(--radius-sm);
}

.input-action-btn:hover {
  color: var(--text-secondary);
  background: var(--bg-muted);
}

/* --- Actions --- */
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}
</style>
