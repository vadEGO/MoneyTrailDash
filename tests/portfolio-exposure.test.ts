import assert from 'node:assert/strict'
import test from 'node:test'
// @ts-expect-error Node's native TypeScript runner requires the source extension.
import { buildExposureGraph, classifyExposure, normalizeThesis } from '../lib/portfolio-exposure.ts'
import type { PortfolioProposalRow, ThesisAllocationRow } from '../lib/types.ts'

test('normalizes the known tactical thesis alias', () => {
  assert.equal(normalizeThesis('Tactical Satellite'), 'tactical_satellites')
})

test('classifies concentration against target and hard maximum', () => {
  assert.equal(classifyExposure(0.669, 0.3, 0.4), 'over_max')
  assert.equal(classifyExposure(0.401, 0.3, 0.4), 'over_max')
  assert.equal(classifyExposure(0.226, 0.2, 0.35), 'over_target')
  assert.equal(classifyExposure(0.1, 0.1, 1), 'at_target')
  assert.equal(classifyExposure(0.005, 0.25, 0.4), 'under_target')
})

test('joins allocations to held and candidate symbols without duplicates', () => {
  const allocations: ThesisAllocationRow[] = [{
    thesis: 'tactical_satellites',
    display_name: 'Tactical Satellites',
    current_pct: 0.12,
    target_pct: 0.05,
    max_pct: 0.1,
    headroom_pct: -0.02,
    nav: 100,
    updated_at: '2026-07-27T00:00:00Z',
  }]
  const proposal = (symbol: string, action: string): PortfolioProposalRow => ({
    symbol,
    thesis: 'tactical_satellite',
    direction: 'long',
    composite_score: 80,
    action,
    target_pct: 0,
    reason: null,
    heat_score: 70,
    heat_level: 'warm',
    proposed_at: '2026-07-27T00:00:00Z',
  })

  const graph = buildExposureGraph(allocations, [
    proposal('NVDA', 'hold'),
    proposal('NVDA', 'hold'),
    proposal('TSM', 'add'),
  ])

  assert.equal(graph[0].risk, 'over_max')
  assert.deepEqual(graph[0].heldSymbols, ['NVDA'])
  assert.deepEqual(graph[0].candidateSymbols, ['TSM'])
})
