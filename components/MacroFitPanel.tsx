import Card from '@/components/ui/Card'
import type { MacroFitRow } from '@/lib/types'

// Surfaces the macro-fit scorer's output (MoneyTrail scripts/score_macro_fit.py):
// which open trade ideas the current macro regime is a tailwind / headwind for.

const LABEL_STYLES: Record<string, string> = {
  tailwind: 'text-status-green',
  headwind: 'text-status-red',
  neutral: 'text-ink-3',
  unknown: 'text-ink-3',
}

const LABEL_DOT: Record<string, string> = {
  tailwind: 'bg-status-green',
  headwind: 'bg-status-red',
  neutral: 'bg-ink-3',
  unknown: 'bg-ink-3',
}

function scoreColor(score: number | null): string {
  if (score == null) return 'text-ink-3'
  if (score >= 60) return 'text-status-green'
  if (score <= 40) return 'text-status-red'
  return 'text-ink-2'
}

export default function MacroFitPanel({ rows, limit = 8 }: { rows: MacroFitRow[]; limit?: number }) {
  const tail = rows.filter(r => r.label === 'tailwind').length
  const head = rows.filter(r => r.label === 'headwind').length
  const season = rows.find(r => r.regime_season)?.regime_season

  return (
    <Card
      title="Macro Fit"
      action={
        rows.length > 0 ? (
          <span className="font-mono text-2xs">
            <span className="text-status-green">{tail}↑</span>{' · '}
            <span className="text-status-red">{head}↓</span>
            {season ? ` · ${season}` : ''}
          </span>
        ) : undefined
      }
    >
      {rows.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-ink-3">
          No macro-fit scores yet — run the engine&apos;s <span className="font-mono text-2xs">score_macro_fit</span> stage.
        </div>
      ) : (
        <div className="divide-y divide-border">
          {rows.slice(0, limit).map(r => (
            <div key={r.idea_id} className="flex items-center gap-3 px-4 py-2.5" title={r.rationale ?? ''}>
              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${LABEL_DOT[r.label ?? 'unknown']}`} />
              <span className="font-mono text-sm text-ink w-16 shrink-0">{r.symbol}</span>
              <span className="text-2xs text-ink-3 uppercase w-12 shrink-0">{r.direction}</span>
              <span className={`text-2xs uppercase flex-1 ${LABEL_STYLES[r.label ?? 'unknown']}`}>
                {r.label}
              </span>
              <span className={`font-mono text-sm shrink-0 ${scoreColor(r.macro_fit_score)}`}>
                {r.macro_fit_score?.toFixed(0) ?? '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
