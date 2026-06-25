<template>
  <form @submit.prevent="handleSubmit" class="client-key-form">
    <div class="form-section">
      <h3 class="section-title">Key Information</h3>

      <div class="form-group">
        <label class="form-label" for="name">Name *</label>
        <input
          id="name"
          v-model="formData.name"
          type="text"
          class="form-input"
          placeholder="e.g., Production App"
          required
        />
      </div>

      <div class="form-group">
        <label class="form-label" for="description">Description</label>
        <textarea
          id="description"
          v-model="formData.description"
          class="form-textarea"
          placeholder="Optional description"
          rows="3"
        />
      </div>
    </div>

    <div class="form-section">
      <h3 class="section-title">Limits & Restrictions</h3>

      <div class="form-group">
        <label class="form-label" for="rate-limit">Rate Limit (requests/minute)</label>
        <input
          id="rate-limit"
          v-model.number="formData.rate_limit"
          type="number"
          min="0"
          class="form-input"
          placeholder="0 = unlimited"
        />
      </div>

      <div class="form-group">
        <label class="form-label" for="quota">Quota (total requests)</label>
        <input
          id="quota"
          v-model.number="formData.quota"
          type="number"
          min="0"
          class="form-input"
          placeholder="0 = unlimited"
        />
      </div>

      <div class="form-group">
        <label class="form-label" for="allowed-models">Allowed Models</label>
        <input
          id="allowed-models"
          v-model="formData.allowed_models"
          type="text"
          class="form-input"
          placeholder="gpt-4,gpt-3.5-turbo (comma-separated, empty = all)"
        />
      </div>

      <div class="form-group">
        <label class="form-label" for="expires-at">Expiration Date</label>
        <input
          id="expires-at"
          v-model="formData.expires_at"
          type="datetime-local"
          class="form-input"
        />
        <p class="form-hint">Leave empty for no expiration</p>
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
import type { ClientKey, CreateClientKeyRequest } from '@/api'

interface Props {
  clientKey?: ClientKey
  loading?: boolean
  submitLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  submitLabel: 'Create Key'
})

const emit = defineEmits<{
  submit: [data: CreateClientKeyRequest]
  cancel: []
}>()

const formData = ref<CreateClientKeyRequest>({
  name: '',
  description: '',
  rate_limit: 0,
  quota: 0,
  allowed_models: '',
  expires_at: '',
  enabled: true
})

const isValid = computed(() => {
  return !!formData.value.name?.trim()
})

const handleSubmit = () => {
  if (!isValid.value) return
  emit('submit', formData.value)
}

watch(() => props.clientKey, (clientKey) => {
  if (clientKey) {
    formData.value = {
      name: clientKey.name,
      description: clientKey.description || '',
      rate_limit: clientKey.rate_limit || 0,
      quota: clientKey.quota || 0,
      allowed_models: clientKey.allowed_models || '',
      expires_at: clientKey.expires_at || '',
      enabled: clientKey.enabled
    }
  }
}, { immediate: true })
</script>

<style scoped>
.client-key-form {
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

.form-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
}

.form-input,
.form-textarea {
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 14px;
  color: var(--text-primary);
  background: var(--bg-base);
  transition: all 150ms ease;
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
  font-family: inherit;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px rgba(0, 112, 243, 0.1);
}

.form-input::placeholder,
.form-textarea::placeholder {
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
