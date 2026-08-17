-- Public-safe projections of the local, append-only paper trading ledger.
-- No broker credentials, wallet material, or private research are replicated.

create table if not exists public.paper_account_snapshots (
  id text primary key,
  account_id text not null,
  strategy_version text not null,
  session_date date not null,
  cash numeric not null,
  market_value numeric not null,
  nav numeric not null,
  realized_pnl numeric not null,
  unrealized_pnl numeric not null,
  drawdown_pct numeric not null,
  gross_exposure_pct numeric not null,
  circuit_state text not null,
  updated_at timestamptz not null,
  unique(account_id, session_date)
);

create table if not exists public.paper_positions (
  id text primary key,
  account_id text not null,
  symbol text not null,
  asset_class text not null,
  quantity numeric not null,
  average_entry numeric,
  stop_price numeric,
  target_price numeric,
  opened_at timestamptz,
  last_price numeric,
  unrealized_pnl numeric not null,
  realized_pnl numeric not null,
  status text not null check (status in ('open', 'closed')),
  updated_at timestamptz not null,
  unique(account_id, symbol)
);

create table if not exists public.paper_trades (
  id text primary key,
  account_id text not null,
  symbol text not null,
  side text not null check (side in ('buy', 'sell')),
  quantity numeric not null,
  price numeric not null,
  fee numeric not null,
  slippage_bps numeric not null,
  session_date date not null,
  fill_reason text not null,
  created_at timestamptz not null
);

create table if not exists public.paper_events (
  id text primary key,
  account_id text not null,
  symbol text,
  event_type text not null,
  event_at timestamptz not null,
  detail jsonb not null default '{}'::jsonb
);

alter table public.paper_account_snapshots enable row level security;
alter table public.paper_positions enable row level security;
alter table public.paper_trades enable row level security;
alter table public.paper_events enable row level security;

drop policy if exists "public paper account snapshots" on public.paper_account_snapshots;
drop policy if exists "public paper positions" on public.paper_positions;
drop policy if exists "public paper trades" on public.paper_trades;
drop policy if exists "public paper events" on public.paper_events;

create policy "public paper account snapshots" on public.paper_account_snapshots for select to anon, authenticated using (true);
create policy "public paper positions" on public.paper_positions for select to anon, authenticated using (true);
create policy "public paper trades" on public.paper_trades for select to anon, authenticated using (true);
create policy "public paper events" on public.paper_events for select to anon, authenticated using (true);

grant select on public.paper_account_snapshots, public.paper_positions, public.paper_trades, public.paper_events to anon, authenticated;

create index if not exists paper_account_snapshots_account_date_idx on public.paper_account_snapshots(account_id, session_date desc);
create index if not exists paper_positions_account_status_idx on public.paper_positions(account_id, status);
create index if not exists paper_trades_account_session_idx on public.paper_trades(account_id, session_date desc);
create index if not exists paper_events_account_time_idx on public.paper_events(account_id, event_at desc);
