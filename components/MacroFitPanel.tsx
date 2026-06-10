import Card from '@/components/ui/Card'
import type { CompositeRow } from '@/lib/types'

// Surfaces the engine's blended conviction per trade idea: macro fit
// (score_macro_fit.py) × technical posture (score_technical.py), fused in the
// public_rv_trade_composite view. Macro = is this idea aligned with the regime?
// Technical = is the chart confirming? Composite = the single ranked answer.

function scoreColor(score: number | null): string {
  if (score == null) return 'text-ink-3'
  if (score >= 60) return 'text-status-green'
  if (score <= 40) return 'text-status-red'
  return 'text-ink-2'
}

function miniBadge(score: number | null, title: string): JSX.Element {
  const v = score == null ? '—' : score.toFixed(0)
  return (
    <span className={`font-mono text-2xs ${scoreColor(score)}`} title={title}>
      {v}
    </span>
  )
}

export default function MacroFitPanel({ rows, limit = 8 }: { rows: CompositeRow[]; limit?: number }) {
  const season = rows.find(r => r.regime_season)?.regime_season
  const withTech = rows.filter(r => r.technical_score != null).length

  return (
    <Card
      title="Idea Conviction"
      action={
        rows.length > 0 ? (
          <span className="font-mono text-2xs text-ink-3">
            macro×tech{season ? ` · ${season}` : ''}
          </span>
        ) : undefined
      }
    >
      {rows.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-ink-3">
          No conviction scores yet — run the engine&apos;s{' '}
          <span className="font-mono text-2xs">score_macro_fit</span> /{' '}
          <span className="font-mono text-2xs">score_technical</span> stages.
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 px-4 py-1.5 border-b border-border text-2xs uppercase tracking-wide text-ink-3">
            <span className="w-14 shrink-0">Symbol</span>
            <span className="w-10 shrink-0">Dir</span>
            <span className="flex-1 text-right">Macro</span>
            <span className="flex-1 text-right">Tech</span>
            <span className="w-12 text-right">Score</span>
          </div>
          <div className="divide-y divide-border">
            {rows.slice(0, limit).map(r => (
              <div
                key={r.idea_id}
                className="flex items-center gap-3 px-4 py-2.5"
                title={`Macro: ${r.macro_label ?? '—'} · Technical: ${r.technical_label ?? '—'}${r.trend ? ` (${r.trend}` : ''}${r.rsi != null ? `, RSI ${r.rsi.toFixed(0)})` : r.trend ? ')' : ''}`}
              >
                <span className="font-mono text-sm text-ink w-14 shrink-0">{r.symbol}</span>
                <span className="text-2xs text-ink-3 uppercase w-10 shrink-0">{r.direction}</span>
                <span className="flex-1 text-right">{miniBadge(r.macro_fit_score, r.macro_label ?? '')}</span>
                <span className="flex-1 text-right">{miniBadge(r.technical_score, r.technical_label ?? 'no candles')}</span>
                <span className={`w-12 text-right font-mono text-sm font-semibold ${scoreColor(r.composite_score)}`}>
                  {r.composite_score?.toFixed(0) ?? '—'}
                </span>
              </div>
            ))}
          </div>
          <div className="px-4 py-2 text-2xs text-ink-3 border-t border-border">
            {withTech}/{rows.length} ideas have chart data · blended 50/50
          </div>
        </>
      )}
    </Card>
  )
}
