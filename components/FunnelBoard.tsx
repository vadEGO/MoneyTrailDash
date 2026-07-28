'use client'

/**
 * FunnelBoard — the single surface the whole app is built around.
 *
 * One object (OpportunityAction), one table, grouped by where each idea sits in
 * its lifecycle. This replaces the old Cockpit / Watchlist / Action / Ideas
 * boards, which were all just different filters of the same rows.
 *
 * Columns: symbol · direction · COMP · MACRO · TECH · CONV · entry status · why-now.
 *   - COMP  = total_score on the opportunity row (the blended rank)
 *   - MACRO = macro_fit_score   (joined from public_rv_trade_composite by symbol)
 *   - TECH  = technical_score   (joined from public_rv_trade_composite by symbol)
 *   - CONV  = viability/conviction (MoneyTrail research pass; '—' until fed)
 *
 * Row click opens the existing IdeaDrawer (chart, levels, score breakdown,
 * thesis, invalidation, sources) — no new detail UI.
 */

import { useState, useMemo } from 'react'
import type { OpportunityAction, CompositeRow } from '@/lib/types'
import Card from '@/components/ui/Card'
import StatusChip from '@/components/ui/StatusChip'
import IdeaDrawer from '@/components/IdeaDrawer'
import { formatAge } from '@/lib/fmt'
import {
  buildEvidenceReviewBatch,
  evidenceReviewPriority,
  needsEvidenceReview,
} from '@/lib/evidence-review'

// Lifecycle order — top of funnel (research) to end (invalidated). Each group is
// a section in the table. `holding` / `exiting` are forward-looking states the
// engine will set once positions are tracked; they render when present.
const STATE_ORDER: Array<{ key: string; label: string; blurb: string }> = [
  { key: 'ready',          label: 'Ready',        blurb: 'Passes the gate and in the entry zone' },
  { key: 'wait_for_entry', label: 'Wait Entry',   blurb: 'Passes the gate, waiting for price' },
  { key: 'chasing_risk',   label: 'Do Not Chase', blurb: 'Extended above the entry zone' },
  { key: 'holding',        label: 'Holding',      blurb: 'Position open, thesis intact' },
  { key: 'exit_trim',      label: 'Exit / Trim',  blurb: 'Take profit or reduce risk' },
  { key: 'exiting',        label: 'Exiting',      blurb: 'Closing the position' },
  { key: 'research',       label: 'Research',     blurb: 'Building conviction' },
  { key: 'invalidated',    label: 'Invalidated',  blurb: 'Thesis broke — stand aside' },
]

export default function FunnelBoard({
  ideas,
  composite,
}: {
  ideas: OpportunityAction[]
  composite: CompositeRow[]
}) {
  const [selected, setSelected] = useState<OpportunityAction | null>(null)
  const [evidenceReviewMode, setEvidenceReviewMode] = useState<'funnel' | 'daily' | 'all'>('funnel')

  // Join macro/tech/conviction by symbol. The opportunity row carries the
  // blended COMP (total_score); the per-factor breakdown lives in the composite
  // view, keyed by normalized symbol.
  const compBySymbol = useMemo(() => {
    const m = new Map<string, CompositeRow>()
    for (const c of composite) if (c.symbol) m.set(c.symbol.toUpperCase(), c)
    return m
  }, [composite])

  // Bucket ideas by action_state, preserving the view's existing rank order
  // (it arrives sorted by state priority then score).
  const evidenceReviews = useMemo(
    () => buildEvidenceReviewBatch(ideas),
    [ideas],
  )
  const visibleIdeas = evidenceReviewMode === 'daily'
    ? evidenceReviews.dailyBatch
    : evidenceReviewMode === 'all'
      ? evidenceReviews.uniqueReviews
      : ideas

  const byState = useMemo(() => {
    const m = new Map<string, OpportunityAction[]>()
    for (const row of visibleIdeas) {
      const key = (row.action_state ?? 'research').toLowerCase()
      if (!m.has(key)) m.set(key, [])
      m.get(key)!.push(row)
    }
    return m
  }, [visibleIdeas])

  const groups = STATE_ORDER.map(s => ({ ...s, rows: byState.get(s.key) ?? [] })).filter(g => g.rows.length > 0)

  if (ideas.length === 0) {
    return (
      <Card title="Funnel">
        <div className="px-4 py-12 text-center text-sm text-ink-3">
          No ideas yet — feed the engine or wait for the next sync.
        </div>
      </Card>
    )
  }

  return (
    <>
      {evidenceReviews.reviewRows.length > 0 && (
        <div className="mb-3 w-full rounded border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-status-amber">
                Evidence review batch
              </div>
              <div className="mt-1 text-sm font-semibold text-ink">
                {evidenceReviews.reviewRows.length} stale setups collapse to {evidenceReviews.uniqueReviews.length} symbols.
              </div>
              <div className="mt-0.5 text-xs text-ink-3">
                Today&apos;s batch routes the {evidenceReviews.dailyBatch.length} highest-risk symbols first; canonical scores remain unchanged.
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 sm:mt-0 sm:justify-end">
              {evidenceReviewMode !== 'funnel' && (
                <button type="button" onClick={() => setEvidenceReviewMode('funnel')} className="text-2xs font-semibold text-ink-3">
                  FULL FUNNEL
                </button>
              )}
              <button type="button" onClick={() => setEvidenceReviewMode('daily')} className="text-2xs font-semibold text-status-amber">
                TODAY&apos;S {evidenceReviews.dailyBatch.length}
              </button>
              <button type="button" onClick={() => setEvidenceReviewMode('all')} className="text-2xs font-semibold text-status-amber">
                ALL {evidenceReviews.uniqueReviews.length} SYMBOLS →
              </button>
            </div>
          </div>
        </div>
      )}
      <Card
        title={
          evidenceReviewMode === 'daily'
            ? 'Today’s Evidence Review Batch'
            : evidenceReviewMode === 'all'
              ? 'Evidence Review Queue'
              : 'Funnel'
        }
        action={<span className="font-mono text-2xs text-ink-3">{visibleIdeas.length} ideas</span>}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-dim border-b border-border">
                {['IDEA', 'DIR', 'COMP', 'MACRO', 'TECH', 'CONV', 'ENTRY', 'WHY NOW', 'PRI', 'UPDATED'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-2xs font-semibold tracking-widest text-ink-3 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map(group => (
                <GroupRows
                  key={group.key}
                  group={group}
                  compBySymbol={compBySymbol}
                  selectedId={selected?.id ?? null}
                  onSelect={setSelected}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <IdeaDrawer idea={selected} onClose={() => setSelected(null)} />
    </>
  )
}

// ── A lifecycle section: a labelled header row + its idea rows ────────────────

function GroupRows({
  group,
  compBySymbol,
  selectedId,
  onSelect,
}: {
  group: { key: string; label: string; blurb: string; rows: OpportunityAction[] }
  compBySymbol: Map<string, CompositeRow>
  selectedId: string | null
  onSelect: (row: OpportunityAction) => void
}) {
  return (
    <>
      <tr className="bg-surface-dim/60 border-y border-border">
        <td colSpan={10} className="px-4 py-1.5">
          <div className="flex items-center gap-2">
            <StatusChip label={`${group.label} · ${group.rows.length}`} variant={stateVariant(group.key)} />
            <span className="text-2xs text-ink-3">{group.blurb}</span>
          </div>
        </td>
      </tr>
      {group.rows.map(row => {
        const sym = (row.normalized_symbol ?? row.symbol ?? '').toUpperCase()
        const comp = compBySymbol.get(sym)
        const isSelected = selectedId === row.id
        return (
          <tr
            key={row.id}
            onClick={() => onSelect(row)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(row) } }}
            tabIndex={0}
            role="button"
            aria-label={`Open ${sym} — ${row.title}`}
            className={`cursor-pointer border-b border-border transition-colors focus:outline-none focus:bg-blue-50 focus-visible:ring-2 focus-visible:ring-status-blue ${
              isSelected ? 'bg-blue-50' : 'hover:bg-surface-dim'
            }`}
          >
            {/* Idea */}
            <td className="px-4 py-3 min-w-[240px]">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-ink">{sym || '—'}</span>
                {row.asset_class && <span className="text-2xs text-ink-3 uppercase">{row.asset_class}</span>}
                {needsEvidenceReview(row) && <EvidenceBadge row={row} />}
                {(row.evidence_duplicate_setup_count ?? 0) > 1 && (
                  <span className="rounded-sm border border-border px-1.5 py-0.5 text-2xs font-semibold text-ink-3">
                    {row.evidence_duplicate_setup_count} SETUPS
                  </span>
                )}
              </div>
              <div className="text-sm font-medium text-ink mt-0.5 line-clamp-1">{row.title}</div>
            </td>

            {/* Direction */}
            <td className="px-4 py-3">
              {row.direction ? (
                <span className={`text-2xs font-semibold ${row.direction === 'long' ? 'text-status-green' : 'text-status-red'}`}>
                  {row.direction === 'long' ? '↑ LONG' : '↓ SHORT'}
                </span>
              ) : <span className="text-2xs text-ink-3">—</span>}
            </td>

            {/* COMP — blended rank (lives on the opportunity row) */}
            <td className="px-4 py-3"><ScoreCell value={row.total_score} bold /></td>
            {/* MACRO / TECH — from composite view */}
            <td className="px-4 py-3"><ScoreCell value={comp?.macro_fit_score ?? null} /></td>
            <td className="px-4 py-3"><ScoreCell value={comp?.technical_score ?? null} /></td>
            {/* CONV — conviction from research pass; not yet wired for RealVision rows */}
            <td className="px-4 py-3"><ScoreCell value={convictionScore(row, comp)} /></td>

            {/* Entry status */}
            <td className="px-4 py-3 whitespace-nowrap"><EntryStatus row={row} /></td>

            {/* Why now */}
            <td className="px-4 py-3 max-w-[240px]">
              <span className="text-2xs text-ink-3 line-clamp-2">{row.why_now ?? row.next_action ?? '—'}</span>
            </td>

            {/* Review priority routes stale evidence; it does not alter COMP. */}
            <td className="px-4 py-3"><EvidencePriority row={row} /></td>

            {/* Updated */}
            <td className="px-4 py-3 text-2xs text-ink-3 whitespace-nowrap">{formatAge(row.updated_at)}</td>
          </tr>
        )
      })}
    </>
  )
}

// ── Cells ─────────────────────────────────────────────────────────────────────

function ScoreCell({ value, bold = false }: { value: number | null; bold?: boolean }) {
  if (value == null || Number.isNaN(Number(value))) {
    return <span className="font-mono text-xs text-ink-3">—</span>
  }
  const v = Math.round(Number(value))
  const color = v >= 60 ? 'text-status-green' : v <= 40 ? 'text-status-red' : 'text-ink-2'
  return <span className={`font-mono text-xs ${bold ? 'font-bold text-ink' : color}`}>{v}</span>
}

function EvidenceBadge({ row }: { row: OpportunityAction }) {
  const missing = !row.evidence_freshness_status || row.evidence_freshness_status === 'missing'
  return (
    <span className="rounded-sm border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-2xs font-semibold text-status-amber">
      {missing ? 'NO EVIDENCE DATE' : `STALE ${row.evidence_age_days ?? '?'}D`}
    </span>
  )
}

function EvidencePriority({ row }: { row: OpportunityAction }) {
  if (!needsEvidenceReview(row)) return <span className="font-mono text-xs text-ink-3">—</span>
  const score = evidenceReviewPriority(row)
  const tier = row.evidence_review_priority_tier
    ?? (score >= 75 ? 'critical' : score >= 55 ? 'high' : 'standard')
  const color = tier === 'critical' ? 'text-status-red' : tier === 'high' ? 'text-status-amber' : 'text-ink-3'
  return (
    <span className={`font-mono text-xs font-bold ${color}`} title={row.evidence_review_priority_reason ?? undefined}>
      {score}
    </span>
  )
}

// Entry status — is the current price inside, below, or above the entry zone?
// This is what turns a score into "act now" vs "wait".
function EntryStatus({ row }: { row: OpportunityAction }) {
  const price = row.current_price
  const lo = row.entry_min ?? row.ideal_entry
  const hi = row.entry_max ?? row.ideal_entry
  const dnc = row.do_not_chase_above

  if (price == null || (lo == null && hi == null)) {
    return <span className="text-2xs text-ink-3">—</span>
  }
  if (dnc != null && price > dnc) return <span className="text-2xs font-semibold text-status-amber">above · chase</span>
  if (lo != null && hi != null && price >= lo && price <= hi) return <span className="text-2xs font-semibold text-status-green">in zone</span>
  if (lo != null && price < lo) return <span className="text-2xs text-status-blue">below zone</span>
  if (hi != null && price > hi) return <span className="text-2xs text-ink-3">above zone</span>
  return <span className="text-2xs text-ink-3">—</span>
}

// Conviction column. MoneyTrail's research pass (Part B) will populate a real
// viability score; until then there is no per-idea conviction value on the
// RealVision rows, so this honestly returns null (renders as '—').
function convictionScore(_row: OpportunityAction, _comp?: CompositeRow): number | null {
  return null
}

function stateVariant(state?: string | null): 'red' | 'amber' | 'green' | 'blue' | 'purple' | 'grey' {
  const s = (state ?? '').toLowerCase()
  if (s === 'ready' || s === 'holding') return 'green'
  if (s === 'wait_for_entry') return 'blue'
  if (s === 'chasing_risk') return 'amber'
  if (s === 'exit_trim' || s === 'exiting') return 'purple'
  if (s === 'invalidated') return 'red'
  return 'grey'
}
