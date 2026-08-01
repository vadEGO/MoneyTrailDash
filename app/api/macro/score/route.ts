import { NextResponse } from 'next/server'
import { getMacroAssetOverlays, getMacroRegimeSnapshot } from '@/lib/openclaw'
import { scoreMacroInput } from '@/lib/macro-scoring'

export const revalidate = 300

export async function GET(request: Request) {
  const url = new URL(request.url)
  return score({
    symbol: url.searchParams.get('symbol'),
    assetClass: url.searchParams.get('assetClass'),
    themes: url.searchParams.getAll('theme'),
  })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  return score({
    symbol: typeof body.symbol === 'string' ? body.symbol : null,
    assetClass: typeof body.assetClass === 'string' ? body.assetClass : null,
    themes: Array.isArray(body.themes) ? body.themes.filter((item: unknown) => typeof item === 'string') : [],
  })
}

async function score(input: { symbol?: string | null; assetClass?: string | null; themes?: string[] }) {
  const [snapshot, overlays] = await Promise.all([
    getMacroRegimeSnapshot(),
    getMacroAssetOverlays(160),
  ])
  const result = scoreMacroInput(input, snapshot, overlays)
  return NextResponse.json(
    {
      ...result,
      input,
      available: result.macro_score != null,
      status: result.macro_score != null ? 'live' : 'unavailable',
      fallback: false,
      regime: snapshot
        ? {
            growth_phase: snapshot.growth_phase,
            liquidity_trend: snapshot.liquidity_trend,
            risk_posture: snapshot.risk_posture,
            macro_season_global: snapshot.macro_season_global,
            macro_season_us: snapshot.macro_season_us,
            macro_season_europe: snapshot.macro_season_europe,
          }
        : null,
    },
    { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=60' } }
  )
}
