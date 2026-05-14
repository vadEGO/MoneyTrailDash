import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import StatusChip from '@/components/ui/StatusChip'
import { getCouncilRuns, getOpportunities } from '@/lib/openclaw'

export default async function RiskPage() {
  const [opportunities, councilRuns] = await Promise.all([
    getOpportunities(30),
    getCouncilRuns(30),
  ])
  const highFit = opportunities.filter(o => Number(o.portfolio_fit_score_public ?? 0) >= 0.7)
  const timingRisk = councilRuns.filter(r => (r.decision_state ?? '').includes('wait'))
  const taxSensitive = councilRuns.filter(r => (r.personal_constraints_public ?? []).some(c => c.toLowerCase().includes('tax')))
  const concentration = councilRuns.filter(r => (r.personal_constraints_public ?? []).some(c => c.toLowerCase().includes('concentration')))

  return (
    <div>
      <PageHeader
        title="Risk Command Center"
        subtitle="Public-redacted personal-fit and tactical risk view."
        status={<StatusChip label={concentration.length > 0 ? 'REVIEW' : 'NOMINAL'} variant={concentration.length > 0 ? 'amber' : 'green'} />}
      />

      <div className="grid grid-cols-4 gap-3 mb-4">
        <Metric label="High Fit Themes" value={highFit.length} />
        <Metric label="Timing Risk" value={timingRisk.length} />
        <Metric label="Tax Sensitive" value={taxSensitive.length} />
        <Metric label="Concentration Review" value={concentration.length} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card title="Public Risk Flags">
          <div className="divide-y divide-border">
            {[
              ['High-beta overlap detected', highFit.length],
              ['Tactical timing risk elevated', timingRisk.length],
              ['Tax-sensitive action', taxSensitive.length],
              ['Concentration review required', concentration.length],
            ].map(([label, count]) => (
              <div key={label as string} className="px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-ink">{label}</span>
                <StatusChip label={String(count)} variant={Number(count) > 0 ? 'amber' : 'grey'} />
              </div>
            ))}
          </div>
        </Card>

        <Card title="Constraint Notes">
          <div className="divide-y divide-border">
            {councilRuns.length === 0 ? (
              <div className="px-4 py-8 text-sm text-ink-3">No council constraints synced yet</div>
            ) : councilRuns.slice(0, 10).map(run => (
              <div key={run.id} className="px-4 py-3">
                <div className="text-sm font-semibold text-ink">{run.topic}</div>
                <div className="text-xs text-ink-3 mt-1">
                  {(run.personal_constraints_public ?? []).join(' · ') || 'No public constraint surfaced'}
                </div>
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
      <div className="font-mono text-xl font-bold text-ink">{value}</div>
    </div>
  )
}

