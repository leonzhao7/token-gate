<template>
  <div class="backend-list">
    <div v-if="backends.length === 0" class="empty-state">
      <EmptyState
        icon="🔌"
        title="No backends configured"
        description="Add your first AI backend to get started"
      >
        <template #action>
          <Button @click="$emit('create')">Add Backend</Button>
        </template>
      </EmptyState>
    </div>

    <div v-else class="backend-table">
      <!-- Table Header -->
      <div class="table-header">
        <div class="col col-name">Name</div>
        <div class="col col-server-url">Server URL</div>
        <div class="col col-models">Models</div>
        <div class="col col-weight">Weight</div>
        <div class="col col-latency">Latency</div>
        <div class="col col-actions">Actions</div>
      </div>

      <!-- Table Body -->
      <div class="table-body">
        <div
          v-for="backend in backends"
          :key="backend.id"
          class="backend-row"
          :class="[getStatusClass(backend.status), { expanded: expandedId === backend.id }]"
        >
          <!-- Main Row -->
          <div class="row-main" @click="toggleExpand(backend.id)">
            <div class="col col-name">
              <div class="name-cell">
                <span class="expand-icon">{{ expandedId === backend.id ? '▼' : '▶' }}</span>
                <span class="name-text">{{ backend.name }}</span>
              </div>
            </div>
            <div class="col col-server-url" @click.stop>
              <a v-if="backend.console_url" class="server-url-link" :href="backend.console_url" target="_blank" rel="noopener noreferrer" :title="backend.console_url">{{ shortenUrl(backend.console_url) }}</a>
              <span v-else class="text-muted">—</span>
            </div>
            <div class="col col-models">
              <span v-if="backend.models && backend.models.length > 0" class="models-preview" :title="backend.models.join(', ')">
                <span class="models-preview-names">{{ formatModelsPreview(backend.models) }}</span>
                <span v-if="backend.models.length > 2" class="models-more">+{{ backend.models.length - 2 }}</span>
              </span>
              <span v-else class="text-muted">—</span>
            </div>
            <div class="col col-weight">
              <span class="weight-value">{{ backend.weight }}</span>
            </div>
            <div class="col col-latency">
              <span class="metric-value">
                {{ formatLatencySeconds(backend.avg_latency_ms, 'N/A') }}
              </span>
            </div>
            <div class="col col-actions" @click.stop>
              <button
                class="action-btn action-status-btn"
                :class="`status-${backend.status}`"
                :title="`Status: ${backend.status} — Click to ${getNextStatus(backend.status) === 'disabled' ? 'disable' : 'enable'}`"
                @click="$emit('toggle-status', backend)"
              >
                <svg v-if="backend.status === 'normal'" xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor"><path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"/></svg>
                <svg v-else-if="backend.status === 'abnormal'" xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor"><path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424ZM578.5-98Q520-156 520-240q0-83 58.5-141.5T720-440q83 0 141.5 58.5T920-240q0 84-58.5 142T720-40q-83 0-141.5-58ZM720-120q8 0 14-6t6-14q0-8-6-14t-14-6q-8 0-14 6t-6 14q0 8 6 14t14 6Zm-20-80h40v-160h-40v160Z"/></svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor"><path d="M324-111.5Q251-143 197-197t-85.5-127Q80-397 80-480t31.5-156Q143-709 197-763t127-85.5Q397-880 480-880t156 31.5Q709-817 763-763t85.5 127Q880-563 880-480t-31.5 156Q817-251 763-197t-127 85.5Q563-80 480-80t-156-31.5ZM480-160q54 0 104-17.5t92-50.5L228-676q-33 42-50.5 92T160-480q0 134 93 227t227 93Zm252-124q33-42 50.5-92T800-480q0-134-93-227t-227-93q-54 0-104 17.5T284-732l448 448ZM480-480Z"/></svg>
              </button>
              <button
                class="action-btn action-sync-btn"
                :class="{ 'is-running': isConsoleSyncRunning(backend.id) }"
                :disabled="isConsoleSyncDisabled(backend)"
                :title="canSyncConsole(backend) ? 'Sync' : '仅通用类型不支持同步'"
                @click="$emit('sync-console', backend)"
              >
                <span v-if="isConsoleSyncRunning(backend.id)" class="action-spinner"></span>
                <svg v-else xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor"><path d="M280-120 80-320l200-200 57 56-104 104h607v80H233l104 104-57 56Zm400-320-57-56 104-104H120v-80h607L623-784l57-56 200 200-200 200Z"/></svg>
                <span v-if="hasCheckinInfo(backend) && !isCheckedInToday(backend)" class="sync-dot sync-dot-done"></span>
              </button>
              <button
                class="action-btn"
                title="Edit"
                @click="$emit('edit', backend)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor"><path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h357l-80 80H200v560h560v-278l80-80v358q0 33-23.5 56.5T760-120H200Zm280-360ZM360-360v-170l367-367q12-12 27-18t30-6q16 0 30.5 6t26.5 18l56 57q11 12 17 26.5t6 29.5q0 15-5.5 29.5T897-728L530-360H360Zm481-424-56-56 56 56ZM440-440h56l232-232-28-28-29-28-231 231v57Zm260-260-29-28 29 28 28 28-28-28Z"/></svg>
              </button>
              <button
                class="action-btn"
                title="Delete"
                @click="$emit('delete', backend)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/></svg>
              </button>
            </div>
          </div>

          <!-- Expanded Details -->
          <div v-if="expandedId === backend.id" class="row-details">
            <div class="details-layout">
              <!-- Top row: Service + User | Relay Config | 24h Stats -->
              <div class="details-top">
                <!-- Backend Service + User Info -->
                <div class="detail-card">
                  <div class="card-header">
                    <svg class="card-icon" width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="4" rx="1.5" stroke="currentColor" stroke-width="1.4"/><rect x="2" y="9" width="12" height="4" rx="1.5" stroke="currentColor" stroke-width="1.4"/><circle cx="4.5" cy="5" r="0.75" fill="currentColor"/><circle cx="4.5" cy="11" r="0.75" fill="currentColor"/></svg>
                    <span class="card-title">后端服务</span>
                  </div>
                  <div class="card-body">
                    <div v-if="backend.console_url" class="kv-row">
                      <span class="kv-label">Server URL</span>
                      <a :href="backend.console_url" target="_blank" class="kv-link">{{ backend.console_url }}</a>
                    </div>
                    <div v-if="backend.tags && backend.tags.length > 0" class="kv-row">
                      <span class="kv-label">标签</span>
                      <div class="chip-list">
                        <span v-for="tag in backend.tags" :key="tag" class="chip">{{ tag }}</span>
                      </div>
                    </div>
                    <div v-if="backend.notes" class="kv-row">
                      <span class="kv-label">备注</span>
                      <span class="kv-value notes-inline">{{ backend.notes }}</span>
                    </div>
                  </div>
                  <!-- User info from console account -->
                  <div v-if="consoleAccountSummary(backend.console_account_json)" class="card-sub">
                    <div class="card-sub-header">用户信息</div>
                    <div class="card-body">
                      <div
                        v-for="row in consoleAccountRows(backend.console_account_json)"
                        :key="row.label"
                        class="kv-row"
                      >
                        <span class="kv-label">{{ row.label }}</span>
                        <span class="kv-value">{{ row.value }}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Relay Configuration -->
                <div class="detail-card">
                  <div class="card-header">
                    <svg class="card-icon" width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 8h4m4 0h4M8 2v4m0 4v4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="8" cy="8" r="2.5" stroke="currentColor" stroke-width="1.4"/></svg>
                    <span class="card-title">转发配置</span>
                  </div>
                  <div class="card-body">
                    <div class="kv-row">
                      <span class="kv-label">Base URL</span>
                      <span class="kv-value mono">{{ backend.base_url }}</span>
                    </div>
                    <div class="kv-row">
                      <span class="kv-label">API Key</span>
                      <span class="kv-value mono selectable">{{ backend.api_key || '—' }}</span>
                    </div>
                    <div v-if="backend.models && backend.models.length > 0" class="kv-row kv-row-top">
                      <span class="kv-label">Models</span>
                      <div class="chip-list">
                        <span v-for="model in backend.models" :key="model" class="chip chip-model">{{ model }}</span>
                      </div>
                    </div>
                    <div v-if="modelMappingEntries(backend.model_mapping).length > 0" class="kv-row kv-row-top">
                      <span class="kv-label">模型映射</span>
                      <div class="mapping-list">
                        <div
                          v-for="[clientModel, upstreamModel] in modelMappingEntries(backend.model_mapping)"
                          :key="clientModel"
                          class="mapping-row"
                        >
                          <span class="mapping-client">{{ clientModel }}</span>
                          <span class="mapping-arrow">→</span>
                          <span class="mapping-upstream">{{ upstreamModel }}</span>
                        </div>
                      </div>
                    </div>
                    <div v-if="backend.proxy" class="kv-row">
                      <span class="kv-label">代理</span>
                      <span class="kv-value">{{ backend.proxy.name }} <span class="text-dim">({{ backend.proxy.address }})</span></span>
                    </div>
                    <div v-if="backend.max_requests_per_minute" class="kv-row">
                      <span class="kv-label">限速</span>
                      <span class="kv-value">{{ backend.max_requests_per_minute }} req/min</span>
                    </div>
                  </div>
                </div>

                <!-- 24h Statistics (from hourly stats API) -->
                <div class="detail-card">
                  <div class="card-header">
                    <svg class="card-icon" width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 12l3-4 3 2 4-6 2 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    <span class="card-title">最近 24h</span>
                    <span v-if="backendStatsLoading[backend.id]" class="card-badge loading-badge">loading</span>
                  </div>
                  <div v-if="backendStats[backend.id]" class="stats-grid">
                    <div class="stat-cell">
                      <span class="stat-value">{{ formatCompactNumber(backendStats[backend.id].successes) }}</span>
                      <span class="stat-label">成功</span>
                    </div>
                    <div class="stat-cell">
                      <span class="stat-value" :class="{ 'stat-danger': backendStats[backend.id].failures > 0 }">
                        {{ formatCompactNumber(backendStats[backend.id].failures) }}
                      </span>
                      <span class="stat-label">失败</span>
                    </div>
                    <div class="stat-cell">
                      <span class="stat-value">{{ formatLatencyMs(backendStats[backend.id].successAvgDurationMs) }}</span>
                      <span class="stat-label">平均延迟</span>
                    </div>
                    <div class="stat-cell">
                      <span class="stat-value" :class="{ 'stat-danger': backendStats[backend.id].failureRate > 0.1 }">
                        {{ formatPercent(backendStats[backend.id].failureRate) }}
                      </span>
                      <span class="stat-label">失败率</span>
                    </div>
                    <div class="stat-cell">
                      <span class="stat-value">{{ formatCompactNumber(backendStats[backend.id].inputTokens) }}</span>
                      <span class="stat-label">输入 Tokens</span>
                    </div>
                    <div class="stat-cell">
                      <span class="stat-value">{{ formatCompactNumber(backendStats[backend.id].outputTokens) }}</span>
                      <span class="stat-label">输出 Tokens</span>
                    </div>
                  </div>
                  <div v-else class="stats-grid stats-empty">
                    <div class="stat-cell stat-cell-wide">
                      <span class="stat-label">{{ backendStatsLoading[backend.id] ? '加载中...' : '暂无数据' }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Bottom: Models pricing table -->
              <div v-if="pricingModelRows(backend.console_pricing_json, focusModelPatterns, backend.console_account_json).length > 0" class="details-bottom">
                <div class="detail-card full-width">
                  <div class="card-header">
                    <svg class="card-icon" width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 4h10M3 8h7M3 12h10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
                    <span class="card-title">可用模型</span>
                    <span v-if="backend.models" class="card-badge">{{ backend.models.length }}</span>
                  </div>
                  <div class="pricing-table-wrap">
                    <table class="pricing-table">
                      <thead>
                        <tr>
                          <th>Model</th>
                          <th>Price</th>
                          <th>Group</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="row in pricingModelRows(backend.console_pricing_json, focusModelPatterns, backend.console_account_json)" :key="`${row.model}-${row.group}-${row.price}`">
                          <td>{{ row.model }}</td>
                          <td>{{ row.price }}</td>
                          <td>
                            <span
                              v-for="group in row.group.split(', ')"
                              :key="group"
                              class="group-tag"
                              :class="{ 'group-tag-lowest': group === lowestGroupRatioName(backend.console_pricing_json, backend.console_account_json) }"
                            >{{ group }}</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, reactive } from 'vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Button from '@/components/ui/Button.vue'
import type { Backend } from '@/api'
import { dashboardApi } from '@/api'
import { formatLatencySeconds } from '@/utils/latency'
import { formatModelMappingForInput, parseModelMappingInput } from './backendPayload'
import { consoleAccountRows, consoleAccountSummary, pricingModelRows, lowestGroupRatioName } from './backendConsoleDisplay'
import { buildDashboardStats, buildStatsRange, type DashboardStatsSummary } from '@/utils/dashboardStats'

interface Props {
  backends: Backend[]
  focusModelPatterns?: string
  runningConsoleSyncIds?: Set<number>
}

const props = withDefaults(defineProps<Props>(), {
  focusModelPatterns: '',
  runningConsoleSyncIds: () => new Set<number>(),
})

const emit = defineEmits<{
  create: []
  edit: [backend: Backend]
  delete: [backend: Backend]
  'sync-console': [backend: Backend]
  'toggle-status': [backend: Backend]
}>()

const expandedId = ref<number | null>(null)

const isConsoleSyncRunning = (backendId: number) => props.runningConsoleSyncIds.has(backendId)
const canSyncConsole = (backend: Backend) => backend.backend_type === 'new-api' || backend.backend_type === 'sub2api'
const isConsoleSyncDisabled = (backend: Backend) => !canSyncConsole(backend) || isConsoleSyncRunning(backend.id)

const toggleExpand = (id: number) => {
  expandedId.value = expandedId.value === id ? null : id
}

const getNextStatus = (status: string): string => {
  switch (status) {
    case 'normal':
      return 'disabled'
    case 'disabled':
      return 'normal'
    case 'abnormal':
      return 'disabled'
    default:
      return 'disabled'
  }
}

const getStatusClass = (status: string): string => {
  switch (status) {
    case 'normal':
      return 'status-normal'
    case 'abnormal':
      return 'status-abnormal'
    case 'disabled':
      return 'status-disable'
    default:
      return ''
  }
}

const modelMappingEntries = (value: Backend['model_mapping']) => {
  try {
    const formatted = formatModelMappingForInput(value)
    return Object.entries(parseModelMappingInput(formatted))
  } catch {
    return []
  }
}

const formatTime = (timestamp: string) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

const backendStats = reactive<Record<number, DashboardStatsSummary>>({})
const backendStatsLoading = reactive<Record<number, boolean>>({})

watch(expandedId, async (id) => {
  if (id === null) return
  if (backendStats[id]) return
  const backend = props.backends.find((b) => b.id === id)
  if (!backend) return

  backendStatsLoading[id] = true
  try {
    const { startHour, endHour } = buildStatsRange(24)
    const res = await dashboardApi.getBackendHourlyModelStats({
      backend: backend.name,
      start_hour: startHour,
      end_hour: endHour,
    })
    const stats = buildDashboardStats(res.items)
    backendStats[id] = stats.summary
  } catch {
    // leave empty — template shows "暂无数据"
  } finally {
    backendStatsLoading[id] = false
  }
})

const formatCompactNumber = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

const formatLatencyMs = (ms: number): string => {
  if (!ms || ms <= 0) return '-'
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

const formatPercent = (rate: number): string => {
  if (!rate || rate <= 0) return '0%'
  return `${(rate * 100).toFixed(1)}%`
}

const shortenUrl = (url: string): string => {
  try {
    const u = new URL(url)
    return u.hostname + (u.port ? `:${u.port}` : '')
  } catch {
    return url
  }
}

const formatModelsPreview = (models: string[]): string => {
  return models.slice(0, 2).join(', ')
}

const isCheckedInToday = (backend: Backend): boolean => {
  const summary = consoleAccountSummary(backend.console_account_json)
  if (!summary?.lastCheckinAt) return false
  const checkinDate = new Date(summary.lastCheckinAt)
  if (Number.isNaN(checkinDate.getTime())) return false
  const today = new Date()
  return (
    checkinDate.getFullYear() === today.getFullYear() &&
    checkinDate.getMonth() === today.getMonth() &&
    checkinDate.getDate() === today.getDate()
  )
}

const hasCheckinInfo = (backend: Backend): boolean => {
  return backend.backend_type === 'new-api' || backend.backend_type === 'sub2api'
}
</script>

<style scoped>
.backend-list {
  width: 100%;
}

.empty-state {
  padding: var(--spacing-2xl) 0;
}

/* Table Structure */
.backend-table {
  background: var(--bg-base);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.table-header {
  display: flex;
  align-items: center;
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--bg-subtle);
  border-bottom: 1px solid var(--border);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.table-body {
  display: flex;
  flex-direction: column;
}

/* Column Layout */
.col {
  padding: 0 var(--spacing-sm);
}

.col-name {
  flex: 1;
  min-width: 120px;
}

.col-server-url {
  flex: 1;
  min-width: 120px;
  overflow: hidden;
}

.col-models {
  flex: 1.8;
  min-width: 150px;
  overflow: hidden;
}

.col-weight {
  flex: 0 0 70px;
  text-align: right;
}

.col-latency {
  flex: 0 0 90px;
  text-align: right;
}

.col-actions {
  flex: 0 0 220px;
  text-align: right;
}

/* Backend Row */
.backend-row {
  border-left: 3px solid transparent;
  border-bottom: 1px solid var(--border);
  transition: all 150ms ease;
}

.backend-row:last-child {
  border-bottom: none;
}

.backend-row.status-normal {
  border-left-color: rgba(16, 185, 129, 0.6);
}

.backend-row.status-abnormal {
  border-left-color: rgba(245, 158, 11, 0.6);
}

.backend-row.status-disable {
  border-left-color: rgba(148, 163, 184, 0.4);
  opacity: 0.7;
}

.backend-row:hover {
  background: var(--bg-subtle);
}

.backend-row.expanded {
  background: var(--bg-subtle);
}

/* Main Row */
.row-main {
  display: flex;
  align-items: center;
  padding: var(--spacing-md) var(--spacing-lg);
  cursor: pointer;
  user-select: none;
  font-size: 14px;
}

.name-cell {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.expand-icon {
  font-size: 10px;
  color: var(--text-tertiary);
  transition: transform 150ms ease;
}

.name-text {
  font-size: 17px;
  font-weight: 600;
  color: var(--text-primary);
}

.server-url-link {
  color: var(--accent-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
  text-decoration: none;
}

.server-url-link:hover {
  text-decoration: underline;
  color: var(--accent-hover);
}

.models-preview {
  display: flex;
  align-items: center;
  gap: 4px;
  overflow: hidden;
}

.models-preview-names {
  color: var(--text-secondary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.models-more {
  flex-shrink: 0;
  font-size: 10px;
  color: var(--text-tertiary);
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 1px 4px;
}


.text-muted {
  color: var(--text-tertiary);
}

.weight-value {
  font-weight: 600;
  color: var(--text-primary);
}

.metric-value {
  color: var(--text-primary);
}

.metric-value.has-failures {
  color: var(--danger);
  font-weight: 600;
}


.action-status-btn {
  color: var(--text-tertiary);
}

.action-status-btn.status-normal {
  color: #059669;
}

.action-status-btn.status-abnormal {
  color: #f59e0b;
}

.action-status-btn.status-disabled {
  color: var(--text-tertiary);
}

.action-btn {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  font-size: 14px;
  cursor: pointer;
  transition: all 150ms ease;
  margin-left: 4px;
}

.action-btn:hover {
  background: var(--bg-muted);
  transform: scale(1.1);
}

.action-btn:disabled {
  cursor: not-allowed;
  opacity: 0.65;
  transform: none;
}

.action-sync-btn {
  position: relative;
}

.sync-dot {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.sync-dot-done {
  background: #10b981;
}

.sync-dot-missed {
  background: #f59e0b;
}

.text-action-btn {
  width: auto;
  min-width: 44px;
  padding: 0 8px;
  font-size: 12px;
  color: var(--text-primary);
}

.console-action-btn {
  min-width: 76px;
  height: 30px;
  gap: 6px;
  border: 1px solid var(--border);
  background: var(--bg-base);
  border-radius: var(--radius-md);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
  font-weight: 600;
}

.console-action-btn:hover:not(:disabled) {
  border-color: var(--accent-primary);
  background: var(--bg-muted);
  transform: none;
}

.console-action-btn.is-running {
  border-color: rgba(0, 112, 243, 0.45);
  background: rgba(0, 112, 243, 0.08);
  color: var(--accent-primary);
}

.action-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 999px;
  animation: actionSpin 700ms linear infinite;
}

@keyframes actionSpin {
  to {
    transform: rotate(360deg);
  }
}

/* Expanded Details */
.row-details {
  padding: 16px 20px;
  background: var(--bg-base);
  border-top: 1px solid var(--border);
  animation: slideDown 200ms ease;
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.details-layout {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.details-top {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.details-bottom {
  display: flex;
}

/* Detail Card */
.detail-card {
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.detail-card.full-width {
  flex: 1;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-muted);
}

.card-icon {
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.card-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.card-badge {
  margin-left: auto;
  padding: 1px 6px;
  background: var(--bg-base);
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
}

.card-body {
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.card-sub {
  border-top: 1px solid var(--border);
}

.card-sub-header {
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.3px;
  background: var(--bg-muted);
  border-bottom: 1px solid var(--border);
}

/* Key-Value Rows */
.kv-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  line-height: 1.5;
}

.kv-row-top {
  align-items: flex-start;
}

.kv-label {
  color: var(--text-tertiary);
  flex-shrink: 0;
  font-size: 12px;
}

.kv-value {
  color: var(--text-primary);
  text-align: right;
  word-break: break-all;
  min-width: 0;
}

.kv-value.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}

.kv-value.selectable {
  user-select: all;
}

.kv-value.notes-inline {
  white-space: pre-wrap;
  max-height: 40px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.kv-link {
  color: var(--accent-primary);
  text-decoration: none;
  font-size: 12px;
  text-align: right;
  word-break: break-all;
}

.kv-link:hover {
  text-decoration: underline;
}

.text-dim {
  color: var(--text-tertiary);
}

/* Mapping */
.mapping-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
  align-items: flex-end;
}

.mapping-row {
  display: flex;
  align-items: center;
  gap: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}

.mapping-client { color: var(--text-primary); }
.mapping-arrow { color: var(--text-tertiary); }
.mapping-upstream { color: var(--accent-primary); }

/* Chips */
.chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: flex-end;
}

.chip {
  display: inline-block;
  padding: 2px 7px;
  background: var(--bg-base);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 11px;
  color: var(--text-secondary);
}

.chip-model {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.model-chip-list {
  padding: 10px 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1px;
  background: var(--border);
}

.stat-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 10px 8px;
  background: var(--bg-subtle);
  gap: 2px;
}

.stat-value {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}

.stat-value.stat-danger {
  color: var(--danger);
}

.stat-label {
  font-size: 10px;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.stats-empty {
  background: transparent;
}

.stat-cell-wide {
  grid-column: 1 / -1;
}

.loading-badge {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Pricing Table */
.pricing-table-wrap {
  max-height: 260px;
  overflow: auto;
}

.pricing-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.pricing-table th,
.pricing-table td {
  padding: 6px 10px;
  border-bottom: 1px solid var(--border);
  text-align: right;
  white-space: nowrap;
}

.pricing-table th {
  position: sticky;
  top: 0;
  background: var(--bg-muted);
  color: var(--text-secondary);
  font-weight: 600;
  font-size: 11px;
  z-index: 1;
}

.pricing-table th:first-child,
.pricing-table td:first-child {
  text-align: left;
  white-space: normal;
  word-break: break-word;
}

.pricing-table tbody tr:last-child td {
  border-bottom: none;
}

.group-highlight {
  display: inline-block;
  padding: 1px 6px;
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: var(--radius-sm);
  font-weight: 600;
  color: var(--success, #10b981);
}

/* Responsive */
@media (max-width: 1400px) {
  .details-top {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 1000px) {
  .details-top {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .col-models,
  .col-latency {
    display: none;
  }
}
</style>
