'use client'

/**
 * IdeaDrawer — slide-over panel showing full detail for one OpportunityAction.
 *
 * Opens when the user clicks any row in the Ideas table.
 * Loads chart data (candles + levels) client-side so the main page stays fast.
 *
 * Sections:
 *   1. Header — symbol, direction, state, score
 *   2. Chart — TradingView Lightweight Charts with all levels
 *   3. Entry / SL / TP grid — key numbers at a glance
 *   4. Score breakdown — all 7 sub-scores as bars
 *   5. Thesis — why this idea, why now, what to watch
 *   6. Risk — invalidation, trailing exit, expiry
 *   7. Source — link, discovery date
 */

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import type { ChartOverlayLevel, MarketCandle, OpportunityAction } from '@/lib/types'
import StatusChip from '@/components/ui/StatusChip'
import TradingViewChart from '@/components/TradingViewChart'

// ── helpers ──────────────────────────────────────────────────────────────────

function money(v?: number | null) {
  if (v == null || Number.isNaN(Number(v))) return '—'
  const n = Number(v)
  if (Math.abs(n) < 0.01) return `$${n.toPrecision(4)}`
  if (Math.abs(n) < 1) return `$${n.toFixed(4)}`
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}

function pct(v?: number | null) {
  if (v == null) return '—'
  return `${Number(v).toFixed(1)}%`
}

function rr(entry?: number | null, stop?: number | null, tp?: number | null) {
  if (!entry || !stop || !tp) return null
  const risk = Math.abs(entry - stop)
  const reward = Math.abs(tp - entry)
  if (risk === 0) return null
  return (reward / risk).toFixed(1)
}

// ── ScoreBar ─────────────────────────────────────────────────────────────────

function ScoreBar({
  label, value, max, color = 'bg-black',
}: { label: string; value: number | null; max: number; color?: string }) {
  const pct = value != null ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <span className="text-2xs text-ink-3 w-28 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-surface-dim rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-2xs text-ink w-14 text-right">
        {value != null ? `${value.toFixed(0)}/${max}` : `—/${max}`}
      </span>
    </div>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border pt-4 mt-4">
      <h3 className="text-2xs font-semibold uppercase tracking-widest text-ink-3 mb-3">{title}</h3>
      {children}
    </div>
  )
}

// ── KeyValue ─────────────────────────────────────────────────────────────────

function KV({ label, value, valueClass = '' }: { label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <div className="bg-surface-dim rounded p-2.5 min-w-0">
      <div className="text-2xs text-ink-3 font-medium uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-sm font-semibold text-ink font-mono truncate ${valueClass}`}>{value}</div>
    </div>
  )
}

// ── Pill ─────────────────────────────────────────────────────────────────────

function Pill({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span className={`inline-flex items-center rounded-sm px-2 py-0.5 text-2xs font-semibold border ${color}`}>
      {children}
    </span>
  )
}

// ── Main drawer ───────────────────────────────────────────────────────────────

interface Props {
  idea: OpportunityAction | null
  onClose: () => void
}

export default function IdeaDrawer({ idea, onClose }: Props) {
  const [levels, setLevels]   = useState<ChartOverlayLevel[]>([])
  const [candles, setCandles] = useState<MarketCandle[]>([])
  const [loading, setLoading] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Load chart data when an idea is selected
  useEffect(() => {
    if (!idea) { setLevels([]); setCandles([]); return }
    const sym = idea.normalized_symbol ?? idea.symbol
    if (!sym) return

    setLoading(true)
    const supabase = createClient()
    Promise.all([
      supabase
        .from('public_symbol_chart_overlays' as 'dashboard_snapshots')
        .select('*')
        .eq('symbol', sym),
      supabase
        .from('market_candles')
        .select('*')
        .eq('symbol', sym)
        .eq('interval', '1d')
        .order('ts', { ascending: true })
        .limit(90),
    ]).then(([lvlRes, candleRes]) => {
      // Also synthesise levels from the idea's own price fields
      // so the chart works even without explicit trade_idea_levels rows.
      const fromDb = (lvlRes.data as unknown as ChartOverlayLevel[]) ?? []
      const fromIdea = buildLevelsFromIdea(idea)
      // Merge: DB levels take precedence; fill gaps from idea fields
      const dbTypes = new Set(fromDb.map(l => l.level_type))
      const merged = [
        ...fromDb,
        ...fromIdea.filter(l => !dbTypes.has(l.level_type)),
      ]
      setLevels(merged)
      setCandles((candleRes.data as unknown as MarketCandle[]) ?? [])
      setLoading(false)
    })
  }, [idea?.id])

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose()
  }

  // Close on Escape
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  // Prevent body scroll while open
  useEffect(() => {
    if (idea) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [!!idea])

  if (!idea) return null

  const sym       = idea.normalized_symbol ?? idea.symbol ?? '—'
  const entryMid  = idea.ideal_entry ?? ((idea.entry_min && idea.entry_max)
    ? (idea.entry_min + idea.entry_max) / 2 : idea.entry_min ?? null)
  const rrRatio   = rr(entryMid, idea.stop_loss, idea.take_profit_1)

  const scoreComponents = [
    { label: 'Thesis',        value: idea.thesis_score,        max: 20 },
    { label: 'Entry setup',   value: idea.entry_score,         max: 20 },
    { label: 'Risk / reward', value: idea.risk_reward_score,   max: 15 },
    { label: 'Catalyst',      value: idea.catalyst_score,      max: 15 },
    { label: 'Source quality',value: idea.source_score,        max: 15 },
    { label: 'Liquidity',     value: idea.liquidity_score,     max: 10 },
    { label: 'Portfolio fit', value: idea.portfolio_fit_score, max: 5  },
  ]

  const resistanceLevels = levels.filter(l => l.level_type === 'resistance')
  const supportLevels    = levels.filter(l => l.level_type === 'support')

  return (
    /* Full-screen backdrop */
    <div
      ref={overlayRef}
      onClick={handleBackdrop}
      className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] flex justify-end"
      aria-modal="true"
      role="dialog"
    >
      {/* Drawer panel */}
      <div
        className="relative bg-white w-full max-w-2xl h-full overflow-y-auto shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-white border-b border-border px-5 py-3 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-base font-bold text-ink">{sym}</span>
              {idea.direction && (
                <span className={`text-xs font-bold ${
                  idea.direction === 'long' ? 'text-status-green' : 'text-status-red'
                }`}>
                  {idea.direction === 'long' ? '↑ LONG' : '↓ SHORT'}
                </span>
              )}
              <StatusChip
                label={stateLabel(idea.action_state)}
                variant={stateVariant(idea.action_state)}
              />
              {idea.asset_class && (
                <span className="text-2xs font-mono text-ink-3 uppercase border border-border rounded px-1.5 py-0.5">
                  {idea.asset_class}
                </span>
              )}
              <span className="text-2xs font-mono text-ink-3 border border-border rounded px-1.5 py-0.5 bg-surface-dim">
                RESEARCH ONLY
              </span>
            </div>
            <div className="text-sm text-ink font-medium mt-0.5 truncate">{idea.title}</div>
            <div className="text-2xs text-ink-3 font-mono uppercase">{sourceLabel(idea.source)}</div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 text-ink-3 hover:text-ink transition-colors p-1 rounded"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 px-5 pb-8 space-y-1">

          {/* ── Score badge ──────────────────────────────────────────────── */}
          {idea.total_score != null && (
            <div className="pt-4 flex items-center gap-3">
              <div className="bg-surface border border-border rounded px-3 py-1.5 text-center">
                <div className="text-2xs text-ink-3">SCORE</div>
                <div className="font-mono font-bold text-lg text-ink leading-none mt-0.5">
                  {Math.round(idea.total_score)}<span className="text-ink-3 text-xs font-normal">/100</span>
                </div>
              </div>
              {rrRatio && (
                <div className="bg-surface border border-border rounded px-3 py-1.5 text-center">
                  <div className="text-2xs text-ink-3">R/R</div>
                  <div className="font-mono font-bold text-lg text-ink leading-none mt-0.5">
                    {rrRatio}<span className="text-ink-3 text-xs font-normal">x</span>
                  </div>
                </div>
              )}
              {idea.current_price != null && (
                <div className="bg-surface border border-border rounded px-3 py-1.5 text-center">
                  <div className="text-2xs text-ink-3">PRICE</div>
                  <div className="font-mono font-bold text-sm text-ink leading-none mt-0.5">
                    {money(idea.current_price)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Chart ────────────────────────────────────────────────────── */}
          <Section title="Chart">
            {loading ? (
              <div className="flex items-center justify-center h-48 text-ink-3 text-sm font-mono">
                Loading chart…
              </div>
            ) : (
              <TradingViewChart
                candles={candles}
                levels={levels}
                symbol={sym}
                height={320}
              />
            )}

            {/* Resistance / support pills */}
            {(resistanceLevels.length > 0 || supportLevels.length > 0) && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {resistanceLevels.map((r, i) => (
                  <Pill key={`r${i}`} color="text-status-amber border-amber-200 bg-amber-50">
                    R: {money(r.price)}{r.label ? ` — ${r.label}` : ''}
                  </Pill>
                ))}
                {supportLevels.map((s, i) => (
                  <Pill key={`s${i}`} color="text-status-blue border-blue-200 bg-blue-50">
                    S: {money(s.price)}{s.label ? ` — ${s.label}` : ''}
                  </Pill>
                ))}
              </div>
            )}
          </Section>

          {/* ── Entry / SL / TP ──────────────────────────────────────────── */}
          <Section title="Trade Levels">
            <div className="grid grid-cols-3 gap-2">
              <KV label="Entry zone"
                value={
                  idea.entry_min && idea.entry_max
                    ? `${money(idea.entry_min)} – ${money(idea.entry_max)}`
                    : money(idea.ideal_entry)
                }
                valueClass="text-status-green"
              />
              <KV label="Stop loss"    value={money(idea.stop_loss)}    valueClass="text-status-red"   />
              <KV label="Do not chase" value={money(idea.do_not_chase_above)} />
              <KV label="TP1" value={money(idea.take_profit_1)} valueClass="text-status-green" />
              <KV label="TP2" value={money(idea.take_profit_2)} valueClass="text-status-green" />
              <KV label="TP3" value={money(idea.take_profit_3)} valueClass="text-status-green" />
            </div>
            {idea.trailing_exit_trigger && (
              <div className="mt-2 text-xs text-ink-3 bg-surface-dim rounded p-2.5">
                <span className="font-semibold text-ink">Trailing exit:</span> {idea.trailing_exit_trigger}
              </div>
            )}
          </Section>

          {/* ── Score breakdown ───────────────────────────────────────────── */}
          <Section title="Score Breakdown">
            <div className="space-y-2">
              {scoreComponents.map(c => (
                <ScoreBar key={c.label} label={c.label} value={c.value} max={c.max} />
              ))}
              {idea.total_score != null && (
                <div className="border-t border-border pt-2 mt-1 flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink">TOTAL</span>
                  <span className="font-mono font-bold text-base text-ink">
                    {Math.round(idea.total_score)}/100
                  </span>
                </div>
              )}
            </div>
          </Section>

          {/* ── Thesis ───────────────────────────────────────────────────── */}
          {(idea.thesis || idea.why_now || idea.what_to_watch) && (
            <Section title="Thesis & Catalyst">
              {idea.thesis && (
                <div className="text-sm text-ink leading-relaxed mb-3">{idea.thesis}</div>
              )}
              {idea.why_now && (
                <div className="bg-surface-dim rounded p-3 mb-2">
                  <div className="text-2xs font-semibold text-ink-3 uppercase tracking-wider mb-1">Why now</div>
                  <div className="text-sm text-ink">{idea.why_now}</div>
                </div>
              )}
              {idea.what_to_watch && (
                <div className="bg-surface-dim rounded p-3">
                  <div className="text-2xs font-semibold text-ink-3 uppercase tracking-wider mb-1">What to watch</div>
                  <div className="text-sm text-ink">{idea.what_to_watch}</div>
                </div>
              )}
            </Section>
          )}

          {/* ── Risk / Invalidation ───────────────────────────────────────── */}
          {(idea.invalidation || idea.next_action) && (
            <Section title="Risk & Invalidation">
              {idea.invalidation && (
                <div className="bg-red-50 border border-red-100 rounded p-3 mb-2">
                  <div className="text-2xs font-semibold text-status-red uppercase tracking-wider mb-1">
                    Invalidation
                  </div>
                  <div className="text-sm text-ink">{idea.invalidation}</div>
                </div>
              )}
              {idea.next_action && (
                <div className="bg-surface-dim rounded p-3">
                  <div className="text-2xs font-semibold text-ink-3 uppercase tracking-wider mb-1">Next action</div>
                  <div className="text-sm text-ink">{idea.next_action}</div>
                </div>
              )}
            </Section>
          )}

          {/* ── Source confirmation ───────────────────────────────────────── */}
          <Section title="Sources">
            {(() => {
              const freshnessStatus = idea.evidence_freshness_status ?? 'missing'
              return (
                <div className={`mb-3 rounded border p-3 ${
                  freshnessStatus === 'fresh'
                    ? 'border-green-100 bg-green-50'
                    : freshnessStatus === 'aging'
                      ? 'border-amber-100 bg-amber-50'
                      : 'border-red-100 bg-red-50'
                }`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-2xs font-semibold uppercase tracking-wider text-ink-3">
                      Evidence {freshnessStatus}
                    </div>
                    <div className="text-2xs font-mono text-ink-3">
                      {idea.evidence_age_days == null ? 'undated' : `${idea.evidence_age_days}d old`}
                      {idea.evidence_sla_days == null ? '' : ` / ${idea.evidence_sla_days}d SLA`}
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-ink">
                    {idea.evidence_review_reason ?? 'No dated source confirmation is available; verify provenance before relying on this idea.'}
                  </div>
                  {idea.evidence_review_due_at && (
                    <div className="mt-1 text-2xs text-ink-3">
                      Review deadline: {fmtDate(idea.evidence_review_due_at)}
                    </div>
                  )}
                </div>
              )
            })()}
            {/* Multi-source confirmation badges */}
            {(idea.sources && idea.sources.length > 0) ? (
              <div className="mb-3">
                <div className="text-2xs text-ink-3 uppercase tracking-wider font-semibold mb-2">
                  Confirmed by {idea.confirmed_by_count ?? idea.sources.length} source{(idea.confirmed_by_count ?? idea.sources.length) > 1 ? 's' : ''}
                  {(idea.confirmed_by_count ?? 0) > 1 && (
                    <span className="ml-2 text-status-green font-bold">↑ higher conviction</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {idea.sources.map((src, i) => {
                    const detail = idea.source_details?.find(d => d.source === src)
                    return (
                      <div key={i} className="group relative">
                        <span className={`inline-flex items-center gap-1 rounded px-2 py-1 text-2xs font-semibold border ${
                          src === idea.source
                            ? 'bg-black text-white border-black'
                            : 'bg-surface-dim text-ink border-border'
                        }`}>
                          {sourceLabel(src)}
                          {detail?.score_contrib ? (
                            <span className="text-status-green">+{detail.score_contrib.toFixed(0)}</span>
                          ) : null}
                        </span>
                        {/* Tooltip on hover */}
                        {detail?.notes && (
                          <div className="hidden group-hover:block absolute bottom-full left-0 mb-1 z-10 w-48 bg-black text-white text-2xs rounded p-2 shadow-lg">
                            {detail.notes}
                            {detail.confirmed_at && (
                              <div className="text-ink-3 mt-1">{fmtDate(detail.confirmed_at)}</div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                {/* Per-source links */}
                {idea.source_details?.some(d => d.source_url) && (
                  <div className="mt-2 space-y-1">
                    {idea.source_details.filter(d => d.source_url).map((d, i) => (
                      <a key={i} href={d.source_url!} target="_blank" rel="noopener noreferrer"
                        className="block text-2xs text-status-blue hover:underline">
                        {sourceLabel(d.source)}{d.author ? ` — ${d.author}` : ''} →
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Single source fallback */
              <div className="mb-3 flex items-center gap-2">
                <span className="inline-flex items-center rounded px-2 py-1 text-2xs font-semibold border bg-surface-dim text-ink border-border">
                  {sourceLabel(idea.source)}
                </span>
                {idea.source_url && (
                  <a href={idea.source_url} target="_blank" rel="noopener noreferrer"
                    className="text-2xs text-status-blue hover:underline">
                    View source →
                  </a>
                )}
              </div>
            )}

            {/* Meta row */}
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[
                { label: 'Lifecycle',  value: idea.lifecycle ?? '—' },
                { label: 'Discovered', value: idea.discovered_at ? fmtDate(idea.discovered_at) : '—' },
                { label: 'Updated',    value: idea.updated_at ? fmtDate(idea.updated_at) : '—' },
                { label: 'Expires',    value: idea.expires_at ? fmtDate(idea.expires_at) : '—' },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-xs text-ink-3">{row.label}</span>
                  <span className="text-xs text-ink font-medium capitalize">{row.value}</span>
                </div>
              ))}
            </div>
          </Section>

        </div>
      </div>
    </div>
  )
}

// ── Synthesise level rows from the idea's own price fields ────────────────────
// Used when the bot hasn't pushed explicit trade_idea_levels yet.

function buildLevelsFromIdea(idea: OpportunityAction): ChartOverlayLevel[] {
  const sym = idea.normalized_symbol ?? idea.symbol ?? ''
  const src = 'openclaw_derived'
  const levels: ChartOverlayLevel[] = []
  const push = (type: string, price: number | null | undefined, label: string) => {
    if (price != null) levels.push({ symbol: sym, idea_id: idea.id, level_type: type, price, source: src, label })
  }
  push('entry_min',  idea.entry_min,         'Entry min')
  push('entry_max',  idea.entry_max,         'Entry max')
  push('entry_min',  idea.ideal_entry,       'Entry')   // fallback if no range
  push('stop_loss',  idea.stop_loss,         'Stop')
  push('tp1',        idea.take_profit_1,     'TP1')
  push('tp2',        idea.take_profit_2,     'TP2')
  push('tp3',        idea.take_profit_3,     'TP3')
  // Deduplicate: keep entry_min from range if both set
  if (idea.entry_min != null && idea.entry_max != null) {
    return levels.filter(l => !(l.level_type === 'entry_min' && l.label === 'Entry'))
  }
  return levels
}

// ── Formatting helpers ────────────────────────────────────────────────────────

function sourceLabel(source?: string | null) {
  if (!source) return 'Unknown'
  if (source.toLowerCase() === 'realvision') return 'RealVision'
  return source.replace(/[_-]/g, ' ')
}

function stateLabel(state?: string | null) {
  const map: Record<string, string> = {
    ready: 'Ready', wait_for_entry: 'Wait Entry', chasing_risk: 'Do Not Chase',
    exit_trim: 'Exit / Trim', invalidated: 'Invalidated', research: 'Research',
  }
  return map[(state ?? '').toLowerCase()] ?? (state ?? 'Research')
}

function stateVariant(state?: string | null): 'red' | 'amber' | 'green' | 'blue' | 'purple' | 'grey' {
  const s = (state ?? '').toLowerCase()
  if (s === 'ready')          return 'green'
  if (s === 'wait_for_entry') return 'blue'
  if (s === 'chasing_risk')   return 'amber'
  if (s === 'exit_trim')      return 'purple'
  if (s === 'invalidated')    return 'red'
  return 'grey'
}

function fmtDate(s: string) {
  try { return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
  catch { return s }
}
