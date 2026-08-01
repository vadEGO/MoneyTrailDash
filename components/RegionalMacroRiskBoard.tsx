import StatusChip from '@/components/ui/StatusChip'
import type { MacroRegionalScore, MacroTrafficLight } from '@/lib/types'
import type { ReactNode } from 'react'

type PillarKey =
  | 'rates_score'
  | 'credit_score'
  | 'growth_score'
  | 'inflation_score'
  | 'liquidity_fx_score'

interface RegionalMacroRiskBoardProps {
  rows: MacroRegionalScore[]
  history?: MacroRegionalScore[]
  compact?: boolean
}

const REGION_ORDER = ['GLOBAL', 'US', 'EUROZONE', 'UK', 'JAPAN', 'AUSTRALIA', 'CANADA']
const REGION_LABELS: Record<string, string> = {
  GLOBAL: 'Global',
  US: 'United States',
  EUROZONE: 'Eurozone',
  UK: 'United Kingdom',
  JAPAN: 'Japan',
  AUSTRALIA: 'Australia',
  CANADA: 'Canada',
}
const PILLARS: Array<{ key: PillarKey; label: string; shortLabel: string }> = [
  { key: 'rates_score', label: 'Rates and bonds', shortLabel: 'Rates' },
  { key: 'credit_score', label: 'Credit stress', shortLabel: 'Credit' },
  { key: 'growth_score', label: 'Growth momentum', shortLabel: 'Growth' },
  { key: 'inflation_score', label: 'Inflation pressure', shortLabel: 'Infl.' },
  { key: 'liquidity_fx_score', label: 'Liquidity and FX', shortLabel: 'Liq./FX' },
]
const SCORE_STYLES: Record<MacroTrafficLight, string> = {
  green: 'border-green-200 bg-green-50 text-status-green',
  amber: 'border-amber-200 bg-amber-50 text-status-amber',
  red: 'border-red-200 bg-red-50 text-status-red',
  grey: 'border-border bg-surface-dim text-ink-3',
}
const DOT_STYLES: Record<MacroTrafficLight, string> = {
  green: 'bg-status-green',
  amber: 'bg-status-amber',
  red: 'bg-status-red',
  grey: 'bg-ink-3',
}
const DATE_FORMAT = new Intl.DateTimeFormat('en-AU', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

export default function RegionalMacroRiskBoard({
  rows,
  history = [],
  compact = false,
}: RegionalMacroRiskBoardProps) {
  const orderedRows = orderRegions(rows)
  const historyByRegion = groupHistory(history)

  if (orderedRows.length === 0) return <EmptyState compact={compact} />
  if (compact) return <CompactBoard rows={orderedRows} />

  return (
    <div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[1040px]">
          <caption className="sr-only">Latest regional macro risk posture and component scores</caption>
          <thead>
            <tr className="border-b border-border bg-surface-dim">
              <HeaderCell>Region</HeaderCell>
              <HeaderCell>Risk posture</HeaderCell>
              {PILLARS.map(pillar => <HeaderCell key={pillar.key}>{pillar.shortLabel}</HeaderCell>)}
              <HeaderCell>Momentum</HeaderCell>
              <HeaderCell>Evidence</HeaderCell>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {orderedRows.map(row => (
              <DesktopRow
                key={row.id}
                row={row}
                history={historyByRegion.get(normalizeRegion(row.region)) ?? []}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-border md:hidden">
        {orderedRows.map(row => (
          <MobileCard
            key={row.id}
            row={row}
            history={historyByRegion.get(normalizeRegion(row.region)) ?? []}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border bg-surface-dim px-4 py-3 text-2xs text-ink-3">
        <Legend light="green" label="Constructive · 65–100" />
        <Legend light="amber" label="Mixed · 40–64" />
        <Legend light="red" label="Defensive · 0–39" />
        <Legend light="grey" label="Stale or insufficient" />
      </div>
    </div>
  )
}

function DesktopRow({ row, history }: { row: MacroRegionalScore; history: MacroRegionalScore[] }) {
  return (
    <tr className="align-top hover:bg-surface-dim/60">
      <th scope="row" className="px-4 py-3 text-left">
        <RegionIdentity row={row} />
      </th>
      <td className="px-4 py-3"><RiskPosture row={row} /></td>
      {PILLARS.map(pillar => (
        <td key={pillar.key} className="px-3 py-3">
          <PillarScore value={row[pillar.key]} stale={Boolean(row.is_stale)} label={pillar.label} />
        </td>
      ))}
      <td className="px-4 py-3"><Momentum row={row} /></td>
      <td className="min-w-[230px] px-4 py-3">
        <EvidenceDetails row={row} history={history} />
      </td>
    </tr>
  )
}

function MobileCard({ row, history }: { row: MacroRegionalScore; history: MacroRegionalScore[] }) {
  return (
    <article className="space-y-3 px-4 py-4" aria-label={`${regionLabel(row.region)} macro risk posture`}>
      <div className="flex items-start justify-between gap-3">
        <RegionIdentity row={row} />
        <RiskPosture row={row} />
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {PILLARS.map(pillar => (
          <div key={pillar.key} className="min-w-0 text-center">
            <div className="mb-1 truncate text-[9px] font-semibold uppercase tracking-wide text-ink-3">{pillar.shortLabel}</div>
            <PillarScore value={row[pillar.key]} stale={Boolean(row.is_stale)} label={pillar.label} />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3 rounded-sm border border-border bg-surface-dim px-3 py-2">
        <Momentum row={row} />
        <div className="text-right text-2xs text-ink-3">
          {coverage(row.coverage_ratio)} coverage · {integer(row.source_count)} sources
        </div>
      </div>
      <EvidenceDetails row={row} history={history} />
    </article>
  )
}

function CompactBoard({ rows }: { rows: MacroRegionalScore[] }) {
  return (
    <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4">
      {rows.map((row, index) => {
        const light = effectiveTrafficLight(row)
        return (
          <div
            key={row.id}
            className={`px-4 py-3 ${index % 2 === 0 ? 'sm:border-r sm:border-border' : ''} ${index < 4 ? 'lg:border-b lg:border-border' : ''} lg:border-r lg:border-border`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs font-semibold text-ink">{regionLabel(row.region)}</div>
                <div className="mt-1 text-2xs text-ink-3">{cleanLabel(row.cycle_phase)}</div>
              </div>
              <StatusChip label={trafficLabel(row, light)} variant={light} />
            </div>
            <div className="mt-3 flex items-end justify-between gap-3">
              <span className="font-mono text-lg font-bold text-ink">{score(row.risk_score)}</span>
              <span className="text-2xs text-ink-3">{coverage(row.coverage_ratio)} covered</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function HeaderCell({ children }: { children: ReactNode }) {
  return (
    <th scope="col" className="whitespace-nowrap px-4 py-2.5 text-left text-2xs font-semibold uppercase tracking-widest text-ink-3">
      {children}
    </th>
  )
}

function RegionIdentity({ row }: { row: MacroRegionalScore }) {
  return (
    <div>
      <div className="whitespace-nowrap text-xs font-semibold text-ink">{regionLabel(row.region)}</div>
      <div className="mt-1 whitespace-nowrap text-2xs text-ink-3">{formatDate(row.as_of)}</div>
      <div className="mt-1 whitespace-nowrap text-2xs text-ink-3">Cycle: {cleanLabel(row.cycle_phase)}</div>
    </div>
  )
}

function RiskPosture({ row }: { row: MacroRegionalScore }) {
  const light = effectiveTrafficLight(row)
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <StatusChip label={trafficLabel(row, light)} variant={light} />
        <span className="font-mono text-sm font-bold text-ink">{score(row.risk_score)}</span>
      </div>
      <div className="whitespace-nowrap text-2xs text-ink-3">
        {coverage(row.coverage_ratio)} coverage · {integer(row.source_count)} sources
      </div>
    </div>
  )
}

function PillarScore({ value, stale, label }: { value: number | null; stale: boolean; label: string }) {
  const light = pillarTrafficLight(value, stale)
  return (
    <div
      title={`${label}: ${score(value)}`}
      className={`inline-flex min-w-11 items-center justify-center gap-1 rounded-sm border px-1.5 py-1 font-mono text-2xs font-semibold ${SCORE_STYLES[light]}`}
    >
      <span className="sr-only">{label}: </span>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_STYLES[light]}`} aria-hidden="true" />
      {score(value)}
      <span className="sr-only">{light}</span>
    </div>
  )
}

function Momentum({ row }: { row: MacroRegionalScore }) {
  return (
    <div className="flex gap-3 whitespace-nowrap">
      <Change label="1W" value={row.weekly_change} />
      <Change label="1M" value={row.monthly_change} />
    </div>
  )
}

function Change({ label, value }: { label: string; value: number | null }) {
  const numeric = finiteNumber(value)
  const tone = numeric == null ? 'text-ink-3' : numeric > 0 ? 'text-status-green' : numeric < 0 ? 'text-status-red' : 'text-ink-3'
  return (
    <div>
      <div className="text-[9px] font-semibold uppercase tracking-widest text-ink-3">{label}</div>
      <div className={`mt-0.5 font-mono text-xs font-semibold ${tone}`}>{signedScore(numeric)}</div>
    </div>
  )
}

function EvidenceDetails({ row, history }: { row: MacroRegionalScore; history: MacroRegionalScore[] }) {
  const positives = cleanDrivers(row.top_positive_drivers)
  const negatives = cleanDrivers(row.top_negative_drivers)
  const recentHistory = history.slice(0, 6)
  const region = normalizeRegion(row.region)

  return (
    <details className="group">
      <summary className="cursor-pointer list-none rounded-sm text-2xs font-semibold uppercase tracking-widest text-ink-3 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
        Drivers &amp; history <span aria-hidden="true" className="group-open:hidden">＋</span><span aria-hidden="true" className="hidden group-open:inline">−</span>
      </summary>
      <div className="mt-3 space-y-3 rounded-sm border border-border bg-surface px-3 py-3 text-left shadow-card">
        <DriverList heading="Positive" items={positives} tone="green" />
        <DriverList heading="Negative" items={negatives} tone="red" />
        <div>
          <div className="text-[9px] font-semibold uppercase tracking-widest text-ink-3">Recent scores</div>
          {recentHistory.length === 0 ? (
            <div className="mt-1 text-2xs text-ink-3">No score history published yet.</div>
          ) : (
            <div className="mt-1 divide-y divide-border">
              {recentHistory.map(point => (
                <div key={`${point.id}-${point.as_of}`} className="flex items-center justify-between gap-3 py-1.5 text-2xs">
                  <span className="text-ink-3">{formatDate(point.as_of)}</span>
                  <span className="flex items-center gap-1.5 font-mono font-semibold text-ink">
                    <span className={`h-1.5 w-1.5 rounded-full ${DOT_STYLES[effectiveTrafficLight(point)]}`} aria-hidden="true" />
                    {score(point.risk_score)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-3 border-t border-border pt-2 text-2xs">
          <a className="text-ink-3 underline-offset-2 hover:text-ink hover:underline" href={`/api/macro/regions/history?region=${encodeURIComponent(region)}`}>History JSON</a>
          <a className="text-ink-3 underline-offset-2 hover:text-ink hover:underline" href="/api/macro/sources">Source health</a>
        </div>
      </div>
    </details>
  )
}

function DriverList({ heading, items, tone }: { heading: string; items: string[]; tone: 'green' | 'red' }) {
  return (
    <div>
      <div className="text-[9px] font-semibold uppercase tracking-widest text-ink-3">{heading}</div>
      {items.length === 0 ? (
        <div className="mt-1 text-2xs text-ink-3">No material driver published.</div>
      ) : (
        <ul className="mt-1 space-y-1.5">
          {items.map(item => (
            <li key={`${heading}-${item}`} className="flex gap-2 text-2xs leading-4 text-ink-2">
              <span className={tone === 'green' ? 'text-status-green' : 'text-status-red'} aria-hidden="true">{tone === 'green' ? '↑' : '↓'}</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function EmptyState({ compact }: { compact: boolean }) {
  return (
    <div className={`flex items-start gap-3 px-4 ${compact ? 'py-5' : 'py-8'}`} role="status">
      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-ink-3" aria-hidden="true" />
      <div>
        <div className="text-sm font-semibold text-ink">Regional macro status unavailable</div>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-ink-3">
          OpenClaw has not published a current regional score to Supabase. The dashboard will stay grey until official-source coverage and freshness checks pass.
        </p>
      </div>
    </div>
  )
}

function Legend({ light, label }: { light: MacroTrafficLight; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_STYLES[light]}`} aria-hidden="true" />
      {label}
    </span>
  )
}

function orderRegions(rows: MacroRegionalScore[]) {
  const deduplicated = new Map<string, MacroRegionalScore>()
  rows.forEach(row => {
    const region = normalizeRegion(row.region)
    const existing = deduplicated.get(region)
    if (!existing || timestamp(row.as_of) > timestamp(existing.as_of)) deduplicated.set(region, row)
  })
  return Array.from(deduplicated.values()).sort((left, right) => {
    const leftIndex = REGION_ORDER.indexOf(normalizeRegion(left.region))
    const rightIndex = REGION_ORDER.indexOf(normalizeRegion(right.region))
    const safeLeft = leftIndex === -1 ? REGION_ORDER.length : leftIndex
    const safeRight = rightIndex === -1 ? REGION_ORDER.length : rightIndex
    return safeLeft - safeRight || regionLabel(left.region).localeCompare(regionLabel(right.region))
  })
}

function groupHistory(rows: MacroRegionalScore[]) {
  const grouped = new Map<string, MacroRegionalScore[]>()
  rows.forEach(row => {
    const region = normalizeRegion(row.region)
    const regionRows = grouped.get(region) ?? []
    regionRows.push(row)
    grouped.set(region, regionRows)
  })
  grouped.forEach(regionRows => regionRows.sort((left, right) => timestamp(right.as_of) - timestamp(left.as_of)))
  return grouped
}

function effectiveTrafficLight(row: MacroRegionalScore): MacroTrafficLight {
  if (row.is_stale || finiteNumber(row.risk_score) == null) return 'grey'
  const light = row.traffic_light?.toLowerCase()
  return light === 'green' || light === 'amber' || light === 'red' || light === 'grey' ? light : 'grey'
}

function pillarTrafficLight(value: number | null, stale: boolean): MacroTrafficLight {
  const numeric = finiteNumber(value)
  if (stale || numeric == null) return 'grey'
  if (numeric >= 65) return 'green'
  if (numeric >= 40) return 'amber'
  return 'red'
}

function trafficLabel(row: MacroRegionalScore, light: MacroTrafficLight) {
  if (row.is_stale) return 'STALE'
  if (finiteNumber(row.risk_score) == null) return 'NO SCORE'
  return light.toUpperCase()
}

function score(value: number | null) {
  const numeric = finiteNumber(value)
  return numeric == null ? '—' : String(Math.round(numeric))
}

function signedScore(value: number | null) {
  if (value == null) return '—'
  const rounded = Math.round(value * 10) / 10
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(rounded % 1 === 0 ? 0 : 1)}`
}

function coverage(value: number | null) {
  const numeric = finiteNumber(value)
  if (numeric == null) return '—'
  const percent = numeric <= 1 ? numeric * 100 : numeric
  return `${Math.round(Math.max(0, Math.min(100, percent)))}%`
}

function integer(value: number | null) {
  const numeric = finiteNumber(value)
  return numeric == null ? '—' : String(Math.max(0, Math.round(numeric)))
}

function finiteNumber(value: number | null) {
  if (value == null) return null
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function cleanDrivers(values: string[] | null) {
  return Array.from(new Set((values ?? []).map(value => value.trim()).filter(Boolean))).slice(0, 3)
}

function cleanLabel(value: string | null) {
  return value?.trim().replace(/[_-]+/g, ' ') || 'Not classified'
}

function normalizeRegion(value: string) {
  return value.trim().toUpperCase().replace(/[\s-]+/g, '_')
}

function regionLabel(value: string) {
  const normalized = normalizeRegion(value)
  return REGION_LABELS[normalized] ?? cleanLabel(value)
}

function formatDate(value: string | null) {
  if (!value) return 'No date'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Invalid date' : DATE_FORMAT.format(date)
}

function timestamp(value: string | null) {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}
