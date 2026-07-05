export interface ConsoleAccountSummary {
  id: string
  username: string
  displayName: string
  group: string
  role: string
  status: string
  quota: unknown
  quotaDisplay: string
  usedQuota: unknown
  usedQuotaDisplay: string
  lastCheckinAt: string
}

export interface PricingModelRow {
  model: string
  price: string
  group: string
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

const formatConsoleNumber = (value: number): string => {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: 6
  })
}

const formatConsoleAmountWithSymbol = (amount: string, symbol: string): string => {
  if (!symbol) return amount
  return symbol === '$' ? `$${amount}` : `${amount} ${symbol}`
}

const formatConsoleQuota = (
  value: unknown,
  exchangeRate: number | null,
  quotaPerUnit: number | null,
  symbol: string
): string => {
  const numericValue = finiteNumber(value)
  if (numericValue === null || exchangeRate === null || quotaPerUnit === null || quotaPerUnit <= 0 || symbol === '') {
    return formatConsoleValue(value, '')
  }
  const formatted = formatConsoleNumber((numericValue * exchangeRate) / quotaPerUnit)
  return formatConsoleAmountWithSymbol(formatted, symbol)
}

const quotaDisplaySymbol = (displayType: unknown, customSymbol: string): string => {
  switch (formatConsoleValue(displayType, '').trim().toUpperCase()) {
    case 'CUSTOM':
      return customSymbol
    case 'USD':
      return '$'
    default:
      return customSymbol
  }
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
  const exchangeRate = finiteNumber(account.custom_currency_exchange_rate)
  const quotaPerUnit = finiteNumber(account.quota_per_unit)
  const currencySymbol = formatConsoleValue(account.custom_currency_symbol, '').trim()
  const quotaSymbol = quotaDisplaySymbol(account.quota_display_type, currencySymbol)

  const summary: ConsoleAccountSummary = {
    id: formatConsoleValue(account.id, ''),
    username: formatConsoleValue(account.username, ''),
    displayName: formatConsoleValue(account.display_name, ''),
    group: formatConsoleValue(account.group, ''),
    role: formatConsoleValue(account.role, ''),
    status: formatConsoleValue(account.status, ''),
    quota,
    quotaDisplay: formatConsoleQuota(quota, exchangeRate, quotaPerUnit, quotaSymbol),
    usedQuota,
    usedQuotaDisplay: formatConsoleQuota(usedQuota, exchangeRate, quotaPerUnit, quotaSymbol),
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
    ['Quota', summary.quotaDisplay],
    ['Used Quota', summary.usedQuotaDisplay],
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
const enableGroupKeys = ['enable_groups', 'enabled_groups', 'groups', 'group']

interface PricingContext {
  groupRatio: Record<string, number>
  exchangeRate: number | null
  quotaPerUnit: number | null
  currencySymbol: string
}

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
    firstPricingField(record, completionPriceKeys) ||
    firstPricingField(record, enableGroupKeys) ||
    record.quota_type !== undefined
  )
}

const normalizeEnableGroups = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => formatConsoleValue(item, '').trim())
      .filter(Boolean)
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }
  const record = asRecord(value)
  if (record) {
    return Object.entries(record)
      .filter(([, enabled]) => enabled !== false && enabled !== null && enabled !== undefined)
      .map(([group]) => group.trim())
      .filter(Boolean)
  }
  return []
}

const normalizeGroupRatio = (value: unknown): Record<string, number> => {
  const record = asRecord(value)
  if (!record) {
    return {}
  }
  return Object.entries(record).reduce<Record<string, number>>((accumulator, [group, ratio]) => {
    const numericRatio = finiteNumber(ratio)
    if (group.trim() && numericRatio !== null) {
      accumulator[group.trim()] = numericRatio
    }
    return accumulator
  }, {})
}

const pricingContextFromPayload = (root: Record<string, unknown> | null, source: unknown, accountRaw?: string): PricingContext => {
  const sourceRecord = asRecord(source)
  const account = asRecord(parseConsoleJSON(accountRaw))
  const metadata = account ?? {}
  const customSymbol = formatConsoleValue(metadata.custom_currency_symbol ?? root?.custom_currency_symbol ?? sourceRecord?.custom_currency_symbol, '').trim()
  return {
    groupRatio: normalizeGroupRatio(root?.group_ratio ?? sourceRecord?.group_ratio),
    exchangeRate: finiteNumber(metadata.custom_currency_exchange_rate ?? root?.custom_currency_exchange_rate ?? sourceRecord?.custom_currency_exchange_rate),
    quotaPerUnit: finiteNumber(metadata.quota_per_unit ?? root?.quota_per_unit ?? sourceRecord?.quota_per_unit),
    currencySymbol: quotaDisplaySymbol(metadata.quota_display_type ?? root?.quota_display_type ?? sourceRecord?.quota_display_type, customSymbol)
  }
}

const minGroupRatio = (groups: string[], groupRatio: Record<string, number>): number => {
  const ratios = groups
    .map((group) => groupRatio[group])
    .filter((ratio): ratio is number => Number.isFinite(ratio))
  return ratios.length > 0 ? Math.min(...ratios) : 1
}

const formatUnitPrice = (value: number, currencySymbol: string): string => {
  const amount = formatConsoleNumber(value)
  return `${formatConsoleAmountWithSymbol(amount, currencySymbol)} / 1M`
}

const formatRequestPrice = (value: number, context: PricingContext): string => {
  const converted = context.exchangeRate === null ? value : value * context.exchangeRate
  const amount = formatConsoleNumber(converted)
  return `${formatConsoleAmountWithSymbol(amount, context.currencySymbol)} 每次`
}

const formatPricingPrice = (record: Record<string, unknown>, groups: string[], context: PricingContext): string => {
  const quotaType = finiteNumber(record.quota_type)
  const modelRatio = finiteNumber(record.model_ratio)
  const modelPrice = finiteNumber(record.model_price)

  if (quotaType === 1) {
    return modelPrice === null ? '-' : formatRequestPrice(modelPrice, context)
  }

  if ((quotaType === 0 || quotaType === null) && modelRatio !== null) {
    if (context.exchangeRate === null || context.quotaPerUnit === null || context.quotaPerUnit <= 0) {
      return formatConsoleNumber(modelRatio)
    }
    const inputPrice = modelRatio * 1_000_000 / context.quotaPerUnit * context.exchangeRate * minGroupRatio(groups, context.groupRatio)
    const inputDisplay = `Input: ${formatUnitPrice(inputPrice, context.currencySymbol)}`
    const completionRatio = finiteNumber(record.completion_ratio)
    if (completionRatio === null) {
      return inputDisplay
    }
    return `${inputDisplay}; Output: ${formatUnitPrice(inputPrice * completionRatio, context.currencySymbol)}`
  }

  if (modelPrice !== null) {
    return formatRequestPrice(modelPrice, context)
  }

  const prompt = firstPricingField(record, promptPriceKeys)
  const completion = firstPricingField(record, completionPriceKeys)
  if (hasConsoleValue(prompt) && hasConsoleValue(completion)) {
    return `Prompt: ${formatConsoleValue(prompt)}; Completion: ${formatConsoleValue(completion)}`
  }
  if (hasConsoleValue(prompt)) {
    return formatConsoleValue(prompt)
  }
  if (hasConsoleValue(completion)) {
    return formatConsoleValue(completion)
  }
  return '-'
}

const pricingRowFromRecord = (model: string, record: Record<string, unknown>, context: PricingContext): PricingModelRow | null => {
  const rowModel = formatConsoleValue(firstPricingField(record, modelNameKeys), model)
  if (!rowModel) {
    return null
  }
  const groups = normalizeEnableGroups(firstPricingField(record, enableGroupKeys))
  return {
    model: rowModel,
    price: formatPricingPrice(record, groups, context),
    group: groups.length > 0 ? groups.join(', ') : '-'
  }
}

const pricingRowsFromModelsField = (models: unknown, context: PricingContext): PricingModelRow[] => {
  if (!Array.isArray(models)) {
    return []
  }
  return models.flatMap((model, index) => {
    const record = asRecord(model)
    if (record) {
      const row = pricingRowFromRecord(`model-${index + 1}`, record, context)
      return row ? [row] : []
    }
    const modelName = formatConsoleValue(model, '')
    return modelName ? [{ model: modelName, price: '-', group: '-' }] : []
  })
}

const pricingRowsFromVendors = (vendors: unknown, context: PricingContext): PricingModelRow[] => {
  if (!Array.isArray(vendors)) {
    return []
  }
  return vendors.flatMap((vendor) => {
    const record = asRecord(vendor)
    return record ? pricingRowsFromModelsField(record.models, context) : []
  })
}

const pricingRowsFromValue = (value: unknown, context: PricingContext): PricingModelRow[] => {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => {
      const record = asRecord(item)
      if (record?.models) {
        return pricingRowsFromModelsField(record.models, context)
      }
      if (record) {
        const row = pricingRowFromRecord(`model-${index + 1}`, record, context)
        return row ? [row] : []
      }
      const modelName = formatConsoleValue(item, '')
      return modelName ? [{ model: modelName, price: '-', group: '-' }] : []
    })
  }

  const record = asRecord(value)
  if (!record) {
    return []
  }

  const vendorRows = pricingRowsFromVendors(record.vendors, context)
  if (vendorRows.length > 0) {
    return vendorRows
  }

  if (record.models) {
    return pricingRowsFromModelsField(record.models, context)
  }

  if (looksLikePricingRecord(record)) {
    const row = pricingRowFromRecord('', record, context)
    return row ? [row] : []
  }

  return Object.entries(record).flatMap(([model, item]) => {
    const itemRecord = asRecord(item)
    if (!itemRecord) {
      return []
    }
    if (itemRecord.models) {
      return pricingRowsFromModelsField(itemRecord.models, context)
    }
    if (!looksLikePricingRecord(itemRecord)) {
      return []
    }
    const row = pricingRowFromRecord(model, itemRecord, context)
    return row ? [row] : []
  })
}

export const pricingModelRows = (raw?: string, focusPatterns?: string, accountRaw?: string): PricingModelRow[] => {
  const cacheKey = `${raw ?? ''}\n${focusPatterns ?? ''}\n${accountRaw ?? ''}`
  if (pricingRowsCache.has(cacheKey)) {
    return pricingRowsCache.get(cacheKey) ?? []
  }

  const parsed = parseConsoleJSON(raw)
  const root = asRecord(parsed)
  const source = root && root.data !== undefined ? root.data : parsed
  const context = pricingContextFromPayload(root, source, accountRaw)

  const seen = new Set<string>()
  const rows = pricingRowsFromValue(source, context)
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
