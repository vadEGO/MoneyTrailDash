alter table public.sync_batches
  add column if not exists records_market_catalysts integer not null default 0;

create table if not exists public.market_catalyst_events (
  id text primary key,
  event_type text not null check (event_type in ('fomc_decision')),
  title text not null,
  event_start_at timestamptz not null,
  event_at timestamptz not null,
  pre_review_at timestamptz not null,
  post_review_at timestamptz not null,
  importance text not null default 'high' check (importance in ('high', 'medium', 'low')),
  has_projections boolean not null default false,
  source_name text not null,
  source_url text not null,
  summary_public text not null,
  fetched_at timestamptz not null,
  constraint market_catalyst_events_review_window
    check (pre_review_at <= event_start_at and event_start_at <= event_at and event_at <= post_review_at)
);

create index if not exists market_catalyst_events_event_at_idx
  on public.market_catalyst_events (event_at);

alter table public.market_catalyst_events enable row level security;

create policy "public catalyst events are readable"
  on public.market_catalyst_events
  for select
  to anon, authenticated
  using (true);

create or replace view public.public_market_catalyst_events
with (security_invoker = true)
as
select
  id,
  event_type,
  title,
  event_start_at,
  event_at,
  pre_review_at,
  post_review_at,
  importance,
  has_projections,
  source_name,
  source_url,
  summary_public,
  fetched_at,
  case
    when now() < pre_review_at then 'scheduled'
    when now() < event_start_at then 'pre_review'
    when now() <= event_at then 'in_progress'
    when now() <= post_review_at then 'post_review'
    else 'complete'
  end as event_phase
from public.market_catalyst_events
where post_review_at >= now() - interval '7 days'
order by event_at;

revoke all on table public.market_catalyst_events from public, anon, authenticated;
grant select on table public.market_catalyst_events to anon, authenticated;
revoke all on table public.public_market_catalyst_events from public, anon, authenticated;
grant select on table public.public_market_catalyst_events to anon, authenticated;
