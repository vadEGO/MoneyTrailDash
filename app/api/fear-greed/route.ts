import { NextResponse } from 'next/server'
import {
  buildFearGreedResult,
  FEAR_GREED_SERIES_IDS,
} from '@/lib/fear-greed'
import { getMacroDataLatestForSeries } from '@/lib/openclaw'

export const revalidate = 300

export async function GET(): Promise<NextResponse> {
  const rows = await getMacroDataLatestForSeries(FEAR_GREED_SERIES_IDS).catch(() => [])
  return NextResponse.json(buildFearGreedResult(rows), {
    headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=60' },
  })
}
