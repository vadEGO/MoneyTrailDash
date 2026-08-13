import type { OpportunityAction } from '@/lib/types'

export const DAILY_EVIDENCE_REVIEW_LIMIT = 20

export function needsEvidenceReview(row: OpportunityAction) {
  return row.actionability_status === 'quarantined'
    || !row.evidence_freshness_status
    || ['stale', 'missing'].includes(row.evidence_freshness_status)
}

export function isCurrentIdea(row: OpportunityAction) {
  return ['actionable', 'review_required'].includes(row.actionability_status ?? '')
    && row.evidence_freshness_status === 'fresh'
    && row.price_freshness_status === 'fresh'
    && row.levels_freshness_status === 'fresh'
    && row.review_freshness_status === 'fresh'
}

export function evidenceReviewPriority(row: OpportunityAction) {
  if (row.evidence_review_priority_score != null) return row.evidence_review_priority_score
  if (!needsEvidenceReview(row)) return 0

  const statePoints = row.action_state === 'ready'
    ? 25
    : ['exit_trim', 'invalidated'].includes(row.action_state)
      ? 15
      : ['wait_for_entry', 'chasing_risk'].includes(row.action_state)
        ? 10
        : 0
  const score = Number(row.total_score ?? 0)
  const convictionPoints = score >= 85 ? 20 : score >= 80 ? 15 : score >= 70 ? 10 : 5
  const sla = Math.max(1, Number(row.evidence_sla_days ?? 14))
  const overdueRatio = Math.max(0, Number(row.evidence_age_days ?? 0) - sla) / sla
  const freshnessPoints = row.evidence_freshness_status === 'missing'
    ? 25
    : overdueRatio >= 3
      ? 25
      : overdueRatio >= 2
        ? 20
        : overdueRatio >= 1
          ? 15
          : 10
  const confirmationPoints = Number(row.confirmed_by_count ?? 0) >= 2 ? 15 : 0
  const focusPoints = row.is_tracked ? 10 : row.is_watchlisted ? 5 : 0
  return Math.min(100, statePoints + convictionPoints + freshnessPoints + confirmationPoints + focusPoints)
}

function reviewKey(row: OpportunityAction) {
  return (row.normalized_symbol ?? row.symbol ?? row.id).toUpperCase()
}

function compareReviews(a: OpportunityAction, b: OpportunityAction) {
  return (
    evidenceReviewPriority(b) - evidenceReviewPriority(a)
    || Number(b.total_score ?? 0) - Number(a.total_score ?? 0)
    || Number(b.evidence_age_days ?? 0) - Number(a.evidence_age_days ?? 0)
  )
}

export function buildEvidenceReviewBatch(
  ideas: OpportunityAction[],
  limit = DAILY_EVIDENCE_REVIEW_LIMIT,
) {
  const reviewRows = ideas.filter(needsEvidenceReview)
  const grouped = new Map<string, OpportunityAction[]>()
  for (const row of reviewRows) {
    const key = reviewKey(row)
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(row)
  }

  const uniqueReviews = Array.from(grouped.values())
    .map(rows => ({
      ...[...rows].sort(compareReviews)[0],
      evidence_duplicate_setup_count: rows.length,
    }))
    .sort(compareReviews)

  return {
    reviewRows,
    uniqueReviews,
    dailyBatch: uniqueReviews.slice(0, Math.max(0, limit)),
    duplicateRows: reviewRows.length - uniqueReviews.length,
  }
}
