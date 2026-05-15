import { NextResponse } from 'next/server'

export const runtime = 'edge'
export const revalidate = 300 // cache 5 min

interface FearGreedResult {
  crypto: { value: number; label: string } | null
  stocks: { value: number; label: string } | null
  error?: string
}

export async function GET(): Promise<NextResponse> {
  const result: FearGreedResult = { crypto: null, stocks: null }

  // Crypto F&G — alternative.me, no auth required
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
  } catch {
    // non-fatal
  }

  // Stock F&G — CNN production endpoint, proxied via edge with browser headers
  try {
    const res = await fetch(
      'https://production.dataviz.cnn.io/index/fearandgreed/graphical',
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          Referer: 'https://edition.cnn.com/',
          Origin: 'https://edition.cnn.com',
        },
        next: { revalidate: 300 },
      }
    )
    if (res.ok) {
      const json = await res.json()
      const fg = json?.fear_and_greed
      if (fg?.score !== undefined) {
        result.stocks = {
          value: Math.round(fg.score),
          label: fg.rating ?? classify(Math.round(fg.score)),
        }
      }
    }
  } catch {
    // non-fatal — stocks will show as null
  }

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=60' },
  })
}

function classify(v: number): string {
  if (v <= 25) return 'Extreme Fear'
  if (v <= 40) return 'Fear'
  if (v <= 60) return 'Neutral'
  if (v <= 75) return 'Greed'
  return 'Extreme Greed'
}
