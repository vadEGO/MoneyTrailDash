'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import Link from 'next/link'
import type { TradeIdeaDetail, ChartOverlayLevel, MarketCandle } from '@/lib/types'
import StatusChip from '@/components/ui/StatusChip'
import Card from '@/components/ui/Card'
import TradingViewChart from '@/components/TradingViewChart'

// ─── helpers ────────────────────────────────────────────────────────────────

function fmt(p: number | null | undefined): string {
  if (p == null) return '—'
  if (p >= 1000) return `$${p.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  if (p >= 1) return `$${p.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  return `$${p.toFixed(4)}`
}

// ─── Score bar ───────────────────────────────────────────────────────────────

function ScoreRow({ label, score, max }: { label: string; score: number | null; max: number }) {
  const pct = score != null ? Math.min(100, (score / max) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <span className="text-2xs text-ink-3 w-32 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-surface-dim rounded-full overflow-hidden">
        <div className="h-full bg-black rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-2xs text-ink w-12 text-right">
        {score != null ? `${score.toFixed(0)}/${max}` : `—/${max}`}
      </span>
    </div>
  )
}

// ─── Level legend ────────────────────────────────────────────────────────────

function LevelLegend() {
  const items = [
    { color: '#059669', dash: false, label: 'Entry zone' },
    { color: '#e02424', dash: false, label: 'Stop loss' },
    { color: '#059669', dash: true,  label: 'Take profit' },
    { color: '#d97706', dash: true,  label: 'Resistance' },
    { color: '#2563eb', dash: true,  label: 'Support' },
  ]
  return (
    <div className="flex flex-wrap gap-3 mt-2">
      {items.map(item => (
        <div key={item.label} className="flex items-center gap-1.5">
          <svg width="16" height="8" viewBox="0 0 16 8">
            <line x1="0" y1="4" x2="16" y2="4"
              stroke={item.color} strokeWidth="1.5"
              strokeDasharray={item.dash ? '4,2' : '0'} />
          </svg>
          <span className="text-2xs text-ink-3">{item.label}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function IdeaSymbolPage({ params }: { params: { symbol: string } }) {
  const { symbol } = params
  const [idea, setIdea] = useState<TradeIdeaDetail | null>(null)
  const [levels, setLevels] = useState<ChartOverlayLevel[]>([])
  const [candles, setCandles] = useState<MarketCandle[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'overview' | 'history'>('overview')

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const [ideaRes, levelsRes, candlesRes] = await Promise.all([
        supabase
          .from('public_symbol_trade_ideas' as 'dashboard_snapshots')
          .select('*')
          .eq('symbol', symbol)
          .limit(1)
          .single(),
        supabase
          .from('public_symbol_chart_overlays' as 'dashboard_snapshots')
          .select('*')
          .eq('symbol', symbol),
        supabase
          .from('market_candles')
          .select('*')
          .eq('symbol', symbol)
          .eq('interval', '1d')
          .order('ts', { ascending: true })
          .limit(90),
      ])
      setIdea((ideaRes.data as unknown as TradeIdeaDetail) ?? null)
      setLevels((levelsRes.data as unknown as ChartOverlayLevel[]) ?? [])
      setCandles((candlesRes.data as unknown as MarketCandle[]) ?? [])
      setLoading(false)
    }
    load()
  }, [symbol])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-ink-3 text-sm font-mono">
        Loading {symbol}…
      </div>
    )
  }

  const resistanceLevels = levels.filter(l => l.level_type === 'resistance')
  const supportLevels = levels.filter(l => l.level_type === 'support')

  // Score components
  const scoreComponents = idea ? [
    { label: 'Source quality',    score: idea.source_quality,      max: 15 },
    { label: 'Evidence quality',  score: idea.evidence_quality,    max: 15 },
    { label: 'Technical setup',   score: idea.technical_setup,     max: 15 },
    { label: 'Risk / reward',     score: idea.risk_reward_score,   max: 15 },
    { label: 'Thesis fit',        score: idea.thesis_fit,          max: 15 },
    { label: 'Macro / liquidity', score: idea.macro_liquidity_fit, max: 10 },
    { label: 'Portfolio relevance', score: idea.portfolio_relevance, max: 10 },
    { label: 'Freshness',         score: idea.freshness,           max: 5  },
  ] : []

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-2xs font-mono text-ink-3 mb-3 uppercase tracking-widest">
        <Link href="/ideas" className="hover:text-ink transition-colors">← Ideas</Link>
        <span>/</span>
        <span>{symbol}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink">
            {symbol}
            {idea?.asset_name && idea.asset_name !== symbol && (
              <span className="text-ink-3 font-normal text-base ml-2">{idea.asset_name}</span>
            )}
          </h1>
          {idea?.asset_class && (
            <div className="text-xs font-mono text-ink-3 mt-0.5 uppercase">{idea.asset_class}</div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {idea?.direction && (
            <span className={`text-sm font-semibold ${
              idea.direction === 'long' ? 'text-status-green'
              : idea.direction === 'short' ? 'text-status-red'
              : 'text-status-amber'
            }`}>
              {idea.direction === 'long' ? 'Long ↑' : idea.direction === 'short' ? 'Short ↓' : 'Watch —'}
            </span>
          )}
          {idea?.decision && (
            <StatusChip
              label={idea.decision.replace(/_/g, ' ')}
              variant={idea.decision === 'setup_active' ? 'green' : idea.decision === 'avoid' ? 'red' : idea.decision === 'watch_for_entry' ? 'blue' : 'grey'}
            />
          )}
          {idea?.total_score != null && (
            <div className="bg-surface border border-border rounded px-3 py-1.5 text-center">
              <span className="text-2xs text-ink-3 block">SCORE</span>
              <span className="font-mono font-bold text-ink">{idea.total_score.toFixed(0)}/100</span>
            </div>
          )}
          <span className="text-2xs font-mono text-ink-3 border border-border rounded px-2 py-1">
            RESEARCH ONLY
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border mb-4">
        {(['overview', 'history'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs font-semibold uppercase tracking-widest transition-colors ${
              tab === t
                ? 'border-b-2 border-black text-ink'
                : 'text-ink-3 hover:text-ink'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-5 gap-4">
          {/* Chart — 3/5 */}
          <div className="col-span-3 space-y-3">
            <Card title="Price Chart" action={
              <span className="text-2xs font-mono text-ink-3">
                {candles.length > 0 ? `${candles.length}d candles` : 'Levels only'}
              </span>
            }>
              <div className="p-2">
                <TradingViewChart candles={candles} levels={levels} symbol={symbol} height={380} />
                <LevelLegend />
                {resistanceLevels.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="text-2xs text-ink-3 font-semibold uppercase tracking-wide">Resistance:</span>
                    {resistanceLevels.map((r, i) => (
                      <span key={i} className="text-2xs font-mono text-status-amber bg-amber-50 border border-amber-200 rounded-sm px-1.5 py-0.5">
                        {fmt(r.price)}{r.label ? ` (${r.label})` : ''}
                        {r.source === 'rv_explicit' ? ' ✓' : ' ≈'}
                      </span>
                    ))}
                  </div>
                )}
                {supportLevels.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="text-2xs text-ink-3 font-semibold uppercase tracking-wide">Support:</span>
                    {supportLevels.map((s, i) => (
                      <span key={i} className="text-2xs font-mono text-status-blue bg-blue-50 border border-blue-200 rounded-sm px-1.5 py-0.5">
                        {fmt(s.price)}{s.label ? ` (${s.label})` : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            {/* Plan details */}
            {idea && (
              <Card title="Plan Details">
                <div className="p-4 grid grid-cols-3 gap-3">
                  {[
                    { label: 'Entry range', value: (idea.entry_min != null && idea.entry_max != null) ? `${fmt(idea.entry_min)} – ${fmt(idea.entry_max)}` : fmt(idea.entry_min) },
                    { label: 'Stop loss',   value: <span className="text-status-red font-mono text-sm">{fmt(idea.stop_loss)}</span> },
                    { label: 'Risk / reward', value: idea.risk_reward ? `${idea.risk_reward.toFixed(1)}x` : '—' },
                    { label: 'TP1',         value: <span className="text-status-green font-mono text-sm">{fmt(idea.take_profit_1)}</span> },
                    { label: 'TP2',         value: <span className="text-status-green font-mono text-sm">{fmt(idea.take_profit_2)}</span> },
                    { label: 'TP3',         value: <span className="text-status-green font-mono text-sm">{fmt(idea.take_profit_3)}</span> },
                    { label: 'Author',      value: idea.source_author ?? '—' },
                    { label: 'RV rank',     value: idea.source_rank != null ? `#${idea.source_rank}` : '—' },
                    { label: 'P/L',         value: idea.pl_pct != null ? (
                      <span className={idea.pl_pct >= 0 ? 'text-status-green font-mono text-sm' : 'text-status-red font-mono text-sm'}>
                        {idea.pl_pct >= 0 ? '+' : ''}{idea.pl_pct.toFixed(1)}%
                      </span>
                    ) : '—' },
                  ].map(item => (
                    <div key={item.label} className="bg-surface-dim rounded p-3">
                      <div className="text-2xs text-ink-3 font-semibold uppercase tracking-widest mb-1">{item.label}</div>
                      <div className="text-sm text-ink font-medium">{item.value}</div>
                    </div>
                  ))}
                </div>
                <div className="px-4 pb-3 flex items-center gap-2">
                  <span className="text-2xs text-ink-3">Levels source:</span>
                  <StatusChip
                    label={idea.levels_source === 'rv_explicit' ? 'RV Explicit' : idea.levels_source === 'manual' ? 'Manual' : 'OpenClaw Derived'}
                    variant={idea.levels_source === 'rv_explicit' ? 'green' : 'grey'}
                    dot={false}
                  />
                </div>
              </Card>
            )}
          </div>

          {/* Score breakdown — 2/5 */}
          <div className="col-span-2 space-y-4">
            <Card title="Score Breakdown">
              <div className="p-4 space-y-2.5">
                {scoreComponents.map(c => (
                  <ScoreRow key={c.label} label={c.label} score={c.score} max={c.max} />
                ))}
                {idea?.total_score != null && (
                  <div className="pt-3 mt-1 border-t border-border flex items-center justify-between">
                    <span className="text-xs font-semibold text-ink">TOTAL</span>
                    <span className="font-mono font-bold text-lg text-ink">{idea.total_score.toFixed(0)}/100</span>
                  </div>
                )}
                {!idea && (
                  <div className="text-sm text-ink-3 text-center py-4">No score data yet</div>
                )}
              </div>
            </Card>

            {/* Source info */}
            {idea?.source_author && (
              <Card title="Source">
                <div className="p-4 space-y-2">
                  {[
                    { label: 'Source', value: 'realvision' },
                    { label: 'Author', value: idea.source_author },
                    { label: 'Rank',   value: idea.source_rank != null ? `#${idea.source_rank}` : '—' },
                    { label: 'Horizon', value: idea.time_horizon ?? '—' },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between">
                      <span className="text-xs text-ink-3">{row.label}</span>
                      <span className="text-xs text-ink font-medium capitalize">{row.value}</span>
                    </div>
                  ))}
                  {idea.source_url && (
                    <a
                      href={idea.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-2xs text-status-blue hover:underline mt-1 block"
                    >
                      View source →
                    </a>
                  )}
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {tab === 'history' && (
        <Card title="Past Ideas for this Symbol">
          <div className="px-4 py-8 text-center text-ink-3 text-sm">
            Closed ideas will appear here once the bot syncs historical RV data.
          </div>
        </Card>
      )}
    </div>
  )
}
