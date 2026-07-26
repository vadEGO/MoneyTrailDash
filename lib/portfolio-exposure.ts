import type { PortfolioProposalRow, ThesisAllocationRow } from '@/lib/types'

export type ExposureRisk = 'over_max' | 'over_target' | 'at_target' | 'under_target'

export interface ThesisExposure {
  thesis: string
  displayName: string
  currentPct: number
  targetPct: number
  maxPct: number
  risk: ExposureRisk
  heldSymbols: string[]
  candidateSymbols: string[]
}

const THESIS_ALIASES: Record<string, string> = {
  tactical_satellite: 'tactical_satellites',
}

export function normalizeThesis(value?: string | null): string {
  const normalized = (value ?? 'unmapped').trim().toLowerCase().replace(/[\s-]+/g, '_')
  return THESIS_ALIASES[normalized] ?? normalized
}

function uniqueSymbols(rows: PortfolioProposalRow[], actions: Set<string>): string[] {
  return Array.from(new Set(
    rows
      .filter(row => actions.has(row.action ?? ''))
      .map(row => row.symbol?.trim().toUpperCase())
      .filter((symbol): symbol is string => Boolean(symbol))
  )).sort()
}

export function classifyExposure(currentPct: number, targetPct: number, maxPct: number): ExposureRisk {
  const targetTolerance = 0.005
  if (currentPct > maxPct + Number.EPSILON) return 'over_max'
  if (currentPct > targetPct + targetTolerance) return 'over_target'
  if (currentPct >= targetPct - targetTolerance) return 'at_target'
  return 'under_target'
}

export function buildExposureGraph(
  allocations: ThesisAllocationRow[],
  proposals: PortfolioProposalRow[]
): ThesisExposure[] {
  const proposalsByThesis = new Map<string, PortfolioProposalRow[]>()
  for (const proposal of proposals) {
    const thesis = normalizeThesis(proposal.thesis)
    proposalsByThesis.set(thesis, [...(proposalsByThesis.get(thesis) ?? []), proposal])
  }

  return allocations
    .map(allocation => {
      const thesis = normalizeThesis(allocation.thesis)
      const rows = proposalsByThesis.get(thesis) ?? []
      const currentPct = Number(allocation.current_pct ?? 0)
      const targetPct = Number(allocation.target_pct ?? 0)
      const maxPct = Number(allocation.max_pct ?? 1)
      return {
        thesis,
        displayName: allocation.display_name ?? thesis.replaceAll('_', ' '),
        currentPct,
        targetPct,
        maxPct,
        risk: classifyExposure(currentPct, targetPct, maxPct),
        heldSymbols: uniqueSymbols(rows, new Set(['hold'])),
        candidateSymbols: uniqueSymbols(rows, new Set(['enter_starter', 'add'])),
      }
    })
    .sort((left, right) => {
      const severity: Record<ExposureRisk, number> = {
        over_max: 3,
        over_target: 2,
        at_target: 1,
        under_target: 0,
      }
      return severity[right.risk] - severity[left.risk] || right.currentPct - left.currentPct
    })
}
