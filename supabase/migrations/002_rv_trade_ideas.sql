alter table sync_batches add column if not exists records_rv_trade_ideas integer not null default 0;
alter table sync_batches add column if not exists records_rv_trade_events integer not null default 0;

create table if not exists rv_trade_ideas (
  id text primary key,
  slug text unique,
  source text not null default 'realvision',
  source_url text,
  title text not null,
  symbol text,
  normalized_symbol text,
  market text,
  asset_class text,
  action text,
  direction text,
  status text,
  is_live boolean not null default false,
  is_tracked boolean not null default false,
  is_watchlisted boolean not null default false,
  author_name text,
  vote_in integer not null default 0,
  vote_out integer not null default 0,
  vote_watching integer not null default 0,
  comments_count integer not null default 0,
  current_price numeric,
  entry_price numeric,
  stop_loss numeric,
  take_profit numeric,
  risk_reward numeric,
  total_return numeric,
  rationale_public text,
  learnings_public text,
  content_hash text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  source_created_at timestamptz,
  source_updated_at timestamptz,
  source_exit_at timestamptz,
  expires_at timestamptz,
  deleted_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists rv_trade_idea_levels (
  id text primary key,
  idea_id text not null references rv_trade_ideas(id) on delete cascade,
  level_type text not null,
  price numeric not null,
  source text not null,
  confidence numeric,
  notes text,
  updated_at timestamptz not null default now()
);

create table if not exists rv_trade_idea_scores (
  idea_id text primary key references rv_trade_ideas(id) on delete cascade,
  total_score numeric not null default 0,
  verdict text,
  source_quality numeric not null default 0,
  evidence_quality numeric not null default 0,
  technical_setup numeric not null default 0,
  risk_reward_score numeric not null default 0,
  thesis_fit numeric not null default 0,
  macro_liquidity_fit numeric not null default 0,
  portfolio_relevance numeric not null default 0,
  freshness numeric not null default 0,
  reasoning_summary text,
  invalidation text,
  next_action text,
  price_state text,
  score_version text not null default 'rv-balanced-v1',
  computed_at timestamptz not null default now()
);

create table if not exists rv_trade_idea_events (
  id text primary key,
  idea_id text references rv_trade_ideas(id) on delete set null,
  event_type text not null,
  title text,
  symbol text,
  old_value text,
  new_value text,
  detail text,
  event_at timestamptz not null default now(),
  sync_batch_id uuid references sync_batches(id) on delete set null
);

create table if not exists rv_market_candles (
  id text primary key,
  symbol text not null,
  provider text not null,
  timeframe text not null,
  candle_at timestamptz not null,
  open numeric,
  high numeric,
  low numeric,
  close numeric,
  volume numeric,
  updated_at timestamptz not null default now()
);

create index if not exists rv_trade_ideas_live_idx on rv_trade_ideas(is_live, deleted_at, expires_at);
create index if not exists rv_trade_ideas_symbol_idx on rv_trade_ideas(normalized_symbol);
create index if not exists rv_trade_ideas_updated_idx on rv_trade_ideas(source_updated_at desc nulls last, updated_at desc);
create index if not exists rv_trade_events_at_idx on rv_trade_idea_events(event_at desc);
create index if not exists rv_market_candles_symbol_idx on rv_market_candles(symbol, timeframe, candle_at desc);

alter table rv_trade_ideas enable row level security;
alter table rv_trade_idea_levels enable row level security;
alter table rv_trade_idea_scores enable row level security;
alter table rv_trade_idea_events enable row level security;
alter table rv_market_candles enable row level security;

create or replace function cleanup_expired_rv_trade_ideas()
returns integer
language plpgsql
security definer
as $$
declare
  affected integer;
begin
  update rv_trade_ideas
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

create or replace view public_rv_trade_leaderboard as
select
  row_number() over (
    order by s.total_score desc nulls last, i.source_updated_at desc nulls last, i.updated_at desc
  ) as rank,
  i.id,
  i.slug,
  i.title,
  i.symbol,
  i.normalized_symbol,
  i.market,
  i.asset_class,
  i.action,
  i.direction,
  i.status,
  i.is_live,
  i.is_tracked,
  i.is_watchlisted,
  i.author_name,
  i.vote_in,
  i.vote_out,
  i.vote_watching,
  i.comments_count,
  i.current_price,
  i.entry_price,
  i.stop_loss,
  i.take_profit,
  i.risk_reward,
  i.total_return,
  i.source_url,
  i.source_created_at,
  i.source_updated_at,
  i.expires_at,
  s.total_score,
  s.verdict,
  s.source_quality,
  s.evidence_quality,
  s.technical_setup,
  s.risk_reward_score,
  s.thesis_fit,
  s.macro_liquidity_fit,
  s.portfolio_relevance,
  s.freshness,
  s.reasoning_summary,
  s.invalidation,
  s.next_action,
  s.price_state,
  s.computed_at
from rv_trade_ideas i
left join rv_trade_idea_scores s on s.idea_id = i.id
where i.deleted_at is null
  and (
    i.is_tracked
    or i.is_watchlisted
    or i.expires_at is null
    or i.expires_at > now()
  )
  and lower(coalesce(i.status, '')) in ('active', 'pending');

create or replace view public_rv_trade_history as
select
  i.*,
  s.total_score,
  s.verdict,
  s.reasoning_summary,
  s.price_state,
  s.computed_at
from rv_trade_ideas i
left join rv_trade_idea_scores s on s.idea_id = i.id
where i.deleted_at is null
  and lower(coalesce(i.status, '')) not in ('active', 'pending')
order by i.source_updated_at desc nulls last, i.updated_at desc;

create or replace view public_rv_trade_detail as
select
  i.*,
  s.total_score,
  s.verdict,
  s.source_quality,
  s.evidence_quality,
  s.technical_setup,
  s.risk_reward_score,
  s.thesis_fit,
  s.macro_liquidity_fit,
  s.portfolio_relevance,
  s.freshness,
  s.reasoning_summary,
  s.invalidation,
  s.next_action,
  s.price_state,
  s.computed_at
from rv_trade_ideas i
left join rv_trade_idea_scores s on s.idea_id = i.id
where i.deleted_at is null;

create or replace view public_rv_trade_chart_overlays as
select
  l.idea_id,
  i.normalized_symbol as symbol,
  l.level_type,
  l.price,
  l.source,
  l.confidence,
  l.notes,
  l.updated_at
from rv_trade_idea_levels l
join rv_trade_ideas i on i.id = l.idea_id
where i.deleted_at is null;

create or replace view public_rv_trade_events as
select *
from rv_trade_idea_events
order by event_at desc;

create or replace view public_rv_trade_sync_status as
select
  sb.id as sync_batch_id,
  sb.status,
  sb.completed_at as last_synced_at,
  sb.workflow_name,
  sb.records_rv_trade_ideas,
  sb.records_rv_trade_events,
  sb.error_summary,
  (now() - sb.completed_at) > interval '90 minutes' as is_stale
from sync_batches sb
where sb.workflow_name like '%rv%' or sb.records_rv_trade_ideas > 0
order by sb.started_at desc
limit 20;

grant select on
  public_rv_trade_leaderboard,
  public_rv_trade_history,
  public_rv_trade_detail,
  public_rv_trade_chart_overlays,
  public_rv_trade_events,
  public_rv_trade_sync_status
to anon;
