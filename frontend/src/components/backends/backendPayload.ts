type ModelMappingInput = string | Record<string, unknown> | null | undefined

export interface BackendProxyLike {
  proxy_id?: number | null
  socks_proxy_id?: number | null
  proxy?: {
    id?: number | null
  } | null
}

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const toStringMap = (value: Record<string, unknown>): Record<string, string> => {
  return Object.entries(value).reduce<Record<string, string>>((mapping, [key, rawValue]) => {
    const trimmedKey = key.trim()
    if (!trimmedKey) return mapping
    if (typeof rawValue !== 'string') {
      throw new Error('Model mapping values must be strings')
    }
    const trimmedValue = rawValue.trim()
    if (trimmedValue) {
      mapping[trimmedKey] = trimmedValue
    }
    return mapping
  }, {})
}

export const formatModelMappingForInput = (value: ModelMappingInput): string => {
  if (!value) return ''
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return ''
    try {
      const parsed = JSON.parse(trimmed) as unknown
      return isPlainRecord(parsed) ? JSON.stringify(toStringMap(parsed), null, 2) : trimmed
    } catch {
      return trimmed
    }
  }
  return JSON.stringify(toStringMap(value), null, 2)
}

export const parseModelMappingInput = (value: string): Record<string, string> => {
  const trimmed = value.trim()
  if (!trimmed) return {}

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    throw new Error('Model mapping must be a valid JSON object')
  }
  if (!isPlainRecord(parsed)) {
    throw new Error('Model mapping must be a valid JSON object')
  }
  return toStringMap(parsed)
}

const parseCommaSeparatedList = (value: string): string[] => {
  return value
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean)
}

export const parseModelListInput = (value: string): string[] => parseCommaSeparatedList(value)

export const parseBackendTagInput = (value: string): string[] => parseCommaSeparatedList(value)

export const normalizeBackendProxyId = (backend: BackendProxyLike): number => {
  const proxyId = backend.proxy_id
  if (typeof proxyId === 'number' && proxyId > 0) return proxyId

  const socksProxyId = backend.socks_proxy_id
  if (typeof socksProxyId === 'number' && socksProxyId > 0) return socksProxyId

  const nestedProxyId = backend.proxy?.id
  if (typeof nestedProxyId === 'number' && nestedProxyId > 0) return nestedProxyId

  return 0
}
