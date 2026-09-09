import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { priceAgeDays, priceHealth, priceIssueLabel, summarisePriceFeed } from '../lib/price-feed'
import { isCurrentIdea, buildEvidenceReviewBatch } from '../lib/evidence-review'
import { formatAge } from '../lib/fmt'
import type { OpportunityAction } from '../lib/types'

// The app's JSX is preserved for Next; provide React for tsx's classic test transform.
Object.assign(globalThis, { React })
const FreshnessChip = require('../components/FreshnessChip').default
const IdeaDrawer = require('../components/IdeaDrawer').default
const FunnelBoard = require('../components/FunnelBoard').default
const { groupIdeasByTicker } = require('../lib/ticker-aggregate')
const { PREVIEW_IDEAS } = require('../lib/preview-fixtures')
const now = Date.UTC(2026, 8, 9, 12)
const realNow = Date.now
Date.now = () => now
const ago = (hours: number) => new Date(now - hours * 3600000).toISOString()
const quote = (overrides: Partial<OpportunityAction> = {}) => ({
  current_price: 100, price_as_of: ago(1), price_freshness_status: 'fresh',
  price_age_hours: 1, asset_class: 'equity', ...overrides,
}) as OpportunityAction

try {
  for (const clock of [null, 'garbage', ago(-1)]) {
    const row = quote({ price_as_of: clock })
    assert.equal(priceAgeDays(row, now), null)
    assert.equal(priceHealth(row, now), 'inconsistent')
    assert.notEqual(priceIssueLabel(row, now), 'VALUE MISSING')
  }
  for (const value of [NaN, Infinity, 0, -1]) {
    assert.equal(priceHealth(quote({ current_price: value }), now), 'inconsistent')
    assert.equal(priceIssueLabel(quote({ current_price: value }), now), 'VALUE INVALID')
  }
  assert.equal(priceHealth(quote({ price_as_of: ago(169), updated_at: ago(0) }), now), 'stale')
  assert.equal(priceHealth(quote({ price_freshness_status: 'aging' }), now), 'aging')
  assert.equal(priceHealth(quote({ price_freshness_status: 'stale' }), now), 'stale')
  assert.equal(priceHealth(quote({ price_freshness_status: 'missing' }), now), 'inconsistent')
  assert.equal(priceHealth(quote({ price_as_of: ago(0) }), now), 'fresh')
  assert.equal(summarisePriceFeed([quote({ price_as_of: null })], now).staleClasses.length, 1)
  assert.equal(summarisePriceFeed([quote({ price_as_of: ago(169) })], now).staleClasses.length, 1)

  const chip = (at: string | null, threshold: number | null = 24) => renderToStaticMarkup(
    React.createElement(FreshnessChip, { at, staleAfterHrs: threshold }),
  )
  for (const clock of ['garbage', ago(-1)]) {
    for (const threshold of [null, 24]) {
      const markup = chip(clock, threshold)
      assert.match(markup, /CLOCK INVALID/)
      assert.doesNotMatch(markup, /LIVE|text-status-green|NaN/)
    }
  }
  assert.match(chip(null), /never run/)
  assert.match(chip(ago(1)), /LIVE/)
  assert.match(chip(ago(25)), /STALE/)
  assert.doesNotMatch(chip(ago(25), null), /LIVE|STALE/)
  assert.match(chip(ago(1), NaN), /FRESHNESS UNKNOWN/)
  assert.match(chip(ago(1), -1), /FRESHNESS UNKNOWN/)
  const current = quote({ id: 'clock-review', normalized_symbol: 'TEST', action_state: 'ready',
    evidence_freshness_status: 'fresh', levels_freshness_status: 'fresh',
    review_freshness_status: 'fresh', actionability_status: 'review_required' })
  assert.equal(isCurrentIdea(current), true)
  for (const clock of [null, 'garbage', ago(-1), ago(169)]) {
    const invalid = { ...current, price_as_of: clock }
    assert.equal(isCurrentIdea(invalid), false)
    assert.equal(buildEvidenceReviewBatch([invalid]).dailyBatch[0].id, invalid.id)
  }
  for (const [clock, label] of [[null, 'CLOCK MISSING'], ['garbage', 'CLOCK INVALID'], [ago(-1), 'CLOCK INVALID']] as const) {
    const row = { ...PREVIEW_IDEAS[0], ...current, price_as_of: clock }
    const group = groupIdeasByTicker([row])[0]
    const drawer = renderToStaticMarkup(React.createElement(IdeaDrawer, {
      selection: { row, group }, onClose: () => {},
    }))
    assert.match(drawer, new RegExp(`\\$100 · ${label}`))
    assert.doesNotMatch(drawer, /VALUE MISSING/)
    const board = renderToStaticMarkup(React.createElement(FunnelBoard, { ideas: [row], composite: [] }))
    assert.doesNotMatch(board, />in zone</)
  }
  assert.equal(formatAge('garbage'), 'Invalid timestamp')
  assert.equal(formatAge(ago(-1)), 'Future timestamp')
  assert.equal(formatAge(ago(1)), '1h ago')
} finally {
  Date.now = realNow
}
console.log('clock integrity tests passed')
