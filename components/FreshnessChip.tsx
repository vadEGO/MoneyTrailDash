import StatusChip from '@/components/ui/StatusChip'
import { formatAge } from '@/lib/fmt'

interface FreshnessChipProps {
  /** ISO timestamp this section/panel last updated. */
  at?: string | null
  /** Age (hours) past which the section is considered STALE. Omit for on-demand
   *  sections (age is shown, but never auto-flagged stale). */
  staleAfterHrs?: number | null
  /** Optional short prefix, e.g. "scores". */
  label?: string
}

/**
 * Per-section freshness indicator: a LIVE/STALE chip plus a human "Xh ago" age.
 * Consolidates the ad-hoc timestamp rendering that only a few surfaces did, so
 * every section can show — consistently — when it last updated and whether that
 * is stale. Drop into a PageHeader `status` slot or a card header.
 */
export default function FreshnessChip({ at, staleAfterHrs, label }: FreshnessChipProps) {
  const age = formatAge(at)
  const prefix = label ? `${label} · ` : ''

  if (!at) {
    return <StatusChip label={`${prefix}never run`} variant="grey" />
  }

  // on_demand (no threshold): show age only, no stale judgement
  if (staleAfterHrs == null) {
    return (
      <span className="inline-flex items-center gap-2">
        <StatusChip label={`${prefix}${age}`} variant="blue" dot={false} />
      </span>
    )
  }

  const ageHrs = (Date.now() - new Date(at).getTime()) / 3_600_000
  const isStale = ageHrs > staleAfterHrs
  return (
    <span className="inline-flex items-center gap-2">
      <StatusChip label={isStale ? 'STALE' : 'LIVE'} variant={isStale ? 'amber' : 'green'} />
      <span className="text-2xs font-mono text-ink-3 uppercase">{prefix}{age}</span>
    </span>
  )
}
