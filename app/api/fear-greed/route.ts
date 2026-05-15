import { NextResponse } from 'next/server'

export const runtime = 'edge'
export const revalidate = 300

interface FearGreedResult {
  crypto: { value: number; label: string } | null
  stocks: { value: number; label: string; vix?: number } | null
}

// VIX → 0-100 fear/greed score (inverse: high VIX = fear, low VIX = greed)
function vixToScore(vix: number): number {
  if (vix >= 40) return 5
  if (vix >= 30) return 15 + ((40 - vix) / 10) * 10
  if (vix >= 22) return 25 + ((30 - vix) / 8) * 15
  if (vix >= 17) return 40 + ((22 - vix) / 5) * 20
  if (vix >= 13) return 60 + ((17 - vix) / 4) * 15
  if (vix >= 11) return 75 + ((13 - vix) / 2) * 10
  return 90
}

function classify(v: number): string {
  if (v <= 25) return 'Extreme Fear'
  if (v <= 40) return 'Fear'
  if (v <= 60) return 'Neutral'
  if (v <= 75) return 'Greed'
  return 'Extreme Greed'
}

export async function GET(): Promise<NextResponse> {
  const result: FearGreedResult = { crypto: null, stocks: null }

  // Crypto F&G — alternative.me, reliable, no auth
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1', {
      next: { revalidate: 300 },
    })
    if (res.ok) {
      const json = await res.json()
      const row = json?.data?.[0]
      if (row) {
        result.crypto = {
          value: parseInt(row.value, 10),
          label: row.value_classification,
        }
      }
    }
  } catch { /* non-fatal */ }

  // Stock F&G — derived from VIX via Yahoo Finance (free, no auth, no bot blocking)
  // VIX is the primary input to CNN's own F&G index, so this is a faithful proxy.
  try {
    const res = await fetch(
      'https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=1d',
      {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        next: { revalidate: 300 },
      }
    )
    if (res.ok) {
      const json = await res.json()
      const vix = json?.chart?.result?.[0]?.meta?.regularMarketPrice as number | undefined
      if (vix != null && vix > 0) {
        const value = Math.round(vixToScore(vix))
        result.stocks = {
          value,
          label: classify(value),
          vix: Math.round(vix * 10) / 10,
        }
      }
    }
  } catch { /* non-fatal */ }

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=60' },
  })
}
