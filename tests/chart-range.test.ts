import assert from 'node:assert/strict'
import { buildChartModel } from '../components/TradingViewChart'
import type { ChartOverlayLevel, MarketCandle } from '../lib/types'

function candle(ts: string, low: number, high: number, close = (low + high) / 2): MarketCandle {
  return { symbol: 'BTC', interval: '1d', ts, open: close, high, low, close, volume: null }
}

function level(level_type: string, price: number): ChartOverlayLevel {
  return { symbol: 'BTC', idea_id: 'idea', level_type, price, source: 'test', label: null }
}

const candles = [
  candle('2026-08-01T00:00:00Z', 100, 108),
  candle('2026-08-02T00:00:00Z', 102, 110, 106),
]

// ── Levels inside the candle range are all visible ────────────────────────────

const inside = buildChartModel(candles, [level('entry_min', 103), level('stop_loss', 101)], 'auto')
assert.equal(inside.clipped.length, 0)
assert.ok(inside.range!.lo < 100 && inside.range!.hi > 110, 'range covers the candles')
assert.equal(inside.stretchedBeyondLimit, false)
assert.equal(inside.referencePrice, 106, 'the latest close is the reference')

// ── A moderately distant level pulls the view open ────────────────────────────

// Candle span is 10; including 130 gives a span of 30, inside the 4x limit.
const nearby = buildChartModel(candles, [level('tp1', 130)], 'auto')
assert.equal(nearby.clipped.length, 0, 'auto stretches to include the target')
assert.ok(nearby.range!.hi > 130)
assert.equal(nearby.stretchedBeyondLimit, false)

// ── A far target is reported rather than crushing the candles ─────────────────

// Including 300 would give a span of 200 against a candle span of 10.
const farTarget = buildChartModel(candles, [level('entry_min', 104), level('tp3', 300)], 'auto')
assert.equal(farTarget.stretchedBeyondLimit, true)
assert.ok(farTarget.range!.hi < 145, 'candles keep a readable share of the viewport')
assert.deepEqual(farTarget.clipped.map(l => l.level_type), ['tp3'])

// ── One unreachable level must not evict the levels that do fit ───────────────

// The regression this guards: auto used to be all-or-nothing, so a single distant
// target collapsed the view back to the bare candles and clipped a stop sitting
// just below them. The stop is 1 away from the candle low and has to stay visible.
const mixedDistance = buildChartModel(
  candles,
  [level('stop_loss', 99), level('entry_min', 104), level('tp1', 130), level('tp3', 900)],
  'auto',
)
assert.deepEqual(
  mixedDistance.clipped.map(l => l.level_type),
  ['tp3'],
  'only the genuinely unreachable level is clipped',
)
assert.ok(mixedDistance.range!.lo < 99, 'the nearby stop survives the distant target')
assert.ok(mixedDistance.range!.hi > 130, 'the affordable target survives too')

// The budget is spent cheapest-side-first, so a large demand upwards cannot starve
// a small demand downwards. Candle span is 10, so auto may spend 30 of extra room:
// 1 goes down to reach the stop and the remaining 29 goes up.
const budget = buildChartModel(candles, [level('stop_loss', 99), level('tp3', 900)], 'auto')
assert.ok(budget.range!.lo < 99, 'the cheap side is satisfied in full')
assert.ok(budget.range!.hi < 900, 'the expensive side is capped')

// `levels` scope overrides that and fits everything, which is the escape hatch.
const forced = buildChartModel(candles, [level('entry_min', 104), level('tp3', 300)], 'levels')
assert.equal(forced.clipped.length, 0)
assert.ok(forced.range!.hi > 300)

// `price` scope ignores levels entirely.
const priceOnly = buildChartModel(candles, [level('tp1', 130)], 'price')
assert.deepEqual(priceOnly.clipped.map(l => l.level_type), ['tp1'])
assert.ok(priceOnly.range!.hi < 120)

// ── A flat series still gets a non-zero price range ──────────────────────────

const flat = buildChartModel([candle('2026-08-01T00:00:00Z', 100, 100, 100)], [], 'auto')
assert.ok(flat.range!.hi > flat.range!.lo, 'zero span must not produce a zero-height range')
assert.equal(flat.range!.lo, 99)
assert.equal(flat.range!.hi, 101)

// ── Levels-only charts fall back to the near-level band ──────────────────────

const levelsOnly = buildChartModel(
  [],
  [level('entry_min', 100), level('entry_max', 110), level('stop_loss', 95), level('tp1', 300)],
  'auto',
)
assert.equal(levelsOnly.validCandles.length, 0)
assert.ok(levelsOnly.range!.lo < 95 && levelsOnly.range!.hi > 110, 'entry zone and stop stay in view')
assert.deepEqual(levelsOnly.clipped.map(l => l.level_type), ['tp1'], 'the distant target is reported')

// ── Rows with null OHLC are not treated as candles ───────────────────────────

const nullOhlc: MarketCandle[] = [
  { symbol: 'BTC', interval: '1d', ts: '2026-08-01T00:00:00Z', open: null, high: null, low: null, close: null, volume: null },
]
const unusable = buildChartModel(nullOhlc, [], 'auto')
assert.equal(unusable.validCandles.length, 0)
assert.equal(unusable.range, null, 'no usable data yields no range, so the empty state renders')

// Null OHLC alongside levels still charts the levels.
const nullWithLevels = buildChartModel(nullOhlc, [level('entry_min', 50), level('stop_loss', 45)], 'auto')
assert.equal(nullWithLevels.validCandles.length, 0)
assert.ok(nullWithLevels.range != null)

console.log('chart range tests passed')
