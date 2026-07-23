import Card from '@/components/ui/Card'
import FreshnessChip from '@/components/FreshnessChip'
import type { PortfolioActionRow, SectionStatus } from '@/lib/types'

// Surfaces the portfolio construction engine (MoneyTrail build_portfolio.py):
// the sized entries it proposes from composite-ranked ideas after enforcing
// thesis budgets, single-name caps, dry-powder floor, and portfolio heat.
// Advisory only — the engine never executes.

const HEAT_STYLES: Record<string, string> = {
  cool: 'text-status-green',
  warm: 'text-status-amber',
  hot: 'text-status-red',
}

export default function PortfolioActionsPanel({ rows, freshness }: { rows: PortfolioActionRow[]; freshness?: SectionStatus }) {
  const heat = rows.find(r => r.heat_score != null)
  const totalPct = rows.reduce((s, r) => s + (r.target_pct ?? 0), 0)

  return (
    <Card
      title="Portfolio Builder"
      action={
        <span className="inline-flex items-center gap-2">
          {heat && (
            <span className={`font-mono text-2xs ${HEAT_STYLES[heat.heat_level ?? 'cool']}`}>
              heat {heat.heat_score?.toFixed(0)} · {heat.heat_level}
            </span>
          )}
          {freshness && <FreshnessChip at={freshness.last_ok_at} staleAfterHrs={freshness.stale_after_hours} />}
        </span>
      }
    >
      {rows.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-ink-3">
          No allocation proposals yet — run the engine&apos;s{' '}
          <span className="font-mono text-2xs">build_portfolio</span> stage.
        </div>
      ) : (
        <>
          <div className="divide-y divide-border">
            {rows.map(r => (
              <div key={`${r.symbol}-${r.direction}`} className="px-4 py-2.5" title={r.reason ?? ''}>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-ink w-16 shrink-0">{r.symbol}</span>
                  <span className="text-2xs text-ink-3 flex-1 truncate">{r.thesis}</span>
                  <span className="text-2xs uppercase text-status-green shrink-0">
                    {r.action === 'enter_starter' ? 'enter' : r.action}
                  </span>
                  <span className="font-mono text-sm text-ink w-12 text-right shrink-0">
                    {r.target_pct != null ? `${(r.target_pct * 100).toFixed(1)}%` : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 py-2 text-2xs text-ink-3 border-t border-border">
            {rows.length} proposed {rows.length === 1 ? 'entry' : 'entries'} ·{' '}
            {(totalPct * 100).toFixed(1)}% of NAV to deploy · advisory only
          </div>
        </>
      )}
    </Card>
  )
}
