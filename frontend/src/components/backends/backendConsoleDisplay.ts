export interface ConsoleAccountSummary {
  id: string
  username: string
  displayName: string
  group: string
  role: string
  status: string
  quota: unknown
  usedQuota: unknown
  remainingQuota: number | null
  lastCheckinAt: string
}

export interface PricingModelRow {
  model: string
  prompt: string
  completion: string
}

export interface DetailRow {
  label: string
  value: string
}

const accountSummaryCache = new Map<string, ConsoleAccountSummary | null>()
const pricingRowsCache = new Map<string, PricingModelRow[]>()

export const parseConsoleJSON = (raw?: string): unknown => {
  const trimmed = raw?.trim()
  if (!trimmed || trimmed === '{}') {
    return null
  }
  try {
    return JSON.parse(trimmed)
  } catch {
    return null
  }
}

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  return value as Record<string, unknown>
}

export const formatConsoleValue = (value: unknown, fallback = '-'): string => {
  if (value === null || value === undefined || value === '') {
    return fallback
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value.toLocaleString() : fallback
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }
  return String(value)
}

const hasConsoleValue = (value: unknown): boolean => value !== null && value !== undefined && value !== ''

const finiteNumber = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const formatConsoleTime = (value: unknown): string => {
  const raw = formatConsoleValue(value, '')
  if (!raw) {
    return ''
  }
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? raw : date.toLocaleString()
}

export const consoleAccountSummary = (raw?: string): ConsoleAccountSummary | null => {
  const cacheKey = raw ?? ''
  if (accountSummaryCache.has(cacheKey)) {
    return accountSummaryCache.get(cacheKey) ?? null
  }

  const account = asRecord(parseConsoleJSON(raw))
  if (!account) {
    accountSummaryCache.set(cacheKey, null)
    return null
  }

  const quota = account.quota
  const usedQuota = account.used_quota
  const quotaValue = finiteNumber(quota)
  const usedQuotaValue = finiteNumber(usedQuota)

  const summary: ConsoleAccountSummary = {
    id: formatConsoleValue(account.id, ''),
    username: formatConsoleValue(account.username, ''),
    displayName: formatConsoleValue(account.display_name, ''),
    group: formatConsoleValue(account.group, ''),
    role: formatConsoleValue(account.role, ''),
    status: formatConsoleValue(account.status, ''),
    quota,
    usedQuota,
    remainingQuota: quotaValue !== null && usedQuotaValue !== null ? quotaValue - usedQuotaValue : null,
    lastCheckinAt: formatConsoleTime(account.last_checkin_at)
  }

  const result = Object.values(summary).some((value) => hasConsoleValue(value)) ? summary : null
  accountSummaryCache.set(cacheKey, result)
  return result
}

export const consoleAccountRows = (raw?: string): DetailRow[] => {
  const summary = consoleAccountSummary(raw)
  if (!summary) {
    return []
  }
  return [
    ['User ID', summary.id],
    ['Username', summary.username],
    ['Display Name', summary.displayName],
    ['Group', summary.group],
    ['Role', summary.role],
    ['Status', summary.status],
    ['Quota', summary.quota],
    ['Used Quota', summary.usedQuota],
    ['Quota Remaining', summary.remainingQuota],
    ['Last Check-in', summary.lastCheckinAt]
  ]
    .filter(([, value]) => hasConsoleValue(value))
    .map(([label, value]) => ({
      label: String(label),
      value: formatConsoleValue(value)
    }))
}

const splitFocusPatterns = (patterns?: string): string[] => {
  return (patterns ?? '')
    .split(/[\n,]+/)
    .map((pattern) => pattern.trim())
    .filter(Boolean)
}

const wildcardPatternToRegExp = (pattern: string): RegExp => {
  const escaped = pattern.replace(/[|\\{}()[\]^$+?.]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp(`^${escaped}$`)
}

export const modelNameMatchesFocusPatterns = (model: string, patterns?: string): boolean => {
  const parsed = splitFocusPatterns(patterns)
  if (parsed.length === 0) {
    return true
  }
  return parsed.some((pattern) => wildcardPatternToRegExp(pattern).test(model))
}

const promptPriceKeys = [
  'prompt',
  'prompt_price',
  'input',
  'input_price',
  'model_ratio',
  'model_price',
  'price'
]

const completionPriceKeys = [
  'completion',
  'completion_price',
  'output',
  'output_price',
  'completion_ratio'
]

const modelNameKeys = ['model', 'model_name', 'name', 'id']

const firstPricingField = (record: Record<string, unknown>, keys: string[]): unknown => {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== '') {
      return record[key]
    }
  }
  return null
}

const looksLikePricingRecord = (record: Record<string, unknown>): boolean => {
  return Boolean(
    firstPricingField(record, modelNameKeys) ||
    firstPricingField(record, promptPriceKeys) ||
    firstPricingField(record, completionPriceKeys)
  )
}

const pricingRowFromRecord = (model: string, record: Record<string, unknown>): PricingModelRow | null => {
  const rowModel = formatConsoleValue(firstPricingField(record, modelNameKeys), model)
  if (!rowModel) {
    return null
  }
  return {
    model: rowModel,
    prompt: formatConsoleValue(firstPricingField(record, promptPriceKeys)),
    completion: formatConsoleValue(firstPricingField(record, completionPriceKeys))
  }
}

const pricingRowsFromModelsField = (models: unknown): PricingModelRow[] => {
  if (!Array.isArray(models)) {
    return []
  }
  return models.flatMap((model, index) => {
    const record = asRecord(model)
    if (record) {
      const row = pricingRowFromRecord(`model-${index + 1}`, record)
      return row ? [row] : []
    }
    const modelName = formatConsoleValue(model, '')
    return modelName ? [{ model: modelName, prompt: '-', completion: '-' }] : []
  })
}

const pricingRowsFromVendors = (vendors: unknown): PricingModelRow[] => {
  if (!Array.isArray(vendors)) {
    return []
  }
  return vendors.flatMap((vendor) => {
    const record = asRecord(vendor)
    return record ? pricingRowsFromModelsField(record.models) : []
  })
}

const pricingRowsFromValue = (value: unknown): PricingModelRow[] => {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => {
      const record = asRecord(item)
      if (record?.models) {
        return pricingRowsFromModelsField(record.models)
      }
      if (record) {
        const row = pricingRowFromRecord(`model-${index + 1}`, record)
        return row ? [row] : []
      }
      const modelName = formatConsoleValue(item, '')
      return modelName ? [{ model: modelName, prompt: '-', completion: '-' }] : []
    })
  }

  const record = asRecord(value)
  if (!record) {
    return []
  }

  const vendorRows = pricingRowsFromVendors(record.vendors)
  if (vendorRows.length > 0) {
    return vendorRows
  }

  if (record.models) {
    return pricingRowsFromModelsField(record.models)
  }

  if (looksLikePricingRecord(record)) {
    const row = pricingRowFromRecord('', record)
    return row ? [row] : []
  }

  return Object.entries(record).flatMap(([model, item]) => {
    const itemRecord = asRecord(item)
    if (!itemRecord) {
      return []
    }
    if (itemRecord.models) {
      return pricingRowsFromModelsField(itemRecord.models)
    }
    if (!looksLikePricingRecord(itemRecord)) {
      return []
    }
    const row = pricingRowFromRecord(model, itemRecord)
    return row ? [row] : []
  })
}

export const pricingModelRows = (raw?: string, focusPatterns?: string): PricingModelRow[] => {
  const cacheKey = `${raw ?? ''}\n${focusPatterns ?? ''}`
  if (pricingRowsCache.has(cacheKey)) {
    return pricingRowsCache.get(cacheKey) ?? []
  }

  const parsed = parseConsoleJSON(raw)
  const root = asRecord(parsed)
  const source = root && root.data !== undefined ? root.data : parsed

  const seen = new Set<string>()
  const rows = pricingRowsFromValue(source)
    .filter((row) => row.model.trim() !== '')
    .filter((row) => modelNameMatchesFocusPatterns(row.model, focusPatterns))
    .filter((row) => {
      if (seen.has(row.model)) {
        return false
      }
      seen.add(row.model)
      return true
    })
    .sort((a, b) => a.model.localeCompare(b.model))
  pricingRowsCache.set(cacheKey, rows)
  return rows
}
