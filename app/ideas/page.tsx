'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase-client'
import type { OpportunityAction, OpportunityEngineEvent } from '@/lib/types'
import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import StatusChip from '@/components/ui/StatusChip'
import IdeaDrawer from '@/components/IdeaDrawer'
import { formatAge } from '@/lib/fmt'

export default function IdeasPage() {
  const [ideas, setIdeas]   = useState<OpportunityAction[]>([])
  const [events, setEvents] = useState<OpportunityEngineEvent[]>([])
  const [selected, setSelected] = useState<OpportunityAction | null>(null)
  const [loading, setLoading]   = useState(true)

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

  const sourceCounts = ideas.reduce<Record<string, number>>((acc, row) => {
    const s = sourceLabel(row.source)
    acc[s] = (acc[s] ?? 0) + 1
    return acc
  }, {})
  const ready   = ideas.filter(r => r.action_state === 'ready').length
  const waiting = ideas.filter(r => r.action_state === 'wait_for_entry').length
  const risk    = ideas.filter(r => ['chasing_risk', 'invalidated'].includes(r.action_state)).length

  return (
    <>
      <div className="space-y-4">
        <PageHeader
          title="Ideas"
          subtitle="Multi-source trade idea feed. Click any row to see the chart, levels, thesis, and score breakdown."
          action={<span className="text-2xs font-mono text-ink-3 border border-border rounded px-2 py-1">RESEARCH ONLY</span>}
        />

        <div className="grid grid-cols-4 gap-3">
          <Metric label="Total Ideas" value={loading ? '…' : ideas.length} />
          <Metric label="Ready"       value={loading ? '…' : ready}   />
          <Metric label="Wait Entry"  value={loading ? '…' : waiting} />
          <Metric label="Risk Flags"  value={loading ? '…' : risk}    />
        </div>

        <Card title="Source Mix">
          <div className="px-4 py-3 flex flex-wrap gap-2">
            {Object.keys(sourceCounts).length === 0 ? (
              <span className="text-sm text-ink-3">{loading ? 'Loading…' : 'No sources synced yet'}</span>
            ) : Object.entries(sourceCounts).map(([source, count]) => (
              <span key={source} className="inline-flex items-center gap-2 rounded-sm border border-border bg-surface-dim px-2 py-1">
                <span className="text-2xs font-semibold uppercase tracking-widest text-ink-3">{source}</span>
                <span className="font-mono text-xs text-ink">{count}</span>
              </span>
            ))}
          </div>
        </Card>

        <Card title="Idea Feed — click any row for chart & detail">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-dim border-b border-border">
                  {['RNK', 'SOURCE', 'IDEA', 'STATE', 'SCORE', 'PRICE', 'ENTRY', 'STOP', 'TP1', 'R/R', 'UPDATED'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-2xs font-semibold tracking-widest text-ink-3 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr><td colSpan={11} className="px-4 py-12 text-center text-sm text-ink-3">Loading ideas…</td></tr>
                ) : ideas.length === 0 ? (
                  <tr><td colSpan={11} className="px-4 py-12 text-center text-sm text-ink-3">No ideas synced yet</td></tr>
                ) : ideas.map((row, i) => {
                  const entryMid = row.ideal_entry ?? ((row.entry_min && row.entry_max)
                    ? (row.entry_min + row.entry_max) / 2 : row.entry_min)
                  const rrVal = rrRatio(entryMid, row.stop_loss, row.take_profit_1)
                  const isSelected = selected?.id === row.id

                  return (
                    <tr
                      key={row.id}
                      onClick={() => setSelected(row)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-50 border-l-2 border-l-status-blue'
                          : 'hover:bg-surface-dim'
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-ink-3">{String(i + 1).padStart(2, '0')}</td>
                      <td className="px-4 py-3">
                        <span className="text-2xs font-semibold uppercase tracking-widest text-ink-3">{sourceLabel(row.source)}</span>
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
                        {row.why_now && (
                          <div className="text-2xs text-ink-3 mt-0.5 line-clamp-1">{row.why_now}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusChip label={stateLabel(row.action_state)} variant={stateVariant(row.action_state)} />
                      </td>
                      <td className="px-4 py-3"><Score value={row.total_score} /></td>
                      <td className="px-4 py-3 font-mono text-xs text-ink">{money(row.current_price)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-ink">{entryRange(row.entry_min, row.entry_max, row.ideal_entry)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-status-red">{money(row.stop_loss)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-status-green">{money(row.take_profit_1)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-ink">{rrVal ? `${rrVal}x` : '—'}</td>
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

      {/* Slide-over drawer — mounts outside the scrollable page */}
      <IdeaDrawer idea={selected} onClose={closeDrawer} />
    </>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

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

// ── Helpers ────────────────────────────────────────────────────────────────

function sourceLabel(source?: string | null) {
  if (!source) return 'Unknown'
  if (source.toLowerCase() === 'realvision') return 'RealVision'
  return source.replace(/[_-]/g, ' ')
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

function rrRatio(entry?: number | null, stop?: number | null, tp?: number | null): string | null {
  if (!entry || !stop || !tp) return null
  const risk   = Math.abs(entry - stop)
  const reward = Math.abs(tp - entry)
  if (risk === 0) return null
  return (reward / risk).toFixed(1)
}
