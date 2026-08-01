import { NextResponse } from 'next/server'
import { boundedIntegerParam } from '@/lib/api-params'
import { getMacroDataLatest } from '@/lib/openclaw'

export const revalidate = 300

export async function GET(request: Request) {
  const url = new URL(request.url)
  const sourceKind = normalize(url.searchParams.get('sourceKind'))
  const seriesId = normalize(url.searchParams.get('seriesId'))
  const country = normalize(url.searchParams.get('country'))
  const limit = boundedIntegerParam(url.searchParams.get('limit'), 160, 300)
  const rows = await getMacroDataLatest(300)
  const filtered = rows
    .filter(row => !sourceKind || normalize(row.source_kind) === sourceKind)
    .filter(row => !seriesId || normalize(row.series_id) === seriesId)
    .filter(row => !country || normalize(row.country) === country)
    .slice(0, limit)

  return NextResponse.json(
    { data: filtered, count: filtered.length, fallback: rows.length === 0, filters: { sourceKind, seriesId, country, limit } },
    { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=60' } }
  )
}

function normalize(value?: string | null) {
  return value?.trim().toUpperCase() || null
}
