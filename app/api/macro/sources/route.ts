import { NextResponse } from 'next/server'
import { getMacroSourceStatus } from '@/lib/openclaw'

export const revalidate = 300

export async function GET() {
  const sources = await getMacroSourceStatus(120)
  return NextResponse.json(
    {
      sources,
      count: sources.length,
      active: sources.filter(source => source.status === 'ok' || source.status === 'partial').length,
      live: sources.filter(source => source.status === 'ok').length,
      partial: sources.filter(source => source.status === 'partial').length,
      pending: sources.filter(source => source.status === 'pending' || source.status === 'registered').length,
      failed: sources.filter(source => source.status === 'failed').length,
    },
    { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=60' } }
  )
}
