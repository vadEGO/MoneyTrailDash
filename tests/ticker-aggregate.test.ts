import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  contestedTickers,
  groupIdeasByTicker,
  opposingViews,
  stanceLabelFor,
  stanceWeight,
  supportingViews,
} from '../lib/ticker-aggregate'
import type { OpportunityAction } from '../lib/types'

function idea(overrides: Partial<OpportunityAction>): OpportunityAction {
  return {
    id: String(overrides.id ?? 'idea'),
    action_state: 'ready',
    lifecycle: 'active_review',
    title: 'Research idea',
    source: 'realvision',
    direction: 'long',
    total_score: 80,
    confirmed_by_count: 1,
    ...overrides,
  } as OpportunityAction
}

// ── Grouping keeps every view ─────────────────────────────────────────────────

const rows = [
  idea({ id: 'btc-long-a', normalized_symbol: 'BTC', direction: 'long',  total_score: 88 }),
  idea({ id: 'btc-long-b', normalized_symbol: 'BTC', direction: 'long',  total_score: 74, source: 'patreon' }),
  idea({ id: 'btc-short',  normalized_symbol: 'BTC', direction: 'short', total_score: 60, source: 'discord' }),
  idea({ id: 'eth-long',   normalized_symbol: 'ETH', direction: 'long',  total_score: 70 }),
]

const groups = groupIdeasByTicker(rows)
assert.equal(groups.length, 2, 'one group per ticker')

const btc = groups.find(g => g.symbol === 'BTC')!
assert.equal(btc.setupCount, 3, 'no view is discarded')
assert.equal(btc.rows.length, 3)
assert.equal(btc.bulls.length, 2)
assert.equal(btc.bears.length, 1)
assert.equal(btc.hasDisagreement, true)
assert.equal(btc.primary.id, 'btc-long-a', 'highest conviction in the most advanced state leads')
assert.deepEqual(btc.sources, ['discord', 'patreon', 'realvision'], 'sources are unioned across views')
assert.equal(btc.topScore, 88)

const eth = groups.find(g => g.symbol === 'ETH')!
assert.equal(eth.hasDisagreement, false)
assert.equal(eth.netStance, 100, 'a lone long is unanimously long')
assert.equal(eth.stanceLabel, 'strong_long')

// Total rows in equals total rows out — the property that separates this from
// buildEvidenceReviewBatch, which keeps one row per symbol.
assert.equal(
  groups.reduce((n, g) => n + g.rows.length, 0),
  rows.length,
  'grouping partitions rather than filters',
)

// ── Net stance is score and confirmation weighted ─────────────────────────────

// BTC: longs weigh 88 + 74 = 162, short weighs 60. (162-60)/222 = 0.4594 -> 46.
assert.equal(btc.netStance, 46)
assert.equal(btc.stanceLabel, 'long')

// A high-conviction, well-corroborated short outweighs a weak lone long.
// Long weighs 40; short weighs 90 * (1 + 0.25 * 2) = 135. (40 - 135) / 175 -> -54.
const flipped = groupIdeasByTicker([
  idea({ id: 'sol-long',  normalized_symbol: 'SOL', direction: 'long',  total_score: 40 }),
  idea({ id: 'sol-short', normalized_symbol: 'SOL', direction: 'short', total_score: 90, confirmed_by_count: 3 }),
])[0]
assert.equal(flipped.netStance, -54)
assert.equal(flipped.stanceLabel, 'short')
assert.equal(flipped.hasDisagreement, true)

// Evenly matched views cancel out — the ticker needs a decision, not an entry.
const evenlySplit = groupIdeasByTicker([
  idea({ id: 'ada-long',  normalized_symbol: 'ADA', direction: 'long',  total_score: 70 }),
  idea({ id: 'ada-short', normalized_symbol: 'ADA', direction: 'short', total_score: 70 }),
])[0]
assert.equal(evenlySplit.netStance, 0)
assert.equal(evenlySplit.stanceLabel, 'contested')

// Confirmation uplift: 25% per additional source.
assert.equal(stanceWeight(idea({ total_score: 80, confirmed_by_count: 1 })), 80)
assert.equal(stanceWeight(idea({ total_score: 80, confirmed_by_count: 3 })), 120)
// An unscored view still carries an opinion.
assert.equal(stanceWeight(idea({ total_score: null, confirmed_by_count: 1 })), 50)

// A row written before migration 004 backfilled `sources` still reports its source.
const legacySources = groupIdeasByTicker([
  idea({ id: 'legacy-empty', normalized_symbol: 'DOT', sources: [], source: 'patreon', total_score: 70 }),
  idea({ id: 'legacy-null',  normalized_symbol: 'DOT', sources: null, source: 'discord', total_score: 70 }),
  idea({ id: 'modern',       normalized_symbol: 'DOT', sources: ['realvision', 'discord'], confirmed_by_count: 2, total_score: 70 }),
])[0]
assert.deepEqual(legacySources.sources, ['discord', 'patreon', 'realvision'])
// Tied on state and score, the best-corroborated view leads. Verified to match
// primary_id from public_ticker_stance_rollup for the same rows.
assert.equal(legacySources.primary.id, 'modern')

// ── Undirected views ──────────────────────────────────────────────────────────

const undirected = groupIdeasByTicker([
  idea({ id: 'gld-none', normalized_symbol: 'GLD', direction: null }),
])[0]
assert.equal(undirected.undirected.length, 1)
assert.equal(undirected.netStance, null, 'no direction means no stance to report')
assert.equal(undirected.stanceLabel, null)
assert.equal(undirected.hasDisagreement, false)

// ── Lifecycle ordering ────────────────────────────────────────────────────────

const multiState = groupIdeasByTicker([
  idea({ id: 'x-research',   normalized_symbol: 'XYZ', action_state: 'research',   total_score: 99 }),
  idea({ id: 'x-ready',      normalized_symbol: 'XYZ', action_state: 'ready',      total_score: 55 }),
  idea({ id: 'x-invalid',    normalized_symbol: 'XYZ', action_state: 'invalidated', total_score: 95 }),
])[0]
assert.equal(multiState.primary.id, 'x-ready', 'most advanced state wins over raw score')
assert.deepEqual(multiState.conflictingStates.sort(), ['invalidated', 'research'])

// ── Stance label boundaries ───────────────────────────────────────────────────

assert.equal(stanceLabelFor(null), null)
assert.equal(stanceLabelFor(100), 'strong_long')
assert.equal(stanceLabelFor(60), 'strong_long')
assert.equal(stanceLabelFor(59), 'long')
assert.equal(stanceLabelFor(20), 'long')
assert.equal(stanceLabelFor(19), 'contested')
assert.equal(stanceLabelFor(0), 'contested')
assert.equal(stanceLabelFor(-19), 'contested')
assert.equal(stanceLabelFor(-20), 'short')
assert.equal(stanceLabelFor(-60), 'strong_short')
assert.equal(stanceLabelFor(-100), 'strong_short')

// ── Re-evaluation helpers ─────────────────────────────────────────────────────

const focused = btc.rows.find(r => r.id === 'btc-long-a')!
assert.deepEqual(opposingViews(btc, focused).map(r => r.id), ['btc-short'])
assert.deepEqual(supportingViews(btc, focused).map(r => r.id), ['btc-long-b'])

const shortView = btc.rows.find(r => r.id === 'btc-short')!
assert.deepEqual(opposingViews(btc, shortView).map(r => r.id), ['btc-long-a', 'btc-long-b'])
assert.deepEqual(supportingViews(btc, shortView).map(r => r.id), [])

assert.deepEqual(contestedTickers(groups).map(g => g.symbol), ['BTC'])

// ── Ticker key falls back when the symbol is missing ──────────────────────────

const unlabelled = groupIdeasByTicker([
  idea({ id: 'no-symbol', normalized_symbol: null, symbol: null }),
])[0]
assert.equal(unlabelled.symbol, 'NO-SYMBOL', 'id is the last-resort key so the row is never dropped')

// Symbol casing is normalised so views on the same asset land together.
const mixedCase = groupIdeasByTicker([
  idea({ id: 'a', normalized_symbol: 'btc' }),
  idea({ id: 'b', normalized_symbol: 'BTC' }),
])
assert.equal(mixedCase.length, 1)
assert.equal(mixedCase[0].setupCount, 2)

// ── The rollup view stays a read-only surface ─────────────────────────────────

const rollupMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260806_ticker_stance_rollup.sql'),
  'utf8',
)
assert.match(rollupMigration, /security_invoker = true/i)
assert.match(
  rollupMigration,
  /revoke all privileges on public\.public_ticker_stance_rollup from anon, authenticated;/i,
)
assert.match(
  rollupMigration,
  /grant select on public\.public_ticker_stance_rollup to anon, authenticated;/i,
)
// The rollup must not mutate the rows it aggregates.
assert.doesNotMatch(rollupMigration, /\b(insert into|update |delete from|create trigger)\b/i)
// SQL stance bands must agree with stanceLabelFor.
assert.match(rollupMigration, /net_stance >=\s*60\s*then 'strong_long'/i)
assert.match(rollupMigration, /net_stance >=\s*20\s*then 'long'/i)
assert.match(rollupMigration, /net_stance >\s*-20\s*then 'contested'/i)
assert.match(rollupMigration, /net_stance >\s*-60\s*then 'short'/i)

console.log('ticker aggregate tests passed')
