import assert from 'node:assert/strict'
import {
  STALE_PRICE_DAYS,
  fmtPriceAge,
  hasNoPlan,
  priceAgeDays,
  priceHealth,
  summarisePriceFeed,
} from '../lib/price-feed'
import type { OpportunityAction } from '../lib/types'

const NOW = Date.UTC(2026, 7, 6)
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString()

// Only the fields the module reads are set; the cast covers the rest of the type.
function row(over: Partial<OpportunityAction>): OpportunityAction {
  return {
    id: 'x', normalized_symbol: 'X', symbol: 'X', asset_class: 'equity',
    current_price: 100, entry_min: 98, entry_max: 100, stop_loss: 90, take_profit_1: 120,
    ideal_entry: null, do_not_chase_above: null, updated_at: daysAgo(30),
    price_as_of: daysAgo(1), price_age_hours: 24, price_freshness_status: 'fresh',
    ...over,
  } as OpportunityAction
}

// ── Health classification ─────────────────────────────────────────────────────

assert.equal(priceHealth(row({}), NOW), 'fresh')
assert.equal(priceHealth(row({ current_price: null, price_freshness_status: 'missing' }), NOW), 'missing')
assert.equal(priceHealth(row({ current_price: null, price_freshness_status: 'fresh' }), NOW), 'inconsistent')
assert.equal(
  priceHealth(row({ price_as_of: daysAgo(STALE_PRICE_DAYS + 1), price_age_hours: null, price_freshness_status: null }), NOW),
  'stale',
)
// Exactly on the threshold is still fine — only past it counts as stale.
assert.equal(priceHealth(row({ price_as_of: daysAgo(STALE_PRICE_DAYS), price_age_hours: null, price_freshness_status: null }), NOW), 'fresh')

// A missing price outranks staleness: there is no verdict to qualify.
assert.equal(
  priceHealth(row({ current_price: null, price_freshness_status: 'missing' }), NOW),
  'missing',
)

// A row with no timestamp cannot be aged, so it is not accused of being stale.
assert.equal(priceAgeDays(row({ price_as_of: null, price_age_hours: null }), NOW), null)
assert.equal(priceHealth(row({ price_as_of: null, price_age_hours: null, price_freshness_status: null }), NOW), 'fresh')

// Re-exporting a row does not refresh a quote: the dedicated clock wins.
assert.equal(
  priceHealth(row({ updated_at: daysAgo(0), price_as_of: daysAgo(10), price_age_hours: 240, price_freshness_status: 'stale' }), NOW),
  'stale',
)

// ── The plan depends on the price ─────────────────────────────────────────────

assert.equal(hasNoPlan(row({})), false)
assert.equal(
  hasNoPlan(row({ entry_min: null, stop_loss: null, take_profit_1: null })),
  true,
)
// A single surviving level still counts as a plan.
assert.equal(
  hasNoPlan(row({ entry_min: null, stop_loss: null, take_profit_1: 120 })),
  false,
)
// ideal_entry stands in for a missing entry_min.
assert.equal(
  hasNoPlan(row({ entry_min: null, ideal_entry: 99, stop_loss: null, take_profit_1: null })),
  false,
)

// ── Summary reproduces the live shape of the problem ──────────────────────────

// Mirrors what the live board actually holds: equity re-exported two days ago,
// crypto abandoned six weeks ago with half its rows never priced.
const board: OpportunityAction[] = [
  ...Array.from({ length: 4 }, (_, i) =>
    row({ normalized_symbol: `EQ${i}`, asset_class: 'equity', price_as_of: daysAgo(2.2), price_age_hours: 52.8 })),
  ...['BTC', 'ETH', 'SOL'].map(s =>
    row({ normalized_symbol: s, asset_class: 'crypto', price_as_of: daysAgo(43.9), price_age_hours: 1053.6, price_freshness_status: 'stale' })),
  ...['HYPE', 'JUP'].map(s =>
    row({
      normalized_symbol: s, asset_class: 'crypto', price_as_of: daysAgo(43.9), price_age_hours: 1053.6,
      price_freshness_status: 'missing',
      current_price: null, entry_min: null, entry_max: null, stop_loss: null, take_profit_1: null,
    })),
]

const summary = summarisePriceFeed(board, NOW)

assert.equal(summary.missing, 2, 'both unpriced rows are counted')
assert.equal(summary.unactionable, 2, 'and both lost their plan with the price')

assert.deepEqual(
  summary.staleClasses.map(c => c.assetClass),
  ['crypto'],
  'only the abandoned class is flagged; equity refreshed inside the window',
)

const crypto = summary.classes.find(c => c.assetClass === 'crypto')!
assert.equal(crypto.ideas, 5)
assert.equal(crypto.missing, 2)
assert.equal(crypto.unactionable, 2)
assert.equal(Math.round(crypto.lastWriteDays!), 44, 'last write is the freshest row, not the oldest')
assert.equal(crypto.stale, true)

const equity = summary.classes.find(c => c.assetClass === 'equity')!
assert.equal(equity.stale, false)
assert.equal(equity.missing, 0)

// Most neglected class sorts first, so the banner leads with the worst offender.
assert.equal(summary.classes[0].assetClass, 'crypto')

// An unclassified row is grouped rather than dropped.
const unclassified = summarisePriceFeed([row({ asset_class: null })], NOW)
assert.deepEqual(unclassified.classes.map(c => c.assetClass), ['unknown'])

// ── Age formatting ───────────────────────────────────────────────────────────

assert.equal(fmtPriceAge(null), 'unknown')
assert.equal(fmtPriceAge(43.9), '44d')
assert.equal(fmtPriceAge(0.25), '6h')
// Sub-hour ages still read as at least an hour rather than "0h".
assert.equal(fmtPriceAge(0.001), '1h')

console.log('price feed tests passed')
