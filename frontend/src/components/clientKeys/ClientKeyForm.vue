<template>
  <form @submit.prevent="handleSubmit" class="client-key-form">
    <div class="form-section">
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
        <label class="form-label" for="allowed-models">Allowed Models</label>
        <input
          id="allowed-models"
          v-model="formData.allowed_models"
          type="text"
          class="form-input"
          placeholder="e.g., claude-opus-4-6,claude-sonnet-4-6 (comma-separated, empty = all)"
        />
        <p class="form-hint">Leave empty to allow all models</p>
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
  allowed_models: '',
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
      allowed_models: clientKey.allowed_models || '',
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

.form-input {
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 14px;
  color: var(--text-primary);
  background: var(--bg-base);
  transition: all 150ms ease;
}

.form-input:focus {
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
  border-top: 1px solid var(--border);
}
</style>
