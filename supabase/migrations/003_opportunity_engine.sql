alter table sync_batches add column if not exists records_opportunity_engine integer not null default 0;

create table if not exists investment_opportunities (
  id text primary key,
  source text not null,
  source_record_id text,
  symbol text,
  normalized_symbol text,
  title text not null,
  thesis text,
  direction text,
  asset_class text,
  status text,
  action_state text not null,
  lifecycle text not null default 'candidate',
  total_score numeric not null default 0,
  thesis_score numeric not null default 0,
  entry_score numeric not null default 0,
  risk_reward_score numeric not null default 0,
  catalyst_score numeric not null default 0,
  source_score numeric not null default 0,
  liquidity_score numeric not null default 0,
  portfolio_fit_score numeric not null default 0,
  current_price numeric,
  ideal_entry numeric,
  entry_min numeric,
  entry_max numeric,
  do_not_chase_above numeric,
  stop_loss numeric,
  take_profit_1 numeric,
  take_profit_2 numeric,
  take_profit_3 numeric,
  trailing_exit_trigger text,
  invalidation text,
  why_now text,
  next_action text,
  what_to_watch text,
  source_url text,
  is_tracked boolean not null default false,
  is_watchlisted boolean not null default false,
  expires_at timestamptz,
  deleted_at timestamptz,
  discovered_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists entry_exit_plans (
  id text primary key,
  opportunity_id text not null references investment_opportunities(id) on delete cascade,
  plan_type text not null default 'research',
  entry_zone text,
  exit_plan text,
  risk_notes text,
  confidence numeric not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists opportunity_engine_events (
  id text primary key,
  opportunity_id text references investment_opportunities(id) on delete set null,
  event_type text not null,
  action_state text,
  symbol text,
  title text,
  detail text,
  event_at timestamptz not null default now(),
  sync_batch_id uuid references sync_batches(id) on delete set null
);

create index if not exists investment_opportunities_action_idx on investment_opportunities(action_state, total_score desc);
create index if not exists investment_opportunities_symbol_idx on investment_opportunities(normalized_symbol);
create index if not exists investment_opportunities_expiry_idx on investment_opportunities(expires_at, deleted_at);
create index if not exists opportunity_engine_events_at_idx on opportunity_engine_events(event_at desc);

alter table investment_opportunities enable row level security;
alter table entry_exit_plans enable row level security;
alter table opportunity_engine_events enable row level security;

create or replace function cleanup_expired_investment_opportunities()
returns integer
language plpgsql
security definer
as $$
declare
  affected integer;
begin
  update investment_opportunities
  set deleted_at = now(), updated_at = now()
  where deleted_at is null
    and coalesce(is_tracked, false) = false
    and coalesce(is_watchlisted, false) = false
    and expires_at is not null
    and expires_at < now();

  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace view public_opportunity_action_board as
select
  row_number() over (
    partition by action_state
    order by total_score desc nulls last, updated_at desc
  ) as state_rank,
  *
from investment_opportunities
where deleted_at is null
  and (
    is_tracked
    or is_watchlisted
    or expires_at is null
    or expires_at > now()
  )
order by
  case action_state
    when 'ready' then 1
    when 'wait_for_entry' then 2
    when 'chasing_risk' then 3
    when 'exit_trim' then 4
    when 'invalidated' then 5
    else 6
  end,
  total_score desc nulls last;

create or replace view public_entry_exit_plans as
select
  p.*,
  o.symbol,
  o.normalized_symbol,
  o.title,
  o.action_state,
  o.total_score
from entry_exit_plans p
join investment_opportunities o on o.id = p.opportunity_id
where o.deleted_at is null;

create or replace view public_opportunity_engine_events as
select *
from opportunity_engine_events
order by event_at desc;

grant select on
  public_opportunity_action_board,
  public_entry_exit_plans,
  public_opportunity_engine_events
to anon;
