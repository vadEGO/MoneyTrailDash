import { createClient } from '@/lib/supabase-server'
import type { DashboardSnapshot } from '@/lib/types'
import Card from '@/components/ui/Card'
import StatusChip from '@/components/ui/StatusChip'
import ActionBadge from '@/components/ui/ActionBadge'
import PageHeader from '@/components/ui/PageHeader'
import Link from 'next/link'

async function getSnapshot(): Promise<DashboardSnapshot | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('dashboard_snapshots')
    .select('*')
    .order('generated_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .single()
  return data ?? null
}

export default async function CockpitPage() {
  const snap = await getSnapshot()

  const heat = snap?.portfolio_heat
  const signals = snap?.signal_radar ?? []
  const topSignals = [...signals].sort((a, b) => b.signal_score - a.signal_score).slice(0, 5)
  const theses = snap?.thesis_board ?? []
  const approvals = snap?.pending_approvals ?? []
  const pipeline = snap?.pipeline_status
  const lastSync = snap?.generated_at
    ? `Last synced ${Math.round((Date.now() - new Date(snap.generated_at).getTime()) / 60000)}m ago`
    : 'Never synced'
  const isStuck = snap?.currently_running &&
    snap.generated_at &&
    Date.now() - new Date(snap.generated_at).getTime() > 2 * 3600 * 1000

  return (
    <div>
      <PageHeader
        title="Command Cockpit"
        status={
          <div className="flex items-center gap-2">
            <StatusChip label={isStuck ? 'DEGRADED' : 'OPERATIONAL'} variant={isStuck ? 'red' : 'green'} />
            <span className="text-2xs font-mono text-ink-3 uppercase">{lastSync}</span>
          </div>
        }
        action={
          <div className="flex items-center gap-2 border border-border rounded px-3 py-1.5 bg-surface text-sm text-ink-3 w-72">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            <span className="font-mono text-xs">Enter global command (e.g., /allocate)</span>
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-4">
        {/* Left column — 2/3 width */}
        <div className="col-span-2 space-y-4">

          {/* Critical Signals */}
          <Card title="Critical Signals">
            <div className="divide-y divide-border">
              {(pipeline?.stages_failed ?? []).length > 0 ? (
                (pipeline!.stages_failed!).map(s => (
                  <div key={s} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="dot-red" />
                      <span className="text-sm text-ink">{s} failed</span>
                    </div>
                    <ActionBadge label="action-required" />
                  </div>
                ))
              ) : heat && heat.score > 80 ? (
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="dot-red" />
                    <span className="text-sm text-ink">Concentration Risk — portfolio heat {heat.score}/100</span>
                  </div>
                  <ActionBadge label="action-required" />
                </div>
              ) : heat && heat.score > 50 ? (
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="dot-amber" />
                    <span className="text-sm text-ink">Portfolio Heat Elevated — {heat.score}/100</span>
                  </div>
                  <ActionBadge label="monitor" />
                </div>
              ) : (
                <div className="px-4 py-3 text-sm text-ink-3">No critical signals — system nominal</div>
              )}
              {isStuck && (
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="dot-amber" />
                    <span className="text-sm text-ink">Data Latency — pipeline running &gt;2h</span>
                  </div>
                  <ActionBadge label="monitor" />
                </div>
              )}
            </div>
          </Card>

          {/* Priority Actions Queue */}
          <Card
            title="Priority Actions Queue"
            action={<Link href="/watchlist" className="text-2xs text-ink-3 hover:text-ink">VIEW ALL →</Link>}
          >
            {approvals.length === 0 ? (
              <div className="px-4 py-6 text-sm text-ink-3">No pending actions</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-surface-dim border-b border-border">
                    <th className="px-4 py-2 text-left text-2xs font-semibold tracking-widest text-ink-3 uppercase">TASK</th>
                    <th className="px-4 py-2 text-left text-2xs font-semibold tracking-widest text-ink-3 uppercase">ENTITY</th>
                    <th className="px-4 py-2 text-left text-2xs font-semibold tracking-widest text-ink-3 uppercase">DUE</th>
                    <th className="px-4 py-2 text-left text-2xs font-semibold tracking-widest text-ink-3 uppercase">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {approvals.slice(0, 4).map((a, i) => (
                    <tr key={i} className="hover:bg-surface-dim transition-colors">
                      <td className="px-4 py-3 text-sm text-ink">{a.asset} — {a.action}</td>
                      <td className="px-4 py-3 text-sm text-ink-3 font-mono">{a.thesis ?? 'Portfolio'}</td>
                      <td className="px-4 py-3 text-sm font-mono text-ink-3">T-2h</td>
                      <td className="px-4 py-3">
                        <button className="bg-black text-white text-2xs font-semibold px-3 py-1 rounded-sm hover:bg-ink-2 transition-colors">
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          {/* Top Opportunities */}
          <Card title="Top Opportunities">
            <div className="grid grid-cols-4 gap-0 divide-x divide-border">
              {topSignals.length === 0 ? (
                <div className="col-span-4 px-4 py-6 text-sm text-ink-3">No signals above threshold</div>
              ) : (
                topSignals.slice(0, 4).map((s, i) => {
                  const categories = ['ALPHA', 'COMMODITY', 'STRATEGIC', 'TECH']
                  return (
                    <Link key={s.symbol} href={`/asset/${s.symbol}`} className="p-4 hover:bg-surface-dim transition-colors">
                      <div className="text-2xs font-semibold tracking-widest text-ink-3 mb-2">{categories[i] ?? 'SIGNAL'}</div>
                      <div className="text-sm font-semibold text-ink">{s.asset || s.symbol}</div>
                      <div className="text-2xs font-mono text-ink-3 mt-1">{s.signal_score?.toFixed(0)} / 100</div>
                    </Link>
                  )
                })
              )}
            </div>
          </Card>
        </div>

        {/* Right column — 1/3 width */}
        <div className="space-y-4">

          {/* Engine Metrics */}
          <Card title="Engine Metrics">
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-surface-dim rounded p-3">
                  <div className="text-2xs font-semibold tracking-widest text-ink-3 uppercase mb-1">Inference Latency</div>
                  <div className="font-mono text-lg font-semibold text-ink">
                    {snap ? '124ms' : '—'}
                  </div>
                </div>
                <div className="bg-surface-dim rounded p-3">
                  <div className="text-2xs font-semibold tracking-widest text-ink-3 uppercase mb-1">Throughput</div>
                  <div className="font-mono text-lg font-semibold text-ink">
                    {snap ? '8.4k t/s' : '—'}
                  </div>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-2xs font-semibold tracking-widest text-ink-3 uppercase">Context Window Usage</span>
                  <span className="font-mono text-xs text-ink">{snap ? '78%' : '—'}</span>
                </div>
                <div className="h-1.5 bg-surface-dim rounded-full overflow-hidden">
                  <div className="h-full bg-black rounded-full transition-all" style={{ width: snap ? '78%' : '0%' }} />
                </div>
              </div>
            </div>
          </Card>

          {/* Top Thesis Changes */}
          <Card title="Top Thesis Changes">
            <div className="divide-y divide-border">
              {theses.length === 0 ? (
                <div className="px-4 py-4 text-sm text-ink-3">No thesis data</div>
              ) : (
                theses.slice(0, 3).map(t => (
                  <div key={t.thesis} className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-ink capitalize">{t.thesis?.replace('_', ' ')}</span>
                    <span className={`font-mono text-xs font-semibold ${(t.strength ?? 0) >= 60 ? 'text-status-green' : 'text-status-red'}`}>
                      {(t.strength ?? 0) >= 60 ? '↑' : '↓'} {t.strength?.toFixed(0)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Council Decisions */}
          <Card title="Council Decisions">
            <div className="divide-y divide-border">
              {approvals.length === 0 ? (
                <div className="px-4 py-4 text-sm text-ink-3">No pending decisions</div>
              ) : (
                approvals.slice(0, 3).map((a, i) => {
                  const statuses = ['pending', 'approved', 'draft'] as const
                  const s = statuses[i % 3]
                  return (
                    <div key={i} className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-sm text-ink capitalize">{a.action} {a.asset}</span>
                      <ActionBadge label={s} />
                    </div>
                  )
                })
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
