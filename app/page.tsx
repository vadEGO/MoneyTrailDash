import PageHeader from '@/components/ui/PageHeader'
import StatusChip from '@/components/ui/StatusChip'
import AutoRefresh from '@/components/AutoRefresh'
import MacroHeatGauge from '@/components/MacroHeatGauge'
import CatalystRiskHorizon from '@/components/CatalystRiskHorizon'
import FunnelBoard from '@/components/FunnelBoard'
import {
  formatAge,
  getComposite,
  getDashboardSummary,
  getEngineHealth,
  getMacroRegime,
  getMarketCatalystEvents,
  getOpportunityActions,
  getPortfolioActions,
} from '@/lib/openclaw'

// The Funnel is now the home page: one ranked board of every idea, grouped by
// lifecycle state, gated by the macro/heat strip on top. It replaces the old
// Cockpit / Watchlist / Action / Ideas split — all of which were views of this
// same object (public_opportunity_action_board).
export default async function FunnelPage() {
  const [ideas, composite, regime, portfolioActions, catalysts, summary, health] = await Promise.all([
    // The evidence-review batch must see the complete active idea set so
    // deduplication and priority are not biased by the funnel's first page.
    getOpportunityActions(500),
    getComposite(),
    getMacroRegime(),
    getPortfolioActions(),
    getMarketCatalystEvents(),
    getDashboardSummary(),
    getEngineHealth(5),
  ])

  // Stale if the engine flags it OR we have never synced — matches the old Cockpit,
  // so a synced-but-stale pipeline still shows STALE rather than a false LIVE.
  const isStale = health[0]?.is_stale ?? !summary?.last_synced_at

  return (
    <div>
      <PageHeader
        title="Funnel"
        subtitle="Every idea, ranked and grouped by where it sits in its lifecycle. Tap a row for chart, levels, thesis, and score breakdown."
        status={
          <div className="flex items-center gap-2">
            <StatusChip label={isStale ? 'STALE' : 'LIVE'} variant={isStale ? 'amber' : 'green'} />
            <span className="text-2xs font-mono text-ink-3 uppercase">{formatAge(summary?.last_synced_at)}</span>
          </div>
        }
        action={<AutoRefresh />}
      />

      <MacroHeatGauge regime={regime} portfolioActions={portfolioActions} />
      <CatalystRiskHorizon events={catalysts} />

      <FunnelBoard ideas={ideas} composite={composite} />
    </div>
  )
}
