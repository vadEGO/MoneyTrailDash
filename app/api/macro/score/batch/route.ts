import { NextResponse } from 'next/server'
import { getMacroAssetOverlays, getMacroRegimeSnapshot } from '@/lib/openclaw'
import { scoreMacroInput, type MacroScoreInput } from '@/lib/macro-scoring'

export const revalidate = 300

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const rawItems = Array.isArray(body.items) ? body.items : []
  const items: MacroScoreInput[] = rawItems.slice(0, 200).map(normalizeInput)

  const [snapshot, overlays] = await Promise.all([
    getMacroRegimeSnapshot(),
    getMacroAssetOverlays(240),
  ])
  const results = items.map(item => ({
    input: item,
    ...scoreMacroInput(item, snapshot, overlays),
  }))
  const available = results.filter(result => result.macro_score != null).length

  return NextResponse.json(
    {
      results,
      count: items.length,
      available,
      status: available === items.length && items.length > 0 ? 'live' : available > 0 ? 'partial' : 'unavailable',
      fallback: false,
      snapshot_id: snapshot?.id ?? null,
      report_date: snapshot?.report_date ?? null,
    },
    { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=60' } }
  )
}

function normalizeInput(value: unknown): MacroScoreInput {
  if (!value || typeof value !== 'object') return {}
  const record = value as Record<string, unknown>
  return {
    symbol: typeof record.symbol === 'string' ? record.symbol : null,
    assetClass: typeof record.assetClass === 'string' ? record.assetClass : null,
    themes: Array.isArray(record.themes) ? record.themes.filter((item): item is string => typeof item === 'string') : [],
  }
}
