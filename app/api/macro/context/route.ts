import { NextResponse } from 'next/server'
import { getMacroAssetOverlays, getMacroRegimeSnapshot } from '@/lib/openclaw'

export const revalidate = 300

export async function GET() {
  const [snapshot, overlays] = await Promise.all([
    getMacroRegimeSnapshot(),
    getMacroAssetOverlays(120),
  ])

  return NextResponse.json(
    {
      snapshot,
      overlays,
      counts: {
        snapshots: snapshot ? 1 : 0,
        asset_overlays: overlays.length,
      },
      status: snapshot && overlays.length > 0 ? 'live' : snapshot || overlays.length > 0 ? 'partial' : 'unavailable',
      fallback: false,
      diagnostics: snapshot && overlays.length > 0 ? null : 'Macro context is incomplete. No fallback data was substituted.',
    },
    { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=60' } }
  )
}
