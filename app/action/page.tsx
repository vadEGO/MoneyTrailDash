import Card from '@/components/ui/Card'
import PageHeader from '@/components/ui/PageHeader'
import StatusChip from '@/components/ui/StatusChip'
import { formatAge, getEntryExitPlans, getOpportunityActions, getOpportunityEngineEvents } from '@/lib/openclaw'

const STATES = [
  ['ready', 'Ready'],
  ['wait_for_entry', 'Wait Entry'],
  ['chasing_risk', 'Do Not Chase'],
  ['exit_trim', 'Exit / Trim'],
  ['invalidated', 'Invalidated'],
  ['research', 'Research'],
] as const

export default async function ActionBoardPage() {
  const [actions, plans, events] = await Promise.all([
    getOpportunityActions(160),
    getEntryExitPlans(120),
    getOpportunityEngineEvents(40),
  ])
  const byState = new Map(STATES.map(([key]) => [key, actions.filter(row => row.action_state === key)]))
  const readyCount = byState.get('ready')?.length ?? 0
  const waitCount = byState.get('wait_for_entry')?.length ?? 0
  const exitCount = byState.get('exit_trim')?.length ?? 0
  const riskCount = (byState.get('chasing_risk')?.length ?? 0) + (byState.get('invalidated')?.length ?? 0)

  return (
    <div className="space-y-4">
      <PageHeader
        title="Action Board"
        subtitle="Research-only opportunity engine for finding candidates, entries, exits, and invalidations."
        status={<StatusChip label={readyCount > 0 ? 'REVIEW READY' : 'SCANNING'} variant={readyCount > 0 ? 'green' : 'blue'} />}
      />

      <div className="grid grid-cols-4 gap-3">
        <Metric label="Ready" value={readyCount} />
        <Metric label="Waiting Entry" value={waitCount} />
        <Metric label="Exit / Trim" value={exitCount} />
        <Metric label="Risk Flags" value={riskCount} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {STATES.map(([key, label]) => (
          <Card key={key} title={label}>
            <div className="divide-y divide-border min-h-[180px]">
              {(byState.get(key) ?? []).slice(0, 8).length === 0 ? (
                <div className="px-4 py-8 text-sm text-ink-3">No candidates</div>
              ) : (byState.get(key) ?? []).slice(0, 8).map(row => (
                <div key={row.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-mono text-xs font-semibold text-ink">{row.normalized_symbol ?? row.symbol ?? '—'}</div>
                      <div className="text-sm font-semibold text-ink mt-0.5 line-clamp-1">{row.title}</div>
                    </div>
                    <StatusChip label={score(row.total_score)} variant={variant(row.action_state)} />
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-2xs font-mono text-ink-3">
                    <span>entry {money(row.ideal_entry)}</span>
                    <span>stop {money(row.stop_loss)}</span>
                    <span>tp1 {money(row.take_profit_1)}</span>
                  </div>
                  <p className="text-xs text-ink-3 mt-2 line-clamp-2">{row.next_action}</p>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card title="Best Entry / Exit Plans">
          <div className="divide-y divide-border">
            {plans.length === 0 ? (
              <div className="px-4 py-8 text-sm text-ink-3">No plans synced yet</div>
            ) : plans.slice(0, 12).map(plan => (
              <div key={plan.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-ink">{plan.normalized_symbol ?? plan.symbol} · {plan.title}</div>
                  <StatusChip label={plan.action_state ?? 'research'} variant={variant(plan.action_state)} />
                </div>
                <div className="text-xs text-ink-3 mt-1">{plan.entry_zone}</div>
                <div className="text-xs text-ink-2 mt-1">{plan.exit_plan}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Engine Events">
          <div className="divide-y divide-border">
            {events.length === 0 ? (
              <div className="px-4 py-8 text-sm text-ink-3">No opportunity events yet</div>
            ) : events.slice(0, 12).map(event => (
              <div key={event.id} className="px-4 py-3 flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-ink">{event.symbol ?? 'OPP'} · {event.action_state ?? event.event_type}</div>
                  <div className="text-xs text-ink-3 mt-0.5">{event.detail}</div>
                </div>
                <div className="text-2xs font-mono text-ink-3 whitespace-nowrap">{formatAge(event.event_at)}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
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

function money(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  const n = Number(value)
  if (Math.abs(n) < 1) return `$${n.toPrecision(4)}`
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function score(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return Math.round(Number(value)).toString()
}

function variant(state?: string | null): 'red' | 'amber' | 'green' | 'blue' | 'purple' | 'grey' {
  const s = (state ?? '').toLowerCase()
  if (s === 'ready') return 'green'
  if (s === 'wait_for_entry') return 'blue'
  if (s === 'chasing_risk') return 'amber'
  if (s === 'exit_trim') return 'purple'
  if (s === 'invalidated') return 'red'
  return 'grey'
}
