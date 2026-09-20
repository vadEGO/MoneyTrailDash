import type { SectionStatus } from './types'

export const CORE_SECTIONS = ['feeds', 'analysis', 'macro', 'filings', 'trade_ideas', 'scores', 'portfolio'] as const

function timestamp(value: string | null | undefined) {
  if (!value) return Number.NaN
  const normalized = value.trim().replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00')
  return Date.parse(normalized)
}

export function sectionHealth(row: SectionStatus | undefined, now = Date.now()) {
  if (!row) return { label: 'UNKNOWN', variant: 'grey' as const }
  if (row.status === 'failed') return { label: 'FAILED', variant: 'red' as const }
  const okAt = timestamp(row.last_ok_at)
  const maxAge = (row.stale_after_hours ?? 26) * 3_600_000
  if (!Number.isFinite(okAt) || now - okAt > maxAge) return { label: 'STALE', variant: 'amber' as const }
  if (row.status === 'running') return { label: 'RUNNING', variant: 'blue' as const }
  if (row.status === 'degraded') return { label: 'DEGRADED', variant: 'amber' as const }
  if (row.error) return { label: 'NEEDS REVIEW', variant: 'amber' as const }
  if (row.status !== 'completed' && row.status !== 'success') return { label: row.status.toUpperCase(), variant: 'amber' as const }
  return { label: 'CURRENT', variant: 'green' as const }
}

export function pipelineHealth(sections: Record<string, SectionStatus>) {
  const states = CORE_SECTIONS.map(key => sectionHealth(sections[key]))
  if (states.some(state => state.label === 'FAILED')) return { label: 'NEEDS ATTENTION', variant: 'red' as const }
  if (states.every(state => state.label === 'CURRENT')) return { label: 'CURRENT', variant: 'green' as const }
  return { label: 'INCOMPLETE', variant: 'amber' as const }
}
