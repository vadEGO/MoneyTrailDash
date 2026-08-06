import type { OpportunityAction } from '@/lib/types'

/**
 * Ticker-level aggregation of opportunity rows.
 *
 * The engine emits one row per source view, so the same ticker arrives several
 * times. `buildEvidenceReviewBatch` collapses those to a single row because it is
 * routing review attention; this module does the opposite. It partitions rather
 * than filters, keeping every sibling thesis so a bull and a bear case on the same
 * asset can be read side by side and re-evaluated against each other.
 */

// Lifecycle order — a ticker surfaces in the most advanced state any of its views
// has reached. Mirrors STATE_ORDER in FunnelBoard and state_priority in
// supabase/migrations/20260806051300_ticker_stance_rollup.sql.
const STATE_PRIORITY: Record<string, number> = {
  ready: 1,
  wait_for_entry: 2,
  chasing_risk: 3,
  holding: 4,
  exit_trim: 5,
  exiting: 6,
  research: 7,
  invalidated: 8,
}

const UNKNOWN_STATE_PRIORITY = 9

// An unscored view still carries an opinion; treat it as mid-conviction rather than
// letting it drop out of the balance entirely.
const DEFAULT_SCORE = 50

// Each additional confirming source upgrades a view's weight by this much.
const CONFIRMATION_UPLIFT = 0.25

export type StanceLabel = 'strong_long' | 'long' | 'contested' | 'short' | 'strong_short'

export interface TickerGroup {
  symbol: string
  /** Every view on this ticker, most advanced and highest conviction first. */
  rows: OpportunityAction[]
  bulls: OpportunityAction[]
  bears: OpportunityAction[]
  undirected: OpportunityAction[]
  /** The view that represents the ticker in the funnel. */
  primary: OpportunityAction
  /** Score-weighted balance of long against short, -100..100, or null if no view has a direction. */
  netStance: number | null
  stanceLabel: StanceLabel | null
  /** True when both a long and a short view are open on the ticker. */
  hasDisagreement: boolean
  /** Union of confirming sources across every view. */
  sources: string[]
  /** Lifecycle states other than the primary's, so a split ticker is visible at a glance. */
  conflictingStates: string[]
  setupCount: number
  topScore: number | null
}

export function statePriority(state?: string | null): number {
  return STATE_PRIORITY[(state ?? '').toLowerCase()] ?? UNKNOWN_STATE_PRIORITY
}

export function tickerOf(row: OpportunityAction): string {
  return (row.normalized_symbol ?? row.symbol ?? row.id).toUpperCase()
}

function directionOf(row: OpportunityAction): 'long' | 'short' | null {
  const dir = (row.direction ?? '').toLowerCase()
  return dir === 'long' || dir === 'short' ? dir : null
}

/** Conviction weight of a single view: its score, uplifted by corroborating sources. */
export function stanceWeight(row: OpportunityAction): number {
  const score = Number(row.total_score ?? DEFAULT_SCORE)
  const base = Number.isFinite(score) ? score : DEFAULT_SCORE
  const confirmations = Math.max(0, Number(row.confirmed_by_count ?? 1) - 1)
  return base * (1 + CONFIRMATION_UPLIFT * confirmations)
}

export function stanceLabelFor(netStance: number | null): StanceLabel | null {
  if (netStance == null) return null
  if (netStance >= 60) return 'strong_long'
  if (netStance >= 20) return 'long'
  if (netStance > -20) return 'contested'
  if (netStance > -60) return 'short'
  return 'strong_short'
}

export const STANCE_LABEL_TEXT: Record<StanceLabel, string> = {
  strong_long: 'Strong long',
  long: 'Long',
  contested: 'Contested',
  short: 'Short',
  strong_short: 'Strong short',
}

/** Most advanced state first, then highest conviction. */
function compareRows(a: OpportunityAction, b: OpportunityAction) {
  return (
    statePriority(a.action_state) - statePriority(b.action_state)
    || Number(b.total_score ?? 0) - Number(a.total_score ?? 0)
    || Number(b.confirmed_by_count ?? 0) - Number(a.confirmed_by_count ?? 0)
    || String(a.id).localeCompare(String(b.id))
  )
}

function buildGroup(symbol: string, rows: OpportunityAction[]): TickerGroup {
  const sorted = [...rows].sort(compareRows)
  const bulls = sorted.filter(r => directionOf(r) === 'long')
  const bears = sorted.filter(r => directionOf(r) === 'short')
  const undirected = sorted.filter(r => directionOf(r) === null)

  const directional = [...bulls, ...bears]
  const totalWeight = directional.reduce((sum, r) => sum + stanceWeight(r), 0)
  const signedWeight = bulls.reduce((sum, r) => sum + stanceWeight(r), 0)
    - bears.reduce((sum, r) => sum + stanceWeight(r), 0)
  const netStance = totalWeight > 0 ? Math.round((signedWeight / totalWeight) * 100) : null

  const primary = sorted[0]
  const primaryState = (primary.action_state ?? '').toLowerCase()
  const conflictingStates = Array.from(
    new Set(
      sorted
        .map(r => (r.action_state ?? '').toLowerCase())
        .filter(s => s && s !== primaryState),
    ),
  )

  // Migration 004 backfilled `sources` from the scalar `source`, but a row written
  // before that can still arrive with an empty array. Fall back to `source` so a
  // single-source view is never reported as having none.
  const sources = Array.from(
    new Set(sorted.flatMap(r => (
      r.sources && r.sources.length > 0 ? r.sources : (r.source ? [r.source] : [])
    ))),
  ).sort()

  const scores = sorted.map(r => Number(r.total_score)).filter(n => Number.isFinite(n))

  return {
    symbol,
    rows: sorted,
    bulls,
    bears,
    undirected,
    primary,
    netStance,
    stanceLabel: stanceLabelFor(netStance),
    hasDisagreement: bulls.length > 0 && bears.length > 0,
    sources,
    conflictingStates,
    setupCount: sorted.length,
    topScore: scores.length > 0 ? Math.max(...scores) : null,
  }
}

/**
 * Group rows by ticker without discarding any of them.
 *
 * Output order matches the funnel's reading order: most advanced lifecycle state
 * first, then highest conviction, so `groups` can be bucketed by
 * `primary.action_state` directly.
 */
export function groupIdeasByTicker(ideas: OpportunityAction[]): TickerGroup[] {
  const buckets = new Map<string, OpportunityAction[]>()
  for (const row of ideas) {
    const key = tickerOf(row)
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key)!.push(row)
  }

  return Array.from(buckets.entries())
    .map(([symbol, rows]) => buildGroup(symbol, rows))
    .sort((a, b) => compareRows(a.primary, b.primary))
}

/** Tickers carrying an open bull-versus-bear conflict, most conviction first. */
export function contestedTickers(groups: TickerGroup[]): TickerGroup[] {
  return groups
    .filter(g => g.hasDisagreement)
    .sort((a, b) => Number(b.topScore ?? 0) - Number(a.topScore ?? 0))
}

/**
 * The set of views to weigh when re-evaluating a ticker: the opposing case first,
 * because that is what the primary thesis has to answer.
 */
export function opposingViews(group: TickerGroup, row: OpportunityAction): OpportunityAction[] {
  const dir = directionOf(row)
  if (dir === null) return group.rows.filter(r => r.id !== row.id)
  return dir === 'long' ? group.bears : group.bulls
}

export function supportingViews(group: TickerGroup, row: OpportunityAction): OpportunityAction[] {
  const dir = directionOf(row)
  if (dir === null) return []
  const sameSide = dir === 'long' ? group.bulls : group.bears
  return sameSide.filter(r => r.id !== row.id)
}
