'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase-client'
import type { OpportunityAction, OpportunityEngineEvent } from '@/lib/types'
import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import StatusChip from '@/components/ui/StatusChip'
import IdeaDrawer from '@/components/IdeaDrawer'
import { formatAge } from '@/lib/fmt'

// ── Thesis category inference ─────────────────────────────────────────────
// Inferred client-side from title + thesis text + symbol. No DB change needed.

const CATEGORY_RULES: Array<{ label: string; color: string; keywords: string[] }> = [
  { label: 'AI',       color: '#7c3aed', keywords: ['ai', 'artificial intelligence', 'coreweave', 'nvidia', 'machine learning', 'gpu', 'data center', 'llm'] },
  { label: 'Energy',   color: '#d97706', keywords: ['energy', 'oil', 'gas', 'power', 'electric', 'eqt', 'bloom energy', 'solar', 'wind', 'nuclear', 'utilities', 'nee'] },
  { label: 'Crypto',   color: '#f59e0b', keywords: ['bitcoin', 'btc', 'ethereum', 'eth', 'sol', 'solana', 'crypto', 'defi', 'blockchain', 'mining', 'hype', 'hyperliquid'] },
  { label: 'Mining',   color: '#6b7280', keywords: ['mining', 'core scientific', 'riot platforms', 'hut 8', 'bitfarms', 'cleanspark', 'bitdeer', 'iren'] },
  { label: 'Semi',     color: '#2563eb', keywords: ['semiconductor', 'tsm', 'taiwan', 'broadcom', 'intel', 'micron', 'sandisk', 'lumentum', 'coherent', 'tower semi'] },
  { label: 'Infra',    color: '#059669', keywords: ['infrastructure', 'applied digital', 'apld', 'solaris', 'data infrastructure', 'server'] },
  { label: 'Tech',     color: '#0891b2', keywords: ['software', 'cloud', 'saas', 'oracle', 'orcl', 'infosys', 'tech'] },
]

function inferCategory(row: OpportunityAction): string {
  const haystack = [row.title, row.thesis, row.normalized_symbol, row.symbol]
    .filter(Boolean).join(' ').toLowerCase()
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some(kw => haystack.includes(kw))) return rule.label
  }
  return row.asset_class === 'crypto' ? 'Crypto' : 'Other'
}

// ── Filter state ────────────────────────────────────────────────────────────

interface Filters {
  categories: Set<string>
  minScore:   number        // 0–100
  minRR:      number        // 0.0–10.0
}

const DEFAULT_FILTERS: Filters = { categories: new Set(), minScore: 0, minRR: 0 }

function filtersActive(f: Filters) {
  return f.categories.size > 0 || f.minScore > 0 || f.minRR > 0
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function IdeasPage() {
  const [ideas, setIdeas]       = useState<OpportunityAction[]>([])
  const [events, setEvents]     = useState<OpportunityEngineEvent[]>([])
  const [selected, setSelected] = useState<OpportunityAction | null>(null)
  const [loading, setLoading]   = useState(true)
  const [filters, setFilters]   = useState<Filters>(DEFAULT_FILTERS)

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('public_opportunity_action_board').select('*').limit(160),
      supabase.from('public_opportunity_engine_events').select('*').limit(30),
    ]).then(([ideasRes, eventsRes]) => {
      setIdeas((ideasRes.data as OpportunityAction[]) ?? [])
      setEvents((eventsRes.data as OpportunityEngineEvent[]) ?? [])
      setLoading(false)
    })
  }, [])

  const closeDrawer = useCallback(() => setSelected(null), [])

  const toggleCategory = useCallback((cat: string) => {
    setFilters(prev => {
      const next = new Set(prev.categories)
      next.has(cat) ? next.delete(cat) : next.add(cat)
      return { ...prev, categories: next }
    })
  }, [])

  // Compute per-row R/R for filtering
  const ideasWithRR = useMemo(() => ideas.map(row => {
    const entryMid = row.ideal_entry ?? ((row.entry_min && row.entry_max)
      ? (row.entry_min + row.entry_max) / 2 : row.entry_min)
    return { row, rr: rrRatioNum(entryMid, row.stop_loss, row.take_profit_1) }
  }), [ideas])

  const ideasWithMeta = useMemo(() => ideasWithRR.map(({ row, rr }) => ({
    row, rr, category: inferCategory(row),
  })), [ideasWithRR])

  const filteredIdeas = useMemo(() => ideasWithMeta.filter(({ row, rr, category }) => {
    if (filters.categories.size > 0 && !filters.categories.has(category)) return false
    if (filters.minScore > 0 && (row.total_score ?? 0) < filters.minScore) return false
    if (filters.minRR > 0 && (rr ?? 0) < filters.minRR) return false
    return true
  }), [ideasWithMeta, filters])

  // Category counts for pills — only show categories that exist in the data
  const categoryCounts = useMemo(() => ideasWithMeta.reduce<Record<string, number>>((acc, { category }) => {
    acc[category] = (acc[category] ?? 0) + 1
    return acc
  }, {}), [ideasWithMeta])

  const ready   = ideas.filter(r => r.action_state === 'ready').length
  const waiting = ideas.filter(r => r.action_state === 'wait_for_entry').length
  const risk    = ideas.filter(r => ['chasing_risk', 'invalidated'].includes(r.action_state)).length
  const active  = filtersActive(filters)

  return (
    <>
      <div className="space-y-4">
        <PageHeader
          title="Ideas"
          subtitle="Multi-source trade idea feed. Tap any row to see chart, levels, thesis, and score breakdown."
          action={<span className="text-2xs font-mono text-ink-3 border border-border rounded px-2 py-1">RESEARCH ONLY</span>}
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Total Ideas" value={loading ? '…' : ideas.length} />
          <Metric label="Ready"       value={loading ? '…' : ready}   />
          <Metric label="Wait Entry"  value={loading ? '…' : waiting} />
          <Metric label="Risk Flags"  value={loading ? '…' : risk}    />
        </div>

        <Card
          title="Idea Feed"
          action={
            <div className="flex items-center gap-3">
              {active && (
                <button
                  onClick={() => setFilters(DEFAULT_FILTERS)}
                  className="text-2xs text-ink-3 hover:text-ink underline"
                >
                  clear filters
                </button>
              )}
              <span className="text-2xs font-mono text-ink-3">
                {active ? `${filteredIdeas.length} of ${ideas.length}` : `${ideas.length} ideas`}
              </span>
            </div>
          }
        >
          {/* ── Filter bar ─────────────────────────────────────────────────── */}
          <div className="px-4 pt-3 pb-4 border-b border-border space-y-3">

            {/* Category pills */}
            {Object.keys(categoryCounts).length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-2xs font-semibold text-ink-3 uppercase tracking-wider shrink-0">Theme</span>
                {CATEGORY_RULES
                  .filter(r => categoryCounts[r.label])
                  .concat(categoryCounts['Other'] ? [{ label: 'Other', color: '#9ca3af', keywords: [] }] : [])
                  .map(rule => {
                    const on    = filters.categories.has(rule.label)
                    const count = categoryCounts[rule.label] ?? 0
                    return (
                      <button
                        key={rule.label}
                        onClick={() => toggleCategory(rule.label)}
                        style={on ? { backgroundColor: rule.color, borderColor: rule.color } : {}}
                        className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-2xs font-semibold transition-all ${
                          on ? 'text-white' : 'border-border bg-surface-dim text-ink-3 hover:border-ink-3'
                        }`}
                      >
                        {rule.label}
                        <span className={`font-mono text-2xs ${on ? 'text-white/60' : 'text-ink'}`}>{count}</span>
                      </button>
                    )
                  })}
              </div>
            )}

            {/* Score + R/R sliders */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <SliderFilter
                label="Min Score"
                value={filters.minScore}
                min={0} max={100} step={5}
                display={v => v === 0 ? 'Any' : `${v}+`}
                color={filters.minScore >= 70 ? '#059669' : filters.minScore >= 50 ? '#d97706' : '#6b7280'}
                onChange={v => setFilters(p => ({ ...p, minScore: v }))}
              />
              <SliderFilter
                label="Min R/R"
                value={filters.minRR}
                min={0} max={10} step={0.5}
                display={v => v === 0 ? 'Any' : `${v}x+`}
                color={filters.minRR >= 3 ? '#059669' : filters.minRR >= 1.5 ? '#d97706' : '#6b7280'}
                onChange={v => setFilters(p => ({ ...p, minRR: v }))}
              />
            </div>
          </div>

          {/* ── Mobile card list ────────────────────────────────────────────── */}
          <div className="md:hidden divide-y divide-border">
            {loading ? (
              <div className="px-4 py-12 text-center text-sm text-ink-3">Loading ideas…</div>
            ) : filteredIdeas.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-ink-3">
                {ideas.length === 0 ? 'No ideas synced yet' : 'No ideas match — try adjusting the filters'}
              </div>
            ) : filteredIdeas.map(({ row, rr }, i) => {
              const isSelected = selected?.id === row.id
              const isMulti    = rowSourceList(row).length > 1
              return (
                <div
                  key={row.id}
                  onClick={() => setSelected(row)}
                  className={`px-4 py-3 cursor-pointer transition-colors active:bg-surface-dim ${
                    isSelected ? 'bg-blue-50 border-l-4 border-l-status-blue' :
                    isMulti    ? 'bg-amber-50/40 border-l-4 border-l-amber-400' :
                    'hover:bg-surface-dim'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-2xs text-ink-3 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                      <span className="font-mono text-sm font-bold text-ink">{row.normalized_symbol ?? row.symbol ?? '—'}</span>
                      {row.direction && (
                        <span className={`text-xs font-bold ${row.direction === 'long' ? 'text-status-green' : 'text-status-red'}`}>
                          {row.direction === 'long' ? '↑' : '↓'}
                        </span>
                      )}
                      <span className="truncate text-xs text-ink-3">{row.title}</span>
                    </div>
                    <StatusChip label={stateLabel(row.action_state)} variant={stateVariant(row.action_state)} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    {row.current_price != null && (
                      <span className="text-2xs font-mono text-ink-3">Price <span className="text-ink">{money(row.current_price)}</span></span>
                    )}
                    {(row.entry_min || row.ideal_entry) && (
                      <span className="text-2xs font-mono text-ink-3">Entry <span className="text-ink">{entryRange(row.entry_min, row.entry_max, row.ideal_entry)}</span></span>
                    )}
                    {row.stop_loss != null && (
                      <span className="text-2xs font-mono text-ink-3">Stop <span className="text-status-red">{money(row.stop_loss)}</span></span>
                    )}
                    {row.take_profit_1 != null && (
                      <span className="text-2xs font-mono text-ink-3">TP1 <span className="text-status-green">{money(row.take_profit_1)}</span></span>
                    )}
                    {rr != null && (
                      <span className="text-2xs font-mono text-ink-3">R/R <span className="text-ink">{rr.toFixed(1)}x</span></span>
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Score value={row.total_score} />
                      {isMulti && <span className="text-2xs font-semibold text-amber-600">{rowSourceList(row).length}× sources</span>}
                      <span className="text-2xs text-ink-3 uppercase tracking-wide">
                        {rowSourceList(row).slice(0, 2).map(sourceLabel).join(' · ') || '—'}
                      </span>
                    </div>
                    <span className="text-2xs text-ink-3 shrink-0">{formatAge(row.updated_at)}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── Desktop table ─────────────────────────────────────────────── */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-dim border-b border-border">
                  {['RNK', 'SOURCES', 'IDEA', 'STATE', 'SCORE', 'PRICE', 'ENTRY', 'STOP', 'TP1', 'R/R', 'UPDATED'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-2xs font-semibold tracking-widest text-ink-3 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr><td colSpan={11} className="px-4 py-12 text-center text-sm text-ink-3">Loading ideas…</td></tr>
                ) : filteredIdeas.length === 0 ? (
                  <tr><td colSpan={11} className="px-4 py-12 text-center text-sm text-ink-3">
                    {ideas.length === 0 ? 'No ideas synced yet' : 'No ideas match — try adjusting the filters'}
                  </td></tr>
                ) : filteredIdeas.map(({ row, rr }, i) => {
                  const isSelected = selected?.id === row.id
                  const isMulti    = rowSourceList(row).length > 1
                  return (
                    <tr
                      key={row.id}
                      onClick={() => setSelected(row)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-50 border-l-2 border-l-status-blue' :
                        isMulti    ? 'bg-amber-50/40 hover:bg-amber-50/70 border-l-2 border-l-amber-400' :
                        'hover:bg-surface-dim'
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-ink-3">{String(i + 1).padStart(2, '0')}</td>
                      <td className="px-4 py-3">
                        {(() => {
                          const srcs = rowSourceList(row)
                          return srcs.length > 1 ? (
                            <div className="flex flex-col gap-0.5">
                              {srcs.slice(0, 3).map((src, j) => (
                                <span key={j} className={`text-2xs font-semibold uppercase tracking-widest ${j === 0 ? 'text-ink' : 'text-ink-3'}`}>
                                  {sourceLabel(src)}
                                </span>
                              ))}
                              {srcs.length > 3 && <span className="text-2xs text-ink-3">+{srcs.length - 3} more</span>}
                            </div>
                          ) : (
                            <span className="text-2xs font-semibold uppercase tracking-widest text-ink-3">{sourceLabel(srcs[0])}</span>
                          )
                        })()}
                      </td>
                      <td className="px-4 py-3 min-w-[260px]">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-ink">{row.normalized_symbol ?? row.symbol ?? '—'}</span>
                          {row.direction && (
                            <span className={`text-2xs font-semibold ${row.direction === 'long' ? 'text-status-green' : 'text-status-red'}`}>
                              {row.direction === 'long' ? '↑' : '↓'}
                            </span>
                          )}
                          {row.asset_class && <span className="text-2xs text-ink-3 uppercase">{row.asset_class}</span>}
                        </div>
                        <div className="text-sm font-medium text-ink mt-0.5 line-clamp-1">{row.title}</div>
                        {row.why_now && <div className="text-2xs text-ink-3 mt-0.5 line-clamp-1">{row.why_now}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <StatusChip label={stateLabel(row.action_state)} variant={stateVariant(row.action_state)} />
                      </td>
                      <td className="px-4 py-3"><Score value={row.total_score} /></td>
                      <td className="px-4 py-3 font-mono text-xs text-ink">{money(row.current_price)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-ink">{entryRange(row.entry_min, row.entry_max, row.ideal_entry)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-status-red">{money(row.stop_loss)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-status-green">{money(row.take_profit_1)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-ink">{rr != null ? `${rr.toFixed(1)}x` : '—'}</td>
                      <td className="px-4 py-3 text-xs text-ink-3 whitespace-nowrap">{formatAge(row.updated_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Latest Idea Events">
          <div className="divide-y divide-border">
            {events.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-ink-3">
                {loading ? 'Loading…' : 'No idea events yet'}
              </div>
            ) : events.map(event => (
              <div key={event.id} className="px-4 py-3 flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-ink">
                    {event.symbol ?? 'IDEA'} · {stateLabel(event.action_state ?? event.event_type)}
                  </div>
                  <div className="text-xs text-ink-3 mt-0.5">{event.detail ?? event.title}</div>
                </div>
                <div className="text-2xs font-mono text-ink-3 whitespace-nowrap">{formatAge(event.event_at)}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <IdeaDrawer idea={selected} onClose={closeDrawer} />
    </>
  )
}

// ── SliderFilter ────────────────────────────────────────────────────────────

function SliderFilter({
  label, value, min, max, step, display, color, onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  display: (v: number) => string
  color: string
  onChange: (v: number) => void
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-2xs font-semibold text-ink-3 uppercase tracking-wider">{label}</span>
        <span className="text-2xs font-mono font-semibold" style={{ color: value > min ? color : undefined }}>
          {display(value)}
        </span>
      </div>
      <div className="relative h-5 flex items-center">
        {/* Track */}
        <div className="absolute inset-x-0 h-1 rounded-full bg-surface-dim overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, backgroundColor: value > min ? color : '#e5e0e1' }}
          />
        </div>
        {/* Input */}
        <input
          type="range"
          min={min} max={max} step={step}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="relative w-full h-1 appearance-none bg-transparent cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white
            [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-border
            [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:cursor-pointer
            [&::-webkit-slider-thumb]:transition-colors
            [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4
            [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white
            [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-border
            [&::-moz-range-thumb]:cursor-pointer"
        />
      </div>
      {/* Tick marks: min and max labels */}
      <div className="flex justify-between">
        <span className="text-2xs text-ink-3 font-mono">{display(min)}</span>
        <span className="text-2xs text-ink-3 font-mono">{display(max)}</span>
      </div>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <div className="px-4 py-3">
        <div className="text-2xs font-semibold tracking-widest text-ink-3 uppercase">{label}</div>
        <div className="text-xl font-semibold text-ink mt-1">{value}</div>
      </div>
    </Card>
  )
}

function Score({ value }: { value?: number | null }) {
  if (value == null || Number.isNaN(Number(value))) return <span className="font-mono text-xs text-ink-3">—</span>
  const score = Math.max(0, Math.min(100, Number(value)))
  const color = score >= 70 ? 'bg-status-green' : score >= 50 ? 'bg-status-amber' : 'bg-status-red'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-dim">
        <div className={`h-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="font-mono text-xs font-semibold text-ink">{Math.round(score)}</span>
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function rowSourceList(row: { source: string; sources?: string[] | null }): string[] {
  if (row.sources && row.sources.length > 0) return row.sources
  if (!row.source) return []
  return row.source.split(';').map(s => s.trim()).filter(Boolean)
}

function sourceLabel(source?: string | null) {
  if (!source) return 'Unknown'
  const s = source.toLowerCase().trim()
  if (s === 'realvision') return 'RealVision'
  if (s === 'sec_13f' || s.endsWith('_13f')) return '13F'
  return source.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function stateLabel(state?: string | null) {
  const map: Record<string, string> = {
    ready: 'Ready', wait_for_entry: 'Wait Entry', chasing_risk: 'Do Not Chase',
    exit_trim: 'Exit / Trim', invalidated: 'Invalidated', research: 'Research',
    action_state_snapshot: 'Snapshot',
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

function money(v?: number | null) {
  if (v == null || Number.isNaN(Number(v))) return '—'
  const n = Number(v)
  if (Math.abs(n) < 0.01) return `$${n.toPrecision(4)}`
  if (Math.abs(n) < 1)    return `$${n.toFixed(4)}`
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}

function entryRange(min?: number | null, max?: number | null, fallback?: number | null) {
  if (min != null && max != null) return `${money(min)}–${money(max)}`
  return money(fallback)
}

function rrRatioNum(entry?: number | null, stop?: number | null, tp?: number | null): number | null {
  if (!entry || !stop || !tp) return null
  const risk   = Math.abs(entry - stop)
  const reward = Math.abs(tp - entry)
  if (risk === 0) return null
  return reward / risk
}
