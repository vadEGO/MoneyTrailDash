import { createClient } from '@/lib/supabase-server'
import type { DashboardSnapshot, SignalRadarRow } from '@/lib/types'
import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import StatusChip from '@/components/ui/StatusChip'
import ActionBadge from '@/components/ui/ActionBadge'
import Link from 'next/link'

function scoreBar(score: number) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-surface-dim rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${score >= 80 ? 'bg-status-green' : score >= 60 ? 'bg-status-amber' : 'bg-ink-3'}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="font-mono text-xs text-ink">{score.toFixed(1)}</span>
    </div>
  )
}

function timingLabel(horizon: string | undefined) {
  if (!horizon) return 'Mid (3-5y)'
  if (horizon.includes('near') || horizon.includes('1')) return 'Near (1-3y)'
  if (horizon.includes('far') || horizon.includes('5')) return 'Far (5y+)'
  return 'Mid (3-5y)'
}

function nextStep(row: SignalRadarRow): { label: string; action: string } {
  const p = row.research_priority
  if (p === 'level_4') return { label: 'Review\nResearch', action: 'Review' }
  if (p === 'level_3') return { label: 'Monitor\nT3', action: 'Monitor T3' }
  if (p === 'level_2') return { label: 'Assign\nAnalyst', action: 'Assign' }
  return { label: 'Update\nModel', action: 'Update' }
}

export default async function WatchlistPage() {
  const supabase = createClient()
  const { data } = await supabase
    .from('dashboard_snapshots')
    .select('signal_radar, generated_at')
    .order('generated_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .single()

  const snap = data as Pick<DashboardSnapshot, 'signal_radar' | 'generated_at'> | null
  const rows = [...(snap?.signal_radar ?? [])].sort((a, b) => b.signal_score - a.signal_score)

  const statusMap: Record<string, { variant: 'green' | 'blue' | 'purple' | 'grey'; label: string }> = {
    tradeable:     { variant: 'green',  label: 'Active' },
    watchlist:     { variant: 'blue',   label: 'Watch' },
    research_only: { variant: 'purple', label: 'Research' },
  }

  return (
    <div>
      <PageHeader
        title="Opportunity Watchlist"
        subtitle="Ranked evaluation of emerging thematic vectors."
        action={
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 border border-border rounded px-3 py-1.5 text-xs text-ink hover:bg-surface-dim transition-colors">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="14" y2="12"/><line x1="4" y1="18" x2="9" y2="18"/></svg>
              Quick log new theme…
            </button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xs font-semibold text-ink-3 flex items-center gap-1">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
          FILTERS:
        </span>
        <select className="border border-border rounded px-2 py-1 text-xs text-ink bg-surface focus:outline-none focus:border-black">
          <option>Status: All Active</option>
          <option>Status: Watch</option>
          <option>Status: Research</option>
        </select>
        <select className="border border-border rounded px-2 py-1 text-xs text-ink bg-surface focus:outline-none focus:border-black">
          <option>Time Horizon: Any</option>
          <option>Near (1-3y)</option>
          <option>Mid (3-5y)</option>
          <option>Far (5y+)</option>
        </select>
        <div className="ml-auto">
          <button className="flex items-center gap-1.5 border border-border rounded px-3 py-1.5 text-xs text-ink hover:bg-surface-dim transition-colors">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            Export CSV
          </button>
        </div>
      </div>

      <Card>
        <table className="w-full">
          <thead>
            <tr className="bg-surface-dim border-b border-border">
              {['RNK', 'THEME', 'STATUS', 'STRAT. SCORE', 'TIMING', 'EVIDENCE', 'FIT', 'WHY NOW', 'NEXT STEP'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-2xs font-semibold tracking-widest text-ink-3 uppercase whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-ink-3 text-sm">
                  No signals — run the MoneyTrail pipeline to populate
                </td>
              </tr>
            ) : (
              rows.map((row, i) => {
                const st = statusMap[row.status] ?? { variant: 'grey' as const, label: row.status ?? '—' }
                const ns = nextStep(row)
                return (
                  <tr key={row.symbol} className="hover:bg-surface-dim transition-colors cursor-pointer">
                    <td className="px-4 py-3 font-mono text-xs text-ink-3">{String(i + 1).padStart(2, '0')}</td>
                    <td className="px-4 py-3">
                      <Link href={`/asset/${row.symbol}`}>
                        <div className="text-sm font-semibold text-ink hover:underline">{row.asset || row.symbol}</div>
                        <div className="text-2xs text-ink-3 mt-0.5 truncate max-w-[180px]">{row.symbol}</div>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <StatusChip label={st.label} variant={st.variant} />
                    </td>
                    <td className="px-4 py-3">{scoreBar(row.signal_score ?? 0)}</td>
                    <td className="px-4 py-3 text-xs text-ink-3">{timingLabel(undefined)}</td>
                    <td className="px-4 py-3">
                      {(row.source_count ?? 0) > 2 ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12" y2="16"/></svg>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-ink">{row.signal_score?.toFixed(0) ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-ink-3 max-w-[140px] truncate">
                      {row.sentiment === 'bullish' ? 'Positive signal momentum' : row.sentiment === 'bearish' ? 'Caution on momentum' : 'Mixed signals'}
                    </td>
                    <td className="px-4 py-3">
                      <button className="border border-border rounded-sm px-2 py-1 text-2xs font-semibold text-ink hover:bg-surface-dim transition-colors whitespace-nowrap">
                        {ns.action}
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
        <div className="px-4 py-3 border-t border-border flex items-center justify-between">
          <span className="text-xs text-ink-3">Showing 1–{rows.length} of {rows.length} themes</span>
          <div className="flex items-center gap-3 text-xs text-ink-3">
            <button className="hover:text-ink transition-colors">Prev</button>
            <button className="hover:text-ink transition-colors">Next</button>
          </div>
        </div>
      </Card>
    </div>
  )
}
