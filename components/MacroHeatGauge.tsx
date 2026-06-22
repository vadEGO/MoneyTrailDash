import StatusChip from '@/components/ui/StatusChip'
import type { MacroRegimeData, PortfolioActionRow } from '@/lib/types'

// MacroHeatGauge — the single gating context strip that sits atop the Funnel.
// It answers one question before the user looks at any idea: "is now a moment
// to add risk, or to research/trim only?" It fuses two engine outputs:
//   • macro regime (season + phase) — score_macro_fit.py / update_macro_regime.py
//   • portfolio heat (0–100) — build_portfolio.py
// Replaces the scattered Cockpit widgets + the /risk page.

const SEASON_META: Record<string, { emoji: string; label: string; subtitle: string }> = {
  spring: { emoji: '🌸', label: 'Spring', subtitle: 'Disinflationary boom' },
  summer: { emoji: '☀️', label: 'Summer', subtitle: 'Inflationary boom' },
  fall:   { emoji: '🍂', label: 'Fall',   subtitle: 'Stagflation' },
  winter: { emoji: '❄️', label: 'Winter', subtitle: 'Deflationary bust' },
}

const PHASE_LABELS: Record<string, string> = {
  rec: 'Recovery', exp: 'Expansion', slo: 'Slowdown', con: 'Contraction',
}

// Translate a heat score into the permission it grants. This is the whole point
// of the gauge: it tells the group what the engine will and won't sanction now.
function heatVerdict(score: number | null): { label: string; permits: string; variant: 'green' | 'amber' | 'red' | 'grey' } {
  if (score == null) return { label: 'No heat data', permits: 'Run build_portfolio to gauge risk capacity', variant: 'grey' }
  if (score >= 80) return { label: `Heat ${Math.round(score)} — hot`, permits: 'Research / trim / hedge only — no new risk', variant: 'red' }
  if (score >= 50) return { label: `Heat ${Math.round(score)} — warm`, permits: 'Selective adds — size down, favour ready setups', variant: 'amber' }
  return { label: `Heat ${Math.round(score)} — cool`, permits: 'Room to add — deploy into ready setups', variant: 'green' }
}

export default function MacroHeatGauge({
  regime,
  portfolioActions,
}: {
  regime: MacroRegimeData | null
  portfolioActions: PortfolioActionRow[]
}) {
  const season = regime?.active_season ?? null
  const seasonMeta = season ? SEASON_META[season] : null
  const phase = regime?.country_phases?.['global'] ?? regime?.active_phase ?? null

  const heat = portfolioActions.find(r => r.heat_score != null)
  const verdict = heatVerdict(heat?.heat_score ?? null)

  return (
    <div className="bg-surface border border-border rounded mb-4">
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">

        {/* Regime side */}
        <div className="flex items-center gap-3 min-w-0">
          {seasonMeta ? (
            <>
              <span className="text-2xl leading-none shrink-0">{seasonMeta.emoji}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-ink">{seasonMeta.label}</span>
                  {phase && <StatusChip label={PHASE_LABELS[phase] ?? phase.toUpperCase()} variant="blue" />}
                  {regime?.season_conviction && (
                    <span className="text-2xs font-mono text-ink-3 uppercase">{regime.season_conviction} conviction</span>
                  )}
                </div>
                <div className="text-2xs text-ink-3 mt-0.5">{seasonMeta.subtitle}</div>
              </div>
            </>
          ) : (
            <div className="text-sm text-ink-3">
              No macro regime set —{' '}
              <span className="font-mono text-2xs">update_macro_regime.py --season summer</span>
            </div>
          )}
        </div>

        {/* Heat / permission side */}
        <div className="flex items-center gap-3 shrink-0 sm:border-l sm:border-border sm:pl-4">
          <div className="text-right">
            <div className="flex items-center justify-end gap-2">
              <span className="text-2xs font-semibold uppercase tracking-widest text-ink-3">Portfolio</span>
              <StatusChip label={verdict.label} variant={verdict.variant} />
            </div>
            <div className="text-2xs text-ink-3 mt-1">{verdict.permits}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
