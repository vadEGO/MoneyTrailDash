'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import Link from 'next/link'
import type { PublicResearch, PublicLilo, PublicTpLayer, SignalRadarRow, DashboardSnapshot } from '@/lib/types'
import StatusChip from '@/components/ui/StatusChip'
import Card from '@/components/ui/Card'

function formatPrice(p: number | null | undefined): string {
  if (p == null) return '—'
  if (p > 1000) return `$${p.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  if (p > 1) return `$${p.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  return `$${p.toFixed(4)}`
}

function computeDca(lilo: PublicLilo): number[] {
  if (lilo.entry_min == null || lilo.entry_max == null) return []
  const count = lilo.aggression_level === 'conservative' ? 5 : lilo.aggression_level === 'aggressive' ? 2 : 3
  if (count <= 1) return [lilo.entry_min]
  const step = (lilo.entry_max - lilo.entry_min) / (count - 1)
  return Array.from({ length: count }, (_, i) => lilo.entry_max! - i * step)
}

export default function AssetDetailPage({ params }: { params: { symbol: string } }) {
  const { symbol } = params
  const [research, setResearch] = useState<PublicResearch | null>(null)
  const [lilo, setLilo] = useState<PublicLilo | null>(null)
  const [tpLayers, setTpLayers] = useState<PublicTpLayer[]>([])
  const [signal, setSignal] = useState<SignalRadarRow | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const [r, l, t, s] = await Promise.all([
        supabase.from('public_research').select('*').eq('symbol', symbol).limit(1).single(),
        supabase.from('public_lilo').select('*').eq('asset', symbol).limit(1).single(),
        supabase.from('public_tp_layers').select('*').eq('asset', symbol).order('layer_number'),
        supabase.from('dashboard_snapshots').select('signal_radar').order('generated_at', { ascending: false, nullsFirst: false }).limit(1).single(),
      ])
      setResearch(r.data ?? null)
      setLilo(l.data ?? null)
      setTpLayers(t.data ?? [])
      const snap = s.data as Pick<DashboardSnapshot, 'signal_radar'> | null
      setSignal(snap?.signal_radar?.find(x => x.symbol === symbol) ?? null)
        setLoading(false)
    }
    load()
  }, [symbol])

  if (loading) {
    return <div className="flex items-center justify-center h-48 text-ink-3 text-sm font-mono">Loading {symbol}…</div>
  }

  const dcaLevels = lilo ? computeDca(lilo) : []
  const pendingTp = tpLayers.filter(l => l.status === 'pending').sort((a, b) => (a.layer_number ?? 0) - (b.layer_number ?? 0))

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-2xs font-mono text-ink-3 mb-3 uppercase tracking-widest">
        <Link href="/watchlist" className="hover:text-ink transition-colors">← Watchlist</Link>
        <span>/</span>
        <span>{symbol}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink">{symbol}
            {research?.asset && research.asset !== symbol && (
              <span className="text-ink-3 font-normal text-base ml-2">{research.asset}</span>
            )}
          </h1>
          {research?.asset_type && <div className="text-xs font-mono text-ink-3 mt-0.5 uppercase">{research.asset_type}</div>}
        </div>
        {signal && (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="bg-surface border border-border rounded px-3 py-2 text-center">
              <div className="text-2xs font-semibold tracking-widest text-ink-3 uppercase">Signal Score</div>
              <div className={`font-mono text-lg font-bold mt-0.5 ${(signal.signal_score ?? 0) >= 70 ? 'text-status-green' : 'text-status-amber'}`}>
                {signal.signal_score?.toFixed(0) ?? '—'}
              </div>
            </div>
            <div className="bg-surface border border-border rounded px-3 py-2 text-center">
              <div className="text-2xs font-semibold tracking-widest text-ink-3 uppercase">Sentiment</div>
              <div className="text-sm font-semibold mt-0.5 capitalize text-ink">{signal.sentiment ?? '—'}</div>
            </div>
            <div className="bg-surface border border-border rounded px-3 py-2 text-center">
              <div className="text-2xs font-semibold tracking-widest text-ink-3 uppercase">Sources</div>
              <div className="font-mono text-lg font-bold mt-0.5 text-ink">{signal.source_count ?? '—'}</div>
            </div>
            {signal.status && <StatusChip label={signal.status.replace('_', ' ')} variant={signal.status === 'tradeable' ? 'green' : 'grey'} />}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Research */}
        <Card title="Research Pack" action={research?.final_decision ? (
          <StatusChip label={research.final_decision} variant={research.final_decision === 'accept' ? 'green' : research.final_decision === 'reject' ? 'red' : 'amber'} />
        ) : undefined}>
          {!research ? (
            <div className="px-4 py-8 text-sm text-ink-3 text-center">No research pack yet</div>
          ) : (
            <div className="p-4 space-y-4">
              {research.research_summary && (
                <p className="text-sm text-ink-2 leading-relaxed">{research.research_summary}</p>
              )}
              <div className="grid grid-cols-2 gap-3">
                {research.bull_case && (
                  <div className="border border-border rounded p-3 border-l-2 border-l-status-green">
                    <div className="text-2xs font-semibold text-status-green uppercase tracking-wide mb-1.5">Bull Case</div>
                    <p className="text-xs text-ink-2 leading-relaxed">{research.bull_case}</p>
                  </div>
                )}
                {research.bear_case && (
                  <div className="border border-border rounded p-3 border-l-2 border-l-status-red">
                    <div className="text-2xs font-semibold text-status-red uppercase tracking-wide mb-1.5">Bear Case</div>
                    <p className="text-xs text-ink-2 leading-relaxed">{research.bear_case}</p>
                  </div>
                )}
              </div>
              {research.risks && (
                <div className="border border-border rounded p-3 bg-surface-dim">
                  <div className="text-2xs font-semibold text-status-amber uppercase tracking-wide mb-1.5">Risks</div>
                  <p className="text-xs text-ink-2 leading-relaxed">{research.risks}</p>
                </div>
              )}
              <div className="flex items-center gap-4 pt-1 border-t border-border text-2xs font-mono text-ink-3">
                {research.evidence_quality_score != null && <span>Evidence: {research.evidence_quality_score.toFixed(1)}/10</span>}
                {research.thesis_fit_score != null && <span>Thesis fit: {research.thesis_fit_score.toFixed(1)}/10</span>}
              </div>
            </div>
          )}
        </Card>

        {/* LILO + DCA */}
        <div className="space-y-4">
          <Card title="LILO Plan">
            {!lilo ? (
              <div className="px-4 py-8 text-sm text-ink-3 text-center">No LILO plan yet</div>
            ) : (
              <div className="p-4 space-y-4">
                <div className="flex flex-wrap gap-2">
                  {lilo.position_role && <StatusChip label={lilo.position_role} variant="grey" />}
                  {lilo.aggression_level && <StatusChip label={lilo.aggression_level} variant="blue" dot={false} />}
                </div>
                {(lilo.entry_min != null || lilo.entry_max != null) && (
                  <div className="bg-surface-dim rounded p-3 space-y-1.5">
                    <div className="text-2xs font-semibold text-ink-3 uppercase tracking-widest mb-2">Entry Plan</div>
                    {lilo.entry_min != null && lilo.entry_max != null && (
                      <div className="flex justify-between text-xs">
                        <span className="text-ink-3">Range</span>
                        <span className="font-mono text-ink">{formatPrice(lilo.entry_min)} – {formatPrice(lilo.entry_max)}</span>
                      </div>
                    )}
                    {lilo.stop_price != null && (
                      <div className="flex justify-between text-xs">
                        <span className="text-ink-3">Stop</span>
                        <span className="font-mono text-status-red">{formatPrice(lilo.stop_price)}</span>
                      </div>
                    )}
                    {lilo.risk_per_position_pct != null && (
                      <div className="flex justify-between text-xs">
                        <span className="text-ink-3">Risk</span>
                        <span className="font-mono text-ink">{lilo.risk_per_position_pct}%</span>
                      </div>
                    )}
                  </div>
                )}
                {pendingTp.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-2xs font-semibold text-ink-3 uppercase tracking-widest">Take-Profit Layers</div>
                    {pendingTp.map(tp => (
                      <div key={tp.id} className="flex items-center gap-2 border border-border rounded-sm px-3 py-2">
                        <span className="text-2xs font-mono text-status-green font-bold w-6">TP{tp.layer_number}</span>
                        <span className="font-mono text-sm text-ink">{formatPrice(tp.target_price)}</span>
                        {tp.sell_percentage != null && <span className="text-xs text-ink-3">→ sell {tp.sell_percentage}%</span>}
                      </div>
                    ))}
                  </div>
                )}
                {lilo.thesis_invalidation && (
                  <div className="border-t border-border pt-3">
                    <div className="text-2xs font-semibold text-ink-3 uppercase tracking-widest mb-1">Invalidation</div>
                    <p className="text-xs text-ink-2">{lilo.thesis_invalidation}</p>
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card title="DCA Plan">
            {dcaLevels.length === 0 ? (
              <div className="px-4 py-6 text-sm text-ink-3 text-center">No entry levels defined</div>
            ) : (
              <div className="p-4 space-y-2">
                <div className="text-xs text-ink-3 mb-3">
                  Range: <span className="font-mono text-ink">{formatPrice(lilo?.entry_min)} – {formatPrice(lilo?.entry_max)}</span>
                  {lilo?.aggression_level && <span className="ml-2 capitalize text-ink-3">({lilo.aggression_level})</span>}
                </div>
                {dcaLevels.map((price, i) => (
                  <div key={i} className="flex items-center gap-3 border border-border rounded-sm px-3 py-2">
                    <span className="text-2xs font-mono text-status-blue font-bold w-6">#{i + 1}</span>
                    <span className="font-mono text-sm text-ink">{formatPrice(price)}</span>
                    <span className="text-xs text-ink-3 ml-auto">{Math.round(100 / dcaLevels.length)}%</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
