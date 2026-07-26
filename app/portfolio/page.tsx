import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import StatusChip from '@/components/ui/StatusChip'
import FreshnessChip from '@/components/FreshnessChip'
import { getThesisAllocation, getPortfolioProposal, getSectionStatus } from '@/lib/openclaw'
import { buildExposureGraph, type ExposureRisk, type ThesisExposure } from '@/lib/portfolio-exposure'
import type { PortfolioProposalRow, ThesisAllocationRow } from '@/lib/types'

const RISK_COPY: Record<ExposureRisk, { label: string; variant: 'red' | 'amber' | 'green' | 'blue'; note: string }> = {
  over_max: {
    label: 'Over hard max',
    variant: 'red',
    note: 'Research concentration before considering additional correlated exposure.',
  },
  over_target: {
    label: 'Over target',
    variant: 'amber',
    note: 'Above plan but inside the hard ceiling.',
  },
  at_target: {
    label: 'At target',
    variant: 'green',
    note: 'Inside the target tolerance.',
  },
  under_target: {
    label: 'Under target',
    variant: 'blue',
    note: 'Capacity exists, subject to evidence and entry review.',
  },
}

// Portfolio — the "how to build the portfolio" guidance surface. It answers three
// questions the engine (build_portfolio.py) computes:
//   1. How much risk can I take now?      → portfolio heat + what it permits
//   2. Where am I vs my plan?             → thesis allocation (current vs target)
//   3. What should I actually do?         → sized, gated proposal per idea
export default async function PortfolioPage() {
  const [allocation, proposal, sections] = await Promise.all([
    getThesisAllocation(),
    getPortfolioProposal(200),
    getSectionStatus(),
  ])

  const heat = proposal.find(r => r.heat_score != null)
  const nav = allocation.find(a => a.nav != null)?.nav ?? null
  const portfolio = sections['portfolio']
  // Prefer the section runner's authoritative last-run; fall back to row timestamps.
  const updated = portfolio?.last_ok_at ?? allocation[0]?.updated_at ?? proposal[0]?.proposed_at ?? null

  // Split proposal by what the engine is actually telling you to do.
  const actionable = proposal.filter(r => r.action === 'enter_starter' || r.action === 'add')
  const holds = proposal.filter(r => r.action === 'hold')
  const blocked = proposal.filter(r => r.action === 'blocked')
  const exposures = buildExposureGraph(allocation, proposal)
  const overMax = exposures.filter(exposure => exposure.risk === 'over_max')

  return (
    <div className="space-y-4">
      <PageHeader
        title="Portfolio"
        subtitle="Build guidance: risk capacity, allocation vs plan, and the engine's sized proposals."
        status={
          <div className="flex items-center gap-2">
            {nav != null && <span className="text-2xs font-mono text-ink-3">NAV ${Math.round(nav).toLocaleString()}</span>}
            <FreshnessChip at={updated} staleAfterHrs={portfolio?.stale_after_hours ?? 28} />
          </div>
        }
      />

      <HeatBanner heat={heat} />

      {overMax.length > 0 && (
        <div className="border border-status-red bg-red-50 px-4 py-3">
          <div className="text-2xs font-semibold uppercase tracking-widest text-status-red">Concentration review required</div>
          <p className="mt-1 text-sm text-ink">
            {overMax.map(exposure => exposure.displayName).join(', ')} {overMax.length === 1 ? 'is' : 'are'} above the configured hard ceiling.
            This is an attention flag, not a trade instruction.
          </p>
        </div>
      )}

      <Card
        title="Thesis → Position Exposure"
        action={<span className="font-mono text-2xs text-ink-3">current / target / max</span>}
      >
        {exposures.length === 0 ? (
          <Empty msg="No public-safe portfolio allocation data is available." />
        ) : (
          <div className="divide-y divide-border">
            {exposures.map(exposure => <ExposureRow key={exposure.thesis} exposure={exposure} />)}
          </div>
        )}
        <div className="border-t border-border px-4 py-2 text-2xs text-ink-3">
          Hold-state symbols count as current mappings. Enter/add candidates are shown separately and never counted as current exposure.
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Allocation vs plan */}
        <Card title="Allocation vs Plan">
          {allocation.length === 0 ? (
            <Empty msg="No allocation synced — run build_portfolio.py --write." />
          ) : (
            <div className="divide-y divide-border">
              {allocation.map(a => <AllocationRow key={a.thesis} row={a} />)}
            </div>
          )}
        </Card>

        {/* What to do */}
        <Card
          title="Proposed Actions"
          action={<span className="font-mono text-2xs text-ink-3">{actionable.length} to add · {holds.length} hold</span>}
        >
          {proposal.length === 0 ? (
            <Empty msg="No proposal synced yet." />
          ) : actionable.length === 0 ? (
            <div className="px-4 py-6 text-sm text-ink-3">
              <div className="font-semibold text-ink mb-1">Nothing to add right now.</div>
              The engine isn&apos;t proposing new entries — typically because dry powder is at its
              floor or a thesis is at budget. Holds and blocks are listed below.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {actionable.slice(0, 12).map(r => <ProposalRow key={r.symbol} row={r} />)}
            </div>
          )}
        </Card>
      </div>

      {/* Holds + blocked — the full picture, with reasons */}
      {(holds.length > 0 || blocked.length > 0) && (
        <Card title="Current Holdings & Constraints">
          <div className="divide-y divide-border">
            {holds.map(r => <ProposalRow key={`h-${r.symbol}`} row={r} />)}
            {blocked.map(r => <ProposalRow key={`b-${r.symbol}`} row={r} />)}
          </div>
        </Card>
      )}
    </div>
  )
}

function ExposureRow({ exposure }: { exposure: ThesisExposure }) {
  const risk = RISK_COPY[exposure.risk]
  const scale = Math.max(exposure.maxPct, exposure.currentPct, exposure.targetPct, 0.01)
  const currentWidth = Math.min(100, (exposure.currentPct / scale) * 100)
  const targetLeft = Math.min(100, (exposure.targetPct / scale) * 100)
  const maxLeft = Math.min(100, (exposure.maxPct / scale) * 100)

  return (
    <div className="grid grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-[160px_minmax(260px,1fr)_minmax(220px,0.8fr)] lg:items-center">
      <div>
        <div className="text-sm font-semibold text-ink">{exposure.displayName}</div>
        <div className="mt-1"><StatusChip label={risk.label} variant={risk.variant} /></div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-3 font-mono text-2xs text-ink-3">
          <span>{formatPct(exposure.currentPct)} current</span>
          <span>{formatPct(exposure.targetPct)} target · {formatPct(exposure.maxPct)} max</span>
        </div>
        <div
          className="relative h-3 overflow-hidden rounded-sm bg-surface-dim"
          role="img"
          aria-label={`${exposure.displayName}: ${formatPct(exposure.currentPct)} current, ${formatPct(exposure.targetPct)} target, ${formatPct(exposure.maxPct)} maximum`}
        >
          <div
            className={`h-full ${exposure.risk === 'over_max' ? 'bg-status-red' : exposure.risk === 'over_target' ? 'bg-status-amber' : 'bg-status-blue'}`}
            style={{ width: `${currentWidth}%` }}
          />
          <div className="absolute inset-y-0 w-0.5 bg-ink" style={{ left: `${targetLeft}%` }} title="Target" />
          <div className="absolute inset-y-0 w-0.5 bg-status-red" style={{ left: `${maxLeft}%` }} title="Hard maximum" />
        </div>
        <p className="mt-1.5 text-2xs text-ink-3">{risk.note}</p>
      </div>

      <div className="space-y-2">
        <SymbolList label="Current holds" symbols={exposure.heldSymbols} empty="No symbol mapping" />
        <SymbolList label="Review candidates" symbols={exposure.candidateSymbols} empty="None" />
      </div>
    </div>
  )
}

function SymbolList({ label, symbols, empty }: { label: string; symbols: string[]; empty: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="w-24 shrink-0 text-2xs uppercase tracking-wide text-ink-3">{label}</span>
      <div className="flex flex-wrap gap-1">
        {symbols.length === 0
          ? <span className="text-2xs text-ink-3">{empty}</span>
          : symbols.map(symbol => (
            <span key={symbol} className="rounded-sm border border-border bg-surface-dim px-1.5 py-0.5 font-mono text-2xs text-ink">
              {symbol}
            </span>
          ))}
      </div>
    </div>
  )
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

// ── Heat banner — risk capacity + what it permits ─────────────────────────────

function HeatBanner({ heat }: { heat?: PortfolioProposalRow }) {
  const score = heat?.heat_score ?? null
  const level = heat?.heat_level ?? null
  const verdict =
    score == null ? { text: 'No heat data', permits: 'Run build_portfolio.py to gauge risk capacity.', variant: 'grey' as const } :
    score >= 80 ? { text: `Heat ${Math.round(score)} — hot`, permits: 'Research / trim / hedge only — no new risk.', variant: 'red' as const } :
    score >= 50 ? { text: `Heat ${Math.round(score)} — warm`, permits: 'Selective adds — size down, favour ready setups.', variant: 'amber' as const } :
    { text: `Heat ${Math.round(score)} — cool`, permits: 'Room to add — deploy into ready setups.', variant: 'green' as const }

  return (
    <Card>
      <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xs font-semibold uppercase tracking-widest text-ink-3">Risk capacity</span>
          <StatusChip label={verdict.text} variant={verdict.variant} />
        </div>
        <span className="text-xs text-ink-3">{verdict.permits}</span>
      </div>
    </Card>
  )
}

// ── Allocation row — current vs target bar ────────────────────────────────────

function AllocationRow({ row }: { row: ThesisAllocationRow }) {
  const cur = (row.current_pct ?? 0) * 100
  const tgt = (row.target_pct ?? 0) * 100
  const max = (row.max_pct ?? 1) * 100
  // Over target → amber; near/over max → red; under target → blue (room to add).
  const over = cur > max - 0.01 ? 'bg-status-red' : cur > tgt ? 'bg-status-amber' : 'bg-status-blue'
  const gap = cur - tgt
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-semibold text-ink">{row.display_name ?? row.thesis}</span>
        <span className="font-mono text-2xs text-ink-3">
          {cur.toFixed(1)}% <span className="text-ink-3">/</span> {tgt.toFixed(0)}% target
          {Math.abs(gap) >= 1 && (
            <span className={gap > 0 ? 'text-status-amber ml-1' : 'text-status-blue ml-1'}>
              ({gap > 0 ? '+' : ''}{gap.toFixed(0)})
            </span>
          )}
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-surface-dim overflow-hidden">
        <div className={`h-full ${over} transition-all`} style={{ width: `${Math.min(100, cur)}%` }} />
        {/* target marker */}
        <div className="absolute top-0 h-full w-px bg-ink" style={{ left: `${Math.min(100, tgt)}%` }} title={`target ${tgt.toFixed(0)}%`} />
      </div>
    </div>
  )
}

// ── Proposal row ──────────────────────────────────────────────────────────────

function ProposalRow({ row }: { row: PortfolioProposalRow }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-xs font-bold text-ink">{row.symbol}</span>
          {row.thesis && <span className="text-2xs text-ink-3">{row.thesis.replace(/_/g, ' ')}</span>}
          <StatusChip label={actionLabel(row.action)} variant={actionVariant(row.action)} />
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {row.composite_score != null && <span className="font-mono text-2xs text-ink-3">{Math.round(row.composite_score)}</span>}
          {row.target_pct != null && row.target_pct > 0 && (
            <span className="font-mono text-xs text-ink">{(row.target_pct * 100).toFixed(1)}%</span>
          )}
        </div>
      </div>
      {row.reason && <p className="text-2xs text-ink-3 mt-1 line-clamp-2">{row.reason}</p>}
    </div>
  )
}

function Empty({ msg }: { msg: string }) {
  return <div className="px-4 py-8 text-center text-sm text-ink-3">{msg}</div>
}

function actionLabel(a?: string | null): string {
  return { enter_starter: 'Enter', add: 'Add', hold: 'Hold', blocked: 'Blocked', skip: 'Skip' }[(a ?? '')] ?? (a ?? '—')
}

function actionVariant(a?: string | null): 'red' | 'amber' | 'green' | 'blue' | 'purple' | 'grey' {
  const s = a ?? ''
  if (s === 'enter_starter' || s === 'add') return 'green'
  if (s === 'hold') return 'blue'
  if (s === 'blocked') return 'red'
  return 'grey'
}
