export const formatLatencySeconds = (
  value: number | null | undefined,
  emptyValue = '0s',
): string => {
  const latencyMs = Number(value)
  if (!Number.isFinite(latencyMs) || latencyMs <= 0) {
    return emptyValue
  }

  const roundedSeconds = Math.max(0.01, Number((latencyMs / 1000).toFixed(2)))
  return `${roundedSeconds}s`
}
