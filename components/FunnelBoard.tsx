'use client'

/**
 * FunnelBoard — the single surface the whole app is built around.
 *
 * One object (OpportunityAction), one table, grouped by where each idea sits in
 * its lifecycle. This replaces the old Cockpit / Watchlist / Action / Ideas
 * boards, which were all just different filters of the same rows.
 *
 * The engine emits one row per source view, so a ticker that several sources flag
 * arrives several times. By default the table collapses those into one row per
 * ticker and reports the split — bull count, bear count, and a score-weighted net
 * stance — with every underlying view expandable. Nothing is discarded: a bull and
 * a bear case on the same asset both stay readable, which is the point. `All rows`
 * drops back to one row per view.
 *
 * Columns: symbol · direction · COMP · MACRO · TECH · STANCE · entry status · why-now.
 *   - COMP   = total_score on the opportunity row (the blended rank)
 *   - MACRO  = macro_fit_score   (joined from public_rv_trade_composite by symbol)
 *   - TECH   = technical_score   (joined from public_rv_trade_composite by symbol)
 *   - STANCE = score-weighted balance of long against short across every view
 *
 * Row click opens the existing IdeaDrawer (chart, levels, score breakdown,
 * thesis, invalidation, sources) — no new detail UI.
 */

import { Fragment, useState, useMemo } from 'react'
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
import {
  groupIdeasByTicker,
  STANCE_LABEL_TEXT,
  tickerOf,
  type TickerGroup,
} from '@/lib/ticker-aggregate'
import {
  fmtPriceAge,
  hasNoPlan,
  priceAgeDays,
  priceHealth,
  summarisePriceFeed,
} from '@/lib/price-feed'

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

const COLUMNS = ['IDEA', 'DIR', 'COMP', 'MACRO', 'TECH', 'STANCE', 'ENTRY', 'WHY NOW', 'PRI', 'UPDATED']

export interface DrawerSelection {
  group: TickerGroup
  row: OpportunityAction
}

export default function FunnelBoard({
  ideas,
  composite,
}: {
  ideas: OpportunityAction[]
  composite: CompositeRow[]
}) {
  const [selected, setSelected] = useState<DrawerSelection | null>(null)
  const [evidenceReviewMode, setEvidenceReviewMode] = useState<'funnel' | 'daily' | 'all'>('funnel')
  const [groupMode, setGroupMode] = useState<'ticker' | 'rows'>('ticker')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Join macro/tech by symbol. The opportunity row carries the blended COMP
  // (total_score); the per-factor breakdown lives in the composite view, keyed by
  // normalized symbol.
  const compBySymbol = useMemo(() => {
    const m = new Map<string, CompositeRow>()
    for (const c of composite) if (c.symbol) m.set(c.symbol.toUpperCase(), c)
    return m
  }, [composite])

  const evidenceReviews = useMemo(() => buildEvidenceReviewBatch(ideas), [ideas])

  const visibleIdeas = evidenceReviewMode === 'daily'
    ? evidenceReviews.dailyBatch
    : evidenceReviewMode === 'all'
      ? evidenceReviews.uniqueReviews
      : ideas

  // Grouped over every row, not just the visible ones, so the drawer can always
  // show the full set of views on a ticker even inside a filtered batch.
  const groupBySymbol = useMemo(() => {
    const m = new Map<string, TickerGroup>()
    for (const g of groupIdeasByTicker(ideas)) m.set(g.symbol, g)
    return m
  }, [ideas])

  const visibleGroups = useMemo(() => groupIdeasByTicker(visibleIdeas), [visibleIdeas])

  const contestedCount = useMemo(
    () => visibleGroups.filter(g => g.hasDisagreement).length,
    [visibleGroups],
  )

  // Summarised across every idea, not just the visible ones — a class the exporter
  // has stopped writing is worth surfacing even while a filter is applied.
  const priceFeed = useMemo(() => summarisePriceFeed(ideas), [ideas])

  const missingSentence = useMemo(() => {
    const { missing, unactionable } = priceFeed
    if (missing === 0) return null
    const subject = missing === 1 ? '1 idea has' : `${missing} ideas have`
    if (unactionable === 0) return `${subject} no price at all.`
    if (unactionable === missing) {
      return `${subject} no price at all, leaving ${missing === 1 ? 'it' : 'them'} with no entry, stop or target.`
    }
    return `${subject} no price at all — ${unactionable} of those have no entry, stop or target as a result.`
  }, [priceFeed])

  // Bucket by lifecycle state, preserving the order each list arrives in.
  const byState = useMemo(() => {
    const m = new Map<string, TickerGroup[]>()
    const push = (state: string | null | undefined, group: TickerGroup) => {
      const key = (state ?? 'research').toLowerCase()
      if (!m.has(key)) m.set(key, [])
      m.get(key)!.push(group)
    }
    if (groupMode === 'ticker') {
      for (const g of visibleGroups) push(g.primary.action_state, g)
    } else {
      // One entry per row, each wrapped as its own single-view group so the row
      // renderer and the drawer stay on one shape.
      for (const row of visibleIdeas) {
        const full = groupBySymbol.get(tickerOf(row))
        push(row.action_state, singleRowGroup(row, full))
      }
    }
    return m
  }, [groupMode, visibleGroups, visibleIdeas, groupBySymbol])

  const groups = STATE_ORDER
    .map(s => ({ ...s, rows: byState.get(s.key) ?? [] }))
    .filter(g => g.rows.length > 0)

  const toggleExpanded = (symbol: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(symbol)) next.delete(symbol)
      else next.add(symbol)
      return next
    })
  }

  const select = (group: TickerGroup, row: OpportunityAction) => {
    setSelected({ group: groupBySymbol.get(group.symbol) ?? group, row })
  }

  if (ideas.length === 0) {
    return (
      <Card title="Funnel">
        <div className="px-4 py-12 text-center text-sm text-ink-3">
          No ideas yet — feed the engine or wait for the next sync.
        </div>
      </Card>
    )
  }

  const visibleCount = groups.reduce((n, g) => n + g.rows.length, 0)

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

      {(priceFeed.staleClasses.length > 0 || priceFeed.missing > 0) && (
        <div className="mb-3 w-full rounded border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-widest text-status-amber">
            Price feed
          </div>
          {priceFeed.staleClasses.length > 0 && (
            <div className="mt-1 text-sm font-semibold text-ink">
              {priceFeed.staleClasses
                .map(c => `${c.assetClass} last priced ${fmtPriceAge(c.lastWriteDays)} ago`)
                .join(' · ')}
              .
            </div>
          )}
          <div className="mt-0.5 text-xs text-ink-3">
            {missingSentence && <>{missingSentence} </>}
            Entry verdicts are derived from the price, so anything marked stale cannot be trusted
            until the exporter refreshes it.
          </div>
        </div>
      )}

      {contestedCount > 0 && groupMode === 'ticker' && (
        <div className="mb-3 w-full rounded border border-purple-200 bg-purple-50 px-4 py-2.5">
          <div className="text-xs font-semibold uppercase tracking-widest text-status-purple">
            Contrarian views open
          </div>
          <div className="mt-0.5 text-sm text-ink">
            {contestedCount} ticker{contestedCount === 1 ? '' : 's'} carry both a long and a short case.
            Expand the row to weigh each thesis against the other before acting.
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
        action={
          <div className="flex items-center gap-3">
            <div className="flex overflow-hidden rounded border border-border">
              <button
                type="button"
                aria-pressed={groupMode === 'ticker'}
                onClick={() => setGroupMode('ticker')}
                className={`px-2 py-0.5 text-2xs font-semibold transition-colors ${
                  groupMode === 'ticker' ? 'bg-ink text-white' : 'text-ink-3 hover:bg-surface-dim'
                }`}
              >
                BY TICKER
              </button>
              <button
                type="button"
                aria-pressed={groupMode === 'rows'}
                onClick={() => setGroupMode('rows')}
                className={`px-2 py-0.5 text-2xs font-semibold transition-colors ${
                  groupMode === 'rows' ? 'bg-ink text-white' : 'text-ink-3 hover:bg-surface-dim'
                }`}
              >
                ALL ROWS
              </button>
            </div>
            <span className="font-mono text-2xs text-ink-3">
              {groupMode === 'ticker'
                ? `${visibleCount} tickers · ${visibleIdeas.length} views`
                : `${visibleCount} ideas`}
            </span>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-dim border-b border-border">
                {COLUMNS.map(h => (
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
                  selectedId={selected?.row.id ?? null}
                  onSelect={select}
                  expanded={expanded}
                  onToggleExpanded={toggleExpanded}
                  showSiblings={groupMode === 'ticker'}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <IdeaDrawer selection={selected} onClose={() => setSelected(null)} onSelectRow={select} />
    </>
  )
}

// Wrap a single row as its own group so `All rows` mode reuses the ticker renderer.
// The full group is still attached for stance context where it is known.
function singleRowGroup(row: OpportunityAction, full?: TickerGroup): TickerGroup {
  return {
    symbol: tickerOf(row),
    rows: [row],
    bulls: (row.direction ?? '').toLowerCase() === 'long' ? [row] : [],
    bears: (row.direction ?? '').toLowerCase() === 'short' ? [row] : [],
    undirected: ['long', 'short'].includes((row.direction ?? '').toLowerCase()) ? [] : [row],
    primary: row,
    netStance: full?.netStance ?? null,
    stanceLabel: full?.stanceLabel ?? null,
    hasDisagreement: full?.hasDisagreement ?? false,
    sources: row.sources && row.sources.length > 0 ? row.sources : (row.source ? [row.source] : []),
    conflictingStates: [],
    setupCount: 1,
    topScore: row.total_score,
  }
}

// ── A lifecycle section: a labelled header row + its ticker rows ──────────────

function GroupRows({
  group,
  compBySymbol,
  selectedId,
  onSelect,
  expanded,
  onToggleExpanded,
  showSiblings,
}: {
  group: { key: string; label: string; blurb: string; rows: TickerGroup[] }
  compBySymbol: Map<string, CompositeRow>
  selectedId: string | null
  onSelect: (group: TickerGroup, row: OpportunityAction) => void
  expanded: Set<string>
  onToggleExpanded: (symbol: string) => void
  showSiblings: boolean
}) {
  return (
    <>
      <tr className="bg-surface-dim/60 border-y border-border">
        <td colSpan={COLUMNS.length} className="px-4 py-1.5">
          <div className="flex items-center gap-2">
            <StatusChip label={`${group.label} · ${group.rows.length}`} variant={stateVariant(group.key)} />
            <span className="text-2xs text-ink-3">{group.blurb}</span>
          </div>
        </td>
      </tr>
      {group.rows.map(ticker => {
        const row = ticker.primary
        const comp = compBySymbol.get(ticker.symbol)
        const isSelected = selectedId === row.id
        const hasSiblings = showSiblings && ticker.setupCount > 1
        const isExpanded = expanded.has(ticker.symbol)
        return (
          <Fragment key={ticker.symbol}>
            <tr
              onClick={() => onSelect(ticker, row)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(ticker, row) } }}
              tabIndex={0}
              role="button"
              aria-label={`Open ${ticker.symbol} — ${row.title}`}
              className={`cursor-pointer border-b border-border transition-colors focus:outline-none focus:bg-blue-50 focus-visible:ring-2 focus-visible:ring-status-blue ${
                isSelected ? 'bg-blue-50' : 'hover:bg-surface-dim'
              }`}
            >
              {/* Idea */}
              <td className="px-4 py-3 min-w-[240px]">
                <div className="flex items-center gap-2">
                  {hasSiblings && (
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); onToggleExpanded(ticker.symbol) }}
                      aria-expanded={isExpanded}
                      aria-label={`${isExpanded ? 'Hide' : 'Show'} all ${ticker.setupCount} views on ${ticker.symbol}`}
                      className="shrink-0 text-ink-3 hover:text-ink transition-transform"
                      style={{ transform: isExpanded ? 'rotate(90deg)' : 'none' }}
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                        <path d="M3 1.5L7 5l-4 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  )}
                  <span className="font-mono text-xs font-bold text-ink">{ticker.symbol || '—'}</span>
                  {row.asset_class && <span className="text-2xs text-ink-3 uppercase">{row.asset_class}</span>}
                  {needsEvidenceReview(row) && <EvidenceBadge row={row} />}
                  {ticker.hasDisagreement && (
                    <span className="rounded-sm border border-purple-200 bg-purple-50 px-1.5 py-0.5 text-2xs font-semibold text-status-purple">
                      DISAGREEMENT
                    </span>
                  )}
                  {hasSiblings && (
                    <span className="rounded-sm border border-border px-1.5 py-0.5 text-2xs font-semibold text-ink-3">
                      {ticker.setupCount} VIEWS
                    </span>
                  )}
                  {!showSiblings && (row.evidence_duplicate_setup_count ?? 0) > 1 && (
                    <span className="rounded-sm border border-border px-1.5 py-0.5 text-2xs font-semibold text-ink-3">
                      {row.evidence_duplicate_setup_count} SETUPS
                    </span>
                  )}
                </div>
                <div className="text-sm font-medium text-ink mt-0.5 line-clamp-1">{row.title}</div>
                {ticker.conflictingStates.length > 0 && (
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <span className="text-2xs text-ink-3">also in</span>
                    {ticker.conflictingStates.map(s => (
                      <span key={s} className="rounded-sm border border-border px-1 py-px text-2xs text-ink-3">
                        {stateLabel(s)}
                      </span>
                    ))}
                  </div>
                )}
              </td>

              {/* Direction — the split when views disagree, otherwise the single side */}
              <td className="px-4 py-3"><DirectionCell ticker={ticker} /></td>

              {/* COMP — blended rank (lives on the opportunity row) */}
              <td className="px-4 py-3"><ScoreCell value={row.total_score} bold /></td>
              {/* MACRO / TECH — from composite view */}
              <td className="px-4 py-3"><ScoreCell value={comp?.macro_fit_score ?? null} /></td>
              <td className="px-4 py-3"><ScoreCell value={comp?.technical_score ?? null} /></td>
              {/* STANCE — score-weighted balance across every view on the ticker */}
              <td className="px-4 py-3"><StanceCell ticker={ticker} /></td>

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

            {/* Sibling views — every other read on this ticker, nothing dropped */}
            {hasSiblings && isExpanded && ticker.rows.slice(1).map(sibling => (
              <SiblingRow
                key={sibling.id}
                ticker={ticker}
                row={sibling}
                isSelected={selectedId === sibling.id}
                onSelect={onSelect}
              />
            ))}
          </Fragment>
        )
      })}
    </>
  )
}

function SiblingRow({
  ticker, row, isSelected, onSelect,
}: {
  ticker: TickerGroup
  row: OpportunityAction
  isSelected: boolean
  onSelect: (group: TickerGroup, row: OpportunityAction) => void
}) {
  return (
    <tr
      onClick={() => onSelect(ticker, row)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(ticker, row) } }}
      tabIndex={0}
      role="button"
      aria-label={`Open ${ticker.symbol} view — ${row.title}`}
      className={`cursor-pointer border-b border-border bg-surface-dim/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-status-blue ${
        isSelected ? 'bg-blue-50' : 'hover:bg-surface-dim'
      }`}
    >
      <td className="px-4 py-2 pl-10 min-w-[240px]">
        <div className="flex items-center gap-2">
          <span className="text-2xs font-mono uppercase text-ink-3">{sourceLabel(row.source)}</span>
          <StatusChip label={stateLabel(row.action_state)} variant={stateVariant(row.action_state)} />
          {needsEvidenceReview(row) && <EvidenceBadge row={row} />}
        </div>
        <div className="mt-0.5 text-xs text-ink line-clamp-1">{row.title}</div>
        {row.thesis && (
          <div className="mt-0.5 text-2xs text-ink-3 line-clamp-2">{row.thesis}</div>
        )}
      </td>
      <td className="px-4 py-2">
        {row.direction ? (
          <span className={`text-2xs font-semibold ${row.direction === 'long' ? 'text-status-green' : 'text-status-red'}`}>
            {row.direction === 'long' ? '↑ LONG' : '↓ SHORT'}
          </span>
        ) : <span className="text-2xs text-ink-3">—</span>}
      </td>
      <td className="px-4 py-2"><ScoreCell value={row.total_score} /></td>
      <td className="px-4 py-2" />
      <td className="px-4 py-2" />
      <td className="px-4 py-2">
        <span className="font-mono text-2xs text-ink-3">
          {row.confirmed_by_count != null && row.confirmed_by_count > 1 ? `${row.confirmed_by_count} src` : '—'}
        </span>
      </td>
      <td className="px-4 py-2 whitespace-nowrap"><EntryStatus row={row} /></td>
      <td className="px-4 py-2 max-w-[240px]">
        <span className="text-2xs text-ink-3 line-clamp-2">{row.why_now ?? row.next_action ?? '—'}</span>
      </td>
      <td className="px-4 py-2"><EvidencePriority row={row} /></td>
      <td className="px-4 py-2 text-2xs text-ink-3 whitespace-nowrap">{formatAge(row.updated_at)}</td>
    </tr>
  )
}

// ── Cells ─────────────────────────────────────────────────────────────────────

function DirectionCell({ ticker }: { ticker: TickerGroup }) {
  if (ticker.hasDisagreement) {
    return (
      <span className="flex items-center gap-1.5 font-mono text-2xs font-semibold">
        <span className="text-status-green">↑{ticker.bulls.length}</span>
        <span className="text-status-red">↓{ticker.bears.length}</span>
      </span>
    )
  }
  const dir = ticker.primary.direction
  if (!dir) return <span className="text-2xs text-ink-3">—</span>
  return (
    <span className={`text-2xs font-semibold ${dir === 'long' ? 'text-status-green' : 'text-status-red'}`}>
      {dir === 'long' ? '↑ LONG' : '↓ SHORT'}
    </span>
  )
}

// Net stance: +100 is unanimously long, -100 unanimously short, near zero means the
// views cancel out and the ticker needs a decision rather than an entry.
function StanceCell({ ticker }: { ticker: TickerGroup }) {
  if (ticker.netStance == null || ticker.stanceLabel == null) {
    return <span className="font-mono text-xs text-ink-3">—</span>
  }
  const net = ticker.netStance
  const color = ticker.stanceLabel === 'contested'
    ? 'text-status-purple'
    : net > 0 ? 'text-status-green' : 'text-status-red'
  return (
    <span className={`font-mono text-xs font-semibold ${color}`} title={STANCE_LABEL_TEXT[ticker.stanceLabel]}>
      {net > 0 ? '+' : ''}{net}
    </span>
  )
}

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
//
// A missing price is called out rather than shown as an em-dash: it means the
// exporter never resolved a quote, so there is no entry, stop or target either.
// A stale price still yields a verdict, but one computed from an old quote, so it
// loses the confident colour and carries its age.
function EntryStatus({ row }: { row: OpportunityAction }) {
  const health = priceHealth(row)

  if (health === 'missing') {
    return (
      <span
        className="rounded-sm border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-2xs font-semibold text-status-amber"
        title={hasNoPlan(row)
          ? 'No price was written for this symbol, so no entry, stop or target could be derived.'
          : 'No price was written for this symbol, so the entry zone cannot be evaluated.'}
      >
        NO PRICE
      </span>
    )
  }

  const price = row.current_price!
  const lo = row.entry_min ?? row.ideal_entry
  const hi = row.entry_max ?? row.ideal_entry
  const dnc = row.do_not_chase_above

  if (lo == null && hi == null) return <span className="text-2xs text-ink-3">—</span>

  let label: string
  let tone: string
  if (dnc != null && price > dnc) {
    label = 'above · chase'; tone = 'font-semibold text-status-amber'
  } else if (lo != null && hi != null && price >= lo && price <= hi) {
    label = 'in zone'; tone = 'font-semibold text-status-green'
  } else if (lo != null && price < lo) {
    label = 'below zone'; tone = 'text-status-blue'
  } else if (hi != null && price > hi) {
    label = 'above zone'; tone = 'text-ink-3'
  } else {
    return <span className="text-2xs text-ink-3">—</span>
  }

  if (health === 'stale') {
    const age = fmtPriceAge(priceAgeDays(row))
    return (
      <span
        className="flex items-center gap-1"
        title={`Computed from a price written ${age} ago — treat this verdict as unreliable.`}
      >
        <span className="text-2xs text-ink-3">{label}</span>
        <span className="rounded-sm border border-amber-200 bg-amber-50 px-1 text-2xs font-semibold text-status-amber">
          {age}
        </span>
      </span>
    )
  }

  return <span className={`text-2xs ${tone}`}>{label}</span>
}

function sourceLabel(source?: string | null) {
  if (!source) return 'unknown'
  if (source.toLowerCase() === 'realvision') return 'RealVision'
  return source.replace(/[_-]/g, ' ')
}

function stateLabel(state?: string | null) {
  return STATE_ORDER.find(s => s.key === (state ?? '').toLowerCase())?.label ?? (state ?? 'Research')
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
