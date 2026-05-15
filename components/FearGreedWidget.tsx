'use client'

import { useEffect, useState } from 'react'

interface FGData {
  value: number
  label: string
  vix?: number
}

interface FGState {
  crypto: FGData | null
  stocks: FGData | null
  loading: boolean
}

function gauge(value: number) {
  if (value <= 25) return { color: 'text-status-red',   bg: 'bg-red-100',    border: 'border-red-200' }
  if (value <= 40) return { color: 'text-status-amber', bg: 'bg-amber-50',   border: 'border-amber-200' }
  if (value <= 60) return { color: 'text-ink',          bg: 'bg-surface-dim', border: 'border-border' }
  if (value <= 75) return { color: 'text-status-green', bg: 'bg-green-50',   border: 'border-green-200' }
  return              { color: 'text-status-green',     bg: 'bg-green-100',  border: 'border-green-300' }
}

function GaugeBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value))
  return (
    <div className="mt-2">
      <div className="relative h-2 rounded-full overflow-hidden"
           style={{ background: 'linear-gradient(to right, #e02424, #d97706, #d4d4d4, #059669, #047857)' }}>
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

function FGCard({ label, data, subtitle }: { label: string; data: FGData | null; subtitle?: string }) {
  if (!data) return (
    <div className="flex-1 border border-border rounded p-3 bg-surface">
      <div className="text-2xs font-semibold tracking-widest text-ink-3 uppercase mb-1">{label}</div>
      <div className="text-ink-3 text-xs">Unavailable</div>
    </div>
  )

  const style = gauge(data.value)
  return (
    <div className={`flex-1 border ${style.border} rounded p-3 ${style.bg}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="text-2xs font-semibold tracking-widest text-ink-3 uppercase">{label}</div>
        {subtitle && <div className="text-2xs font-mono text-ink-3">{subtitle}</div>}
      </div>
      <div className="flex items-baseline gap-2">
        <span className={`font-mono text-2xl font-bold ${style.color}`}>{data.value}</span>
        <span className={`text-xs font-semibold ${style.color}`}>{data.label}</span>
      </div>
      <GaugeBar value={data.value} />
    </div>
  )
}

export default function FearGreedWidget() {
  const [state, setState] = useState<FGState>({ crypto: null, stocks: null, loading: true })

  useEffect(() => {
    fetch('/api/fear-greed')
      .then(r => r.json())
      .then(d => setState({ crypto: d.crypto, stocks: d.stocks, loading: false }))
      .catch(() => setState(s => ({ ...s, loading: false })))
  }, [])

  if (state.loading) {
    return (
      <div className="flex gap-3">
        {['Crypto F&G', 'Stock F&G (VIX)'].map(l => (
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
      <FGCard
        label="Stock F&G"
        data={state.stocks}
        subtitle={state.stocks?.vix != null ? `VIX ${state.stocks.vix}` : undefined}
      />
    </div>
  )
}
