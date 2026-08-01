import { NextResponse } from 'next/server'
import { boundedIntegerParam } from '@/lib/api-params'
import { getMacroRegionalHistory } from '@/lib/openclaw'

export const revalidate = 300

const CACHE_CONTROL = 's-maxage=300, stale-while-revalidate=60'
const REGIONS = new Set(['GLOBAL', 'US', 'EUROZONE', 'UK', 'JAPAN', 'AUSTRALIA', 'CANADA'])
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const region = normalizeRegion(searchParams.get('region'))
  const from = normalizeDate(searchParams.get('from'))
  const to = normalizeDate(searchParams.get('to'))
  const limit = boundedIntegerParam(searchParams.get('limit'), 180, 1000)

  if (region === false) {
    return NextResponse.json(
      { error: 'Invalid region.', allowed_regions: Array.from(REGIONS) },
      { status: 400 }
    )
  }
  if (from === false || to === false) {
    return NextResponse.json(
      { error: 'from and to must be valid ISO dates in YYYY-MM-DD format.' },
      { status: 400 }
    )
  }
  if (from && to && from > to) {
    return NextResponse.json(
      { error: 'from must be earlier than or equal to to.' },
      { status: 400 }
    )
  }

  const history = await getMacroRegionalHistory({ region, from, to, limit })

  return NextResponse.json(
    {
      history,
      count: history.length,
      status: history.length > 0 ? 'live' : 'unavailable',
      diagnostics: history.length > 0
        ? null
        : 'No regional macro history matched the request. No fallback history was substituted.',
      filters: { region, from, to, limit },
    },
    { headers: { 'Cache-Control': CACHE_CONTROL } }
  )
}

function normalizeRegion(value: string | null): string | null | false {
  if (!value?.trim()) return null
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, '_')
  const region = normalized === 'EURO_ZONE' || normalized === 'EUROPE' || normalized === 'EU'
    ? 'EUROZONE'
    : normalized
  return REGIONS.has(region) ? region : false
}

function normalizeDate(value: string | null): string | null | false {
  if (!value?.trim()) return null
  const normalized = value.trim()
  if (!ISO_DATE.test(normalized)) return false
  const parsed = new Date(`${normalized}T00:00:00Z`)
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized
    ? false
    : normalized
}
