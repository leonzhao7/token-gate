<template>
  <DefaultLayout>
    <div class="dashboard">

      <!-- Loading State -->
      <LoadingSpinner v-if="modelStatsLoading && !backendModelStats" message="Loading dashboard..." />

      <!-- Error State -->
      <Card v-else-if="modelStatsError && !backendModelStats">
        <EmptyState icon="⚠️" title="Failed to load dashboard" :description="modelStatsError">
          <template #action>
            <Button @click="refreshData">Retry</Button>
          </template>
        </EmptyState>
      </Card>

      <!-- Dashboard Content -->
      <div v-else class="dashboard-content">
        <div class="stats-toolbar">
          <div class="range-control" role="group" aria-label="Statistics time range">
            <button
              v-for="option in rangeOptions"
              :key="option.preset"
              type="button"
              :class="['range-button', { 'range-button-active': option.preset === statsRangePreset }]"
              :disabled="modelStatsLoading"
              @click="updateStatsRange(option.preset)"
            >
              {{ option.label }}
            </button>
          </div>
          <div class="stats-time-summary">
            <span>{{ modelStatsRangeLabel }}</span>
            <span>{{ bucketLabel }}</span>
          </div>
        </div>

        <!-- Stats Grid -->
        <div class="stats-grid">
          <div class="summary-card">
            <div class="summary-icon summary-icon-requests">📊</div>
            <div class="summary-content">
              <p class="summary-label">Requests ({{ selectedRangeLabel }})</p>
              <div class="summary-metrics">
                <div class="summary-metric">
                  <strong>{{ formatCompactNumber(statsSummary.successes) }}</strong>
                  <span>Success</span>
                </div>
                <div class="summary-metric">
                  <strong>{{ formatCompactNumber(statsSummary.failures) }}</strong>
                  <span>Failure</span>
                </div>
                <div class="summary-metric">
                  <strong>{{ formatLatency(statsSummary.successAvgDurationMs) }}</strong>
                  <span>Latency</span>
                </div>
              </div>
            </div>
          </div>

          <div class="summary-card">
            <div class="summary-icon summary-icon-tokens">🧮</div>
            <div class="summary-content">
              <p class="summary-label">Tokens ({{ selectedRangeLabel }})</p>
              <div class="summary-metrics">
                <div class="summary-metric">
                  <strong>{{ formatCompactNumber(statsSummary.inputTokens) }}</strong>
                  <span>Input</span>
                </div>
                <div class="summary-metric">
                  <strong>{{ formatCompactNumber(statsSummary.inputCacheTokens) }}</strong>
                  <span>Cache</span>
                </div>
                <div class="summary-metric">
                  <strong>{{ formatCompactNumber(statsSummary.outputTokens) }}</strong>
                  <span>Output</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Card :title="`Backend Model Statistics (${selectedRangeLabel})`" class="model-stats-card">
          <LoadingSpinner
            v-if="modelStatsLoading && !backendModelStats"
            message="Loading backend model statistics..."
          />
          <EmptyState
            v-else-if="modelStatsError"
            icon="⚠️"
            title="Failed to load statistics"
            :description="modelStatsError"
          >
            <template #action>
              <Button @click="refreshModelStats" size="sm">Retry</Button>
            </template>
          </EmptyState>
          <EmptyState
            v-else-if="!hasModelStats"
            icon="📊"
            title="No backend model stats yet"
            description="Requests will appear here after successful or failed backend attempts are recorded"
          />
          <div v-else class="model-stats-content">
            <div class="trend-panels">
              <section class="trend-panel">
                <div class="section-heading">
                  <h3>Request Trend</h3>
                  <div class="trend-legend">
                    <span class="legend-item">
                      <span class="legend-swatch legend-success"></span>
                      Success
                    </span>
                    <span class="legend-item">
                      <span class="legend-swatch legend-failure"></span>
                      Failure
                    </span>
                  </div>
                </div>
                <div
                  class="stacked-trend"
                  :style="trendGridStyle(requestTrend)"
                  aria-label="Success and failure request trend"
                >
                  <div
                    v-for="point in requestTrend"
                    :key="point.hour"
                    class="stacked-point"
                    :title="`${point.label}: ${point.successes} successes, ${point.failures} failures`"
                  >
                    <div class="stacked-bar-track">
                      <div
                        class="stacked-bar"
                        :style="{ height: `${stackedBarHeight(point.requests, maxRequestTrendTotal)}%` }"
                      >
                        <span
                          v-for="segment in requestSegments(point)"
                          :key="segment.key"
                          class="stacked-segment"
                          :style="{ height: segmentHeight(segment.value, point.requests), background: segment.color }"
                        />
                      </div>
                    </div>
                    <span class="axis-label">{{ point.label }}</span>
                  </div>
                </div>
              </section>

              <section class="trend-panel">
                <div class="section-heading">
                  <h3>Backend Trend</h3>
                  <div class="trend-legend">
                    <span v-for="item in backendLegend" :key="item.key" class="legend-item">
                      <span class="legend-swatch" :style="{ background: item.color }"></span>
                      {{ item.label }}
                    </span>
                  </div>
                </div>
                <div
                  class="stacked-trend"
                  :style="trendGridStyle(backendTrend)"
                  aria-label="Backend request trend"
                >
                  <div
                    v-for="point in backendTrend"
                    :key="point.hour"
                    class="stacked-point"
                    :title="stackedTitle(point)"
                  >
                    <div class="stacked-bar-track">
                      <div
                        class="stacked-bar"
                        :style="{ height: `${stackedBarHeight(point.total, maxBackendTrendTotal)}%` }"
                      >
                        <span
                          v-for="segment in coloredSegments(point.segments, backendLegend)"
                          :key="segment.key"
                          class="stacked-segment"
                          :style="{ height: segmentHeight(segment.value, point.total), background: segment.color }"
                        />
                      </div>
                    </div>
                    <span class="axis-label">{{ point.label }}</span>
                  </div>
                </div>
              </section>

              <section class="trend-panel">
                <div class="section-heading">
                  <h3>Model Trend</h3>
                  <div class="trend-legend">
                    <span v-for="item in modelLegend" :key="item.key" class="legend-item">
                      <span class="legend-swatch" :style="{ background: item.color }"></span>
                      {{ item.label }}
                    </span>
                  </div>
                </div>
                <div
                  class="stacked-trend"
                  :style="trendGridStyle(modelTrend)"
                  aria-label="Model request trend"
                >
                  <div
                    v-for="point in modelTrend"
                    :key="point.hour"
                    class="stacked-point"
                    :title="stackedTitle(point)"
                  >
                    <div class="stacked-bar-track">
                      <div
                        class="stacked-bar"
                        :style="{ height: `${stackedBarHeight(point.total, maxModelTrendTotal)}%` }"
                      >
                        <span
                          v-for="segment in coloredSegments(point.segments, modelLegend)"
                          :key="segment.key"
                          class="stacked-segment"
                          :style="{ height: segmentHeight(segment.value, point.total), background: segment.color }"
                        />
                      </div>
                    </div>
                    <span class="axis-label">{{ point.label }}</span>
                  </div>
                </div>
              </section>
            </div>

            <div class="stats-tables">
              <section class="stats-section">
                <div class="section-heading">
                  <h3>Backends</h3>
                  <span>Ranked by requests</span>
                </div>
                <div class="stats-table-wrap">
                  <table class="stats-table">
                    <thead>
                      <tr>
                        <th>Backend</th>
                        <th>Requests</th>
                        <th>Failure</th>
                        <th>Latency</th>
                        <th>Tokens</th>
                        <th>Transfer</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="row in topBackends" :key="row.backendId">
                        <td>{{ row.backend }}</td>
                        <td>{{ formatNumber(row.requests) }}</td>
                        <td>{{ formatRate(row.failureRate) }}</td>
                        <td>{{ formatLatency(row.successAvgDurationMs) }}</td>
                        <td>{{ formatCompactNumber(row.totalTokens) }}</td>
                        <td>{{ formatBytes(row.totalBytes) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              <section class="stats-section">
                <div class="section-heading">
                  <h3>Models</h3>
                  <span>Ranked by requests</span>
                </div>
                <div class="stats-table-wrap">
                  <table class="stats-table">
                    <thead>
                      <tr>
                        <th>Model</th>
                        <th>Requests</th>
                        <th>Failure</th>
                        <th>Latency</th>
                        <th>Tokens</th>
                        <th>Transfer</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="row in topModels" :key="row.model">
                        <td>{{ row.model }}</td>
                        <td>{{ formatNumber(row.requests) }}</td>
                        <td>{{ formatRate(row.failureRate) }}</td>
                        <td>{{ formatLatency(row.successAvgDurationMs) }}</td>
                        <td>{{ formatCompactNumber(row.totalTokens) }}</td>
                        <td>{{ formatBytes(row.totalBytes) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </div>
        </Card>
      </div>
    </div>
  </DefaultLayout>
</template>

<script setup lang="ts">
import { onMounted, computed } from 'vue'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import Card from '@/components/ui/Card.vue'
import Button from '@/components/ui/Button.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import { useDashboardStore } from '@/stores/dashboard'
import { formatLatencySeconds } from '@/utils/latency'
import type {
  DashboardStackedPoint,
  DashboardStackedSegment,
  DashboardStatsPreset,
  DashboardStatsSeriesPoint,
} from '@/utils/dashboardStats'

interface LegendItem {
  key: string
  label: string
  color: string
}

interface ColoredSegment extends DashboardStackedSegment {
  color: string
}

const rangeOptions = [
  { label: 'Today', preset: 'today' as DashboardStatsPreset },
  { label: '7 days', preset: '7d' as DashboardStatsPreset },
]

const seriesPalette = [
  '#0070f3',
  '#16a34a',
  '#f59e0b',
  '#ef4444',
  '#14b8a6',
  '#a855f7',
  '#f97316',
  '#64748b',
  '#0ea5e9',
  '#84cc16',
]

const dashboardStore = useDashboardStore()

const backendModelStats = computed(() => dashboardStore.backendModelStats)
const modelStats = computed(() => dashboardStore.modelStats)
const statsSummary = computed(() => modelStats.value.summary)
const requestTrend = computed(() => modelStats.value.hourlySeries)
const backendTrend = computed(() => modelStats.value.backendHourlySeries)
const modelTrend = computed(() => modelStats.value.modelHourlySeries)
const topBackends = computed(() => modelStats.value.backendRows)
const topModels = computed(() => modelStats.value.modelRows)
const statsRangePreset = computed(() => dashboardStore.statsRangePreset)
const statsRange = computed(() => dashboardStore.statsRange)
const statsBucket = computed(() => dashboardStore.statsBucket)
const selectedRangeLabel = computed(() =>
  rangeOptions.find((option) => option.preset === statsRangePreset.value)?.label ?? 'Today'
)
const bucketLabel = computed(() => statsBucket.value === 'day' ? 'Daily' : 'Hourly')
const modelStatsLoading = computed(() => dashboardStore.modelStatsLoading)
const modelStatsError = computed(() => dashboardStore.modelStatsError)
const hasModelStats = computed(() => (backendModelStats.value?.items.length ?? 0) > 0)
const maxRequestTrendTotal = computed(() => maxTrendTotal(requestTrend.value.map((point) => point.requests)))
const maxBackendTrendTotal = computed(() => maxTrendTotal(backendTrend.value.map((point) => point.total)))
const maxModelTrendTotal = computed(() => maxTrendTotal(modelTrend.value.map((point) => point.total)))
const backendLegend = computed(() =>
  buildLegend(modelStats.value.backendRows.map((row) => ({
    key: String(row.backendId),
    label: row.backend,
  })))
)
const modelLegend = computed(() =>
  buildLegend(modelStats.value.modelRows.map((row) => ({
    key: row.model,
    label: row.model,
  })))
)
const modelStatsRangeLabel = computed(() => {
  const range = statsRange.value
  return `${formatDateTime(range.startHour)} - ${formatDateTime(range.endHour)}`
})

const refreshData = async () => {
  await dashboardStore.fetchAll()
}

const refreshModelStats = async () => {
  await dashboardStore.fetchBackendModelStats()
}

const updateStatsRange = async (preset: DashboardStatsPreset) => {
  if (preset === statsRangePreset.value) return
  await dashboardStore.setStatsRangePreset(preset)
}

const formatNumber = (value: number) => value.toLocaleString()

const formatCompactNumber = (value: number) =>
  new Intl.NumberFormat(undefined, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)

const formatRate = (value: number) => `${(value * 100).toFixed(1)}%`

const formatLatency = (value: number) => formatLatencySeconds(value)

const formatBytes = (value: number) => {
  if (value <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)
  const scaled = value / 1024 ** index
  return `${scaled >= 10 || index === 0 ? scaled.toFixed(0) : scaled.toFixed(1)} ${units[index]}`
}

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))

const maxTrendTotal = (values: number[]) => Math.max(...values, 0)

const buildLegend = (items: Array<{ key: string; label: string }>): LegendItem[] =>
  items.map((item, index) => ({
    ...item,
    color: seriesPalette[index % seriesPalette.length],
  }))

const colorForKey = (legend: LegendItem[], key: string) =>
  legend.find((item) => item.key === key)?.color ?? '#64748b'

const requestSegments = (point: DashboardStatsSeriesPoint): ColoredSegment[] => [
  {
    key: 'successes',
    label: 'Success',
    value: point.successes,
    color: 'var(--success)',
  },
  {
    key: 'failures',
    label: 'Failure',
    value: point.failures,
    color: 'var(--danger)',
  },
].filter((segment) => segment.value > 0)

const coloredSegments = (
  segments: DashboardStackedSegment[],
  legend: LegendItem[],
): ColoredSegment[] =>
  segments.map((segment) => ({
    ...segment,
    color: colorForKey(legend, segment.key),
  }))

const trendGridStyle = (points: Array<{ hour: string }>) => ({
  gridTemplateColumns: `repeat(${Math.max(points.length, 1)}, minmax(32px, 1fr))`,
})

const stackedBarHeight = (total: number, maxTotal: number) => {
  if (total <= 0 || maxTotal <= 0) return 0
  return Math.max(12, Math.round((total / maxTotal) * 100))
}

const segmentHeight = (value: number, total: number) => {
  if (value <= 0 || total <= 0) return '0%'
  return `${(value / total) * 100}%`
}

const stackedTitle = (point: DashboardStackedPoint) => {
  const segments = point.segments.map((segment) => `${segment.label}: ${segment.value}`).join(', ')
  return `${point.label}: ${segments || '0 requests'}`
}

onMounted(() => {
  refreshData()
})
</script>

<style scoped>
.dashboard {
  max-width: 1400px;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-2xl);
}

.dashboard-header h1 {
  font-size: 32px;
  font-weight: 600;
  color: var(--text-primary);
}

.dashboard-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2xl);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--spacing-lg);
}

.summary-card {
  display: flex;
  gap: var(--spacing-md);
  min-width: 0;
  padding: var(--spacing-lg);
  background: var(--bg-base);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
}

.summary-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  font-size: 24px;
  flex-shrink: 0;
}

.summary-icon-requests {
  background: rgba(59, 130, 246, 0.1);
}

.summary-icon-tokens {
  background: rgba(20, 184, 166, 0.1);
}

.summary-content {
  flex: 1;
  min-width: 0;
}

.summary-label {
  margin-bottom: var(--spacing-sm);
  color: var(--text-secondary);
  font-size: 13px;
}

.summary-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--spacing-md);
}

.summary-metric {
  min-width: 0;
}

.summary-metric strong {
  display: block;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 24px;
  font-weight: 600;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.summary-metric span {
  display: block;
  margin-top: 3px;
  color: var(--text-tertiary);
  font-size: 12px;
}

.model-stats-card {
  margin-top: var(--spacing-lg);
}

.model-stats-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
}

.stats-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-md);
}

.stats-time-summary {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
  color: var(--text-tertiary);
  font-size: 12px;
}

.stats-time-summary span {
  padding: 4px 8px;
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

.range-control {
  display: inline-flex;
  align-items: center;
  padding: 3px;
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}

.range-button {
  min-width: 48px;
  height: 30px;
  padding: 0 10px;
  border: 0;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  background: transparent;
  font-size: 13px;
  cursor: pointer;
}

.range-button:hover:not(:disabled) {
  color: var(--text-primary);
}

.range-button:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.range-button-active {
  color: var(--text-primary);
  background: var(--bg-base);
  box-shadow: var(--shadow-sm);
}

.trend-panels {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--spacing-lg);
}

.trend-panel {
  min-width: 0;
  padding: var(--spacing-md);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-subtle);
}

.trend-legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px 12px;
  max-width: 70%;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--text-tertiary);
  white-space: nowrap;
}

.legend-swatch {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  flex-shrink: 0;
}

.legend-success {
  background: var(--success);
}

.legend-failure {
  background: var(--danger);
}

.stacked-trend {
  display: grid;
  gap: 6px;
  min-height: 164px;
  align-items: end;
  padding-top: var(--spacing-sm);
  overflow-x: auto;
}

.stacked-point {
  min-width: 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.stacked-bar-track {
  width: 100%;
  height: 84px;
  display: flex;
  align-items: flex-end;
  border-radius: var(--radius-sm);
  background: var(--bg-base);
  border: 1px solid var(--border);
  overflow: hidden;
}

.stacked-bar {
  width: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column-reverse;
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  overflow: hidden;
}

.stacked-segment {
  display: block;
  width: 100%;
  min-height: 0;
}

.axis-label {
  min-height: 28px;
  margin-top: 2px;
  color: var(--text-tertiary);
  font-size: 10px;
  line-height: 1;
  white-space: nowrap;
  transform: rotate(-45deg);
  transform-origin: top center;
}

.stats-tables {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--spacing-lg);
}

.stats-section {
  min-width: 0;
}

.section-heading {
  display: flex;
  justify-content: space-between;
  gap: var(--spacing-md);
  align-items: baseline;
  margin-bottom: var(--spacing-sm);
}

.section-heading h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.section-heading span {
  font-size: 12px;
  color: var(--text-tertiary);
}

.stats-table-wrap {
  max-height: 392px;
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}

.stats-table {
  width: 100%;
  min-width: 520px;
  border-collapse: collapse;
  font-size: 13px;
}

.stats-table th,
.stats-table td {
  padding: 10px 12px;
  text-align: right;
  border-bottom: 1px solid var(--border);
  color: var(--text-secondary);
  white-space: nowrap;
}

.stats-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  color: var(--text-tertiary);
  font-size: 12px;
  font-weight: 500;
  background: var(--bg-subtle);
}

.stats-table th:first-child,
.stats-table td:first-child {
  text-align: left;
  color: var(--text-primary);
  font-weight: 500;
}

.stats-table tbody tr:last-child td {
  border-bottom: 0;
}

@media (max-width: 900px) {
  .stats-grid,
  .stats-tables {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .dashboard-header {
    align-items: flex-start;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .stats-toolbar {
    align-items: flex-start;
    flex-direction: column;
    justify-content: flex-start;
  }

  .stats-time-summary {
    justify-content: flex-start;
  }

  .summary-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .trend-legend {
    justify-content: flex-start;
    max-width: 100%;
  }
}
</style>
