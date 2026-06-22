import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import FearGreedWidget from '@/components/FearGreedWidget'
import MacroRegimeWidget from '@/components/MacroRegimeWidget'
import MacroFitPanel from '@/components/MacroFitPanel'
import PortfolioActionsPanel from '@/components/PortfolioActionsPanel'
import { getComposite, getMacroRegime, getPortfolioActions } from '@/lib/openclaw'

// Market & Macro — the gating context the old Cockpit sidebar carried, given its
// own surface: sentiment (Fear & Greed), the full macro regime (seasons/momentum,
// asset-class playbook, country phases), idea conviction, and portfolio actions.
// The Funnel's compact MacroHeatGauge is the one-line summary; this is the detail.
export default async function MacroPage() {
  const [regime, composite, portfolioActions] = await Promise.all([
    getMacroRegime(),
    getComposite(),
    getPortfolioActions(),
  ])

  return (
    <div>
      <PageHeader
        title="Market & Macro"
        subtitle="Sentiment, regime, and portfolio context — the conditions that gate the funnel."
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
          <MacroFitPanel rows={composite} />
          <PortfolioActionsPanel rows={portfolioActions} />
        </div>
      </div>
    </div>
  )
}
