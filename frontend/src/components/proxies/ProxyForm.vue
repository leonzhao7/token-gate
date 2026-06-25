<template>
  <form @submit.prevent="handleSubmit" class="proxy-form">
    <div class="form-section">
      <h3 class="section-title">Proxy Information</h3>

      <div class="form-group">
        <label class="form-label" for="name">Name *</label>
        <input
          id="name"
          v-model="formData.name"
          type="text"
          class="form-input"
          placeholder="e.g., US Proxy 1"
          required
        />
      </div>

      <div class="form-group">
        <label class="form-label" for="address">Address *</label>
        <input
          id="address"
          v-model="formData.address"
          type="text"
          class="form-input"
          placeholder="socks5://hostname:port"
          required
        />
        <p class="form-hint">Format: socks5://host:port or socks5://user:pass@host:port</p>
      </div>

      <div class="form-group">
        <label class="form-label" for="username">Username</label>
        <input
          id="username"
          v-model="formData.username"
          type="text"
          class="form-input"
          placeholder="Optional username"
        />
      </div>

      <div class="form-group">
        <label class="form-label" for="password">Password</label>
        <input
          id="password"
          v-model="formData.password"
          type="password"
          class="form-input"
          placeholder="Optional password"
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
import type { SocksProxy, CreateProxyRequest } from '@/api'

interface Props {
  proxy?: SocksProxy
  loading?: boolean
  submitLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  submitLabel: 'Save Proxy'
})

const emit = defineEmits<{
  submit: [data: CreateProxyRequest]
  cancel: []
}>()

const formData = ref<CreateProxyRequest>({
  name: '',
  address: '',
  username: '',
  password: '',
  enabled: true
})

const isValid = computed(() => {
  return !!(
    formData.value.name?.trim() &&
    formData.value.address?.trim()
  )
})

const handleSubmit = () => {
  if (!isValid.value) return
  emit('submit', formData.value)
}

watch(() => props.proxy, (proxy) => {
  if (proxy) {
    formData.value = {
      name: proxy.name,
      address: proxy.address,
      username: proxy.username || '',
      password: proxy.password || '',
      enabled: proxy.enabled
    }
  }
}, { immediate: true })
</script>

<style scoped>
.proxy-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
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
