'use client'

import { useEffect, useRef, memo } from 'react'
import type { ChartOverlayLevel, MarketCandle } from '@/lib/types'

interface LevelStyle {
  color: string
  lineWidth: 1 | 2 | 3 | 4
  lineStyle: 0 | 1 | 2 | 3
  label: string
}

const LEVEL_STYLES: Record<string, LevelStyle> = {
  entry_min:  { color: '#059669', lineWidth: 1, lineStyle: 2, label: 'Entry ↓' },
  entry_max:  { color: '#059669', lineWidth: 1, lineStyle: 2, label: 'Entry ↑' },
  stop_loss:  { color: '#e02424', lineWidth: 2, lineStyle: 0, label: 'Stop'    },
  tp1:        { color: '#10b981', lineWidth: 1, lineStyle: 2, label: 'TP1'     },
  tp2:        { color: '#10b981', lineWidth: 1, lineStyle: 2, label: 'TP2'     },
  tp3:        { color: '#10b981', lineWidth: 1, lineStyle: 2, label: 'TP3'     },
  resistance: { color: '#d97706', lineWidth: 1, lineStyle: 1, label: 'R'       },
  support:    { color: '#3b82f6', lineWidth: 1, lineStyle: 1, label: 'S'       },
}

// Level types that are "near" price — use these to set the no-candle Y range.
// TP levels can be far above entry and would crush the view if included.
const NEAR_LEVEL_TYPES = new Set(['entry_min', 'entry_max', 'stop_loss', 'resistance', 'support'])

interface Props {
  candles: MarketCandle[]
  levels: ChartOverlayLevel[]
  symbol: string
  height?: number
}

function TradingViewChart({ candles, levels, symbol, height = 380 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef = useRef<any>(null)

  useEffect(() => {
    if (!containerRef.current) return
    let destroyed = false

    async function init() {
      try {
        const { createChart, CandlestickSeries, LineSeries, LineStyle } =
          await import('lightweight-charts')

        if (destroyed || !containerRef.current) return

        const chart: any = createChart(containerRef.current, { // eslint-disable-line @typescript-eslint/no-explicit-any
          autoSize: true,
          height,
          layout: {
            background: { color: '#ffffff' },
            textColor: '#4c4546',
            fontSize: 11,
            fontFamily: "'Inter', monospace",
          },
          grid: {
            vertLines: { color: '#f0eced', style: LineStyle.Dotted },
            horzLines: { color: '#f0eced', style: LineStyle.Dotted },
          },
          rightPriceScale: { borderColor: '#e5e0e1' },
          timeScale: {
            borderColor: '#e5e0e1',
            timeVisible: true,
            secondsVisible: false,
            fixLeftEdge: true,
            fixRightEdge: true,
          },
          crosshair: {
            vertLine: { labelBackgroundColor: '#4c4546' },
            horzLine: { labelBackgroundColor: '#4c4546' },
          },
        })

        // ── Path A: we have candle data ───────────────────────────────────

        const validCandles = candles.filter(
          c => c.open != null && c.high != null && c.low != null && c.close != null
        )

        if (validCandles.length > 0) {
          // Compute Y range from candle OHLC only — exclude all price lines.
          let lo = Infinity, hi = -Infinity
          for (const c of validCandles) {
            if (c.low!  < lo) lo = c.low!
            if (c.high! > hi) hi = c.high!
          }
          const pad = (hi - lo) * 0.06

          const candleSeries = chart.addSeries(CandlestickSeries, {
            upColor:         '#059669',
            downColor:       '#e02424',
            borderUpColor:   '#059669',
            borderDownColor: '#e02424',
            wickUpColor:     '#059669',
            wickDownColor:   '#e02424',
            // Lock Y axis to candle range — price lines don't change the viewport.
            autoscaleInfoProvider: () => ({
              priceRange: { minValue: lo - pad, maxValue: hi + pad },
            }),
          })

          candleSeries.setData(
            validCandles
              .map(c => ({
                time:  Math.floor(new Date(c.ts).getTime() / 1000) as unknown as import('lightweight-charts').Time,
                open:  c.open!,
                high:  c.high!,
                low:   c.low!,
                close: c.close!,
              }))
              .sort((a, b) => (a.time as number) - (b.time as number))
          )

          // Draw all level lines — they appear on axis but don't affect zoom.
          for (const level of levels) {
            const style = LEVEL_STYLES[level.level_type]
            if (!style) continue
            const title = level.label
              ? `${style.label}: ${level.label} ${fmtPrice(level.price)}`
              : `${style.label} ${fmtPrice(level.price)}`
            candleSeries.createPriceLine({
              price: level.price, color: style.color,
              lineWidth: style.lineWidth, lineStyle: style.lineStyle,
              axisLabelVisible: true, title,
            })
          }

          chart.timeScale().fitContent()

        // ── Path B: no candles — levels only ─────────────────────────────

        } else if (levels.length > 0) {
          // Compute Y range from "near" levels only (entry zone + stop).
          // TPs can be 2-3x above entry and would make the range nonsensical.
          const nearPrices = levels
            .filter(l => NEAR_LEVEL_TYPES.has(l.level_type))
            .map(l => l.price)

          // Fallback: if no near levels, use all levels but clip extreme outliers.
          const pricesForRange = nearPrices.length >= 2
            ? nearPrices
            : levels.map(l => l.price)

          const lo = Math.min(...pricesForRange)
          const hi = Math.max(...pricesForRange)
          const pad = (hi - lo) * 0.15  // 15% padding so lines aren't at the edge

          // Dummy LineSeries so we have a time axis and can attach price lines.
          const placeholder = chart.addSeries(LineSeries, {
            color: 'transparent', lineWidth: 1,
            priceLineVisible: false, lastValueVisible: false,
            autoscaleInfoProvider: () => ({
              priceRange: { minValue: lo - pad, maxValue: hi + pad },
            }),
          })

          const now = Math.floor(Date.now() / 1000)
          placeholder.setData([
            { time: (now - 86400 * 60) as unknown as import('lightweight-charts').Time, value: (lo + hi) / 2 },
            { time: now                as unknown as import('lightweight-charts').Time, value: (lo + hi) / 2 },
          ])

          for (const level of levels) {
            const style = LEVEL_STYLES[level.level_type] ??
              { color: '#888', lineWidth: 1 as const, lineStyle: 1 as const, label: level.level_type }
            placeholder.createPriceLine({
              price: level.price, color: style.color,
              lineWidth: style.lineWidth as 1|2|3|4,
              lineStyle: style.lineStyle as 0|1|2|3,
              axisLabelVisible: true,
              title: level.label
                ? `${style.label}: ${level.label} ${fmtPrice(level.price)}`
                : `${style.label} ${fmtPrice(level.price)}`,
            })
          }

          chart.timeScale().fitContent()
        }

        chartRef.current = { chart }

      } catch (err) {
        console.error('[TradingViewChart] init error:', err)
      }
    }

    init()

    return () => {
      destroyed = true
      if (chartRef.current) {
        try { chartRef.current.chart.remove() } catch (_) {}
        chartRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // Stringify stable keys so the effect only re-runs when data actually changes.
    JSON.stringify(validCandleKey(candles)),
    JSON.stringify(levels.map(l => `${l.level_type}:${l.price}`)),
    height,
  ])

  const hasData = candles.length > 0 || levels.length > 0

  if (!hasData) {
    return (
      <div
        className="flex items-center justify-center bg-surface-dim border border-border rounded text-ink-3 text-sm"
        style={{ height }}
      >
        No price data — sync market_candles for {symbol} to see the chart
      </div>
    )
  }

  return (
    <div className="relative w-full">
      <div ref={containerRef} style={{ height }} className="w-full" />
      {candles.length === 0 && levels.length > 0 && (
        <div className="absolute top-2 left-2 text-2xs font-mono text-ink-3 bg-white/80 rounded px-2 py-0.5 border border-border pointer-events-none">
          Levels only — no candles synced for {symbol}
        </div>
      )}
    </div>
  )
}

function validCandleKey(candles: MarketCandle[]) {
  return candles
    .filter(c => c.open != null)
    .map(c => c.ts)
}

function fmtPrice(p: number): string {
  if (p >= 10000) return `$${p.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  if (p >= 1)     return `$${p.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  return `$${p.toFixed(4)}`
}

export default memo(TradingViewChart)
