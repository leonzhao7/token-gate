import type { BackendHourlyModelStatsItem } from '@/api/types'

export type DashboardStatsBucket = 'hour' | 'day'
export type DashboardStatsPreset = 'today' | '7d'

export interface DashboardStatsPresetRange {
  startHour: string
  endHour: string
  bucket: DashboardStatsBucket
}

export interface DashboardStatsOptions {
  startHour?: string | null
  endHour?: string | null
  bucket?: DashboardStatsBucket
}

export interface DashboardStatsSummary {
  requests: number
  successes: number
  failures: number
  failureRate: number
  successAvgDurationMs: number
  inputTokens: number
  outputTokens: number
  inputCacheTokens: number
  totalTokens: number
  requestBytes: number
  responseBytes: number
  totalBytes: number
}

export interface DashboardStatsSeriesPoint extends DashboardStatsSummary {
  hour: string
  label: string
}

export interface DashboardStatsBackendRow extends DashboardStatsSummary {
  backendId: number
  backend: string
}

export interface DashboardStatsModelRow extends DashboardStatsSummary {
  model: string
}

export interface DashboardStackedSegment {
  key: string
  label: string
  value: number
}

export interface DashboardStackedPoint {
  hour: string
  label: string
  total: number
  segments: DashboardStackedSegment[]
}

export interface DashboardStats {
  summary: DashboardStatsSummary
  hourlySeries: DashboardStatsSeriesPoint[]
  backendHourlySeries: DashboardStackedPoint[]
  modelHourlySeries: DashboardStackedPoint[]
  backendRows: DashboardStatsBackendRow[]
  modelRows: DashboardStatsModelRow[]
}

interface MutableTotals {
  requests: number
  successes: number
  failures: number
  successDurationMsSum: number
  inputTokens: number
  outputTokens: number
  inputCacheTokens: number
  requestBytes: number
  responseBytes: number
}

interface DimensionRef {
  key: string
  label: string
}

export const buildStatsRange = (hours = 24, now = new Date()) => {
  const safeHours = Math.max(1, Math.floor(safeNumber(hours)))
  const end = truncateToHour(now.getTime())
  const start = end - (safeHours - 1) * 60 * 60 * 1000

  return {
    startHour: new Date(start).toISOString(),
    endHour: new Date(end).toISOString(),
  }
}

export const buildStatsPresetRange = (
  preset: DashboardStatsPreset,
  now = new Date(),
): DashboardStatsPresetRange => {
  const end = truncateToLocalHour(now.getTime())

  if (preset === '7d') {
    const start = truncateToDay(end)
    return {
      startHour: new Date(start - 6 * 24 * 60 * 60 * 1000).toISOString(),
      endHour: new Date(end).toISOString(),
      bucket: 'day' as DashboardStatsBucket,
    }
  }

  return {
    startHour: new Date(truncateToDay(end)).toISOString(),
    endHour: new Date(end).toISOString(),
    bucket: 'hour' as DashboardStatsBucket,
  }
}

const emptyTotals = (): MutableTotals => ({
  requests: 0,
  successes: 0,
  failures: 0,
  successDurationMsSum: 0,
  inputTokens: 0,
  outputTokens: 0,
  inputCacheTokens: 0,
  requestBytes: 0,
  responseBytes: 0,
})

const addItem = (totals: MutableTotals, item: BackendHourlyModelStatsItem) => {
  const successes = safeNumber(item.successes)

  totals.requests += safeNumber(item.requests)
  totals.successes += successes
  totals.failures += safeNumber(item.failures)
  totals.successDurationMsSum += successes * safeNumber(item.success_avg_duration_ms)
  totals.inputTokens += safeNumber(item.input_tokens)
  totals.outputTokens += safeNumber(item.output_tokens)
  totals.inputCacheTokens += safeNumber(item.input_cache_tokens)
  totals.requestBytes += safeNumber(item.success_request_bytes)
  totals.responseBytes += safeNumber(item.success_response_bytes)
}

const toSummary = (totals: MutableTotals): DashboardStatsSummary => {
  const totalTokens = totals.inputTokens + totals.outputTokens + totals.inputCacheTokens
  const totalBytes = totals.requestBytes + totals.responseBytes

  return {
    requests: totals.requests,
    successes: totals.successes,
    failures: totals.failures,
    failureRate: roundRatio(totals.requests === 0 ? 0 : totals.failures / totals.requests),
    successAvgDurationMs:
      totals.successes === 0 ? 0 : roundNumber(totals.successDurationMsSum / totals.successes),
    inputTokens: totals.inputTokens,
    outputTokens: totals.outputTokens,
    inputCacheTokens: totals.inputCacheTokens,
    totalTokens,
    requestBytes: totals.requestBytes,
    responseBytes: totals.responseBytes,
    totalBytes,
  }
}

export const buildDashboardStats = (
  items: BackendHourlyModelStatsItem[],
  options: DashboardStatsOptions = {},
): DashboardStats => {
  const bucket = options.bucket ?? 'hour'
  const summaryTotals = emptyTotals()
  const hourlyTotals = new Map<string, MutableTotals>()
  const backendTotals = new Map<string, MutableTotals & { backendId: number; backend: string }>()
  const modelTotals = new Map<string, MutableTotals & { model: string }>()
  const hourKeys = new Set<string>()

  for (const item of items) {
    addItem(summaryTotals, item)

    const hour = normalizeBucket(item.hour, bucket)
    hourKeys.add(hour)
    if (!hourlyTotals.has(hour)) {
      hourlyTotals.set(hour, emptyTotals())
    }
    addItem(hourlyTotals.get(hour)!, item)

    const backendKey = `${item.backend_id}:${item.backend}`
    if (!backendTotals.has(backendKey)) {
      backendTotals.set(backendKey, {
        ...emptyTotals(),
        backendId: safeNumber(item.backend_id),
        backend: item.backend,
      })
    }
    addItem(backendTotals.get(backendKey)!, item)

    if (!modelTotals.has(item.model)) {
      modelTotals.set(item.model, {
        ...emptyTotals(),
        model: item.model,
      })
    }
    addItem(modelTotals.get(item.model)!, item)
  }

  const hours = resolveHourKeys(hourKeys, options, bucket)
  const hourlySeries = buildHourlySeries(hourlyTotals, hours, bucket)
  const backendHourlySeries = buildDimensionSeries(items, hours, bucket, (item) => ({
    key: String(item.backend_id),
    label: item.backend,
  }))
  const modelHourlySeries = buildDimensionSeries(items, hours, bucket, (item) => ({
    key: item.model,
    label: item.model,
  }))
  const backendRows = Array.from(backendTotals.values())
    .map((row) => ({
      backendId: row.backendId,
      backend: row.backend,
      ...toSummary(row),
    }))
    .sort(compareDashboardRows)
  const modelRows = Array.from(modelTotals.values())
    .map((row) => ({
      model: row.model,
      ...toSummary(row),
    }))
    .sort(compareDashboardRows)

  return {
    summary: toSummary(summaryTotals),
    hourlySeries,
    backendHourlySeries,
    modelHourlySeries,
    backendRows,
    modelRows,
  }
}

const buildHourlySeries = (
  hourlyTotals: Map<string, MutableTotals>,
  hours: string[],
  bucket: DashboardStatsBucket,
): DashboardStatsSeriesPoint[] => {
  return hours.map((hour) => ({
    hour,
    label: formatBucketLabel(hour, bucket),
    ...toSummary(hourlyTotals.get(hour) ?? emptyTotals()),
  }))
}

const buildDimensionSeries = (
  items: BackendHourlyModelStatsItem[],
  hours: string[],
  bucket: DashboardStatsBucket,
  getDimension: (item: BackendHourlyModelStatsItem) => DimensionRef,
): DashboardStackedPoint[] => {
  const buckets = new Map<string, Map<string, DashboardStackedSegment>>()

  for (const item of items) {
    const hour = normalizeBucket(item.hour, bucket)
    const dimension = getDimension(item)
    if (!buckets.has(hour)) {
      buckets.set(hour, new Map())
    }
    const segments = buckets.get(hour)!
    const current = segments.get(dimension.key) ?? {
      key: dimension.key,
      label: dimension.label,
      value: 0,
    }
    current.value += safeNumber(item.requests)
    segments.set(dimension.key, current)
  }

  return hours.map((hour) => {
    const segments = Array.from(buckets.get(hour)?.values() ?? [])
      .filter((segment) => segment.value > 0)
      .sort(compareSegments)
    return {
      hour,
      label: formatBucketLabel(hour, bucket),
      total: segments.reduce((sum, segment) => sum + segment.value, 0),
      segments,
    }
  })
}

const resolveHourKeys = (
  hourKeys: Set<string>,
  options: DashboardStatsOptions,
  bucket: DashboardStatsBucket,
): string[] => {
  const hours = bucketsBetween(options.startHour, options.endHour, bucket)
  return hours.length > 0 ? hours : Array.from(hourKeys).sort()
}

const bucketsBetween = (
  startHour: string | null | undefined,
  endHour: string | null | undefined,
  bucket: DashboardStatsBucket,
): string[] => {
  if (!startHour || !endHour) {
    return []
  }

  const start = Date.parse(startHour)
  const end = Date.parse(endHour)
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
    return []
  }

  const out: string[] = []
  const step = bucket === 'day' ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000
  for (
    let cursor = truncateToBucket(start, bucket);
    cursor <= truncateToBucket(end, bucket);
    cursor += step
  ) {
    out.push(new Date(cursor).toISOString())
  }
  return out
}

const normalizeBucket = (hour: string, bucket: DashboardStatsBucket): string =>
  new Date(truncateToBucket(Date.parse(hour), bucket)).toISOString()

const truncateToBucket = (value: number, bucket: DashboardStatsBucket): number =>
  bucket === 'day' ? truncateToDay(value) : truncateToHour(value)

const truncateToHour = (value: number): number => {
  const date = new Date(value)
  date.setUTCMinutes(0, 0, 0)
  return date.getTime()
}

const truncateToLocalHour = (value: number): number => {
  const date = new Date(value)
  date.setMinutes(0, 0, 0)
  return date.getTime()
}

const truncateToDay = (value: number): number => {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

const formatBucketLabel = (hour: string, bucket: DashboardStatsBucket): string => {
  if (bucket === 'day') {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: '2-digit',
    }).format(new Date(hour))
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(hour))
}

const safeNumber = (value: number | null | undefined): number => {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : 0
}

const roundNumber = (value: number): number => Number(value.toFixed(2))

const roundRatio = (value: number): number => Number(value.toFixed(4))

const compareDashboardRows = <T extends DashboardStatsSummary>(a: T, b: T): number => {
  if (b.requests !== a.requests) {
    return b.requests - a.requests
  }
  return a.failureRate - b.failureRate
}

const compareSegments = (a: DashboardStackedSegment, b: DashboardStackedSegment): number => {
  if (b.value !== a.value) {
    return b.value - a.value
  }
  return a.label.localeCompare(b.label)
}
