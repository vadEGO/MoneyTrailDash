import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import StatusChip from '@/components/ui/StatusChip'
import { getLatestSnapshot, getTheses, pct } from '@/lib/openclaw'
import type { ThesisBoardRow } from '@/lib/types'

// ── Lifecycle stage → StatusChip variant ────────────────────────────────────

function lifecycleVariant(stage: string): 'blue' | 'green' | 'amber' | 'red' | 'grey' {
  switch (stage) {
    case 'accumulating': return 'blue'
    case 'expansion': return 'green'
    case 'crowded':
    case 'peak': return 'amber'
    case 'distribution': return 'red'
    default: return 'grey'
  }
}

// ── Crowding bar ─────────────────────────────────────────────────────────────

function CrowdingBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = value < 0.33 ? 'bg-green-500' : value < 0.66 ? 'bg-amber-500' : 'bg-red-500'
  const label = value < 0.33 ? 'Low' : value < 0.66 ? 'Medium' : 'High'
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-2xs text-ink-3">
        <span>Crowding</span>
        <span className="font-mono">{label} ({pct}%)</span>
      </div>
      <div className="h-1.5 bg-surface-dim rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ── Investment Thesis Board ───────────────────────────────────────────────────

function ThesisBoardSection({ theses }: { theses: ThesisBoardRow[] }) {
  if (theses.length === 0) {
    return (
      <Card>
        <div className="px-4 py-10 text-center text-ink-3 text-sm space-y-1">
          <div>No thesis data synced yet</div>
          <div className="font-mono text-xs">python MoneyTrail/scripts/update_thesis_memory.py</div>
        </div>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {theses.map(thesis => (
        <Card
          key={thesis.thesis}
          title={thesis.display_name || thesis.thesis}
          action={
            <div className="flex items-center gap-1.5">
              {thesis.is_placeholder && (
                <StatusChip label="UNSCORED" variant="amber" />
              )}
              <StatusChip
                label={thesis.lifecycle_stage ?? 'unknown'}
                variant={lifecycleVariant(thesis.lifecycle_stage ?? '')}
              />
            </div>
          }
        >
          <div className="p-4 space-y-3">
            {/* Hero strength metric */}
            <div>
              <div className="font-mono text-2xl font-bold text-ink">
                {Math.round((thesis.strength ?? 0) * 100)}%
              </div>
              <div className="text-2xs text-ink-3 uppercase tracking-widest">
                Thesis Strength{thesis.is_placeholder ? ' (placeholder)' : ''}
              </div>
            </div>

            {/* Crowding bar */}
            <CrowdingBar value={thesis.crowding_score ?? 0} />

            {/* Top expressions */}
            {(thesis.top_expressions ?? []).length > 0 && (
              <div className="space-y-1">
                <div className="text-2xs font-semibold tracking-widest text-ink-3 uppercase">
                  Top Expressions
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {thesis.top_expressions.map(expr => (
                    <span
                      key={expr.symbol}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs ${
                        expr.is_placeholder
                          ? 'border-border text-ink-3 bg-surface-dim'
                          : 'border-border text-ink bg-surface'
                      }`}
                    >
                      <span className="font-mono font-semibold">{expr.symbol}</span>
                      <span className="font-mono text-2xs text-ink-3">
                        {expr.is_placeholder ? '~' : ''}{Math.round((expr.score ?? 0) * 100)}%
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ThesesPage() {
  const [theses, snapshot] = await Promise.all([
    getTheses(50),
    getLatestSnapshot(),
  ])

  const thesisBoard = snapshot.thesis_board ?? []

  return (
    <div className="space-y-6">
      {/* ── Investment Thesis Board (MoneyTrail) ── */}
      <div>
        <PageHeader
          title="Investment Thesis Board"
          subtitle="MoneyTrail thesis health — lifecycle, crowding, and top expressions."
        />
        <ThesisBoardSection theses={thesisBoard} />
      </div>

      {/* ── OpenClaw Belief Register ── */}
      <div>
        <PageHeader
          title="Belief Register"
          subtitle="Evolving OpenClaw belief register with confidence movement."
        />

        {theses.length === 0 ? (
          <Card><div className="px-4 py-12 text-center text-ink-3 text-sm">No theses synced yet</div></Card>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {theses.map(thesis => (
              <Card key={thesis.id} title={thesis.status ?? 'research'}>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <h3 className="text-md font-semibold text-ink leading-tight">{thesis.topic}</h3>
                    <div className="text-right">
                      <div className="font-mono text-lg font-bold text-ink">{pct(thesis.confidence)}</div>
                      <div className="text-2xs text-ink-3">{thesis.confidence_movement ?? 'new'}</div>
                    </div>
                  </div>
                  <p className="text-sm text-ink-2 leading-relaxed line-clamp-4">{thesis.core_reasoning}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <StatusChip label={thesis.decision_state ?? 'research'} variant="blue" />
                    <span className="text-xs text-ink-3 truncate">{thesis.next_step}</span>
                  </div>
                  {(thesis.invalidation_conditions ?? []).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <div className="text-2xs font-semibold tracking-widest text-ink-3 uppercase mb-1">Change View If</div>
                      <ul className="text-xs text-ink-3 space-y-1">
                        {(thesis.invalidation_conditions ?? []).slice(0, 3).map(item => <li key={item}>◇ {item}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
