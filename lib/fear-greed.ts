import type { MacroDataPoint } from './types'

export const FEAR_GREED_SERIES = {
  crypto: 'CRYPTO_FEAR_GREED',
  stocks: 'STOCK_FEAR_GREED',
  vix: 'VIXCLS',
} as const

export const FEAR_GREED_SERIES_IDS = Object.values(FEAR_GREED_SERIES)

export interface FearGreedDatum {
  value: number
  label: string
}

export interface StockFearGreedDatum extends FearGreedDatum {
  vix?: number
}

export interface FearGreedResult {
  crypto: FearGreedDatum | null
  stocks: StockFearGreedDatum | null
  status: 'live' | 'partial' | 'unavailable'
  unavailable_series: string[]
  as_of: string | null
}

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const ISO_DATE = /^(\d{4}-\d{2}-\d{2})/

export function buildFearGreedResult(
  rows: MacroDataPoint[],
  now = new Date()
): FearGreedResult {
  const latestBySeries = latestRowsBySeries(rows)
  const nowMs = now.getTime()

  const cryptoRow = latestBySeries.get(FEAR_GREED_SERIES.crypto)
  const stocksRow = latestBySeries.get(FEAR_GREED_SERIES.stocks)
  const vixRow = latestBySeries.get(FEAR_GREED_SERIES.vix)

  const crypto = validIndexPoint(cryptoRow, nowMs)
  const stockIndex = validIndexPoint(stocksRow, nowMs)
  const vix = validVixPoint(vixRow, nowMs)
  const stocks = stockIndex
    ? {
        ...stockIndex,
        ...(vix == null ? {} : { vix }),
      }
    : null

  const unavailableSeries = [
    ...(crypto ? [] : [FEAR_GREED_SERIES.crypto]),
    ...(stocks ? [] : [FEAR_GREED_SERIES.stocks]),
    ...(vix == null ? [FEAR_GREED_SERIES.vix] : []),
  ]
  const usefulRows = [
    ...(crypto && cryptoRow ? [cryptoRow] : []),
    ...(stocks && stocksRow ? [stocksRow] : []),
    ...(stocks && vix != null && vixRow ? [vixRow] : []),
  ]

  return {
    crypto,
    stocks,
    status: unavailableSeries.length === 0
      ? 'live'
      : crypto || stocks
        ? 'partial'
        : 'unavailable',
    unavailable_series: unavailableSeries,
    as_of: newestObservationDate(usefulRows),
  }
}

function latestRowsBySeries(rows: MacroDataPoint[]) {
  const latest = new Map<string, MacroDataPoint>()
  for (const row of rows) {
    const seriesId = typeof row.series_id === 'string' ? row.series_id.trim() : ''
    if (!FEAR_GREED_SERIES_IDS.includes(seriesId as (typeof FEAR_GREED_SERIES_IDS)[number])) continue
    const current = latest.get(seriesId)
    if (!current || isNewerRow(row, current)) latest.set(seriesId, row)
  }
  return latest
}

function validIndexPoint(row: MacroDataPoint | undefined, nowMs: number): FearGreedDatum | null {
  if (!isCurrent(row, nowMs)) return null
  if (typeof row.value !== 'number' || !Number.isFinite(row.value) || row.value < 0 || row.value > 100) {
    return null
  }
  if (typeof row.signal_label !== 'string' || row.signal_label.trim().length === 0) return null
  return { value: row.value, label: row.signal_label }
}

function validVixPoint(row: MacroDataPoint | undefined, nowMs: number): number | null {
  if (!isCurrent(row, nowMs)) return null
  return typeof row.value === 'number' && Number.isFinite(row.value) && row.value > 0
    ? row.value
    : null
}

function isCurrent(
  row: MacroDataPoint | undefined,
  nowMs: number
): row is MacroDataPoint {
  if (!row || row.latest !== true || !Number.isFinite(nowMs)) return false

  const observation = observationBounds(row.observation_date)
  if (!observation || observation.startMs > nowMs) return false

  const lag = nonNegativeHours(row.expected_release_lag_hours)
  const grace = nonNegativeHours(row.freshness_grace_hours)
  const sla = nonNegativeHours(row.freshness_sla_hours)
  if (lag == null || grace == null || sla == null) return false

  const lagAndGrace = lag + grace
  const freshnessWindow = lagAndGrace > 0 ? lagAndGrace : sla
  if (!Number.isFinite(freshnessWindow) || freshnessWindow <= 0) return false

  const availabilityValue = row.available_at ?? row.release_date ?? row.first_seen_at
  if (availabilityValue) {
    const availableAtMs = Date.parse(availabilityValue)
    if (!Number.isFinite(availableAtMs) || availableAtMs > nowMs) return false
  }

  return nowMs <= observation.endMs + freshnessWindow * HOUR_MS
}

function nonNegativeHours(value: number | null) {
  if (value == null) return 0
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

function observationBounds(value: string | null) {
  if (typeof value !== 'string') return null
  const isoDate = value.match(ISO_DATE)?.[1]
  if (!isoDate) return null
  const startMs = Date.parse(`${isoDate}T00:00:00.000Z`)
  if (!Number.isFinite(startMs) || new Date(startMs).toISOString().slice(0, 10) !== isoDate) return null
  return { startMs, endMs: startMs + DAY_MS - 1 }
}

function isNewerRow(candidate: MacroDataPoint, current: MacroDataPoint) {
  const candidateObservation = observationBounds(candidate.observation_date)?.startMs ?? Number.NEGATIVE_INFINITY
  const currentObservation = observationBounds(current.observation_date)?.startMs ?? Number.NEGATIVE_INFINITY
  if (candidateObservation !== currentObservation) return candidateObservation > currentObservation

  const candidateFetchedAt = candidate.fetched_at ? Date.parse(candidate.fetched_at) : Number.NEGATIVE_INFINITY
  const currentFetchedAt = current.fetched_at ? Date.parse(current.fetched_at) : Number.NEGATIVE_INFINITY
  return (Number.isFinite(candidateFetchedAt) ? candidateFetchedAt : Number.NEGATIVE_INFINITY) >
    (Number.isFinite(currentFetchedAt) ? currentFetchedAt : Number.NEGATIVE_INFINITY)
}

function newestObservationDate(rows: MacroDataPoint[]) {
  let newest: string | null = null
  for (const row of rows) {
    const value = row.observation_date?.match(ISO_DATE)?.[1] ?? null
    if (value && (!newest || value > newest)) newest = value
  }
  return newest
}
