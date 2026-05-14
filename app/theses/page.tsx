import { createClient } from '@/lib/supabase-server'
import type { DashboardSnapshot, ThesisBoardRow } from '@/lib/types'
import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import StatusChip from '@/components/ui/StatusChip'
import Link from 'next/link'

function ConvictionBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score))
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-surface-dim rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${pct >= 70 ? 'bg-black' : pct >= 50 ? 'bg-ink-2' : 'bg-ink-3'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-xs text-ink w-6 text-right">{pct.toFixed(0)}%</span>
    </div>
  )
}

function lifecycleVariant(stage: string): 'green' | 'blue' | 'amber' | 'red' | 'grey' {
  const map: Record<string, 'green' | 'blue' | 'amber' | 'red' | 'grey'> = {
    accumulating: 'green', expansion: 'blue', crowded: 'amber',
    distribution: 'amber', declining: 'red', recovering: 'grey',
  }
  return map[stage?.toLowerCase()] ?? 'grey'
}

function ThesisCard({ thesis, rank }: { thesis: ThesisBoardRow; rank: number }) {
  const isActive = (thesis.strength ?? 0) >= 60
  const strengthLabel = (thesis.strength ?? 0) >= 70 ? 'IN THESIS' : 'WATCHLIST'
  const strengthVariant: 'green' | 'grey' = isActive ? 'green' : 'grey'

  return (
    <div className={`border rounded p-4 bg-surface ${rank <= 2 ? 'border-black' : 'border-border'}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <StatusChip label={strengthLabel} variant={strengthVariant} />
            <span className="text-2xs font-mono text-ink-3">SIG: {rank <= 2 ? 'IN-THESIS' : 'IN-ARCHIVE'}</span>
          </div>
          <h3 className="text-md font-semibold text-ink capitalize leading-tight">
            {thesis.thesis?.replace('_', ' ') ?? '—'}
          </h3>
        </div>
        <div className="text-right">
          <div className="text-xl font-mono font-bold text-ink">{(thesis.strength ?? 0).toFixed(0)}%</div>
          <div className="text-2xs text-ink-3">conviction</div>
        </div>
      </div>

      <ConvictionBar score={thesis.strength ?? 0} />

      <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-border">
        <div>
          <div className="text-2xs text-ink-3 uppercase tracking-widest mb-1">Horizon</div>
          <div className="text-xs font-mono text-ink">3-5 yr</div>
        </div>
        <div>
          <div className="text-2xs text-ink-3 uppercase tracking-widest mb-1">Catalyst</div>
          <div className="text-xs font-mono text-ink">{thesis.lifecycle_stage ?? '—'}</div>
        </div>
        <div>
          <div className="text-2xs text-ink-3 uppercase tracking-widest mb-1">Key Catalyst</div>
          <div className="text-xs font-mono text-ink">Market Guidance</div>
        </div>
      </div>

      {thesis.top_expressions && thesis.top_expressions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {thesis.top_expressions.slice(0, 3).map((e, i) => (
            <Link
              key={e.symbol}
              href={`/asset/${e.symbol}`}
              className="text-2xs font-mono bg-surface-dim border border-border rounded-sm px-2 py-0.5 text-ink hover:border-black transition-colors"
            >
              {i + 1}. {e.symbol}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default async function ThesesPage() {
  const supabase = createClient()
  const { data } = await supabase
    .from('dashboard_snapshots')
    .select('thesis_board, generated_at')
    .order('generated_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .single()

  const snap = data as Pick<DashboardSnapshot, 'thesis_board' | 'generated_at'> | null
  const theses = [...(snap?.thesis_board ?? [])].sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0))
  const active = theses.filter(t => (t.strength ?? 0) >= 60)
  const watchlist = theses.filter(t => (t.strength ?? 0) < 60)

  return (
    <div>
      <PageHeader
        title="Thesis Register"
        subtitle="Active belief register and structural market hypotheses."
        action={
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 border border-border rounded px-3 py-1.5 text-xs text-ink hover:bg-surface-dim transition-colors">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              {theses.length} THESES
            </button>
            <button className="flex items-center gap-1.5 bg-black text-white rounded px-3 py-1.5 text-xs font-semibold hover:bg-ink-2 transition-colors">
              + NEW THESIS
            </button>
          </div>
        }
      />

      {/* Primary convictions */}
      {active.length > 0 && (
        <div className="mb-6">
          <h2 className="text-2xs font-semibold tracking-widest text-ink-3 uppercase mb-3">● PRIMARY CONVICTIONS</h2>
          <div className="grid grid-cols-2 gap-4">
            {active.slice(0, 4).map((t, i) => (
              <ThesisCard key={t.thesis} thesis={t} rank={i + 1} />
            ))}
          </div>
        </div>
      )}

      {/* Watchlist & archive */}
      {watchlist.length > 0 && (
        <div>
          <h2 className="text-2xs font-semibold tracking-widest text-ink-3 uppercase mb-3">◎ WATCHLIST & ARCHIVE</h2>
          <Card>
            <table className="w-full">
              <thead>
                <tr className="bg-surface-dim border-b border-border">
                  {['HYPOTHESIS', 'STATUS', 'LAST JUMP', 'UPDATED'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-2xs font-semibold tracking-widest text-ink-3 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {watchlist.map(t => (
                  <tr key={t.thesis} className="hover:bg-surface-dim transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-ink capitalize">{t.thesis?.replace('_', ' ') ?? '—'}</div>
                      <div className="text-2xs text-ink-3 mt-0.5">Thesis under evaluation</div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusChip label={lifecycleVariant(t.lifecycle_stage ?? '') === 'red' ? 'Invalidated' : 'Dormant'} variant={lifecycleVariant(t.lifecycle_stage ?? '')} />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-ink">{(t.strength ?? 0).toFixed(0)}%</td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-3">—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {theses.length === 0 && (
        <Card>
          <div className="px-4 py-12 text-center text-ink-3 text-sm">
            No thesis data — run the MoneyTrail pipeline to populate
          </div>
        </Card>
      )}
    </div>
  )
}
