export function boundedIntegerParam(
  value: string | null,
  fallback: number,
  maximum: number,
  minimum = 1
) {
  if (value == null || value.trim() === '') return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(minimum, Math.min(maximum, Math.trunc(parsed)))
}
