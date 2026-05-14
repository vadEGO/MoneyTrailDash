import { createClient } from '@/lib/supabase-server'
import type { DashboardSnapshot } from '@/lib/types'
import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import StatusChip from '@/components/ui/StatusChip'

function ExposureBar({ label, value, max = 100, variant = 'default' }: {
  label: string; value: number; max?: number; variant?: 'default' | 'red' | 'amber'
}) {
  const pct = Math.min(100, (value / max) * 100)
  const barColor = variant === 'red' ? 'bg-status-red' : variant === 'amber' ? 'bg-status-amber' : 'bg-black'
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-ink-2 w-32 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-surface-dim rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-xs text-ink w-10 text-right">{value.toFixed(1)}%</span>
    </div>
  )
}

export default async function RiskPage() {
  const supabase = createClient()
  const { data } = await supabase
    .from('dashboard_snapshots')
    .select('portfolio_heat, signal_radar, pending_approvals, generated_at')
    .order('generated_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .single()

  const snap = data as Pick<DashboardSnapshot, 'portfolio_heat' | 'signal_radar' | 'pending_approvals' | 'generated_at'> | null
  const heat = snap?.portfolio_heat
  const signals = snap?.signal_radar ?? []
  const approvals = snap?.pending_approvals ?? []
  const heatScore = heat?.score ?? 0
  const heatVariant = heatScore > 80 ? 'red' : heatScore > 50 ? 'amber' : 'green'

  // Derive exposure estimates from signals
  const cryptoSignals = signals.filter(s => s.status === 'tradeable')
  const highCrowding = signals.filter(s => (s.crowding_score ?? 0) > 70)

  return (
    <div>
      <PageHeader
        title="Risk Command Center"
        subtitle="Tactical Risk Overview — Decision Center Risk Analytics"
        action={
          <div className="flex items-center gap-2">
            <StatusChip
              label={heatScore > 80 ? 'CRITICAL STATE' : heatScore > 50 ? 'ELEVATED' : 'NOMINAL'}
              variant={heatVariant}
            />
            <button className="flex items-center gap-1.5 border border-border rounded px-3 py-1.5 text-xs text-ink hover:bg-surface-dim transition-colors">
              Export Report
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-4">
        {/* Left — exposure heatmap + mitigation queue */}
        <div className="col-span-2 space-y-4">
          {/* Exposure Heatmap */}
          <Card title="Exposure Heatmap" action={<span className="text-2xs font-mono text-ink-3">LIVE DATA</span>}>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-surface-dim rounded p-3">
                  <div className="text-2xs font-semibold tracking-widest text-ink-3 uppercase mb-1">Concentration</div>
                  <div className="font-mono text-lg font-bold text-ink">{heatScore.toFixed(0)}</div>
                  <div className={`text-2xs font-semibold mt-0.5 ${heatScore > 80 ? 'text-status-red' : heatScore > 50 ? 'text-status-amber' : 'text-status-green'}`}>
                    {heatScore > 80 ? 'OVERWEIGHT' : heatScore > 50 ? 'ELEVATED' : 'NOMINAL'}
                  </div>
                </div>
                <div className="bg-surface-dim rounded p-3">
                  <div className="text-2xs font-semibold tracking-widest text-ink-3 uppercase mb-1">Vulnerability</div>
                  <div className="font-mono text-lg font-bold text-ink">{highCrowding.length}</div>
                  <div className="text-2xs font-semibold text-status-amber mt-0.5">HIGH</div>
                </div>
                <div className="bg-surface-dim rounded p-3">
                  <div className="text-2xs font-semibold tracking-widest text-ink-3 uppercase mb-1">Degradation</div>
                  <div className="font-mono text-lg font-bold text-ink">{heat?.blocked_actions?.length ?? 0}</div>
                  <div className="text-2xs font-semibold text-ink-3 mt-0.5">BASELINE</div>
                </div>
              </div>
              <div className="bg-surface-dim rounded p-4 space-y-2.5">
                <ExposureBar label="Crypto Beta" value={Math.min(35, cryptoSignals.length * 3)} variant={cryptoSignals.length > 10 ? 'red' : 'default'} />
                <ExposureBar label="AI Growth" value={25} />
                <ExposureBar label="Crowding" value={highCrowding.length * 8} max={100} variant={highCrowding.length > 5 ? 'amber' : 'default'} />
                <ExposureBar label="Concentration" value={heatScore * 0.4} variant={heatScore > 80 ? 'red' : 'default'} />
              </div>
            </div>
          </Card>

          {/* Mitigation Queue */}
          <Card
            title="Mitigation Queue"
            action={<button className="text-2xs text-ink-3 hover:text-ink">View All</button>}
          >
            {approvals.length === 0 ? (
              <div className="px-4 py-6 text-sm text-ink-3">No active mitigations</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-surface-dim border-b border-border">
                    {['PRIORITY', 'ISSUE', 'STATUS', 'ASSIGNED'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-2xs font-semibold tracking-widest text-ink-3 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {approvals.slice(0, 5).map((a, i) => {
                    const priorities = ['HIGH', 'MEDIUM', 'LOW']
                    const statuses = ['Active', 'Pending', 'Pending']
                    const teams = ['Portfolio', 'Macro', 'Quant Team']
                    return (
                      <tr key={i} className="hover:bg-surface-dim transition-colors">
                        <td className="px-4 py-3">
                          <StatusChip label={priorities[i % 3]} variant={i === 0 ? 'red' : i === 1 ? 'amber' : 'grey'} />
                        </td>
                        <td className="px-4 py-3 text-sm text-ink">{a.action} {a.asset}</td>
                        <td className="px-4 py-3 text-xs text-ink-3">{statuses[i % 3]}</td>
                        <td className="px-4 py-3 text-xs font-mono text-ink-3">{teams[i % 3]}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        {/* Right — signal feed + intelligence synthesis */}
        <div className="space-y-4">
          <Card title="Tactical Signal Feed">
            <div className="divide-y divide-border">
              {heat?.blocked_actions && heat.blocked_actions.length > 0 ? (
                heat.blocked_actions.map((action, i) => (
                  <div key={i} className="px-4 py-3">
                    <div className="text-2xs font-semibold text-status-red mb-0.5">● CRITICAL PLAN</div>
                    <div className="text-xs text-ink-2">{action.replace(/_/g, ' ')}</div>
                  </div>
                ))
              ) : (
                <>
                  <div className="px-4 py-3">
                    <div className="text-2xs font-semibold text-status-green mb-0.5">● NOMINAL</div>
                    <div className="text-xs text-ink-2">No blocked actions — portfolio within thresholds</div>
                  </div>
                  {highCrowding.slice(0, 2).map(s => (
                    <div key={s.symbol} className="px-4 py-3">
                      <div className="text-2xs font-semibold text-status-amber mb-0.5">● ELEVATED</div>
                      <div className="text-xs text-ink-2">{s.symbol} crowding: {s.crowding_score?.toFixed(0)}/100</div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </Card>

          <Card title="Intelligence Synthesis">
            <div className="p-4">
              <p className="text-xs text-ink-2 leading-relaxed">
                {heatScore > 80
                  ? `Portfolio heat critical at ${heatScore}/100. Concentration review required for primary positions. ${highCrowding.length} assets showing elevated crowding.`
                  : heatScore > 50
                  ? `Portfolio heat elevated at ${heatScore}/100. Monitor ${highCrowding.length} crowded signals. Review allocation before new entries.`
                  : `Portfolio heat nominal at ${heatScore}/100. System operating within parameters. ${signals.length} signals tracked.`}
              </p>
              {snap?.generated_at && (
                <div className="mt-2 text-2xs font-mono text-ink-3">
                  {new Date(snap.generated_at).toLocaleTimeString()} · Follow the Money Macro-Synthesis Engine
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
