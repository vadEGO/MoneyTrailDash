import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import FearGreedWidget from '@/components/FearGreedWidget'
import MacroRegimeWidget from '@/components/MacroRegimeWidget'
import MacroFitPanel from '@/components/MacroFitPanel'
import PortfolioActionsPanel from '@/components/PortfolioActionsPanel'
import FreshnessChip from '@/components/FreshnessChip'
import { getComposite, getMacroRegime, getPortfolioActions, getSectionStatus } from '@/lib/openclaw'

// Market & Macro — the gating context the old Cockpit sidebar carried, given its
// own surface: sentiment (Fear & Greed), the full macro regime (seasons/momentum,
// asset-class playbook, country phases), idea conviction, and portfolio actions.
// The Funnel's compact MacroHeatGauge is the one-line summary; this is the detail.
export default async function MacroPage() {
  const [regime, composite, portfolioActions, sections] = await Promise.all([
    getMacroRegime(),
    getComposite(),
    getPortfolioActions(),
    getSectionStatus(),
  ])
  const scores = sections['scores']
  const portfolio = sections['portfolio']

  return (
    <div>
      <PageHeader
        title="Market & Macro"
        subtitle="Sentiment, regime, and portfolio context — the conditions that gate the funnel."
        status={scores && <FreshnessChip label="scores" at={scores.last_ok_at} staleAfterHrs={scores.stale_after_hours} />}
      />

      <div className="space-y-4 lg:grid lg:grid-cols-3 lg:gap-4 lg:space-y-0">
        {/* Left: sentiment + regime detail (the heart of the old cockpit) */}
        <div className="lg:col-span-2 space-y-4">
          <Card title="Market Sentiment">
            <div className="p-3">
              <FearGreedWidget />
            </div>
          </Card>

          <MacroRegimeWidget regime={regime} />
        </div>

        {/* Right: how the regime translates into ideas + positioning */}
        <div className="space-y-4">
          <MacroFitPanel rows={composite} freshness={scores} />
          <PortfolioActionsPanel rows={portfolioActions} freshness={portfolio} />
        </div>
      </div>
    </div>
  )
}
