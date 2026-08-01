import Link from 'next/link'
import RegionalMacroRiskBoard from '@/components/RegionalMacroRiskBoard'
import Card from '@/components/ui/Card'
import PageHeader from '@/components/ui/PageHeader'
import StatusChip from '@/components/ui/StatusChip'
import {
  formatAge,
  getMacroRegionalHistory,
  getMacroRegionalLatest,
  getMacroSourceStatus,
} from '@/lib/openclaw'
import type { MacroRegionalScore, MacroSourceStatus, MacroTrafficLight } from '@/lib/types'

export const revalidate = 300

export default async function MacroPage() {
  const [regions, history, sources] = await Promise.all([
    getMacroRegionalLatest(),
    getMacroRegionalHistory({ limit: 180 }),
    getMacroSourceStatus(120),
  ])
  const global = regions.find(row => row.region.trim().toUpperCase() === 'GLOBAL')
  const globalLight = effectiveTrafficLight(global)
  const latestUpdate = newestTimestamp(regions)
  const activeSources = sources.filter(source => source.enabled !== false)

  return (
    <div className="space-y-4">
      <PageHeader
        title="Macro"
        subtitle="Live regional risk posture from official rates, credit, growth, inflation, liquidity, and FX data."
        status={<StatusChip label={globalLabel(global, globalLight)} variant={globalLight} />}
        action={
          <div className="text-right">
            <div className="text-2xs font-mono uppercase text-ink-3">Updated {formatAge(latestUpdate)}</div>
            <Link href="/api/macro/regions" className="mt-1 block text-2xs text-ink-3 hover:text-ink">REGIONS API →</Link>
          </div>
        }
      />

      <Card
        title="Regional Macro Risk Board"
        action={`${regions.length} regions · ${activeSources.length} enabled sources`}
      >
        <RegionalMacroRiskBoard rows={regions} history={history} />
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <Card
          title="Official Source Pipeline"
          action={<Link href="/api/macro/sources" className="text-2xs text-ink-3 hover:text-ink">SOURCE API →</Link>}
        >
          <SourcePipeline sources={activeSources} />
        </Card>

        <Card title="Signal Contract">
          <div className="divide-y divide-border">
            <ContractRow label="Orchestrator" value="OpenClaw" />
            <ContractRow label="Read model" value="Supabase public views" />
            <ContractRow label="Score cadence" value="Daily" />
            <ContractRow label="Activation gate" value="7 daily shadow cycles" />
            <ContractRow label="Missing data" value="Grey · never substituted" />
            <ContractRow label="Cycle phase" value="Separate from risk posture" />
          </div>
          <div className="border-t border-border bg-surface-dim px-4 py-3 text-xs leading-5 text-ink-3">
            Headline and pillar scores are computed upstream. This dashboard only reads, formats, and explains the published result.
          </div>
        </Card>
      </div>
    </div>
  )
}

function SourcePipeline({ sources }: { sources: MacroSourceStatus[] }) {
  if (sources.length === 0) {
    return (
      <div className="flex items-start gap-3 px-4 py-8" role="status">
        <span className="mt-1 h-2.5 w-2.5 rounded-full bg-ink-3" aria-hidden="true" />
        <div>
          <div className="text-sm font-semibold text-ink">Source status unavailable</div>
          <div className="mt-1 text-xs text-ink-3">No source-health rows are published. Regional scores remain subject to their own grey-state checks.</div>
        </div>
      </div>
    )
  }

  const ordered = [...sources].sort((left, right) => {
    const statusOrder = sourceStatusRank(left.status) - sourceStatusRank(right.status)
    return statusOrder || sourceName(left).localeCompare(sourceName(right))
  })

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px]">
        <caption className="sr-only">Macro data source health and coverage</caption>
        <thead>
          <tr className="border-b border-border bg-surface-dim">
            {['Provider', 'Feed', 'Status', 'Coverage', 'Checked'].map(label => (
              <th key={label} scope="col" className="px-4 py-2.5 text-left text-2xs font-semibold uppercase tracking-widest text-ink-3">{label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {ordered.slice(0, 24).map(source => (
            <tr key={source.id} className="hover:bg-surface-dim">
              <td className="px-4 py-3 text-xs font-semibold text-ink">{source.provider ?? 'Official source'}</td>
              <td className="px-4 py-3">
                <div className="text-xs text-ink">{source.source}</div>
                <div className="mt-0.5 text-2xs text-ink-3">{source.cadence ?? source.source_kind ?? 'Cadence unavailable'}</div>
              </td>
              <td className="px-4 py-3"><StatusChip label={source.status ?? 'unknown'} variant={sourceStatusVariant(source.status)} /></td>
              <td className="px-4 py-3 font-mono text-xs text-ink">
                {source.active_items == null || source.expected_items == null
                  ? `${source.points_ingested ?? 0} pts`
                  : `${source.active_items}/${source.expected_items}`}
              </td>
              <td className="whitespace-nowrap px-4 py-3 font-mono text-2xs text-ink-3">{formatAge(source.checked_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ContractRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <span className="text-xs text-ink-3">{label}</span>
      <span className="text-right text-xs font-semibold text-ink">{value}</span>
    </div>
  )
}

function effectiveTrafficLight(row?: MacroRegionalScore): MacroTrafficLight {
  if (!row || row.is_stale || row.risk_score == null || !Number.isFinite(Number(row.risk_score))) return 'grey'
  const light = row.traffic_light?.toLowerCase()
  return light === 'green' || light === 'amber' || light === 'red' || light === 'grey' ? light : 'grey'
}

function globalLabel(row: MacroRegionalScore | undefined, light: MacroTrafficLight) {
  if (!row) return 'GLOBAL UNAVAILABLE'
  if (row.is_stale) return 'GLOBAL STALE'
  return `GLOBAL ${light.toUpperCase()}`
}

function newestTimestamp(rows: MacroRegionalScore[]) {
  const timestamps = rows.flatMap(row => {
    const candidate = row.updated_at ?? row.as_of
    const parsed = candidate ? Date.parse(candidate) : Number.NaN
    return Number.isFinite(parsed) && candidate ? [candidate] : []
  })
  return timestamps.sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null
}

function sourceName(source: MacroSourceStatus) {
  return `${source.provider ?? ''} ${source.source}`.trim()
}

function sourceStatusRank(status?: string | null) {
  const value = status?.toLowerCase()
  if (value === 'failed') return 0
  if (value === 'partial') return 1
  if (value === 'pending' || value === 'registered') return 2
  if (value === 'ok') return 4
  return 3
}

function sourceStatusVariant(status?: string | null): 'red' | 'amber' | 'green' | 'blue' | 'purple' | 'grey' {
  const value = status?.toLowerCase()
  if (value === 'ok') return 'green'
  if (value === 'partial') return 'amber'
  if (value === 'failed') return 'red'
  if (value === 'pending' || value === 'registered') return 'blue'
  return 'grey'
}
