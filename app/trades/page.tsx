import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import StatusChip from '@/components/ui/StatusChip'
import { formatAge, getRvTradeEvents, getRvTradeIdeas, getRvTradeSyncStatus } from '@/lib/openclaw'

export default async function TradesPage() {
  const [ideas, events, syncRows] = await Promise.all([
    getRvTradeIdeas(80),
    getRvTradeEvents(30),
    getRvTradeSyncStatus(5),
  ])
  const latestSync = syncRows[0]

  return (
    <div className="space-y-4">
      <PageHeader
        title="RV Trade Ideas"
        subtitle="Active and pending RealVision ideas scored by OpenClaw, with expiry for stale untracked ideas."
      />

      <div className="grid grid-cols-4 gap-3">
        <Metric label="Live ideas" value={ideas.length.toString()} />
        <Metric label="Last push" value={formatAge(latestSync?.last_synced_at)} />
        <Metric label="Changed events" value={(latestSync?.records_rv_trade_events ?? events.length ?? 0).toString()} />
        <Metric label="Sync state" value={latestSync?.status ?? 'waiting'} />
      </div>

      <Card title="Leaderboard">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-dim border-b border-border">
                {['RNK', 'IDEA', 'STATUS', 'SCORE', 'PRICE', 'ENTRY', 'STOP', 'TP', 'R/R', 'STATE', 'EXPIRY'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-2xs font-semibold tracking-widest text-ink-3 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ideas.length === 0 ? (
                <tr><td colSpan={11} className="px-4 py-10 text-center text-ink-3 text-sm">No RV trade ideas synced yet</td></tr>
              ) : ideas.map(row => (
                <tr key={row.id} className="hover:bg-surface-dim transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-ink-3">{String(row.rank ?? '').padStart(2, '0')}</td>
                  <td className="px-4 py-3 min-w-[260px]">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-ink">{row.normalized_symbol ?? row.symbol ?? '—'}</span>
                      <span className="text-2xs text-ink-3 uppercase">{row.direction ?? row.action}</span>
                    </div>
                    <div className="text-sm font-semibold text-ink mt-0.5">{row.title}</div>
                    <div className="text-2xs text-ink-3 mt-0.5">{row.author_name ?? 'RV'} · {formatAge(row.source_updated_at)}</div>
                  </td>
                  <td className="px-4 py-3"><StatusChip label={row.status ?? 'unknown'} variant={statusVariant(row.status)} /></td>
                  <td className="px-4 py-3 font-mono text-xs text-ink">{num(row.total_score, 0)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink">{money(row.current_price)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink">{money(row.entry_price)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-status-red">{money(row.stop_loss)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-status-green">{money(row.take_profit)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink">{num(row.risk_reward, 2)}</td>
                  <td className="px-4 py-3"><StatusChip label={row.price_state ?? row.verdict ?? 'watch'} variant={stateVariant(row.price_state ?? row.verdict)} /></td>
                  <td className="px-4 py-3 text-xs text-ink-3">{row.is_tracked || row.is_watchlisted ? 'protected' : formatUntil(row.expires_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Latest Status Changes">
        <div className="divide-y divide-border">
          {events.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-ink-3">No RV trade events yet</div>
          ) : events.map(event => (
            <div key={event.id} className="px-4 py-3 flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-ink">{event.symbol ?? 'RV'} · {event.event_type}</div>
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

function Metric({ label, value }: { label: string; value: string }) {
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

function num(value?: number | null, digits = 1) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return Number(value).toFixed(digits)
}

function formatUntil(iso?: string | null) {
  if (!iso) return 'none'
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60000)
  if (minutes <= 0) return 'expired'
  if (minutes < 60) return `${minutes}m left`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours}h left`
  return `${Math.round(hours / 24)}d left`
}

function statusVariant(status?: string | null): 'red' | 'amber' | 'green' | 'blue' | 'purple' | 'grey' {
  const s = (status ?? '').toLowerCase()
  if (s === 'active') return 'green'
  if (s === 'pending') return 'amber'
  if (s === 'closed') return 'grey'
  return 'blue'
}

function stateVariant(state?: string | null): 'red' | 'amber' | 'green' | 'blue' | 'purple' | 'grey' {
  const s = (state ?? '').toLowerCase()
  if (s.includes('invalid') || s.includes('reject')) return 'red'
  if (s.includes('target') || s.includes('go')) return 'green'
  if (s.includes('chasing') || s.includes('watch')) return 'amber'
  if (s.includes('research')) return 'blue'
  return 'grey'
}
