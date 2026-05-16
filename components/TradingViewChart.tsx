'use client'

/**
 * TradingViewChart — Lightweight Charts v5 candlestick chart with level overlays.
 *
 * Levels drawn as price lines on the candlestick series:
 *   entry_min / entry_max  — green dashed
 *   stop_loss              — solid red
 *   tp1 / tp2 / tp3        — green dashed
 *   resistance             — amber dotted
 *   support                — blue dotted
 *
 * Entry zone shading is done with a second AreaSeries (no baseValue — v5 removed it).
 * The area spans from 0 to entry_max; opacity is low so it reads as a band.
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
          AreaSeries,
          LineStyle,
        } = await import('lightweight-charts')

        if (destroyed || !containerRef.current) return

        // ── Create chart ─────────────────────────────────────────────────

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const chart: any = createChart(containerRef.current, {
          width:  containerRef.current.clientWidth,
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
            scaleMargins: { top: 0.1, bottom: 0.1 },
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
          chart.timeScale().fitContent()
        }

        // ── Entry zone shading (AreaSeries from entry_min to entry_max) ──

        const entryMin = levels.find(l => l.level_type === 'entry_min')?.price
        const entryMax = levels.find(l => l.level_type === 'entry_max')?.price

        if (entryMin != null && entryMax != null && candles.length > 0) {
          const areaSeries = chart.addSeries(AreaSeries, {
            topColor:    'rgba(5, 150, 105, 0.15)',
            bottomColor: 'rgba(5, 150, 105, 0.05)',
            lineColor:   'rgba(5, 150, 105, 0.3)',
            lineWidth:   1,
            lineStyle:   LineStyle.Dashed,
            priceLineVisible:      false,
            lastValueVisible:      false,
            crosshairMarkerVisible: false,
          })

          // Set area data at entry_max so it fills down to entry_min visually.
          // We use the candlestick timestamps so the area spans the full chart.
          const times = candles
            .filter(c => c.ts)
            .map(c => Math.floor(new Date(c.ts).getTime() / 1000))
            .sort((a, b) => a - b)

          areaSeries.setData(
            times.map(t => ({
              time:  t as unknown as import('lightweight-charts').Time,
              value: entryMax,
            }))
          )

          // Draw entry_min as a price line on the area series for the lower bound
          areaSeries.createPriceLine({
            price:     entryMin,
            color:     '#059669',
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: `Entry ↓ ${fmtPrice(entryMin)}`,
          })
          areaSeries.createPriceLine({
            price:     entryMax,
            color:     '#059669',
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: `Entry ↑ ${fmtPrice(entryMax)}`,
          })
        }

        // ── All other level lines ─────────────────────────────────────────
        // Skip entry_min/entry_max — handled by area series above

        for (const level of levels) {
          if (level.level_type === 'entry_min' || level.level_type === 'entry_max') continue
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
          const { LineSeries } = await import('lightweight-charts')
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

        // ── Resize observer ───────────────────────────────────────────────

        const ro = new ResizeObserver(entries => {
          if (!entries[0] || !chart) return
          chart.resize(entries[0].contentRect.width, height)
        })
        ro.observe(containerRef.current!)

        chartRef.current = { chart, ro }

      } catch (err) {
        console.error('[TradingViewChart] init error:', err)
      }
    }

    init()

    return () => {
      destroyed = true
      if (chartRef.current) {
        const { chart, ro } = chartRef.current
        try { ro.disconnect() } catch (_) {}
        try { chart.remove()  } catch (_) {}
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
