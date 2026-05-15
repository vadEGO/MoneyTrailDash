'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import Link from 'next/link'
import type { TradeIdeaDetail, ChartOverlayLevel, MarketCandle } from '@/lib/types'
import StatusChip from '@/components/ui/StatusChip'
import Card from '@/components/ui/Card'

// ─── helpers ────────────────────────────────────────────────────────────────

function fmt(p: number | null | undefined): string {
  if (p == null) return '—'
  if (p >= 1000) return `$${p.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  if (p >= 1) return `$${p.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  return `$${p.toFixed(4)}`
}

// ─── SVG Price Chart ─────────────────────────────────────────────────────────

interface ChartProps {
  candles: MarketCandle[]
  levels: ChartOverlayLevel[]
}

function PriceChart({ candles, levels }: ChartProps) {
  const W = 580
  const H = 300
  const PAD_L = 60
  const PAD_R = 70
  const PAD_T = 16
  const PAD_B = 24

  // Collect all relevant prices to compute y-axis range
  const allPrices: number[] = [
    ...candles.flatMap(c => [c.high, c.low, c.close, c.open].filter((v): v is number => v != null)),
    ...levels.map(l => l.price),
  ]

  if (allPrices.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 bg-surface-dim border border-border rounded text-ink-3 text-sm">
        No price data — levels will appear once candles are synced
      </div>
    )
  }

  const minP = Math.min(...allPrices) * 0.97
  const maxP = Math.max(...allPrices) * 1.03
  const priceRange = maxP - minP

  const toY = (p: number) => PAD_T + (H - PAD_T - PAD_B) * (1 - (p - minP) / priceRange)
  const candleW = candles.length > 0
    ? Math.max(2, Math.min(8, (W - PAD_L - PAD_R) / candles.length - 1))
    : 6

  // X positions for candles
  const chartW = W - PAD_L - PAD_R
  const toX = (i: number) => PAD_L + (i + 0.5) * (chartW / Math.max(candles.length, 1))

  // Level styling
  const levelStyle: Record<string, { stroke: string; dash: string; label: string }> = {
    entry_min:  { stroke: '#059669', dash: '4,3',  label: 'Entry min' },
    entry_max:  { stroke: '#059669', dash: '4,3',  label: 'Entry max' },
    stop_loss:  { stroke: '#e02424', dash: '0',     label: 'Stop' },
    tp1:        { stroke: '#059669', dash: '6,3',  label: 'TP1' },
    tp2:        { stroke: '#059669', dash: '6,3',  label: 'TP2' },
    tp3:        { stroke: '#059669', dash: '6,3',  label: 'TP3' },
    resistance: { stroke: '#d97706', dash: '3,3',  label: 'R' },
    support:    { stroke: '#2563eb', dash: '3,3',  label: 'S' },
  }

  // Find entry zone for shading
  const entryMin = levels.find(l => l.level_type === 'entry_min')?.price
  const entryMax = levels.find(l => l.level_type === 'entry_max')?.price

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      {/* Background */}
      <rect x={PAD_L} y={PAD_T} width={chartW} height={H - PAD_T - PAD_B} fill="#f8f8f8" />

      {/* Entry zone shading */}
      {entryMin != null && entryMax != null && (
        <rect
          x={PAD_L}
          y={toY(entryMax)}
          width={chartW}
          height={Math.abs(toY(entryMin) - toY(entryMax))}
          fill="#059669"
          fillOpacity={0.08}
        />
      )}

      {/* Candles */}
      {candles.map((c, i) => {
        if (c.open == null || c.close == null || c.high == null || c.low == null) return null
        const x = toX(i)
        const isUp = c.close >= c.open
        const color = isUp ? '#059669' : '#e02424'
        const bodyTop = toY(Math.max(c.open, c.close))
        const bodyBot = toY(Math.min(c.open, c.close))
        const bodyH = Math.max(1, bodyBot - bodyTop)
        return (
          <g key={i}>
            <line x1={x} y1={toY(c.high)} x2={x} y2={toY(c.low)} stroke={color} strokeWidth="1" />
            <rect x={x - candleW / 2} y={bodyTop} width={candleW} height={bodyH} fill={color} />
          </g>
        )
      })}

      {/* Level lines */}
      {levels.map((level, i) => {
        const style = levelStyle[level.level_type] ?? { stroke: '#4c4546', dash: '2,2', label: level.level_type }
        const y = toY(level.price)
        if (y < PAD_T - 4 || y > H - PAD_B + 4) return null
        return (
          <g key={`level-${i}`}>
            <line
              x1={PAD_L} y1={y} x2={W - PAD_R} y2={y}
              stroke={style.stroke}
              strokeWidth="1.5"
              strokeDasharray={style.dash}
              opacity="0.9"
            />
            {/* Right label */}
            <rect x={W - PAD_R + 2} y={y - 9} width={PAD_R - 4} height={14} rx="2" fill={style.stroke} fillOpacity="0.12" />
            <text x={W - PAD_R + 5} y={y + 2} fontSize="9" fill={style.stroke} fontFamily="monospace" fontWeight="600">
              {style.label} {fmt(level.price).replace('$', '')}
            </text>
          </g>
        )
      })}

      {/* Y-axis price labels */}
      {[0, 0.25, 0.5, 0.75, 1].map(frac => {
        const price = minP + frac * priceRange
        const y = toY(price)
        return (
          <g key={frac}>
            <line x1={PAD_L - 4} y1={y} x2={PAD_L} y2={y} stroke="#e5e5e5" />
            <text x={PAD_L - 6} y={y + 3} fontSize="9" fill="#7e7576" textAnchor="end" fontFamily="monospace">
              {fmt(price).replace('$', '')}
            </text>
          </g>
        )
      })}

      {/* Border */}
      <rect x={PAD_L} y={PAD_T} width={chartW} height={H - PAD_T - PAD_B}
        fill="none" stroke="#e5e5e5" strokeWidth="1" />
    </svg>
  )
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
              <div className="p-4">
                <PriceChart candles={candles} levels={levels} />
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
