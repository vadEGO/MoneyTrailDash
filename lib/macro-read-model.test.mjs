import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildFearGreedResult,
  FEAR_GREED_SERIES,
} from './fear-greed.ts'
import { boundedIntegerParam } from './api-params.ts'
import { scoreMacroInput } from './macro-scoring.ts'

const NOW = new Date('2026-08-01T12:00:00.000Z')

function point(seriesId, value, overrides = {}) {
  return {
    id: seriesId,
    series_id: seriesId,
    observation_date: '2026-08-01',
    available_at: '2026-08-01T01:00:00.000Z',
    release_date: null,
    first_seen_at: null,
    expected_release_lag_hours: null,
    freshness_grace_hours: null,
    freshness_sla_hours: 48,
    fetched_at: '2026-08-01T02:00:00.000Z',
    latest: true,
    signal_label: null,
    value,
    ...overrides,
  }
}

test('fear/greed uses published index scores, labels, and raw VIX without deriving replacements', () => {
  const result = buildFearGreedResult([
    point(FEAR_GREED_SERIES.crypto, 21, { signal_label: 'Published crypto label ' }),
    point(FEAR_GREED_SERIES.stocks, 73, { signal_label: 'Published stock label' }),
    point(FEAR_GREED_SERIES.vix, 35.4),
  ], NOW)

  assert.deepEqual(result.crypto, { value: 21, label: 'Published crypto label ' })
  assert.deepEqual(result.stocks, {
    value: 73,
    label: 'Published stock label',
    vix: 35.4,
  })
  assert.equal(result.status, 'live')
  assert.deepEqual(result.unavailable_series, [])
  assert.equal(result.as_of, '2026-08-01')
})

test('fear/greed fails closed for stale rows and missing published labels', () => {
  const result = buildFearGreedResult([
    point(FEAR_GREED_SERIES.crypto, 18, {
      observation_date: '2026-07-20',
      signal_label: 'Extreme Fear',
    }),
    point(FEAR_GREED_SERIES.stocks, 55, { signal_label: '   ' }),
    point(FEAR_GREED_SERIES.vix, 22.1),
  ], NOW)

  assert.equal(result.crypto, null)
  assert.equal(result.stocks, null)
  assert.equal(result.status, 'unavailable')
  assert.deepEqual(result.unavailable_series, [
    FEAR_GREED_SERIES.crypto,
    FEAR_GREED_SERIES.stocks,
  ])
  assert.equal(result.as_of, null)
})

test('fear/greed remains partial when VIX is stale instead of deriving it from the stock index', () => {
  const result = buildFearGreedResult([
    point(FEAR_GREED_SERIES.crypto, 45, { signal_label: 'Neutral' }),
    point(FEAR_GREED_SERIES.stocks, 61, { signal_label: 'Greed' }),
    point(FEAR_GREED_SERIES.vix, 19, { observation_date: '2026-07-20' }),
  ], NOW)

  assert.deepEqual(result.stocks, { value: 61, label: 'Greed' })
  assert.equal(result.status, 'partial')
  assert.deepEqual(result.unavailable_series, [FEAR_GREED_SERIES.vix])
})

test('legacy overlay scores accept only finite values inside the published 0–100 range', () => {
  for (const value of [0, 100]) {
    const result = scoreMacroInput(
      { symbol: 'SPY' },
      null,
      [{ symbol: 'SPY', macro_score: value, stance: 'neutral' }],
    )
    assert.equal(result.macro_score, value)
    assert.equal(result.matched_by, 'symbol')
  }

  for (const value of [-1, 101, Number.NaN, '50']) {
    const result = scoreMacroInput(
      { symbol: 'SPY' },
      null,
      [{ symbol: 'SPY', macro_score: value, stance: 'neutral' }],
    )
    assert.equal(result.macro_score, null)
    assert.equal(result.stance, 'unavailable')
    assert.equal(result.matched_by, 'unavailable')
    assert.match(result.rationale, /rejected/)
  }
})

test('missing limit parameters preserve documented defaults', () => {
  assert.equal(boundedIntegerParam(null, 20, 50), 20)
  assert.equal(boundedIntegerParam('', 180, 1000), 180)
  assert.equal(boundedIntegerParam('0', 20, 50), 1)
  assert.equal(boundedIntegerParam('9999', 20, 50), 50)
})
