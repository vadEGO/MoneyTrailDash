import PageHeader from '@/components/ui/PageHeader'
import StatusChip from '@/components/ui/StatusChip'
import AutoRefresh from '@/components/AutoRefresh'
import MacroHeatGauge from '@/components/MacroHeatGauge'
import CatalystRiskHorizon from '@/components/CatalystRiskHorizon'
import FunnelBoard from '@/components/FunnelBoard'
import PipelineStatus from '@/components/PipelineStatus'
import { pipelineHealth } from '@/lib/pipeline-health'
import {
  formatAge,
  getComposite,
  getDashboardSummary,
  getSectionStatus,
  getMacroRegime,
  getMarketCatalystEvents,
  getAllOpportunityActions,
  getPortfolioActions,
} from '@/lib/openclaw'

export const dynamic = 'force-dynamic'

// The Funnel is now the home page: one ranked board of every idea, grouped by
// lifecycle state, gated by the macro/heat strip on top. It replaces the old
// Cockpit / Watchlist / Action / Ideas split — all of which were views of this
// same object (public_opportunity_action_board).
export default async function FunnelPage() {
  const [ideas, composite, regime, portfolioActions, catalysts, summary, sections] = await Promise.all([
    // The evidence-review batch must see the complete active idea set so
    // deduplication and priority are not biased by the funnel's first page.
    // Paginate beyond Supabase's per-request limit to keep every active idea.
    getAllOpportunityActions(),
    getComposite(),
    getMacroRegime(),
    getPortfolioActions(),
    getMarketCatalystEvents(),
    getDashboardSummary(),
    getSectionStatus(),
  ])

  const health = pipelineHealth(sections)

  return (
    <div>
      <PageHeader
        title="Funnel"
        subtitle="Every idea, ranked and grouped by where it sits in its lifecycle. Tap a row for chart, levels, thesis, and score breakdown."
        status={
          <div className="flex items-center gap-2">
            <StatusChip {...health} />
            <span className="text-2xs font-mono text-ink-3 uppercase">Published {formatAge(summary?.last_synced_at)}</span>
          </div>
        }
        action={<AutoRefresh />}
      />

      <PipelineStatus sections={sections} />
      <MacroHeatGauge regime={regime} portfolioActions={portfolioActions} />
      <CatalystRiskHorizon events={catalysts} />

      <FunnelBoard ideas={ideas} composite={composite} />
    </div>
  )
}
