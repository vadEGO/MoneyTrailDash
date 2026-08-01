import { NextResponse } from 'next/server'
import { getMacroAssetOverlays, getMacroRegimeSnapshot } from '@/lib/openclaw'

export const revalidate = 300

export async function GET() {
  const [snapshot, overlays] = await Promise.all([
    getMacroRegimeSnapshot(),
    getMacroAssetOverlays(240),
  ])
  const status = snapshot && overlays.length > 0 ? 'live' : snapshot || overlays.length > 0 ? 'partial' : 'unavailable'

  return NextResponse.json(
    {
      status,
      fallback: false,
      snapshot_id: snapshot?.id ?? null,
      report_date: snapshot?.report_date ?? null,
      overlay_count: overlays.length,
      diagnostics: status === 'live' ? null : 'Macro context is incomplete. No fallback data was substituted.',
      endpoints: [
        '/api/macro/regions',
        '/api/macro/regions/history',
        '/api/macro/context',
        '/api/macro/score',
        '/api/macro/score/batch',
        '/api/macro/overlays',
        '/api/macro/history',
        '/api/macro/health',
        '/api/fear-greed',
      ],
    },
    { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=60' } }
  )
}
