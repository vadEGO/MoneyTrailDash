import type { MacroAssetOverlay, MacroRegimeSnapshot } from '@/lib/types'

export interface MacroScoreInput {
  symbol?: string | null
  assetClass?: string | null
  themes?: string[] | null
}

export interface MacroScoreResult {
  symbol: string | null
  macro_score: number | null
  stance: string
  rationale: string
  matched_by: 'symbol' | 'unavailable'
  snapshot_id: string | null
  report_date: string | null
}

export function scoreMacroInput(
  input: MacroScoreInput,
  snapshot: MacroRegimeSnapshot | null,
  overlays: MacroAssetOverlay[]
): MacroScoreResult {
  const symbol = normalizeSymbol(input.symbol)
  const overlay = symbol ? overlays.find(row => normalizeSymbol(row.symbol) === symbol) : undefined
  const overlayScore = validatedScore(overlay?.macro_score)
  if (overlay && overlayScore != null) {
    return {
      symbol,
      macro_score: overlayScore,
      stance: overlay.stance ?? 'neutral',
      rationale: overlay.rationale_public ?? 'Matched direct macro asset overlay.',
      matched_by: 'symbol',
      snapshot_id: overlay.snapshot_id ?? snapshot?.id ?? null,
      report_date: overlay.report_date ?? snapshot?.report_date ?? null,
    }
  }

  return {
    symbol,
    macro_score: null,
    stance: 'unavailable',
    rationale: overlay
      ? 'The upstream OpenClaw macro overlay was rejected because its score is missing, non-numeric, non-finite, or outside 0–100. No fallback score was generated.'
      : 'No upstream OpenClaw macro overlay is available for this asset. No fallback score was generated.',
    matched_by: 'unavailable',
    snapshot_id: snapshot?.id ?? null,
    report_date: snapshot?.report_date ?? null,
  }
}

function normalizeSymbol(value?: string | null) {
  return value?.trim().toUpperCase() || null
}

function validatedScore(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return value >= 0 && value <= 100 ? value : null
}
