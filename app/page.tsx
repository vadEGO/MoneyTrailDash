import Card from '@/components/ui/Card'
import StatusChip from '@/components/ui/StatusChip'
import PageHeader from '@/components/ui/PageHeader'
import FearGreedWidget from '@/components/FearGreedWidget'
import MacroRegimeWidget from '@/components/MacroRegimeWidget'
import AutoRefresh from '@/components/AutoRefresh'
import SentimentAlerts from '@/components/SentimentAlerts'
import Link from 'next/link'
import { formatAge, getCouncilRuns, getDashboardSummary, getEngineHealth, getMacroRegime, getOpportunities, pct } from '@/lib/openclaw'

export default async function CockpitPage() {
  const [summary, opportunities, councilRuns, health, regime] = await Promise.all([
    getDashboardSummary(),
    getOpportunities(5),
    getCouncilRuns(5),
    getEngineHealth(5),
    getMacroRegime(),
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
        action={<AutoRefresh />}
      />

      <SentimentAlerts />

      <div className="grid grid-cols-2 gap-3 mb-4 sm:grid-cols-4">
        <Metric label="Claims" value={summary?.claim_count ?? 0} />
        <Metric label="Insights" value={summary?.insight_count ?? 0} />
        <Metric label="Council Runs" value={summary?.council_run_count ?? 0} />
        <Metric label="LLM Fallback" value={fallbackRate} />
      </div>

      {/* Single-column on mobile, 3-col on lg+ */}
      <div className="space-y-4 lg:grid lg:grid-cols-3 lg:gap-4 lg:space-y-0">

        {/* Main column — takes 2/3 on desktop */}
        <div className="lg:col-span-2 space-y-4">

          {/* Opportunities — card list on mobile, table on md+ */}
          <Card title="Top Opportunities" action={<Link href="/watchlist" className="text-2xs text-ink-3 hover:text-ink">VIEW ALL →</Link>}>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-border">
              {opportunities.length === 0 ? (
                <div className="px-4 py-8 text-sm text-ink-3 text-center">No opportunities synced yet</div>
              ) : opportunities.map(row => (
                <div key={row.opportunity_id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="font-mono text-2xs text-ink-3">{String(row.rank).padStart(2, '0')}</span>
                        <StatusChip label={row.status ?? 'watch'} variant={statusVariant(row.status)} />
                      </div>
                      <div className="text-sm font-semibold text-ink">{row.title}</div>
                      {row.why_now && <div className="text-2xs text-ink-3 mt-0.5 line-clamp-1">{row.why_now}</div>}
                    </div>
                    <span className="font-mono text-xs text-ink shrink-0">{pct(row.portfolio_fit_score_public)}</span>
                  </div>
                  {row.next_step && (
                    <div className="mt-1.5 text-2xs text-ink-3 bg-surface-dim rounded px-2 py-1 truncate">
                      → {row.next_step}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block">
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
            </div>
          </Card>

          <Card title="Latest Council Conclusions" action={<Link href="/council" className="text-2xs text-ink-3 hover:text-ink">COUNCIL →</Link>}>
            <div className="divide-y divide-border">
              {councilRuns.length === 0 ? (
                <div className="px-4 py-8 text-sm text-ink-3">No council runs synced yet</div>
              ) : councilRuns.slice(0, 4).map(run => (
                <div key={run.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm font-semibold text-ink">{run.topic}</div>
                    <StatusChip label={run.decision_state ?? 'research'} variant={statusVariant(run.decision_state)} />
                  </div>
                  <p className="text-xs text-ink-3 mt-1 line-clamp-2">{run.consensus_view}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Sidebar — full width on mobile, 1/3 on desktop */}
        <div className="space-y-4">
          <Card title="Market Sentiment">
            <div className="p-3">
              <FearGreedWidget />
            </div>
          </Card>

          <MacroRegimeWidget regime={regime} />

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

