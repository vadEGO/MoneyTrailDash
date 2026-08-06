'use client'

import { useEffect, useMemo, useRef, useState, memo } from 'react'
import type { ChartOverlayLevel, MarketCandle } from '@/lib/types'

interface OhlcLegend {
  date: string
  open: number
  high: number
  low: number
  close: number
  change: number
  changePct: number
}

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

const FALLBACK_STYLE: LevelStyle = { color: '#888', lineWidth: 1, lineStyle: 1, label: '' }

function styleFor(levelType: string): LevelStyle {
  return LEVEL_STYLES[levelType] ?? { ...FALLBACK_STYLE, label: levelType }
}

// Level types that sit "near" price. When there are no candles these define the
// baseline view, because TP levels can be 2-3x above entry and would otherwise
// make the range nonsensical.
const NEAR_LEVEL_TYPES = new Set(['entry_min', 'entry_max', 'stop_loss', 'resistance', 'support'])

// How far `auto` will stretch the view to pull in distant levels. Beyond this the
// candles would compress to an unreadable sliver, so auto keeps price legible and
// reports the out-of-view levels as edge markers instead.
const AUTO_STRETCH_LIMIT = 4

const CANDLE_PAD_RATIO = 0.06
const LEVEL_PAD_RATIO  = 0.15

type Scope = 'auto' | 'levels' | 'price'

const SCOPES: Array<{ key: Scope; label: string; title: string }> = [
  { key: 'auto',   label: 'Auto',   title: 'Fit price, stretching to include levels while candles stay readable' },
  { key: 'levels', label: 'Levels', title: 'Always fit every entry, stop and target level' },
  { key: 'price',  label: 'Price',  title: 'Fit the price action only' },
]

interface Range { lo: number; hi: number }

function boundsOf(values: number[]): Range | null {
  if (values.length === 0) return null
  return { lo: Math.min(...values), hi: Math.max(...values) }
}

function union(a: Range | null, b: Range | null): Range | null {
  if (!a) return b
  if (!b) return a
  return { lo: Math.min(a.lo, b.lo), hi: Math.max(a.hi, b.hi) }
}

function span(r: Range) {
  return r.hi - r.lo
}

// A flat or single-price series has zero span, which would hand the chart a
// zero-height price range. Fall back to a fraction of the price itself.
function pad(r: Range, ratio: number): Range {
  const s = span(r)
  const amount = s > 0 ? s * ratio : Math.max(Math.abs(r.hi) * 0.01, Number.EPSILON)
  return { lo: r.lo - amount, hi: r.hi + amount }
}

/**
 * The range `auto` settles on.
 *
 * Spends a fixed compression budget rather than treating the stretch as
 * all-or-nothing: a single far-off cycle target must not push a stop sitting just
 * under the candles out of view. The budget is filled cheapest-side-first so a
 * small move down is never starved by a huge demand upwards, then the bounds snap
 * to the outermost level that fits, leaving the axis ending on a real level
 * instead of mid-air.
 */
function autoRange(baseline: Range, levels: ChartOverlayLevel[]): Range {
  const prices = levels.map(l => l.price)
  const everything = union(baseline, boundsOf(prices))!
  const baseSpan = span(baseline)
  if (baseSpan <= 0) return everything

  const extra = baseSpan * (AUTO_STRETCH_LIMIT - 1)
  const needBelow = baseline.lo - everything.lo
  const needAbove = everything.hi - baseline.hi
  if (needBelow + needAbove <= extra) return everything

  let allowBelow: number
  let allowAbove: number
  if (needBelow <= needAbove) {
    allowBelow = Math.min(needBelow, extra)
    allowAbove = extra - allowBelow
  } else {
    allowAbove = Math.min(needAbove, extra)
    allowBelow = extra - allowAbove
  }

  const lo = baseline.lo - allowBelow
  const hi = baseline.hi + allowAbove
  return union(baseline, boundsOf(prices.filter(p => p >= lo && p <= hi)))!
}

interface ChartModel {
  validCandles: MarketCandle[]
  range: Range | null
  clipped: ChartOverlayLevel[]
  referencePrice: number | null
  stretchedBeyondLimit: boolean
}

/**
 * Resolve the visible price range for the requested scope.
 *
 * The baseline is the candle range when we have candles, otherwise the near-level
 * range. `levels` widens that baseline; `auto` only widens it while the result
 * stays within AUTO_STRETCH_LIMIT of the baseline span.
 */
export function buildChartModel(
  candles: MarketCandle[],
  levels: ChartOverlayLevel[],
  scope: Scope,
): ChartModel {
  const validCandles = candles.filter(
    c => c.open != null && c.high != null && c.low != null && c.close != null
  )

  const candleRange = boundsOf(
    validCandles.flatMap(c => [c.low!, c.high!])
  )
  const allLevelRange = boundsOf(levels.map(l => l.price))
  const nearLevelPrices = levels.filter(l => NEAR_LEVEL_TYPES.has(l.level_type)).map(l => l.price)
  const nearLevelRange = nearLevelPrices.length >= 2 ? boundsOf(nearLevelPrices) : null

  const baseline = candleRange ?? nearLevelRange ?? allLevelRange
  const padRatio = candleRange ? CANDLE_PAD_RATIO : LEVEL_PAD_RATIO

  const lastClose = validCandles.length > 0
    ? validCandles[validCandles.length - 1].close!
    : null
  const referencePrice = lastClose ?? (baseline ? (baseline.lo + baseline.hi) / 2 : null)

  if (!baseline) {
    return { validCandles, range: null, clipped: [], referencePrice, stretchedBeyondLimit: false }
  }

  const stretched = union(baseline, allLevelRange)!

  let range: Range
  if (scope === 'price') {
    range = pad(baseline, padRatio)
  } else if (scope === 'levels') {
    range = pad(stretched, padRatio)
  } else {
    range = pad(autoRange(baseline, levels), padRatio)
  }

  const clipped = levels.filter(l => l.price < range.lo || l.price > range.hi)

  return {
    validCandles,
    range,
    clipped,
    referencePrice,
    // Only auto prompts the user to switch — in `price` the clipping was asked for.
    stretchedBeyondLimit: scope === 'auto' && clipped.length > 0,
  }
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
  const [legend, setLegend] = useState<OhlcLegend | null>(null)
  const [scope, setScope] = useState<Scope>('auto')

  // Stable identity for the data so neither the model nor the chart is rebuilt on
  // every parent render.
  const candleKey = JSON.stringify(candles.filter(c => c.open != null).map(c => c.ts))
  const levelKey  = JSON.stringify(levels.map(l => `${l.level_type}:${l.price}`))

  const model = useMemo(
    () => buildChartModel(candles, levels, scope),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [candleKey, levelKey, scope],
  )

  useEffect(() => {
    if (!containerRef.current) return
    const { validCandles, range } = model
    if (!range) return
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

        // The resolved range drives the price scale for both render paths, so the
        // scope toggle is the single place that decides what stays in view.
        const autoscaleInfoProvider = () => ({
          priceRange: { minValue: range!.lo, maxValue: range!.hi },
        })

        // ── Path A: we have candle data ───────────────────────────────────

        if (validCandles.length > 0) {
          const candleSeries = chart.addSeries(CandlestickSeries, {
            upColor:         '#059669',
            downColor:       '#e02424',
            borderUpColor:   '#059669',
            borderDownColor: '#e02424',
            wickUpColor:     '#059669',
            wickDownColor:   '#e02424',
            autoscaleInfoProvider,
          })

          const candleData = validCandles
            .map(c => ({
              time:  Math.floor(new Date(c.ts).getTime() / 1000) as unknown as import('lightweight-charts').Time,
              open:  c.open!,
              high:  c.high!,
              low:   c.low!,
              close: c.close!,
            }))
            .sort((a, b) => (a.time as number) - (b.time as number))

          candleSeries.setData(candleData)

          // Show most-recent candle in legend by default
          const last = candleData[candleData.length - 1]
          const prev = candleData[candleData.length - 2]
          if (last) {
            setLegend({
              date:      new Date((last.time as number) * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
              open:  last.open,  high: last.high,
              low:   last.low,   close: last.close,
              change:    prev ? last.close - prev.close : 0,
              changePct: prev ? ((last.close - prev.close) / prev.close) * 100 : 0,
            })
          }

          // Update legend on crosshair move
          chart.subscribeCrosshairMove((param: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
            if (!param.time || !param.seriesData) { return }
            const bar = param.seriesData.get(candleSeries)
            if (!bar) return
            const time = param.time as number
            const idx = candleData.findIndex(d => (d.time as number) === time)
            const p = idx > 0 ? candleData[idx - 1] : null
            setLegend({
              date:      new Date(time * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
              open:  bar.open,  high: bar.high,
              low:   bar.low,   close: bar.close,
              change:    p ? bar.close - p.close : 0,
              changePct: p ? ((bar.close - p.close) / p.close) * 100 : 0,
            })
          })

          for (const level of levels) {
            const style = styleFor(level.level_type)
            candleSeries.createPriceLine({
              price: level.price, color: style.color,
              lineWidth: style.lineWidth, lineStyle: style.lineStyle,
              axisLabelVisible: true, title: levelTitle(level, style),
            })
          }

          chart.timeScale().fitContent()

        // ── Path B: no candles — levels only ─────────────────────────────

        } else if (levels.length > 0) {
          // Dummy LineSeries so we have a time axis and can attach price lines.
          const placeholder = chart.addSeries(LineSeries, {
            color: 'transparent', lineWidth: 1,
            priceLineVisible: false, lastValueVisible: false,
            autoscaleInfoProvider,
          })

          const mid = (range!.lo + range!.hi) / 2
          const now = Math.floor(Date.now() / 1000)
          placeholder.setData([
            { time: (now - 86400 * 60) as unknown as import('lightweight-charts').Time, value: mid },
            { time: now                as unknown as import('lightweight-charts').Time, value: mid },
          ])

          for (const level of levels) {
            const style = styleFor(level.level_type)
            placeholder.createPriceLine({
              price: level.price, color: style.color,
              lineWidth: style.lineWidth, lineStyle: style.lineStyle,
              axisLabelVisible: true, title: levelTitle(level, style),
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
  }, [model, height])

  const { validCandles, clipped, referencePrice, stretchedBeyondLimit } = model
  const hasData = validCandles.length > 0 || levels.length > 0

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

  const above = clipped.filter(l => referencePrice != null && l.price > referencePrice)
  const below = clipped.filter(l => referencePrice != null && l.price <= referencePrice)

  return (
    <div className="relative w-full">
      <div ref={containerRef} style={{ height }} className="w-full" />

      {/* OHLC hover legend — top-left, updates with crosshair */}
      {legend && (
        <div className="absolute top-2 left-2 z-10 pointer-events-none flex items-baseline gap-3 bg-white/90 border border-border rounded px-2.5 py-1.5 text-2xs font-mono">
          <span className="text-ink-3">{legend.date}</span>
          <span className="text-ink-3">O <span className="text-ink">{fmtPrice(legend.open)}</span></span>
          <span className="text-ink-3">H <span className="text-status-green">{fmtPrice(legend.high)}</span></span>
          <span className="text-ink-3">L <span className="text-status-red">{fmtPrice(legend.low)}</span></span>
          <span className="text-ink-3">C <span className="text-ink font-semibold">{fmtPrice(legend.close)}</span></span>
          <span className={legend.change >= 0 ? 'text-status-green' : 'text-status-red'}>
            {legend.change >= 0 ? '+' : ''}{fmtPrice(Math.abs(legend.change))} ({legend.change >= 0 ? '+' : ''}{legend.changePct.toFixed(2)}%)
          </span>
        </div>
      )}

      {/* Scope toggle — decides whether out-of-range levels pull the view open.
          z-10 because the chart library's canvases carry their own z-index and
          would otherwise paint over every overlay in here. */}
      {levels.length > 0 && (
        <div className="absolute top-2 right-2 z-10 flex overflow-hidden rounded border border-border bg-white/90 shadow-sm">
          {SCOPES.map(s => (
            <button
              key={s.key}
              type="button"
              title={s.title}
              aria-pressed={scope === s.key}
              onClick={() => setScope(s.key)}
              className={`px-2 py-0.5 text-2xs font-semibold transition-colors ${
                scope === s.key ? 'bg-ink text-white' : 'text-ink-3 hover:bg-surface-dim'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Clamped edge markers — an out-of-view level is never silently invisible */}
      {above.length > 0 && (
        <div className="absolute top-9 right-20 z-10 flex flex-col items-end gap-1 pointer-events-none">
          {above
            .slice()
            .sort((a, b) => a.price - b.price)
            .map((l, i) => <EdgeMarker key={`a${i}`} level={l} referencePrice={referencePrice!} direction="up" />)}
        </div>
      )}
      {below.length > 0 && (
        <div className="absolute bottom-7 right-20 z-10 flex flex-col items-end gap-1 pointer-events-none">
          {below
            .slice()
            .sort((a, b) => b.price - a.price)
            .map((l, i) => <EdgeMarker key={`b${i}`} level={l} referencePrice={referencePrice!} direction="down" />)}
        </div>
      )}

      {stretchedBeyondLimit && (
        <div className="mt-1.5 text-2xs text-ink-3">
          Levels sit too far from price to show together — switch to Levels to fit them all.
        </div>
      )}

      {validCandles.length === 0 && levels.length > 0 && (
        <div className="absolute top-2 left-2 z-10 text-2xs font-mono text-ink-3 bg-white/80 rounded px-2 py-0.5 border border-border pointer-events-none">
          Levels only — no candles synced for {symbol}
        </div>
      )}
    </div>
  )
}

function EdgeMarker({
  level, referencePrice, direction,
}: { level: ChartOverlayLevel; referencePrice: number; direction: 'up' | 'down' }) {
  const style = styleFor(level.level_type)
  const delta = referencePrice !== 0
    ? ((level.price - referencePrice) / Math.abs(referencePrice)) * 100
    : null
  return (
    <span
      className="flex items-center gap-1 rounded-sm border border-border bg-white/90 px-1.5 py-0.5 font-mono text-2xs"
      style={{ color: style.color }}
    >
      <span className="font-semibold">{style.label || level.level_type}</span>
      <span>{direction === 'up' ? '↑' : '↓'}</span>
      <span>{fmtPrice(level.price)}</span>
      {delta != null && (
        <span className="text-ink-3">
          {delta >= 0 ? '+' : ''}{delta.toFixed(0)}%
        </span>
      )}
    </span>
  )
}

function levelTitle(level: ChartOverlayLevel, style: LevelStyle) {
  const name = style.label || level.level_type
  return level.label
    ? `${name}: ${level.label} ${fmtPrice(level.price)}`
    : `${name} ${fmtPrice(level.price)}`
}

function fmtPrice(p: number): string {
  if (p >= 10000) return `$${p.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  if (p >= 1)     return `$${p.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  return `$${p.toFixed(4)}`
}

export default memo(TradingViewChart)
