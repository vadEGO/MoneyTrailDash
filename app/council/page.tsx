import { createClient } from '@/lib/supabase-server'
import type { DashboardSnapshot } from '@/lib/types'
import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import StatusChip from '@/components/ui/StatusChip'

export default async function CouncilPage() {
  const supabase = createClient()
  const { data } = await supabase
    .from('dashboard_snapshots')
    .select('pending_approvals, thesis_board, generated_at')
    .order('generated_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .single()

  const snap = data as Pick<DashboardSnapshot, 'pending_approvals' | 'thesis_board' | 'generated_at'> | null
  const approvals = snap?.pending_approvals ?? []
  const hasDebate = approvals.length > 0
  const currentDebate = approvals[0]

  return (
    <div>
      <div className="flex items-center gap-2 text-2xs font-mono text-ink-3 mb-2 uppercase tracking-widest">
        COUNCIL ROOM
      </div>

      <PageHeader
        title={hasDebate ? `Current Debate` : 'Council Room'}
        subtitle={hasDebate ? undefined : 'Multi-persona deliberation on investment decisions'}
        status={
          hasDebate ? (
            <div className="flex items-center gap-2">
              <StatusChip label="ACTIVE" variant="green" />
              <span className="text-2xs font-mono text-ink-3">IN DEBATE</span>
            </div>
          ) : undefined
        }
      />

      {!hasDebate ? (
        <Card>
          <div className="px-6 py-16 text-center space-y-3">
            <div className="text-4xl">⚖️</div>
            <div className="text-md font-semibold text-ink">No active debates</div>
            <p className="text-sm text-ink-3 max-w-sm mx-auto">
              Council debates are triggered when the pipeline generates real candidate position plans.
              Run MoneyTrail to generate approval candidates.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Debate subject */}
          <div className="bg-surface-dim border border-border rounded p-4 flex items-center gap-3">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            <span className="text-2xs font-semibold tracking-widest text-ink-3 uppercase">SUBJECT:</span>
            <span className="text-sm font-semibold text-ink uppercase">
              {currentDebate.action?.toUpperCase()} {currentDebate.asset} — {currentDebate.thesis?.replace('_', ' ').toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {/* Main debate — 2/3 */}
            <div className="col-span-2 space-y-4">
              {/* Consensus View */}
              <Card title="Consensus View" action={<span className="text-2xs font-mono text-ink-3">AUTO-GENERATED</span>}>
                <div className="p-4">
                  <p className="text-sm text-ink leading-relaxed">
                    The council is evaluating a {currentDebate.action} position in {currentDebate.asset}.
                    Entry sizing at {currentDebate.size_pct ? `${(currentDebate.size_pct * 100).toFixed(1)}%` : 'TBD'} of portfolio.
                    {currentDebate.entry_price ? ` Target entry: $${currentDebate.entry_price.toLocaleString()}.` : ''}
                    Thesis alignment: {currentDebate.thesis?.replace('_', ' ') ?? 'pending review'}.
                  </p>
                  {currentDebate.entry_price && (
                    <div className="mt-3 bg-surface-dim rounded p-3 font-mono text-xs text-ink-3">
                      CODE PROJECTION: &quot;Entry at ${currentDebate.entry_price.toLocaleString()} — risk/reward pending council sign-off.&quot;
                    </div>
                  )}
                </div>
              </Card>

              {/* Active Discourse — placeholder personas */}
              <Card title="Active Discourse">
                <div className="divide-y divide-border">
                  {[
                    { name: 'The Pragmatist', role: 'Bull case', color: 'status-blue',
                      text: `The risk-adjusted entry for ${currentDebate.asset} is within acceptable parameters. Evidence quality supports a monitored position with defined stop-loss.` },
                    { name: 'The Skeptic', role: 'Bear case', color: 'status-red',
                      text: `Sentiment crowding is elevated. If the ${currentDebate.thesis?.replace('_', ' ')} thesis is further validated, we need a secondary verification pass before entry.` },
                  ].map(persona => (
                    <div key={persona.name} className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="text-sm font-semibold text-ink">{persona.name}</div>
                          <div className="text-2xs text-ink-3 font-mono mt-0.5">{persona.role}</div>
                        </div>
                        <span className="text-2xs font-mono text-ink-3">Just now</span>
                      </div>
                      <p className="text-sm text-ink-2 leading-relaxed">{persona.text}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Right panel — 1/3 */}
            <div className="space-y-4">
              <Card title="Contentions">
                <div className="divide-y divide-border">
                  {[
                    { type: 'QUESTION', text: `Entry sizing for ${currentDebate.asset} vs portfolio heat`, variant: 'amber' as const },
                    { type: 'FRICTION', text: 'Liquidity profile needs re-check at entry range', variant: 'red' as const },
                    { type: 'OPEN', text: 'Secondary validation source needed', variant: 'blue' as const },
                  ].map((c, i) => (
                    <div key={i} className="px-4 py-3">
                      <div className={`text-2xs font-semibold mb-1 text-status-${c.variant}`}>{c.type}</div>
                      <div className="text-xs text-ink-2">{c.text}</div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card title="Uncertainties">
                <div className="divide-y divide-border">
                  {[
                    'Cost of implementing secondary validation pass given timeline',
                    'Availability of independent price management infrastructure',
                  ].map((u, i) => (
                    <div key={i} className="px-4 py-3 text-xs text-ink-3">◇ {u}</div>
                  ))}
                </div>
              </Card>

              <button className="w-full border border-border rounded px-4 py-2.5 text-xs text-ink hover:bg-surface-dim transition-colors font-semibold">
                REQUEST CLARIFICATION
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
