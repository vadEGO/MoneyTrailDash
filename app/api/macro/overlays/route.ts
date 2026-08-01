import { NextResponse } from 'next/server'
import { boundedIntegerParam } from '@/lib/api-params'
import { getMacroAssetOverlays } from '@/lib/openclaw'

export const revalidate = 300

export async function GET(request: Request) {
  const url = new URL(request.url)
  const symbol = normalize(url.searchParams.get('symbol'))
  const assetClass = normalize(url.searchParams.get('assetClass'))
  const stance = normalize(url.searchParams.get('stance'))
  const limit = boundedIntegerParam(url.searchParams.get('limit'), 120, 240)

  const overlays = await getMacroAssetOverlays(240)
  const filtered = overlays
    .filter(row => !symbol || normalize(row.symbol) === symbol)
    .filter(row => !assetClass || normalize(row.asset_class) === assetClass)
    .filter(row => !stance || normalize(row.stance) === stance)
    .slice(0, limit)

  return NextResponse.json(
    {
      overlays: filtered,
      count: filtered.length,
      status: overlays.length > 0 ? 'live' : 'unavailable',
      fallback: false,
      diagnostics: overlays.length > 0 ? null : 'No asset overlays are published. No fallback overlays were substituted.',
      filters: { symbol, assetClass, stance, limit },
    },
    { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=60' } }
  )
}

function normalize(value?: string | null) {
  return value?.trim().toUpperCase() || null
}
