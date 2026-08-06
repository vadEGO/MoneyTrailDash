'use client'

/**
 * /preview — a login-free, Supabase-free walkthrough of the ticker aggregation
 * and chart range work.
 *
 * Everything here runs on mock fixtures so the behaviour can be inspected without
 * credentials and without depending on what the engine last exported. Blocked from
 * production by the environment check in middleware.ts.
 */

import Card from '@/components/ui/Card'
import PageHeader from '@/components/ui/PageHeader'
import FunnelBoard from '@/components/FunnelBoard'
import TradingViewChart from '@/components/TradingViewChart'
import {
  PREVIEW_COMPOSITE,
  PREVIEW_IDEAS,
  PREVIEW_LEVELS,
  previewCandles,
} from '@/lib/preview-fixtures'
import { groupIdeasByTicker } from '@/lib/ticker-aggregate'

const fmtUsd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`

export default function PreviewPage() {
  const candles = previewCandles()
  const groups = groupIdeasByTicker(PREVIEW_IDEAS)
  const contested = groups.filter(g => g.hasDisagreement)
  const collapsed = PREVIEW_IDEAS.length - groups.length

  // Described from the data rather than hardcoded, so the copy cannot drift.
  const candleLow = Math.min(...candles.map(c => c.low as number))
  const candleHigh = Math.max(...candles.map(c => c.high as number))
  const farLevel = PREVIEW_LEVELS.reduce((a, b) => (b.price > a.price ? b : a))

  return (
    <div>
      <PageHeader
        title="Preview — Ticker Stance & Chart Auto-Fit"
        subtitle="Mock data, no login and no Supabase. Everything below is the same component code the Funnel uses."
      />

      <div className="mb-4 rounded border border-blue-200 bg-blue-50 px-4 py-3">
        <div className="text-xs font-semibold uppercase tracking-widest text-status-blue">
          What changed
        </div>
        <ul className="mt-1.5 space-y-1 text-sm text-ink">
          <li>
            <strong>{PREVIEW_IDEAS.length} source views collapse to {groups.length} tickers</strong> — {collapsed} rows
            that previously took their own line in the funnel. Nothing is discarded; expand a row with the chevron
            to read every view.
          </li>
          <li>
            <strong>{contested.length} tickers disagree</strong> ({contested.map(g => g.symbol).join(', ')}) — a long
            and a short case are both open, so they are flagged rather than deduplicated away.
          </li>
          <li>
            <strong>STANCE</strong> replaces the old always-blank CONV column: a score-weighted balance of long
            against short, +100 unanimously long to -100 unanimously short.
          </li>
          <li>
            <strong>A dead price feed is now visible</strong> — crypto quotes here are 44 days old, matching the live
            board, so their entry verdicts are stripped of the confident colour and carry their age. TAO has no price
            at all, which means no entry, stop or target either, and reads <strong>NO PRICE</strong> instead of a
            blank cell.
          </li>
          <li>
            <strong>The chart no longer hides out-of-range levels</strong> — see the panel below the table.
          </li>
        </ul>
      </div>

      <FunnelBoard ideas={PREVIEW_IDEAS} composite={PREVIEW_COMPOSITE} />

      <div className="mt-6">
        <Card
          title="Chart auto-fit — BTC with a cycle target far above price"
          action={<span className="font-mono text-2xs text-ink-3">mock candles + levels</span>}
        >
          <div className="border-b border-border px-4 py-3 text-sm text-ink">
            Candles span {fmtUsd(candleLow)}–{fmtUsd(candleHigh)}, but the cycle target sits at{' '}
            <strong>{fmtUsd(farLevel.price)}</strong> — far outside it. Previously the price scale was locked to the
            candles, so any level beyond them was drawn off-screen and simply never appeared.
            <div className="mt-1.5 text-xs text-ink-3">
              Use the <strong>Auto / Levels / Price</strong> toggle in the chart&apos;s top-right corner.
              <em> Auto</em> stretches to pull in every level it can while keeping the candles readable, and reports
              whatever still will not fit as a labelled marker on the right edge — so the {fmtUsd(farLevel.price)}{' '}
              target is never silently invisible.
              <em> Levels</em> forces the entire range into view so every line is on the axis.
              <em> Price</em> is the old candles-only behaviour, for comparison.
            </div>
          </div>
          <div className="p-4">
            <TradingViewChart
              candles={candles}
              levels={PREVIEW_LEVELS}
              symbol="BTC"
              height={420}
            />
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <Card title="Levels-only chart — no candles synced">
          <div className="border-b border-border px-4 py-3 text-xs text-ink-3">
            The same component with the candle feed empty. It falls back to the entry-and-stop band rather than
            rendering blank, and still reports the distant targets.
          </div>
          <div className="p-4">
            <TradingViewChart candles={[]} levels={PREVIEW_LEVELS} symbol="BTC" height={300} />
          </div>
        </Card>
      </div>

      <div className="mt-6 mb-10">
        <Card title="Computed stance per ticker">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-surface-dim">
                  {['TICKER', 'VIEWS', 'LONG', 'SHORT', 'NET STANCE', 'LABEL', 'DISAGREE', 'SOURCES'].map(h => (
                    <th key={h} className="px-4 py-2 text-left text-2xs font-semibold uppercase tracking-widest text-ink-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map(g => (
                  <tr key={g.symbol} className="border-b border-border">
                    <td className="px-4 py-2 font-mono text-xs font-bold text-ink">{g.symbol}</td>
                    <td className="px-4 py-2 font-mono text-xs text-ink-2">{g.setupCount}</td>
                    <td className="px-4 py-2 font-mono text-xs text-status-green">{g.bulls.length}</td>
                    <td className="px-4 py-2 font-mono text-xs text-status-red">{g.bears.length}</td>
                    <td className="px-4 py-2 font-mono text-xs font-semibold text-ink">
                      {g.netStance == null ? '—' : `${g.netStance > 0 ? '+' : ''}${g.netStance}`}
                    </td>
                    <td className="px-4 py-2 text-2xs text-ink-2">{g.stanceLabel ?? '—'}</td>
                    <td className="px-4 py-2 text-2xs">
                      {g.hasDisagreement
                        ? <span className="font-semibold text-status-purple">yes</span>
                        : <span className="text-ink-3">no</span>}
                    </td>
                    <td className="px-4 py-2 font-mono text-2xs text-ink-3">{g.sources.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  )
}
