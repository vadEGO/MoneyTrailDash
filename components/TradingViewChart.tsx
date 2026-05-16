'use client'

/**
 * TradingViewChart — Lightweight Charts v5 wrapper.
 *
 * Renders candlestick data with overlay lines for:
 *   entry zone (green shaded band)
 *   entry_min / entry_max (green dashed lines)
 *   stop_loss  (solid red line)
 *   tp1 / tp2 / tp3 (green dashed lines, labelled)
 *   resistance (amber dotted lines)
 *   support    (blue dotted lines)
 *
 * Falls back to a "levels only" view when candles are empty —
 * draws horizontal lines on a blank chart so the plan is still readable.
 *
 * No SSR: uses `useEffect` + dynamic import to keep the library
 * client-side only (it uses window / DOM internally).
 */

import { useEffect, useRef, memo } from 'react'
import type { ChartOverlayLevel, MarketCandle } from '@/lib/types'

// ── Level styling config ─────────────────────────────────────────────────────

interface LevelStyle {
  color: string
  lineWidth: 1 | 2 | 3 | 4
  lineStyle: 0 | 1 | 2 | 3  // Solid=0 Dotted=1 Dashed=2 LargeDashed=3
  labelPrefix: string
  labelSide: 'left' | 'right'
}

const LEVEL_STYLES: Record<string, LevelStyle> = {
  entry_min:  { color: '#059669', lineWidth: 1, lineStyle: 2, labelPrefix: 'Entry ↓', labelSide: 'left'  },
  entry_max:  { color: '#059669', lineWidth: 1, lineStyle: 2, labelPrefix: 'Entry ↑', labelSide: 'left'  },
  stop_loss:  { color: '#e02424', lineWidth: 2, lineStyle: 0, labelPrefix: 'Stop',    labelSide: 'left'  },
  tp1:        { color: '#10b981', lineWidth: 1, lineStyle: 2, labelPrefix: 'TP1',     labelSide: 'right' },
  tp2:        { color: '#10b981', lineWidth: 1, lineStyle: 2, labelPrefix: 'TP2',     labelSide: 'right' },
  tp3:        { color: '#10b981', lineWidth: 1, lineStyle: 2, labelPrefix: 'TP3',     labelSide: 'right' },
  resistance: { color: '#d97706', lineWidth: 1, lineStyle: 1, labelPrefix: 'R',       labelSide: 'right' },
  support:    { color: '#3b82f6', lineWidth: 1, lineStyle: 1, labelPrefix: 'S',       labelSide: 'left'  },
}

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  candles: MarketCandle[]
  levels: ChartOverlayLevel[]
  symbol: string
  height?: number
}

// ── Component ────────────────────────────────────────────────────────────────

function TradingViewChart({ candles, levels, symbol, height = 380 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef = useRef<any>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chart: any
    let destroyed = false

    async function init() {
      const {
        createChart,
        CandlestickSeries,
        LineSeries,
        PriceLineSource,
        CrosshairMode,
        LineStyle,
        PriceScaleMode,
      } = await import('lightweight-charts')

      if (destroyed || !containerRef.current) return

      // ── Create chart ──────────────────────────────────────────────────────

      chart = createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height,
        layout: {
          background: { color: '#ffffff' },
          textColor: '#4c4546',
          fontSize: 11,
          fontFamily: "'Inter', 'ui-monospace', monospace",
        },
        grid: {
          vertLines: { color: '#f0eced', style: LineStyle.Dotted },
          horzLines: { color: '#f0eced', style: LineStyle.Dotted },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: '#b0a8a9', labelBackgroundColor: '#4c4546' },
          horzLine: { color: '#b0a8a9', labelBackgroundColor: '#4c4546' },
        },
        rightPriceScale: {
          borderColor: '#e5e0e1',
          scaleMargins: { top: 0.08, bottom: 0.08 },
        },
        timeScale: {
          borderColor: '#e5e0e1',
          timeVisible: true,
          secondsVisible: false,
          fixLeftEdge: true,
          fixRightEdge: true,
        },
      })

      // ── Candlestick series ────────────────────────────────────────────────

      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor:          '#059669',
        downColor:        '#e02424',
        borderUpColor:    '#059669',
        borderDownColor:  '#e02424',
        wickUpColor:      '#059669',
        wickDownColor:    '#e02424',
      })

      if (candles.length > 0) {
        const data = candles
          .filter(c => c.open != null && c.high != null && c.low != null && c.close != null)
          .map(c => ({
            time: Math.floor(new Date(c.ts).getTime() / 1000) as unknown as import('lightweight-charts').Time,
            open:  c.open!,
            high:  c.high!,
            low:   c.low!,
            close: c.close!,
          }))
          .sort((a, b) => (a.time as number) - (b.time as number))
        candleSeries.setData(data)
        chart.timeScale().fitContent()
      }

      // ── Entry zone shading (area between entry_min and entry_max) ─────────
      // We simulate this with a LineSeries band by drawing a semi-transparent
      // area series between the two prices.

      const entryMin = levels.find(l => l.level_type === 'entry_min')?.price
      const entryMax = levels.find(l => l.level_type === 'entry_max')?.price

      if (entryMin != null && entryMax != null && candles.length > 0) {
        const { AreaSeries } = await import('lightweight-charts')
        const times = candles
          .map(c => Math.floor(new Date(c.ts).getTime() / 1000))
          .sort((a, b) => a - b)

        const areaSeries = chart.addSeries(AreaSeries, {
          topColor:      'rgba(5, 150, 105, 0.12)',
          bottomColor:   'rgba(5, 150, 105, 0.02)',
          lineColor:     'rgba(5, 150, 105, 0)',
          lineWidth:     0,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
          baseValue: { type: 'price', price: entryMin },
        })

        const areaData = times.map(t => ({
          time: t as unknown as import('lightweight-charts').Time,
          value: entryMax,
        }))
        areaSeries.setData(areaData)
      }

      // ── Price lines (levels) ──────────────────────────────────────────────

      for (const level of levels) {
        const style = LEVEL_STYLES[level.level_type]
        if (!style) continue

        const labelText = level.label
          ? `${style.labelPrefix}: ${level.label} ${fmtPrice(level.price)}`
          : `${style.labelPrefix} ${fmtPrice(level.price)}`

        // Use a LineSeries with a single data point (invisible line) so we
        // can attach a proper price line with label to it.
        // In LW Charts v5 price lines are the simplest way to add labeled
        // horizontals without affecting the main series.
        candleSeries.createPriceLine({
          price:       level.price,
          color:       style.color,
          lineWidth:   style.lineWidth,
          lineStyle:   style.lineStyle,
          axisLabelVisible: true,
          title:       labelText,
        })
      }

      // ── Resize observer ───────────────────────────────────────────────────

      const ro = new ResizeObserver(entries => {
        if (!entries[0] || !chart) return
        chart.resize(entries[0].contentRect.width, height)
      })
      ro.observe(containerRef.current!)

      // Store for cleanup
      chartRef.current = { chart, ro }
    }

    init().catch(err => console.error('[TradingViewChart]', err))

    return () => {
      destroyed = true
      if (chartRef.current) {
        const { chart, ro } = chartRef.current as { chart: { remove: () => void }; ro: ResizeObserver }
        try { ro.disconnect() } catch (_) {}
        try { chart.remove() } catch (_) {}
        chartRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles, levels, height])

  if (candles.length === 0 && levels.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-surface-dim border border-border rounded text-ink-3 text-sm"
        style={{ height }}
      >
        No price data yet — levels will appear once data is synced
      </div>
    )
  }

  return (
    <div className="relative">
      <div ref={containerRef} style={{ height }} className="w-full rounded overflow-hidden" />
      {candles.length === 0 && (
        <div className="absolute top-2 left-3 text-2xs font-mono text-ink-3 bg-white/80 rounded px-2 py-0.5 border border-border">
          Levels only — no candles synced for {symbol}
        </div>
      )}
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtPrice(p: number): string {
  if (p >= 10000) return `$${p.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  if (p >= 1)     return `$${p.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  return `$${p.toFixed(4)}`
}

export default memo(TradingViewChart)
