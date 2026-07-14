<template>
  <div class="usage-logs-table">
    <div v-if="logs.length === 0" class="empty-state">
      <EmptyState
        icon="📝"
        title="No usage logs"
        description="Request logs will appear here as your API is used"
      />
    </div>

    <div v-else class="table-container">
      <table class="logs-table">
        <thead>
          <tr>
            <th></th>
            <th>Time</th>
            <th>Client</th>
            <th>Model</th>
            <th>Backend</th>
            <th>Status</th>
            <th>Latency</th>
            <th>Tokens</th>
            <th>Bytes</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="log in logs" :key="log.id">
            <tr class="log-row" @click="toggleExpand(log.id)">
              <td class="expand-cell">
                <button class="expand-button">
                  {{ expandedRows.has(log.id) ? '▼' : '▶' }}
                </button>
              </td>
              <td class="time-cell">
                <div class="time-primary">{{ formatTime(log.created_at) }}</div>
                <div class="time-secondary">{{ formatDate(log.created_at) }}</div>
              </td>
              <td>
                <div class="client-name">{{ log.client_name || log.client_key_name || 'Unknown' }}</div>
              </td>
              <td>
                <code class="model-code">{{ log.model }}</code>
              </td>
              <td>
                <div class="backend-name">{{ log.backend_name || 'N/A' }}</div>
              </td>
              <td>
                <StatusBadge
                  :variant="getStatusVariant(log.status_code)"
                  :label="log.status_code.toString()"
                />
              </td>
              <td>
                <span class="latency-value">{{ formatLogLatency(log) }}</span>
              </td>
              <td>
                <div class="tokens-cell">
                  <span class="token-count">{{ formatTokenCount(log.input_tokens) }}</span>
                  <span class="token-detail">
                    Cache {{ formatTokenCount(log.input_cache_tokens) }} · Out
                    {{ formatTokenCount(log.output_tokens) }}
                  </span>
                </div>
              </td>
              <td>
                <div class="tokens-cell">
                  <span class="token-count">{{ formatBytes((log.request_bytes || 0) + (log.response_bytes || 0)) }}</span>
                  <span class="token-detail">({{ formatBytes(log.request_bytes || 0) }}/{{ formatBytes(log.response_bytes || 0) }})</span>
                </div>
              </td>
            </tr>
            <tr v-if="expandedRows.has(log.id)" class="expanded-row">
              <td colspan="9">
                <div class="expanded-content">
                  <div class="detail-grid">
                    <div class="detail-item">
                      <span class="detail-label">Request ID:</span>
                      <code class="detail-value">{{ log.request_id }}</code>
                    </div>
                    <div class="detail-item">
                      <span class="detail-label">Path:</span>
                      <code class="detail-value detail-code">{{ log.path || 'N/A' }}</code>
                    </div>
                    <div class="detail-item">
                      <span class="detail-label">IP Address:</span>
                      <span class="detail-value">{{ log.client_ip || log.ip_address }}</span>
                    </div>
                    <div class="detail-item">
                      <span class="detail-label">User Agent:</span>
                      <span class="detail-value">{{ log.user_agent || 'N/A' }}</span>
                    </div>
                    <div v-if="log.error_message" class="detail-item full-width">
                      <span class="detail-label">Error:</span>
                      <span class="detail-value error-message">{{ log.error_message }}</span>
                    </div>
                    <div v-if="shouldShowResponseBody(log)" class="detail-item full-width">
                      <span class="detail-label">Response Body Preview:</span>
                      <pre class="detail-value response-body-preview">{{ log.response_body_preview }}</pre>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import type { UsageLog } from '@/api'
import { formatLatencySeconds } from '@/utils/latency'

interface Props {
  logs: UsageLog[]
}

defineProps<Props>()

const expandedRows = ref<Set<number>>(new Set())

const toggleExpand = (id: number) => {
  if (expandedRows.value.has(id)) {
    expandedRows.value.delete(id)
  } else {
    expandedRows.value.add(id)
  }
}

const getStatusVariant = (statusCode: number): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  if (statusCode >= 200 && statusCode < 300) return 'success'
  if (statusCode >= 400 && statusCode < 500) return 'warning'
  if (statusCode >= 500) return 'danger'
  return 'default'
}

const isErrorStatus = (statusCode: number): boolean => statusCode < 200 || statusCode >= 300

const isZeroTokenSuccess = (log: UsageLog): boolean => {
  return log.status_code === 200 &&
    Number(log.input_tokens || 0) === 0 &&
    Number(log.output_tokens || 0) === 0 &&
    Number(log.input_cache_tokens || 0) === 0
}

const shouldShowResponseBody = (log: UsageLog): boolean => {
  return Boolean(log.response_body_preview) && (isErrorStatus(log.status_code) || isZeroTokenSuccess(log))
}

const formatLogLatency = (log: UsageLog) => {
  const latencyMs = log.duration_ms > 0 ? log.duration_ms : log.latency_ms
  return formatLatencySeconds(latencyMs)
}

const formatTime = (timestamp: string) => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString()
}

const formatDate = (timestamp: string) => {
  const date = new Date(timestamp)
  return date.toLocaleDateString()
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0'
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

const formatTokenCount = (value?: number): string => {
  const count = Number(value ?? 0)
  if (!Number.isFinite(count) || count <= 0) return '0'
  if (count < 1000) return String(Math.round(count))
  if (count < 1_000_000) return `${(count / 1000).toFixed(1)}K`
  return `${(count / 1_000_000).toFixed(1)}M`
}
</script>

<style scoped>
.usage-logs-table {
  width: 100%;
}

.empty-state {
  padding: var(--spacing-2xl) 0;
}

.table-container {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
}

.logs-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--bg-base);
}

.logs-table thead {
  background: var(--bg-subtle);
  border-bottom: 1px solid var(--border);
}

.logs-table th {
  padding: var(--spacing-md);
  text-align: left;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.log-row {
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  transition: background 150ms ease;
}

.log-row:hover {
  background: var(--bg-subtle);
}

.logs-table td {
  padding: var(--spacing-md);
  font-size: 14px;
  color: var(--text-primary);
}

.expand-cell {
  width: 40px;
}

.expand-button {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all 150ms ease;
}

.expand-button:hover {
  background: var(--bg-muted);
}

.time-cell {
  min-width: 120px;
}

.time-primary {
  font-weight: 500;
}

.time-secondary {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 2px;
}

.client-name {
  font-weight: 500;
}

.model-code {
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 13px;
  background: var(--bg-muted);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
}

.backend-name {
  color: var(--text-secondary);
}

.latency-value {
  font-weight: 500;
}

.tokens-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 136px;
}

.token-count {
  font-weight: 600;
}

.token-detail {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.expanded-row {
  background: var(--bg-subtle);
  border-bottom: 1px solid var(--border);
}

.expanded-content {
  padding: var(--spacing-lg);
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--spacing-md);
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-item.full-width {
  grid-column: 1 / -1;
}

.detail-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-value {
  font-size: 14px;
  color: var(--text-primary);
}

.detail-code {
  font-family: 'Monaco', 'Menlo', monospace;
  overflow-wrap: anywhere;
}

.detail-value.error-message {
  color: var(--danger);
  font-weight: 500;
}

.response-body-preview {
  margin: 0;
  max-height: 240px;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 13px;
  line-height: 1.5;
  background: var(--bg-muted);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
}
</style>
