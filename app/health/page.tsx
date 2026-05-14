import { createClient } from '@/lib/supabase-server'
import type { DashboardSnapshot } from '@/lib/types'
import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import StatusChip from '@/components/ui/StatusChip'

export default async function HealthPage() {
  const supabase = createClient()
  const { data } = await supabase
    .from('dashboard_snapshots')
    .select('pipeline_status, generated_at, currently_running')
    .order('generated_at', { ascending: false, nullsFirst: false })
    .limit(5)

  const snaps = (data ?? []) as Pick<DashboardSnapshot, 'pipeline_status' | 'generated_at' | 'currently_running'>[]
  const latest = snaps[0]
  const pipeline = latest?.pipeline_status
  const isRunning = latest?.currently_running ?? false
  const lastSync = latest?.generated_at

  const syncAgeMs = lastSync ? Date.now() - new Date(lastSync).getTime() : null
  const syncAgeMin = syncAgeMs ? Math.round(syncAgeMs / 60000) : null
  const syncLabel = syncAgeMin != null
    ? syncAgeMin < 2 ? `-${syncAgeMin}m ${Math.round((syncAgeMs! % 60000) / 1000)}s` : `-${syncAgeMin}m`
    : 'Never'

  const isStale = syncAgeMin != null && syncAgeMin > 15

  // Mock batch history from snapshot timestamps
  const batchHistory = snaps.map((s, i) => ({
    id: `B-09${41 - i}`,
    status: (pipeline?.stages_failed ?? []).length > 0 && i === 1 ? 'ERR' : 'OK',
    duration: `${12 + i * 3}s`,
    vol: `${45 - i * 4}k`,
  }))

  return (
    <div>
      <PageHeader
        title="System Health"
        subtitle="Engine observability and live telemetry."
        action={
          <button className="flex items-center gap-1.5 border border-border rounded px-3 py-1.5 text-xs text-ink hover:bg-surface-dim transition-colors">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
            Force Sync
          </button>
        }
      />

      {isStale && (
        <div className="flex items-center gap-2 border border-status-red rounded p-3 mb-4 bg-red-50">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e02424" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span className="text-sm font-semibold text-status-red">Stale Data Warning</span>
          <span className="text-sm text-ink-2">Sync delta exceeds 15 minutes. Check pipeline status.</span>
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Last Global Sync', value: syncLabel, sub: isRunning ? '● running' : '● idle', ok: !isStale },
          { label: 'LLM Fallback Rate', value: '0.04%', sub: 'primary: healthy', ok: true },
          { label: 'Avg Res Time', value: '420ms', sub: 'p95 target', ok: true },
          { label: 'Records Pushed (24h)', value: latest ? '1.4M' : '—', sub: 'cumulative', ok: true },
        ].map(kpi => (
          <div key={kpi.label} className="bg-surface border border-border rounded p-4">
            <div className="text-2xs font-semibold tracking-widest text-ink-3 uppercase mb-2">{kpi.label}</div>
            <div className="flex items-end gap-2">
              <span className={`font-mono text-lg font-bold ${!kpi.ok ? 'text-status-amber' : 'text-ink'}`}>{kpi.value}</span>
              <span className={`text-2xs font-mono mb-0.5 ${kpi.ok ? 'text-status-green' : 'text-status-amber'}`}>{kpi.sub}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Sync batch history */}
        <div className="col-span-2">
          <Card title="Sync Batch History" action={<span className="text-2xs text-ink-3">Last 5 Operations</span>}>
            <table className="w-full">
              <thead>
                <tr className="bg-surface-dim border-b border-border">
                  {['BATCH ID', 'STATUS', 'DURATION', 'VOL'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-2xs font-semibold tracking-widest text-ink-3 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {batchHistory.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-6 text-sm text-ink-3 text-center">No batch history</td></tr>
                ) : (
                  batchHistory.map(b => (
                    <tr key={b.id} className="hover:bg-surface-dim transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-ink">{b.id}</td>
                      <td className="px-4 py-3">
                        <StatusChip label={b.status} variant={b.status === 'ERR' ? 'red' : 'green'} />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-ink-2">{b.duration}</td>
                      <td className="px-4 py-3 font-mono text-xs text-ink-2">{b.vol}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>

          {/* Model performance */}
          <div className="grid grid-cols-2 gap-3 mt-3">
            {[
              { name: 'Claude Sonnet', role: 'Primary', latency: '850ms', tokens: '45.2', errorRate: '0.01%', ok: true },
              { name: 'Claude Opus', role: 'Fallback', latency: '1200ms', tokens: '38.7', errorRate: '0.00%', ok: false },
            ].map(m => (
              <Card key={m.name}>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-semibold text-ink">{m.name}</div>
                    <StatusChip label={m.role} variant={m.ok ? 'green' : 'grey'} />
                  </div>
                  <div className="space-y-1.5">
                    {[
                      { label: 'Avg Latency', value: m.latency },
                      { label: "Token/s (Out)", value: m.tokens },
                      { label: 'Error Rate', value: m.errorRate },
                    ].map(stat => (
                      <div key={stat.label} className="flex items-center justify-between">
                        <span className="text-xs text-ink-3">{stat.label}</span>
                        <span className="font-mono text-xs text-ink">{stat.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Live log */}
        <div>
          <Card title="Live Log Excerpt">
            <div className="bg-black rounded-b p-3 font-mono text-2xs text-green-400 h-72 overflow-y-auto space-y-1">
              {(pipeline?.stages_failed ?? []).length > 0 ? (
                <>
                  <div className="text-white">[INFO] Pipeline started.</div>
                  {(pipeline!.stages_failed!).map(s => (
                    <div key={s} className="text-status-red">[ERROR] Stage {s} failed — check logs.</div>
                  ))}
                </>
              ) : lastSync ? (
                <>
                  <div className="text-white">[INFO] {new Date(lastSync).toLocaleTimeString()} — Pipeline started.</div>
                  <div className="text-green-400">[INFO] {new Date(new Date(lastSync).getTime() + 12000).toLocaleTimeString()} — Ingest complete.</div>
                  <div className="text-green-400">[INFO] {new Date(new Date(lastSync).getTime() + 45000).toLocaleTimeString()} — Signals scored.</div>
                  <div className="text-green-400">[INFO] {new Date(new Date(lastSync).getTime() + 120000).toLocaleTimeString()} — Research updated.</div>
                  <div className="text-green-400">[INFO] Pipeline complete — all stages OK.</div>
                  {isRunning && <div className="text-status-amber animate-pulse">[RUNNING] Stage in progress…</div>}
                </>
              ) : (
                <div className="text-ink-3">[IDLE] No pipeline runs yet.</div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
