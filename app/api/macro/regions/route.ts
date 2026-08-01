import { NextResponse } from 'next/server'
import { boundedIntegerParam } from '@/lib/api-params'
import { getMacroRegionalLatest } from '@/lib/openclaw'

export const revalidate = 300

const CACHE_CONTROL = 's-maxage=300, stale-while-revalidate=60'
const REGIONS = new Set(['GLOBAL', 'US', 'EUROZONE', 'UK', 'JAPAN', 'AUSTRALIA', 'CANADA'])
const TRAFFIC_LIGHTS = new Set(['green', 'amber', 'red', 'grey'])

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const region = normalizeRegion(searchParams.get('region'))
  const trafficLight = normalizeTrafficLight(searchParams.get('trafficLight'))
  const includeStale = parseBoolean(searchParams.get('includeStale'), true)
  const limit = boundedIntegerParam(searchParams.get('limit'), 20, 50)

  if (region === false) {
    return NextResponse.json(
      { error: 'Invalid region.', allowed_regions: Array.from(REGIONS) },
      { status: 400 }
    )
  }
  if (trafficLight === false) {
    return NextResponse.json(
      { error: 'Invalid trafficLight.', allowed_traffic_lights: Array.from(TRAFFIC_LIGHTS) },
      { status: 400 }
    )
  }
  if (includeStale === null) {
    return NextResponse.json(
      { error: 'includeStale must be true or false.' },
      { status: 400 }
    )
  }

  const regions = await getMacroRegionalLatest({
    region,
    trafficLight,
    includeStale,
    limit,
  })

  return NextResponse.json(
    {
      regions,
      count: regions.length,
      status: regions.length > 0 ? 'live' : 'unavailable',
      diagnostics: regions.length > 0
        ? null
        : 'No regional macro scores matched the request. No fallback score was substituted.',
      filters: { region, trafficLight, includeStale, limit },
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

function normalizeTrafficLight(value: string | null): string | null | false {
  if (!value?.trim()) return null
  const normalized = value.trim().toLowerCase()
  return TRAFFIC_LIGHTS.has(normalized) ? normalized : false
}

function parseBoolean(value: string | null, fallback: boolean): boolean | null {
  if (value == null || value === '') return fallback
  if (value.toLowerCase() === 'true') return true
  if (value.toLowerCase() === 'false') return false
  return null
}
