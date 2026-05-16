/**
 * Pure formatting helpers — no server imports, safe for client components.
 */

export function formatAge(iso?: string | null) {
  if (!iso) return 'Never synced'
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export function pct(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return `${Math.round(Number(value) * 100)}%`
}
