'use client'

/**
 * TradingViewChart — Lightweight Charts v5 candlestick chart with level overlays.
 *
 * All levels (entry, stop, TP, resistance, support) are drawn as price lines
 * on the candlestick series. Price lines don't affect the visible price range,
 * so the viewport always centres on the actual candle data.
 *
 * autoSize:true lets the chart track its container — no zero-width race on
 * drawer open animation.
 */

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
        const {
          createChart,
          CandlestickSeries,
          LineSeries,
          LineStyle,
        } = await import('lightweight-charts')

        if (destroyed || !containerRef.current) return

        // ── Create chart ─────────────────────────────────────────────────

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const chart: any = createChart(containerRef.current, {
          autoSize: true,   // tracks container size automatically — no zero-width race on drawer open
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
          rightPriceScale: {
            borderColor: '#e5e0e1',
            // no scaleMargins — let fitContent decide the range so price is centred
          },
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

        // ── Candlestick series ────────────────────────────────────────────

        const candleSeries = chart.addSeries(CandlestickSeries, {
          upColor:         '#059669',
          downColor:       '#e02424',
          borderUpColor:   '#059669',
          borderDownColor: '#e02424',
          wickUpColor:     '#059669',
          wickDownColor:   '#e02424',
        })

        if (candles.length > 0) {
          const candleData = candles
            .filter(c => c.open != null && c.high != null && c.low != null && c.close != null)
            .map(c => ({
              time: Math.floor(new Date(c.ts).getTime() / 1000) as unknown as import('lightweight-charts').Time,
              open:  c.open!,
              high:  c.high!,
              low:   c.low!,
              close: c.close!,
            }))
            .sort((a, b) => (a.time as number) - (b.time as number))

          candleSeries.setData(candleData)
          // fitContent called after ALL series are set (see bottom of init)
        }

        // ── All level lines on the candlestick series ─────────────────────
        // Price lines don't affect the visible price range — viewport stays
        // centred on actual candle prices.

        for (const level of levels) {
          const style = LEVEL_STYLES[level.level_type]
          if (!style) continue

          const title = level.label
            ? `${style.label}: ${level.label} ${fmtPrice(level.price)}`
            : `${style.label} ${fmtPrice(level.price)}`

          candleSeries.createPriceLine({
            price:            level.price,
            color:            style.color,
            lineWidth:        style.lineWidth,
            lineStyle:        style.lineStyle,
            axisLabelVisible: true,
            title,
          })
        }

        // If no candles but we have levels, draw lines on a LineSeries placeholder
        if (candles.length === 0 && levels.length > 0) {
          const placeholder = chart.addSeries(LineSeries, {
            color:            'transparent',
            lineWidth:        1,
            priceLineVisible: false,
            lastValueVisible: false,
          })
          // Give it two dummy points bracketing the level range so the axis shows
          const allPrices = levels.map(l => l.price)
          const mid = (Math.min(...allPrices) + Math.max(...allPrices)) / 2
          const now = Math.floor(Date.now() / 1000)
          placeholder.setData([
            { time: (now - 86400 * 30) as unknown as import('lightweight-charts').Time, value: mid },
            { time: now               as unknown as import('lightweight-charts').Time, value: mid },
          ])
          for (const level of levels) {
            const style = LEVEL_STYLES[level.level_type] ?? { color: '#888', lineWidth: 1, lineStyle: 1, label: level.level_type }
            placeholder.createPriceLine({
              price:            level.price,
              color:            style.color,
              lineWidth:        style.lineWidth as 1|2|3|4,
              lineStyle:        style.lineStyle as 0|1|2|3,
              axisLabelVisible: true,
              title:            level.label ?? style.label,
            })
          }
          chart.timeScale().fitContent()
        }

        // Fit after all series + levels are set so the viewport centres on candles
        chart.timeScale().fitContent()

        // autoSize:true handles resize — no manual ResizeObserver needed
        chartRef.current = { chart }

      } catch (err) {
        console.error('[TradingViewChart] init error:', err)
      }
    }

    init()

    return () => {
      destroyed = true
      if (chartRef.current) {
        const { chart } = chartRef.current
        try { chart.remove() } catch (_) {}
        chartRef.current = null
      }
    }
  // Re-run when data changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(candles.map(c => c.ts)), JSON.stringify(levels.map(l => `${l.level_type}:${l.price}`)), height])

  if (candles.length === 0 && levels.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-surface-dim border border-border rounded text-ink-3 text-sm"
        style={{ height }}
      >
        No price data — levels appear once data is synced for {symbol}
      </div>
    )
  }

  return (
    <div className="relative w-full">
      <div ref={containerRef} style={{ height }} className="w-full" />
      {candles.length === 0 && levels.length > 0 && (
        <div className="absolute top-2 left-2 text-2xs font-mono text-ink-3 bg-white/80 rounded px-2 py-0.5 border border-border">
          Levels only — no candles for {symbol}
        </div>
      )}
    </div>
  )
}

function fmtPrice(p: number): string {
  if (p >= 10000) return `$${p.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  if (p >= 1)     return `$${p.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  return `$${p.toFixed(4)}`
}

export default memo(TradingViewChart)
