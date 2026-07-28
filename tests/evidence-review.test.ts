import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildEvidenceReviewBatch, evidenceReviewPriority } from '../lib/evidence-review'
import type { OpportunityAction } from '../lib/types'

function idea(overrides: Partial<OpportunityAction>): OpportunityAction {
  return {
    id: String(overrides.id ?? 'idea'),
    action_state: 'ready',
    lifecycle: 'active_review',
    title: 'Research idea',
    source: 'realvision',
    total_score: 85,
    evidence_freshness_status: 'stale',
    evidence_age_days: 60,
    evidence_sla_days: 14,
    confirmed_by_count: 1,
    is_watchlisted: true,
    ...overrides,
  } as OpportunityAction
}

const rows = [
  idea({ id: 'btc-old', normalized_symbol: 'BTC', evidence_review_priority_score: 70, total_score: 82 }),
  idea({ id: 'btc-priority', normalized_symbol: 'BTC', evidence_review_priority_score: 90, total_score: 88 }),
  idea({ id: 'eth', normalized_symbol: 'ETH', evidence_review_priority_score: 75 }),
  idea({ id: 'fresh', normalized_symbol: 'SOL', evidence_freshness_status: 'fresh', evidence_review_priority_score: null }),
]

const result = buildEvidenceReviewBatch(rows, 1)
assert.equal(result.reviewRows.length, 3)
assert.equal(result.uniqueReviews.length, 2)
assert.equal(result.duplicateRows, 1)
assert.equal(result.dailyBatch.length, 1)
assert.equal(result.dailyBatch[0].id, 'btc-priority')
assert.equal(result.dailyBatch[0].evidence_duplicate_setup_count, 2)

const fallback = idea({
  evidence_review_priority_score: null,
  evidence_age_days: 61,
  confirmed_by_count: 2,
})
assert.equal(evidenceReviewPriority(fallback), 90)

const grantMigration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260728171538_lock_down_opportunity_action_board_grants.sql',
  ),
  'utf8',
)
assert.match(
  grantMigration,
  /revoke all privileges on public\.public_opportunity_action_board from anon, authenticated;/i,
)
assert.match(
  grantMigration,
  /grant select on public\.public_opportunity_action_board to anon, authenticated;/i,
)

console.log('evidence review tests passed')
