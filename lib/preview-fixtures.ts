import type { ChartOverlayLevel, CompositeRow, MarketCandle, OpportunityAction } from '@/lib/types'

/**
 * Mock data for the /preview route.
 *
 * Exists so the ticker aggregation and chart range behaviour can be inspected
 * without Supabase credentials or a login, and so the interesting cases
 * (bull-versus-bear on one ticker, targets far outside the candle range) are
 * present regardless of what the live engine happens to have exported.
 *
 * Not imported by any real page.
 */

// Relative so the demonstrated price ages stay meaningful as time passes.
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()

function mockIdea(overrides: Partial<OpportunityAction>): OpportunityAction {
  return {
    state_rank: null,
    id: 'mock',
    sources: null,
    confirmed_by_count: 1,
    source_details: null,
    source: 'realvision',
    source_record_id: null,
    symbol: null,
    normalized_symbol: null,
    title: 'Mock idea',
    thesis: null,
    direction: 'long',
    asset_class: 'crypto',
    status: 'active',
    action_state: 'ready',
    lifecycle: 'active_review',
    total_score: 75,
    thesis_score: 15,
    entry_score: 15,
    risk_reward_score: 11,
    catalyst_score: 11,
    source_score: 12,
    liquidity_score: 8,
    portfolio_fit_score: 3,
    current_price: null,
    ideal_entry: null,
    entry_min: null,
    entry_max: null,
    do_not_chase_above: null,
    stop_loss: null,
    take_profit_1: null,
    take_profit_2: null,
    take_profit_3: null,
    trailing_exit_trigger: null,
    invalidation: null,
    why_now: null,
    next_action: null,
    what_to_watch: null,
    evidence_last_confirmed_at: null,
    evidence_review_due_at: null,
    evidence_sla_days: 14,
    evidence_age_days: 3,
    evidence_freshness_status: 'fresh',
    evidence_review_reason: null,
    evidence_review_priority_score: null,
    evidence_review_priority_tier: null,
    evidence_review_priority_reason: null,
    source_url: null,
    is_tracked: false,
    is_watchlisted: true,
    expires_at: null,
    deleted_at: null,
    discovered_at: daysAgo(5),
    updated_at: daysAgo(1),
    ...overrides,
  }
}

// The crypto leg of the real exporter stopped writing about six weeks ago, so every
// crypto quote on the live board is this old. Reproduced here so the stale-price
// treatment is visible against the freshly-written equities.
const CRYPTO_PRICED_AT = daysAgo(44)

export const PREVIEW_IDEAS: OpportunityAction[] = [
  // ── BTC: three views, two long and one short. Net stance lands at +46 ("long")
  // but the DISAGREEMENT badge fires because a bear case is open.
  mockIdea({
    id: 'btc-rv', updated_at: CRYPTO_PRICED_AT, normalized_symbol: 'BTC', symbol: 'BTC',
    title: 'Bitcoin — halving supply squeeze into ETF inflows',
    source: 'realvision', sources: ['realvision', 'patreon'], confirmed_by_count: 2,
    direction: 'long', total_score: 88, action_state: 'ready',
    current_price: 104_200, entry_min: 98_000, entry_max: 106_000,
    do_not_chase_above: 112_000, stop_loss: 91_000,
    take_profit_1: 128_000, take_profit_2: 155_000, take_profit_3: 310_000,
    thesis: 'Post-halving issuance drop meets sustained spot ETF accumulation. Float available to sell is shrinking while allocators are still under-weight.',
    why_now: 'Spot ETF net inflows positive for six straight weeks while exchange balances hit a multi-year low.',
    what_to_watch: 'Weekly ETF net flow turning negative, or exchange balances rising two weeks running.',
    invalidation: 'A weekly close below 91k, or ETF outflows for three consecutive weeks.',
    next_action: 'Scale in across the entry band; do not chase above 112k.',
    source_details: [
      { source: 'realvision', author: 'RV Pro', score_contrib: 12, notes: 'Macro desk long-term structural long', confirmed_at: '2026-08-04T00:00:00Z' },
      { source: 'patreon', author: 'Chartist', score_contrib: 6, notes: 'Independent confirmation from flow desk', confirmed_at: '2026-08-05T00:00:00Z' },
    ],
  }),
  mockIdea({
    id: 'btc-patreon', updated_at: CRYPTO_PRICED_AT, normalized_symbol: 'BTC', symbol: 'BTC',
    title: 'Bitcoin — momentum continuation above range high',
    source: 'patreon', sources: ['patreon'],
    direction: 'long', total_score: 74, action_state: 'wait_for_entry',
    current_price: 104_200, entry_min: 96_000, entry_max: 100_000, stop_loss: 88_000,
    take_profit_1: 120_000,
    thesis: 'Simple trend-following read: higher lows since March and a clean breakout retest. Wants a pullback into the 96–100k shelf before adding.',
    why_now: 'Retest of the breakout shelf is in progress.',
    invalidation: 'Loss of the 96k shelf on a daily close.',
    evidence_freshness_status: 'aging', evidence_age_days: 11,
  }),
  mockIdea({
    id: 'btc-discord', updated_at: CRYPTO_PRICED_AT, normalized_symbol: 'BTC', symbol: 'BTC',
    title: 'Bitcoin — distribution into retail euphoria, fade the rip',
    source: 'discord', sources: ['discord'],
    direction: 'short', total_score: 60, action_state: 'ready',
    current_price: 104_200, entry_min: 108_000, entry_max: 115_000,
    stop_loss: 124_000, take_profit_1: 88_000, take_profit_2: 74_000,
    thesis: 'Long-term holder cohorts are net distributing into strength while funding stays persistently positive. Reads as late-cycle rather than early.',
    why_now: 'Funding at annualised highs with open interest making new records — crowded long positioning.',
    invalidation: 'Long-term holder supply resuming growth, or funding normalising while price holds.',
    next_action: 'Only on a push into 108–115k. Not a spot sell signal.',
    evidence_freshness_status: 'stale', evidence_age_days: 34,
    evidence_review_priority_score: 68, evidence_review_priority_tier: 'high',
    evidence_review_priority_reason: 'Stale evidence on an active short against a higher-conviction long.',
  }),

  // ── SOL: a weak long against a well-corroborated short. Net stance flips
  // negative (-54, "short") even though the long arrived first.
  mockIdea({
    id: 'sol-rv', updated_at: CRYPTO_PRICED_AT, normalized_symbol: 'SOL', symbol: 'SOL',
    title: 'Solana — throughput narrative re-rating',
    source: 'realvision', sources: ['realvision'],
    direction: 'long', total_score: 40, action_state: 'research',
    current_price: 178, entry_min: 150, entry_max: 165, stop_loss: 132, take_profit_1: 240,
    thesis: 'Fee revenue growth argues the network is being used, not just traded.',
    why_now: 'Fee revenue at a new quarterly high.',
    invalidation: 'Fee revenue rolling over two quarters running.',
  }),
  mockIdea({
    id: 'sol-discord', updated_at: CRYPTO_PRICED_AT, normalized_symbol: 'SOL', symbol: 'SOL',
    title: 'Solana — unlock overhang into thin bid',
    source: 'discord', sources: ['discord', 'patreon', 'sec_13f'], confirmed_by_count: 3,
    direction: 'short', total_score: 90, action_state: 'ready',
    current_price: 178, entry_min: 182, entry_max: 196, stop_loss: 214, take_profit_1: 138,
    thesis: 'A large scheduled unlock lands into a market depth that has thinned materially. Three independent sources flag the same supply event.',
    why_now: 'Unlock tranche clears in eleven days; order book depth down sharply quarter on quarter.',
    invalidation: 'Unlock absorbed without a depth impact, or the tranche being renegotiated.',
    source_details: [
      { source: 'discord', author: 'Flow', score_contrib: 8, notes: 'Unlock calendar cross-check', confirmed_at: '2026-08-05T00:00:00Z' },
      { source: 'patreon', author: 'Desk', score_contrib: 5, notes: 'Depth analysis agrees', confirmed_at: '2026-08-04T00:00:00Z' },
      { source: 'sec_13f', author: null, score_contrib: 4, notes: 'Institutional position reduced last quarter', confirmed_at: '2026-07-28T00:00:00Z' },
    ],
  }),

  // ── ETH: two same-direction views. No disagreement, but still two rows that
  // used to occupy two funnel lines — the plain duplicate case.
  mockIdea({
    id: 'eth-rv', updated_at: CRYPTO_PRICED_AT, normalized_symbol: 'ETH', symbol: 'ETH',
    title: 'Ethereum — staking yield compression trade',
    source: 'realvision', sources: ['realvision'],
    direction: 'long', total_score: 81, action_state: 'ready',
    current_price: 3_420, entry_min: 3_200, entry_max: 3_500,
    stop_loss: 2_950, take_profit_1: 4_400, take_profit_2: 5_200,
    thesis: 'Staking participation growth is slowing while fee burn holds, improving net issuance.',
    why_now: 'Net issuance negative across the last three epochs.',
    invalidation: 'Net issuance turning durably positive.',
  }),
  mockIdea({
    id: 'eth-13f', updated_at: CRYPTO_PRICED_AT, normalized_symbol: 'ETH', symbol: 'ETH',
    title: 'Ethereum — institutional accumulation per Q2 filings',
    source: 'sec_13f', sources: ['sec_13f'],
    direction: 'long', total_score: 69, action_state: 'wait_for_entry',
    current_price: 3_420, entry_min: 3_000, entry_max: 3_150, stop_loss: 2_800, take_profit_1: 4_100,
    thesis: 'Filing data shows three large managers initiating positions. Lagged evidence, so treated as confirmation rather than a trigger.',
    why_now: 'Q2 filings published this week.',
    invalidation: 'Next filing cycle showing the same managers reducing.',
    evidence_freshness_status: 'stale', evidence_age_days: 47, evidence_sla_days: 60,
    evidence_review_priority_score: 44, evidence_review_priority_tier: 'standard',
  }),

  // ── XYZ: same ticker sitting in three different lifecycle states, which renders
  // the "also in" chips on the collapsed row.
  mockIdea({
    id: 'xyz-ready', normalized_symbol: 'XYZ', symbol: 'XYZ', asset_class: 'equity',
    title: 'Example Corp — margin inflection',
    direction: 'long', total_score: 55, action_state: 'ready',
    current_price: 42.5, entry_min: 40, entry_max: 44, stop_loss: 36, take_profit_1: 58,
    thesis: 'Gross margin inflecting as the cost programme annualises.',
  }),
  // Priced but with no entry band yet, so ENTRY reads a plain em-dash. That is the
  // legitimate "no zone set" case, and it should stay distinguishable from TAO below.
  mockIdea({
    id: 'xyz-research', normalized_symbol: 'XYZ', symbol: 'XYZ', asset_class: 'equity',
    title: 'Example Corp — TAM expansion work in progress',
    direction: 'long', total_score: 99, action_state: 'research',
    current_price: 42.5,
    thesis: 'Highest raw score on the ticker, but still in research — so it does not set the funnel position.',
  }),
  mockIdea({
    id: 'xyz-invalid', normalized_symbol: 'XYZ', symbol: 'XYZ', asset_class: 'equity',
    title: 'Example Corp — prior breakout thesis, broken',
    direction: 'long', total_score: 95, action_state: 'invalidated',
    current_price: 42.5,
    thesis: 'Superseded: the breakout failed and the level did not hold.',
    invalidation: 'Already triggered — the 38 level broke on volume.',
  }),

  // ── Single-view baseline, so the aggregated rows can be compared against a
  // ticker that has nothing to aggregate.
  mockIdea({
    id: 'nvda-rv', normalized_symbol: 'NVDA', symbol: 'NVDA', asset_class: 'equity',
    title: 'Nvidia — accelerator demand still supply-constrained',
    direction: 'long', total_score: 84, action_state: 'chasing_risk',
    current_price: 148, entry_min: 118, entry_max: 128, do_not_chase_above: 135,
    stop_loss: 104, take_profit_1: 165,
    thesis: 'Backlog extends beyond the current build capacity.',
    why_now: 'Lead times extended again this quarter.',
    invalidation: 'Lead times normalising, or a hyperscaler cutting capex guidance.',
  }),

  // ── The live defect: the exporter resolved no price for this symbol, so the
  // entry, stop and target that are derived from it were never written either.
  // The row is unactionable, which the funnel now says out loud instead of
  // rendering an em-dash indistinguishable from "no entry zone set".
  mockIdea({
    id: 'tao-discord', normalized_symbol: 'TAO', symbol: 'TAO',
    title: 'Bittensor — subnet emissions repricing',
    source: 'discord', sources: ['discord'],
    direction: 'long', total_score: 71, action_state: 'wait_for_entry',
    updated_at: CRYPTO_PRICED_AT,
    current_price: null,
    entry_min: null, entry_max: null, stop_loss: null,
    take_profit_1: null, take_profit_2: null, take_profit_3: null,
    thesis: 'Emissions schedule changes should reprice subnet tokens relative to the root network.',
    why_now: 'Governance vote on the emissions split closes this month.',
    invalidation: 'Vote fails, or emissions land unchanged.',
    next_action: 'Cannot size this without a price — the plan is missing entirely.',
  }),

  // ── No direction at all: STANCE has nothing to report and renders as a dash.
  mockIdea({
    id: 'gld-none', normalized_symbol: 'GLD', symbol: 'GLD', asset_class: 'commodity',
    title: 'Gold — monitoring only, no directional call yet',
    direction: null, total_score: 62, action_state: 'research',
    current_price: 2_640,
    thesis: 'Tracked for portfolio construction purposes; no entry thesis formed.',
    evidence_freshness_status: 'missing', evidence_age_days: null,
  }),
]

export const PREVIEW_COMPOSITE: CompositeRow[] = [
  { idea_id: 'btc-rv',  symbol: 'BTC',  asset_class: 'crypto',    direction: 'long',  macro_fit_score: 72, macro_label: 'supportive', technical_score: 65, technical_label: 'uptrend', trend: 'up',   rsi: 61, composite_score: 78, regime_season: 'spring', scored_at: '2026-08-05T00:00:00Z' },
  { idea_id: 'sol-rv',  symbol: 'SOL',  asset_class: 'crypto',    direction: 'long',  macro_fit_score: 48, macro_label: 'neutral',    technical_score: 34, technical_label: 'weak',    trend: 'down', rsi: 41, composite_score: 44, regime_season: 'spring', scored_at: '2026-08-05T00:00:00Z' },
  { idea_id: 'eth-rv',  symbol: 'ETH',  asset_class: 'crypto',    direction: 'long',  macro_fit_score: 66, macro_label: 'supportive', technical_score: 58, technical_label: 'neutral', trend: 'up',   rsi: 55, composite_score: 68, regime_season: 'spring', scored_at: '2026-08-05T00:00:00Z' },
  { idea_id: 'nvda-rv', symbol: 'NVDA', asset_class: 'equity',    direction: 'long',  macro_fit_score: 58, macro_label: 'neutral',    technical_score: 81, technical_label: 'strong',  trend: 'up',   rsi: 74, composite_score: 72, regime_season: 'spring', scored_at: '2026-08-05T00:00:00Z' },
  { idea_id: 'gld-none',symbol: 'GLD',  asset_class: 'commodity', direction: null,    macro_fit_score: 70, macro_label: 'supportive', technical_score: 52, technical_label: 'neutral', trend: 'flat', rsi: 50, composite_score: 61, regime_season: 'spring', scored_at: '2026-08-05T00:00:00Z' },
]

// Ninety days of synthetic daily candles in an uptrend, spanning roughly 90k-113k.
// Paired with the levels below, TP3 at 310k sits far outside that band — the exact
// situation that used to hide the level lines.
export function previewCandles(): MarketCandle[] {
  const out: MarketCandle[] = []
  const start = Date.UTC(2026, 4, 8)
  let close = 98_000
  for (let i = 0; i < 90; i++) {
    // Deterministic walk, so the chart is identical on every render and the copy
    // describing it cannot drift from the data.
    const drift = Math.sin(i / 9) * 5_000 + Math.cos(i / 4) * 1_800 + i * 90
    const open = close
    close = 98_000 + drift
    const high = Math.max(open, close) + 700
    const low = Math.min(open, close) - 700
    out.push({
      symbol: 'BTC', interval: '1d',
      ts: new Date(start + i * 86_400_000).toISOString(),
      open, high, low, close, volume: 1_000 + i,
    })
  }
  return out
}

export const PREVIEW_LEVELS: ChartOverlayLevel[] = [
  { symbol: 'BTC', idea_id: 'btc-rv', level_type: 'entry_min',  price:  98_000, source: 'preview', label: 'Entry min' },
  { symbol: 'BTC', idea_id: 'btc-rv', level_type: 'entry_max',  price: 106_000, source: 'preview', label: 'Entry max' },
  { symbol: 'BTC', idea_id: 'btc-rv', level_type: 'stop_loss',  price:  91_000, source: 'preview', label: 'Stop' },
  { symbol: 'BTC', idea_id: 'btc-rv', level_type: 'support',    price:  94_500, source: 'preview', label: 'Range low' },
  { symbol: 'BTC', idea_id: 'btc-rv', level_type: 'resistance', price: 111_000, source: 'preview', label: 'Range high' },
  { symbol: 'BTC', idea_id: 'btc-rv', level_type: 'tp1',        price: 128_000, source: 'preview', label: 'TP1' },
  { symbol: 'BTC', idea_id: 'btc-rv', level_type: 'tp2',        price: 155_000, source: 'preview', label: 'TP2' },
  // Deliberately far away: this is the level that was invisible before.
  { symbol: 'BTC', idea_id: 'btc-rv', level_type: 'tp3',        price: 310_000, source: 'preview', label: 'Cycle target' },
]
