import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import StatusChip from '@/components/ui/StatusChip'
import { getOpportunities, pct } from '@/lib/openclaw'

export default async function WatchlistPage() {
  const rows = await getOpportunities(50)

  return (
    <div>
      <PageHeader
        title="Opportunity Watchlist"
        subtitle="Public-redacted ranking of OpenClaw opportunity themes."
      />

      <Card>
        <table className="w-full">
          <thead>
            <tr className="bg-surface-dim border-b border-border">
              {['RNK', 'THEME', 'STATUS', 'STRATEGIC', 'TIMING', 'EVIDENCE', 'FIT', 'WHY NOW', 'CHANGE VIEW', 'NEXT STEP'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-2xs font-semibold tracking-widest text-ink-3 uppercase whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-10 text-center text-ink-3 text-sm">No opportunities synced yet</td></tr>
            ) : rows.map(row => (
              <tr key={row.opportunity_id} className="hover:bg-surface-dim transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-ink-3">{String(row.rank).padStart(2, '0')}</td>
                <td className="px-4 py-3 min-w-[220px]">
                  <div className="text-sm font-semibold text-ink">{row.title}</div>
                  <div className="text-2xs text-ink-3 mt-0.5">{(row.themes ?? []).slice(0, 3).join(' / ')}</div>
                </td>
                <td className="px-4 py-3"><StatusChip label={row.status ?? 'watch'} variant={variant(row.status)} /></td>
                <td className="px-4 py-3 font-mono text-xs text-ink">{pct(row.strategic_relevance)}</td>
                <td className="px-4 py-3 font-mono text-xs text-ink">{pct(row.tactical_timing)}</td>
                <td className="px-4 py-3 font-mono text-xs text-ink">{pct(row.evidence_strength)}</td>
                <td className="px-4 py-3 font-mono text-xs text-ink">{pct(row.portfolio_fit_score_public)}</td>
                <td className="px-4 py-3 text-xs text-ink-3 max-w-[220px]">{row.why_now}</td>
                <td className="px-4 py-3 text-xs text-ink-3 max-w-[220px]">{row.what_would_change_the_view}</td>
                <td className="px-4 py-3 text-xs text-ink-2 max-w-[220px]">{row.next_step}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

function variant(status?: string | null): 'red' | 'amber' | 'green' | 'blue' | 'purple' | 'grey' {
  const s = (status ?? '').toLowerCase()
  if (s.includes('high')) return 'green'
  if (s.includes('council')) return 'purple'
  if (s.includes('investigate')) return 'blue'
  if (s.includes('avoid')) return 'red'
  return 'grey'
}

