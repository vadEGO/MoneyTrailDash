import Card from '@/components/ui/Card'
import StatusChip from '@/components/ui/StatusChip'
import PageHeader from '@/components/ui/PageHeader'
import FearGreedWidget from '@/components/FearGreedWidget'
import Link from 'next/link'
import { formatAge, getCouncilRuns, getDashboardSummary, getEngineHealth, getOpportunities, getTheses, pct } from '@/lib/openclaw'

export default async function CockpitPage() {
  const [summary, opportunities, theses, councilRuns, health] = await Promise.all([
    getDashboardSummary(),
    getOpportunities(5),
    getTheses(5),
    getCouncilRuns(5),
    getEngineHealth(5),
  ])

  const latestHealth = health[0]
  const isStale = latestHealth?.is_stale ?? !summary?.last_synced_at
  const fallbackRate = summary?.llm_fallback_rate == null ? '—' : `${Math.round(Number(summary.llm_fallback_rate) * 100)}%`

  return (
    <div>
      <PageHeader
        title="Command Cockpit"
        status={
          <div className="flex items-center gap-2">
            <StatusChip label={isStale ? 'STALE' : 'OPERATIONAL'} variant={isStale ? 'amber' : 'green'} />
            <span className="text-2xs font-mono text-ink-3 uppercase">{formatAge(summary?.last_synced_at)}</span>
          </div>
        }
      />

      <div className="grid grid-cols-4 gap-3 mb-4">
        <Metric label="Claims" value={summary?.claim_count ?? 0} />
        <Metric label="Insights" value={summary?.insight_count ?? 0} />
        <Metric label="Council Runs" value={summary?.council_run_count ?? 0} />
        <Metric label="LLM Fallback" value={fallbackRate} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-4">
          <Card title="Top Opportunities" action={<Link href="/watchlist" className="text-2xs text-ink-3 hover:text-ink">VIEW ALL →</Link>}>
            <table className="w-full">
              <thead>
                <tr className="bg-surface-dim border-b border-border">
                  {['RANK', 'THEME', 'STATUS', 'FIT', 'NEXT STEP'].map(h => (
                    <th key={h} className="px-4 py-2 text-left text-2xs font-semibold tracking-widest text-ink-3 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {opportunities.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-sm text-ink-3 text-center">No opportunities synced yet</td></tr>
                ) : opportunities.map(row => (
                  <tr key={row.opportunity_id} className="hover:bg-surface-dim">
                    <td className="px-4 py-3 font-mono text-xs text-ink-3">{String(row.rank).padStart(2, '0')}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-semibold text-ink">{row.title}</div>
                      <div className="text-2xs text-ink-3 mt-0.5 line-clamp-1">{row.why_now}</div>
                    </td>
                    <td className="px-4 py-3"><StatusChip label={row.status ?? 'watch'} variant={statusVariant(row.status)} /></td>
                    <td className="px-4 py-3 font-mono text-xs text-ink">{pct(row.portfolio_fit_score_public)}</td>
                    <td className="px-4 py-3 text-xs text-ink-2 max-w-[260px] truncate">{row.next_step ?? 'Investigate'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card title="Latest Council Conclusions" action={<Link href="/council" className="text-2xs text-ink-3 hover:text-ink">COUNCIL →</Link>}>
            <div className="divide-y divide-border">
              {councilRuns.length === 0 ? (
                <div className="px-4 py-8 text-sm text-ink-3">No council runs synced yet</div>
              ) : councilRuns.slice(0, 4).map(run => (
                <div key={run.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-ink">{run.topic}</div>
                    <StatusChip label={run.decision_state ?? 'research'} variant={statusVariant(run.decision_state)} />
                  </div>
                  <p className="text-xs text-ink-3 mt-1 line-clamp-2">{run.consensus_view}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Market Sentiment">
            <div className="p-3">
              <FearGreedWidget />
            </div>
          </Card>

          <Card title="Thesis Movement">
            <div className="divide-y divide-border">
              {theses.length === 0 ? (
                <div className="px-4 py-6 text-sm text-ink-3">No theses synced yet</div>
              ) : theses.slice(0, 5).map(thesis => (
                <div key={thesis.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-ink line-clamp-1">{thesis.topic}</span>
                    <span className="font-mono text-xs text-ink">{pct(thesis.confidence)}</span>
                  </div>
                  <div className="text-2xs text-ink-3 mt-1">{thesis.confidence_movement ?? 'new'} · {thesis.status ?? 'research'}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="System Health">
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-ink-3">Latest sync</span>
                <span className="font-mono text-xs text-ink">{formatAge(summary?.last_synced_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-ink-3">Latest batch</span>
                <StatusChip label={latestHealth?.status ?? 'none'} variant={statusVariant(latestHealth?.status)} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-ink-3">Opportunities</span>
                <span className="font-mono text-xs text-ink">{summary?.opportunity_count ?? 0}</span>
              </div>
            </div>
          </Card>
        </div>
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

function statusVariant(status?: string | null): 'red' | 'amber' | 'green' | 'blue' | 'purple' | 'grey' {
  const s = (status ?? '').toLowerCase()
  if (['success', 'operational', 'active', 'stage_entry', 'hold', 'hold_high_conviction'].includes(s)) return 'green'
  if (['failed', 'avoid', 'red'].includes(s)) return 'red'
  if (['partial', 'stale', 'wait_for_better_entry'].includes(s)) return 'amber'
  if (['research_further', 'research', 'investigate'].includes(s)) return 'blue'
  if (['council_review', 'watch'].includes(s)) return 'purple'
  return 'grey'
}

