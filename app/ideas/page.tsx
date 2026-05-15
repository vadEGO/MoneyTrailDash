import { createClient } from '@/lib/supabase-server'
import type { TradeIdeaLeaderboardRow, MarketCandle } from '@/lib/types'
import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import StatusChip from '@/components/ui/StatusChip'
import Sparkline from '@/components/Sparkline'
import Link from 'next/link'

function formatPrice(p: number | null | undefined): string {
  if (p == null) return '—'
  if (p >= 1000) return `$${p.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  if (p >= 1) return `$${p.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  return `$${p.toFixed(4)}`
}

function ScoreBar({ score }: { score: number | null }) {
  if (score == null) return <span className="text-ink-3 text-xs font-mono">—</span>
  const pct = Math.min(100, Math.max(0, score))
  const color = pct >= 70 ? 'bg-status-green' : pct >= 50 ? 'bg-status-amber' : 'bg-status-red'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-surface-dim rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`font-mono text-xs font-semibold ${pct >= 70 ? 'text-status-green' : pct >= 50 ? 'text-status-amber' : 'text-status-red'}`}>
        {pct.toFixed(0)}
      </span>
    </div>
  )
}

function DirectionBadge({ direction }: { direction: string | null }) {
  if (!direction) return <span className="text-ink-3 text-xs">—</span>
  const map: Record<string, { label: string; cls: string }> = {
    long:  { label: 'Long ↑',  cls: 'text-status-green' },
    short: { label: 'Short ↓', cls: 'text-status-red' },
    watch: { label: 'Watch —', cls: 'text-status-amber' },
    pair:  { label: 'Pair ⇌',  cls: 'text-status-blue' },
  }
  const m = map[direction.toLowerCase()] ?? { label: direction, cls: 'text-ink-3' }
  return <span className={`text-xs font-semibold ${m.cls}`}>{m.label}</span>
}

function DecisionChip({ decision }: { decision: string | null }) {
  if (!decision) return <span className="text-ink-3 text-xs">—</span>
  const map: Record<string, { label: string; variant: 'green' | 'blue' | 'grey' | 'red' }> = {
    setup_active:      { label: 'Setup Active',    variant: 'green' },
    watch_for_entry:   { label: 'Watch Entry',     variant: 'blue' },
    research_further:  { label: 'Research More',   variant: 'grey' },
    avoid:             { label: 'Avoid',           variant: 'red' },
  }
  const m = map[decision] ?? { label: decision.replace('_', ' '), variant: 'grey' as const }
  return <StatusChip label={m.label} variant={m.variant} />
}

export default async function IdeasPage() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('public_trade_idea_leaderboard' as 'dashboard_snapshots')
    .select('*')
    .order('total_score', { ascending: false })

  const rows = (error ? [] : (data as unknown as TradeIdeaLeaderboardRow[])) ?? []
  const activeRows = rows.filter(r => r.status === 'active')

  // Fetch 7-day candles for all active symbols in one query
  const symbols = activeRows.map(r => r.symbol)
  const candleMap: Record<string, number[]> = {}

  if (symbols.length > 0) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
    const { data: candles } = await supabase
      .from('market_candles')
      .select('symbol, close, ts')
      .in('symbol', symbols)
      .eq('interval', '1d')
      .gte('ts', sevenDaysAgo)
      .order('ts', { ascending: true })
    ;(candles as unknown as Pick<MarketCandle, 'symbol' | 'close' | 'ts'>[] | null ?? [])
      .forEach(c => {
        if (c.close == null) return
        if (!candleMap[c.symbol]) candleMap[c.symbol] = []
        candleMap[c.symbol].push(c.close)
      })
  }

  return (
    <div>
      <PageHeader
        title="Trade Ideas"
        subtitle="Ranked by OpenClaw score — research only, no execution"
        action={
          <div className="flex items-center gap-2">
            <span className="text-2xs font-mono text-ink-3 border border-border rounded px-2 py-1">
              RESEARCH ONLY
            </span>
          </div>
        }
      />

      <Card>
        {activeRows.length === 0 ? (
          <div className="px-4 py-16 text-center space-y-3">
            <div className="text-4xl">📈</div>
            <div className="text-md font-semibold text-ink">No trade ideas yet</div>
            <p className="text-sm text-ink-3 max-w-sm mx-auto">
              Sync RV data to populate the leaderboard. Ideas will appear here ranked by OpenClaw score.
            </p>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="bg-surface-dim border-b border-border">
                  {['RNK', 'SYMBOL', 'CLASS', 'DIR', '7D', 'SCORE', 'R/R', 'ENTRY ZONE', 'DECISION', 'AUTHOR', 'P/L'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-2xs font-semibold tracking-widest text-ink-3 uppercase whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {activeRows.map((row, i) => (
                  <tr key={row.symbol} className="hover:bg-surface-dim transition-colors cursor-pointer">
                    <td className="px-4 py-3 font-mono text-xs text-ink-3">{String(i + 1).padStart(2, '0')}</td>
                    <td className="px-4 py-3">
                      <Link href={`/ideas/${row.symbol}`} className="group">
                        <div className="font-mono font-bold text-sm text-ink group-hover:text-status-blue transition-colors">
                          {row.symbol}
                        </div>
                        {row.asset_name && (
                          <div className="text-2xs text-ink-3 mt-0.5 truncate max-w-[120px]">{row.asset_name}</div>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {row.asset_class && (
                        <span className="text-2xs bg-surface-dim border border-border rounded-sm px-1.5 py-0.5 text-ink-3 capitalize">
                          {row.asset_class}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <DirectionBadge direction={row.direction} />
                    </td>
                    <td className="px-4 py-3">
                      <Sparkline prices={candleMap[row.symbol] ?? []} />
                    </td>
                    <td className="px-4 py-3">
                      <ScoreBar score={row.total_score} />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-ink">
                      {row.risk_reward ? `${row.risk_reward.toFixed(1)}x` : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-ink whitespace-nowrap">
                      {row.entry_min != null && row.entry_max != null
                        ? `${formatPrice(row.entry_min)}–${formatPrice(row.entry_max)}`
                        : row.entry_min != null ? formatPrice(row.entry_min)
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <DecisionChip decision={row.decision} />
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-2 truncate max-w-[100px]">
                      {row.source_author ?? '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                      {row.pl_pct != null ? (
                        <span className={row.pl_pct >= 0 ? 'text-status-green' : 'text-status-red'}>
                          {row.pl_pct >= 0 ? '+' : ''}{row.pl_pct.toFixed(1)}%
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 border-t border-border flex items-center justify-between">
              <span className="text-xs text-ink-3">
                {activeRows.length} active idea{activeRows.length !== 1 ? 's' : ''}
              </span>
              <span className="text-2xs font-mono text-ink-3 border border-border rounded px-2 py-0.5">
                RESEARCH ONLY — NO EXECUTION
              </span>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
