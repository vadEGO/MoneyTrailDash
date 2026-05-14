import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import StatusChip from '@/components/ui/StatusChip'
import { formatAge, getDashboardSummary, getEngineHealth, getLlmHealth } from '@/lib/openclaw'

export default async function HealthPage() {
  const [summary, health, llm] = await Promise.all([
    getDashboardSummary(),
    getEngineHealth(20),
    getLlmHealth(14),
  ])
  const latest = health[0]

  return (
    <div>
      <PageHeader
        title="System Health"
        subtitle="OpenClaw sync, LLM, and dashboard data freshness."
        status={<StatusChip label={latest?.is_stale ? 'STALE' : latest?.status ?? 'NO SYNC'} variant={latest?.is_stale ? 'amber' : latest?.status === 'success' ? 'green' : 'grey'} />}
      />

      <div className="grid grid-cols-4 gap-3 mb-4">
        <Metric label="Last Sync" value={formatAge(summary?.last_synced_at)} />
        <Metric label="Claims" value={summary?.claim_count ?? 0} />
        <Metric label="Insights" value={summary?.insight_count ?? 0} />
        <Metric label="Council Runs" value={summary?.council_run_count ?? 0} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <Card title="Sync Batch History">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-dim border-b border-border">
                  {['BATCH', 'STATUS', 'WORKFLOW', 'CLAIMS', 'INSIGHTS', 'OPPORTUNITIES', 'COUNCIL'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-2xs font-semibold tracking-widest text-ink-3 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {health.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-ink-3">No sync batches yet</td></tr>
                ) : health.map(row => (
                  <tr key={row.sync_batch_id} className="hover:bg-surface-dim">
                    <td className="px-4 py-3 font-mono text-xs text-ink-3">{row.sync_batch_id.slice(0, 8)}</td>
                    <td className="px-4 py-3"><StatusChip label={row.status ?? 'unknown'} variant={row.status === 'success' ? 'green' : row.status === 'partial' ? 'amber' : row.status === 'failed' ? 'red' : 'grey'} /></td>
                    <td className="px-4 py-3 text-xs text-ink-2">{row.workflow_name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-ink">{row.records_claims ?? 0}</td>
                    <td className="px-4 py-3 font-mono text-xs text-ink">{row.records_insights ?? 0}</td>
                    <td className="px-4 py-3 font-mono text-xs text-ink">{row.records_opportunities ?? 0}</td>
                    <td className="px-4 py-3 font-mono text-xs text-ink">{row.records_council_runs ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        <Card title="LLM Health">
          <div className="divide-y divide-border">
            {llm.length === 0 ? (
              <div className="px-4 py-6 text-sm text-ink-3">No LLM audit synced yet</div>
            ) : llm.slice(0, 8).map(row => (
              <div key={`${row.day}-${row.model}`} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-ink">{row.model ?? 'model'}</div>
                  <div className="font-mono text-xs text-ink">{row.calls ?? 0}</div>
                </div>
                <div className="text-2xs text-ink-3 mt-1">ok {row.ok_count ?? 0} / fallback {row.fallback_count ?? 0} / failed {row.failed_count ?? 0}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-surface border border-border rounded p-4">
      <div className="text-2xs font-semibold tracking-widest text-ink-3 uppercase mb-2">{label}</div>
      <div className="font-mono text-lg font-bold text-ink">{value}</div>
    </div>
  )
}

