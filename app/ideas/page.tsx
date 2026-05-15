import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import StatusChip from '@/components/ui/StatusChip'
import { formatAge, getOpportunityActions, getOpportunityEngineEvents } from '@/lib/openclaw'

export default async function IdeasPage() {
  const [ideas, events] = await Promise.all([
    getOpportunityActions(160),
    getOpportunityEngineEvents(30),
  ])
  const sourceCounts = ideas.reduce<Record<string, number>>((acc, row) => {
    const source = sourceLabel(row.source)
    acc[source] = (acc[source] ?? 0) + 1
    return acc
  }, {})
  const ready = ideas.filter(row => row.action_state === 'ready').length
  const waiting = ideas.filter(row => row.action_state === 'wait_for_entry').length
  const risk = ideas.filter(row => ['chasing_risk', 'invalidated'].includes(row.action_state)).length

  return (
    <div className="space-y-4">
      <PageHeader
        title="Ideas"
        subtitle="Multi-source trade idea feed ranked by OpenClaw. RealVision is one source; more sources can flow into this same board."
        action={<span className="text-2xs font-mono text-ink-3 border border-border rounded px-2 py-1">RESEARCH ONLY</span>}
      />

      <div className="grid grid-cols-4 gap-3">
        <Metric label="Total Ideas" value={ideas.length} />
        <Metric label="Ready" value={ready} />
        <Metric label="Wait Entry" value={waiting} />
        <Metric label="Risk Flags" value={risk} />
      </div>

      <Card title="Source Mix">
        <div className="px-4 py-3 flex flex-wrap gap-2">
          {Object.keys(sourceCounts).length === 0 ? (
            <span className="text-sm text-ink-3">No sources synced yet</span>
          ) : Object.entries(sourceCounts).map(([source, count]) => (
            <span key={source} className="inline-flex items-center gap-2 rounded-sm border border-border bg-surface-dim px-2 py-1">
              <span className="text-2xs font-semibold uppercase tracking-widest text-ink-3">{source}</span>
              <span className="font-mono text-xs text-ink">{count}</span>
            </span>
          ))}
        </div>
      </Card>

      <Card title="Unified Idea Feed">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-dim border-b border-border">
                {['RNK', 'SOURCE', 'IDEA', 'STATE', 'SCORE', 'PRICE', 'ENTRY', 'STOP', 'TP1', 'NO CHASE', 'UPDATED'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-2xs font-semibold tracking-widest text-ink-3 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ideas.length === 0 ? (
                <tr><td colSpan={11} className="px-4 py-12 text-center text-sm text-ink-3">No ideas synced yet</td></tr>
              ) : ideas.map((row, index) => (
                <tr key={row.id} className="hover:bg-surface-dim transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-ink-3">{String(index + 1).padStart(2, '0')}</td>
                  <td className="px-4 py-3">
                    <span className="text-2xs font-semibold uppercase tracking-widest text-ink-3">{sourceLabel(row.source)}</span>
                  </td>
                  <td className="px-4 py-3 min-w-[280px]">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-ink">{row.normalized_symbol ?? row.symbol ?? '—'}</span>
                      <span className="text-2xs text-ink-3 uppercase">{row.direction ?? 'watch'}</span>
                      {row.asset_class && <span className="text-2xs text-ink-3 uppercase">{row.asset_class}</span>}
                    </div>
                    <div className="text-sm font-semibold text-ink mt-0.5">{row.title}</div>
                    <div className="text-2xs text-ink-3 mt-0.5 line-clamp-1">{row.next_action ?? row.why_now}</div>
                  </td>
                  <td className="px-4 py-3"><StatusChip label={stateLabel(row.action_state)} variant={stateVariant(row.action_state)} /></td>
                  <td className="px-4 py-3"><Score value={row.total_score} /></td>
                  <td className="px-4 py-3 font-mono text-xs text-ink">{money(row.current_price)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink">{entryRange(row.entry_min, row.entry_max, row.ideal_entry)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-status-red">{money(row.stop_loss)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-status-green">{money(row.take_profit_1)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink">{money(row.do_not_chase_above)}</td>
                  <td className="px-4 py-3 text-xs text-ink-3 whitespace-nowrap">{formatAge(row.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Latest Idea Events">
        <div className="divide-y divide-border">
          {events.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-ink-3">No idea events yet</div>
          ) : events.map(event => (
            <div key={event.id} className="px-4 py-3 flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-ink">{event.symbol ?? 'IDEA'} · {stateLabel(event.action_state ?? event.event_type)}</div>
                <div className="text-xs text-ink-3 mt-0.5">{event.detail ?? event.title}</div>
              </div>
              <div className="text-2xs font-mono text-ink-3 whitespace-nowrap">{formatAge(event.event_at)}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <div className="px-4 py-3">
        <div className="text-2xs font-semibold tracking-widest text-ink-3 uppercase">{label}</div>
        <div className="text-xl font-semibold text-ink mt-1">{value}</div>
      </div>
    </Card>
  )
}

function Score({ value }: { value?: number | null }) {
  if (value == null || Number.isNaN(Number(value))) return <span className="font-mono text-xs text-ink-3">—</span>
  const score = Math.max(0, Math.min(100, Number(value)))
  const color = score >= 70 ? 'bg-status-green' : score >= 50 ? 'bg-status-amber' : 'bg-status-red'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-dim">
        <div className={`h-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="font-mono text-xs font-semibold text-ink">{Math.round(score)}</span>
    </div>
  )
}

function sourceLabel(source?: string | null) {
  if (!source) return 'Unknown'
  if (source.toLowerCase() === 'realvision') return 'RealVision'
  return source.replace(/[_-]/g, ' ')
}

function stateLabel(state?: string | null) {
  const labels: Record<string, string> = {
    ready: 'Ready',
    wait_for_entry: 'Wait Entry',
    chasing_risk: 'Do Not Chase',
    exit_trim: 'Exit / Trim',
    invalidated: 'Invalidated',
    research: 'Research',
    action_state_snapshot: 'Snapshot',
  }
  return labels[(state ?? '').toLowerCase()] ?? (state ?? 'Research')
}

function stateVariant(state?: string | null): 'red' | 'amber' | 'green' | 'blue' | 'purple' | 'grey' {
  const s = (state ?? '').toLowerCase()
  if (s === 'ready') return 'green'
  if (s === 'wait_for_entry') return 'blue'
  if (s === 'chasing_risk') return 'amber'
  if (s === 'exit_trim') return 'purple'
  if (s === 'invalidated') return 'red'
  return 'grey'
}

function money(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  const n = Number(value)
  if (Math.abs(n) < 1) return `$${n.toPrecision(4)}`
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function entryRange(min?: number | null, max?: number | null, fallback?: number | null) {
  if (min != null && max != null) return `${money(min)}–${money(max)}`
  return money(fallback)
}
