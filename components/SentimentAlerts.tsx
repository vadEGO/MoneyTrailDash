'use client'

import { useEffect, useState } from 'react'

interface Alert {
  id: string
  severity: 'critical' | 'warning' | 'opportunity'
  message: string
  detail: string
}

const THRESHOLDS = {
  crypto: {
    extremeFear: 20,      // opportunity signal
    fear: 35,             // warning
    extremeGreed: 80,     // warning (overheated)
    bubbleDanger: 90,     // critical
  },
  stocks: {
    extremeFear: 20,
    fear: 35,
    extremeGreed: 75,
    bubbleDanger: 85,
  },
}

function buildAlerts(
  crypto: { value: number; label: string } | null,
  stocks: { value: number; label: string; vix?: number } | null
): Alert[] {
  const alerts: Alert[] = []

  if (crypto) {
    const v = crypto.value
    if (v <= THRESHOLDS.crypto.extremeFear) {
      alerts.push({
        id: 'crypto-extreme-fear',
        severity: 'opportunity',
        message: 'Crypto: Extreme Fear',
        detail: `Index at ${v} — historically a contrarian buy signal. Review thesis fit before acting.`,
      })
    } else if (v <= THRESHOLDS.crypto.fear) {
      alerts.push({
        id: 'crypto-fear',
        severity: 'warning',
        message: 'Crypto: Fear Zone',
        detail: `Index at ${v}. Market sentiment weak — check your entry levels.`,
      })
    } else if (v >= THRESHOLDS.crypto.bubbleDanger) {
      alerts.push({
        id: 'crypto-bubble',
        severity: 'critical',
        message: 'Crypto: Extreme Greed — Bubble Risk',
        detail: `Index at ${v}. Historically precedes sharp corrections. Review take-profit levels.`,
      })
    } else if (v >= THRESHOLDS.crypto.extremeGreed) {
      alerts.push({
        id: 'crypto-greed',
        severity: 'warning',
        message: 'Crypto: Greed Elevated',
        detail: `Index at ${v}. Sentiment frothy — tighten stops or trim tactical positions.`,
      })
    }
  }

  if (stocks) {
    const v = stocks.value
    const vixLabel = stocks.vix != null ? ` (VIX ${stocks.vix})` : ''
    if (v <= THRESHOLDS.stocks.extremeFear) {
      alerts.push({
        id: 'stocks-extreme-fear',
        severity: 'opportunity',
        message: `Stocks: Extreme Fear${vixLabel}`,
        detail: `VIX-derived index at ${v}. Elevated volatility may present entry opportunities in quality names.`,
      })
    } else if (v <= THRESHOLDS.stocks.fear) {
      alerts.push({
        id: 'stocks-fear',
        severity: 'warning',
        message: `Stocks: Fear Zone${vixLabel}`,
        detail: `Index at ${v}. Monitor equity exposure. Check risk board for concentration flags.`,
      })
    } else if (v >= THRESHOLDS.stocks.bubbleDanger) {
      alerts.push({
        id: 'stocks-bubble',
        severity: 'critical',
        message: `Stocks: Complacency Warning${vixLabel}`,
        detail: `VIX suppressed, index at ${v}. Low volatility regimes can end abruptly.`,
      })
    } else if (v >= THRESHOLDS.stocks.extremeGreed) {
      alerts.push({
        id: 'stocks-greed',
        severity: 'warning',
        message: `Stocks: Greed Elevated${vixLabel}`,
        detail: `Index at ${v}. Reduced margin of safety on new entries.`,
      })
    }
  }

  return alerts
}

const SEVERITY_STYLES = {
  critical:    'border-status-red    bg-red-50    text-status-red',
  warning:     'border-status-amber  bg-amber-50  text-status-amber',
  opportunity: 'border-status-green  bg-green-50  text-status-green',
}

const SEVERITY_ICONS = {
  critical:    '🔴',
  warning:     '⚠️',
  opportunity: '🟢',
}

export default function SentimentAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/fear-greed')
      .then(r => r.json())
      .then(d => setAlerts(buildAlerts(d.crypto, d.stocks)))
      .catch(() => {})
  }, [])

  const visible = alerts.filter(a => !dismissed.has(a.id))
  if (visible.length === 0) return null

  return (
    <div className="space-y-2 mb-4">
      {visible.map(alert => (
        <div
          key={alert.id}
          className={`flex items-start gap-3 border rounded px-4 py-3 ${SEVERITY_STYLES[alert.severity]}`}
        >
          <span className="text-base shrink-0 mt-0.5">{SEVERITY_ICONS[alert.severity]}</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">{alert.message}</div>
            <div className="text-xs mt-0.5 opacity-80">{alert.detail}</div>
          </div>
          <button
            onClick={() => setDismissed(s => { const n = new Set(s); n.add(alert.id); return n })}
            className="shrink-0 opacity-50 hover:opacity-100 transition-opacity text-lg leading-none"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
