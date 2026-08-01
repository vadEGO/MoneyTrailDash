import { NextResponse } from 'next/server'
import { boundedIntegerParam } from '@/lib/api-params'
import { getMacroHistory } from '@/lib/openclaw'

export const revalidate = 300

export async function GET(request: Request) {
  const url = new URL(request.url)
  const limit = boundedIntegerParam(url.searchParams.get('limit'), 12, 50)
  const snapshots = await getMacroHistory(limit)

  return NextResponse.json(
    {
      snapshots,
      count: snapshots.length,
      status: snapshots.length > 0 ? 'live' : 'unavailable',
      fallback: false,
      diagnostics: snapshots.length > 0 ? null : 'No macro history is published. No fallback snapshot was substituted.',
    },
    { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=60' } }
  )
}
