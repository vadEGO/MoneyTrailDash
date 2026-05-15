'use client'

import { useEffect, useState } from 'react'

interface FGData {
  value: number
  label: string
}

interface FGState {
  crypto: FGData | null
  stocks: FGData | null
  loading: boolean
  error: boolean
}

function classify(v: number): string {
  if (v <= 25) return 'Extreme Fear'
  if (v <= 40) return 'Fear'
  if (v <= 60) return 'Neutral'
  if (v <= 75) return 'Greed'
  return 'Extreme Greed'
}

function gauge(value: number) {
  // Returns color class and needle position
  if (value <= 25) return { color: 'text-status-red',   bg: 'bg-red-100',   border: 'border-red-200' }
  if (value <= 40) return { color: 'text-status-amber', bg: 'bg-amber-50',  border: 'border-amber-200' }
  if (value <= 60) return { color: 'text-ink',          bg: 'bg-surface-dim', border: 'border-border' }
  if (value <= 75) return { color: 'text-status-green', bg: 'bg-green-50',  border: 'border-green-200' }
  return              { color: 'text-status-green',     bg: 'bg-green-100', border: 'border-green-300' }
}

function GaugeBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value))
  return (
    <div className="mt-2">
      {/* Gradient bar */}
      <div className="relative h-2 rounded-full overflow-hidden"
           style={{ background: 'linear-gradient(to right, #e02424, #d97706, #d4d4d4, #059669, #047857)' }}>
        {/* Needle */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white border-2 border-ink shadow-sm transition-all duration-500"
          style={{ left: `calc(${pct}% - 5px)` }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-2xs text-ink-3">Extreme Fear</span>
        <span className="text-2xs text-ink-3">Extreme Greed</span>
      </div>
    </div>
  )
}

function FGCard({ label, data }: { label: string; data: FGData | null }) {
  if (!data) return (
    <div className="flex-1 border border-border rounded p-3 bg-surface">
      <div className="text-2xs font-semibold tracking-widest text-ink-3 uppercase mb-1">{label}</div>
      <div className="text-ink-3 text-xs">Unavailable</div>
    </div>
  )

  const style = gauge(data.value)
  return (
    <div className={`flex-1 border ${style.border} rounded p-3 ${style.bg}`}>
      <div className="text-2xs font-semibold tracking-widest text-ink-3 uppercase mb-1">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className={`font-mono text-2xl font-bold ${style.color}`}>{data.value}</span>
        <span className={`text-xs font-semibold ${style.color}`}>{data.label}</span>
      </div>
      <GaugeBar value={data.value} />
    </div>
  )
}

export default function FearGreedWidget() {
  const [state, setState] = useState<FGState>({ crypto: null, stocks: null, loading: true, error: false })

  useEffect(() => {
    async function load() {
      // Crypto — via our API route (alternative.me, always works server-side)
      const cryptoPromise = fetch('/api/fear-greed')
        .then(r => r.json())
        .then(d => d.crypto as FGData | null)
        .catch(() => null)

      // Stocks — fetch CNN directly from the browser (bypasses server-side bot blocking)
      const stocksPromise = fetch(
        'https://production.dataviz.cnn.io/index/fearandgreed/graphical',
        { headers: { Accept: 'application/json' } }
      )
        .then(r => r.json())
        .then(d => {
          const fg = d?.fear_and_greed
          if (!fg?.score) return null
          const value = Math.round(fg.score)
          return { value, label: fg.rating ?? classify(value) } as FGData
        })
        .catch(() => null)

      const [crypto, stocks] = await Promise.all([cryptoPromise, stocksPromise])
      setState({ crypto, stocks, loading: false, error: false })
    }
    load()
  }, [])

  if (state.loading) {
    return (
      <div className="flex gap-3">
        {['Crypto F&G', 'Stock F&G'].map(l => (
          <div key={l} className="flex-1 border border-border rounded p-3 bg-surface animate-pulse">
            <div className="text-2xs font-semibold tracking-widest text-ink-3 uppercase mb-1">{l}</div>
            <div className="h-7 bg-surface-dim rounded w-20 mt-1" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex gap-3">
      <FGCard label="Crypto F&G" data={state.crypto} />
      <FGCard label="Stock F&G"  data={state.stocks} />
    </div>
  )
}
