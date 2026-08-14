import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import StatusChip from '@/components/ui/StatusChip'
import { createClient } from '@/lib/supabase-server'

type Snapshot = {
  nav: number; cash: number; market_value: number; realized_pnl: number; unrealized_pnl: number
  drawdown_pct: number; gross_exposure_pct: number; circuit_state: string; session_date: string
}
type Position = {
  symbol: string; asset_class: string; quantity: number; average_entry: number | null; stop_price: number | null
  target_price: number | null; last_price: number | null; unrealized_pnl: number; status: string
}
type Trade = { id: string; symbol: string; side: string; quantity: number; price: number; fee: number; session_date: string; fill_reason: string }

const money = (value: number | null | undefined) => value == null ? '—' : value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
const pct = (value: number | null | undefined) => value == null ? '—' : `${(value * 100).toFixed(1)}%`

export default async function PaperPage() {
  const supabase = createClient() as any
  const [snapshotResult, positionsResult, tradesResult] = await Promise.all([
    supabase.from('paper_account_snapshots').select('*').order('session_date', { ascending: false }).limit(1),
    supabase.from('paper_positions').select('*').eq('status', 'open').order('updated_at', { ascending: false }),
    supabase.from('paper_trades').select('*').order('session_date', { ascending: false }).limit(12),
  ])
  const snapshot = (snapshotResult.data?.[0] ?? null) as Snapshot | null
  const positions = (positionsResult.data ?? []) as Position[]
  const trades = (tradesResult.data ?? []) as Trade[]
  const unavailable = snapshotResult.error || positionsResult.error || tradesResult.error

  return (
    <div className="space-y-4">
      <PageHeader
        title="Paper Account"
        subtitle="Aggressive $10K swing portfolio. Simulated only — no broker, wallet, leverage, or execution connection."
        status={<StatusChip label={snapshot?.circuit_state?.replace('_', ' ') ?? 'awaiting first cycle'} variant={snapshot?.circuit_state === 'locked' ? 'red' : snapshot?.circuit_state === 'reduced_risk' ? 'amber' : 'green'} />}
      />

      {unavailable && <div className="border border-status-amber bg-amber-50 px-4 py-3 text-sm text-ink">Paper projection is waiting for its Supabase migration/export. The local ledger remains canonical.</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Metric label="NAV" value={money(snapshot?.nav)} />
        <Metric label="Cash" value={money(snapshot?.cash)} />
        <Metric label="Exposure" value={pct(snapshot?.gross_exposure_pct)} />
        <Metric label="Drawdown" value={pct(snapshot?.drawdown_pct)} />
        <Metric label="Realized P&L" value={money(snapshot?.realized_pnl)} />
        <Metric label="Unrealized P&L" value={money(snapshot?.unrealized_pnl)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Open Positions" action={<span className="font-mono text-2xs text-ink-3">{positions.length} / 5</span>}>
          {positions.length === 0 ? <Empty text="No paper positions are open. Only fresh, source-backed, actionable setups can enter." /> : (
            <div className="divide-y divide-border">{positions.map(position => <PositionRow key={position.symbol} position={position} />)}</div>
          )}
        </Card>
        <Card title="Recent Fills" action={<span className="font-mono text-2xs text-ink-3">daily-bar simulation</span>}>
          {trades.length === 0 ? <Empty text="No fills yet. The first valid order activates on the next eligible market session." /> : (
            <div className="divide-y divide-border">{trades.map(trade => <TradeRow key={trade.id} trade={trade} />)}</div>
          )}
        </Card>
      </div>

      <Card title="Execution Contract">
        <div className="grid grid-cols-1 gap-3 px-4 py-4 text-sm text-ink-3 md:grid-cols-3">
          <p><span className="font-semibold text-ink">2% risk per trade.</span> Positions cap at 25% NAV, with at most five concurrent longs.</p>
          <p><span className="font-semibold text-ink">No hindsight fills.</span> Signals wait for the next completed eligible session; stop wins any same-bar stop/target tie.</p>
          <p><span className="font-semibold text-ink">Automatic risk circuit.</span> Risk halves at 15% drawdown, entries pause at 25%, and the account locks at 35%.</p>
        </div>
      </Card>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="border border-border bg-surface px-4 py-3"><div className="text-2xs font-semibold tracking-widest text-ink-3">{label}</div><div className="mt-1 font-mono text-lg font-semibold text-ink">{value}</div></div>
}

function Empty({ text }: { text: string }) {
  return <div className="px-4 py-8 text-sm text-ink-3">{text}</div>
}

function PositionRow({ position }: { position: Position }) {
  return <div className="grid grid-cols-[1fr_auto] gap-3 px-4 py-3"><div><div className="font-mono text-sm font-semibold text-ink">{position.symbol}</div><div className="mt-1 text-2xs text-ink-3">{position.asset_class} · {position.quantity} units · entry {money(position.average_entry)}</div><div className="mt-1 text-2xs text-ink-3">stop {money(position.stop_price)} · target {money(position.target_price)} · last {money(position.last_price)}</div></div><div className={position.unrealized_pnl >= 0 ? 'font-mono text-sm text-status-green' : 'font-mono text-sm text-status-red'}>{money(position.unrealized_pnl)}</div></div>
}

function TradeRow({ trade }: { trade: Trade }) {
  return <div className="flex items-center justify-between gap-3 px-4 py-3"><div><div className="font-mono text-sm font-semibold text-ink">{trade.side.toUpperCase()} {trade.symbol}</div><div className="mt-1 text-2xs text-ink-3">{trade.session_date} · {trade.quantity} @ {money(trade.price)} · {trade.fill_reason}</div></div><div className="font-mono text-2xs text-ink-3">fee {money(trade.fee)}</div></div>
}
