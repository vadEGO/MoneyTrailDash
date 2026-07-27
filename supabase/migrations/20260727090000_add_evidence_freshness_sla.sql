alter table investment_opportunities
  add column if not exists evidence_last_confirmed_at timestamptz,
  add column if not exists evidence_review_due_at timestamptz,
  add column if not exists evidence_sla_days integer,
  add column if not exists evidence_age_days integer,
  add column if not exists evidence_freshness_status text,
  add column if not exists evidence_review_reason text;

alter table investment_opportunities
  drop constraint if exists investment_opportunities_evidence_freshness_status_check;

alter table investment_opportunities
  add constraint investment_opportunities_evidence_freshness_status_check
  check (evidence_freshness_status is null or evidence_freshness_status in ('fresh', 'aging', 'stale', 'missing'));

create index if not exists investment_opportunities_evidence_review_idx
  on investment_opportunities (evidence_freshness_status, evidence_review_due_at);

create or replace view public_opportunity_action_board
with (security_invoker = true) as
select
  row_number() over (
    partition by action_state
    order by total_score desc nulls last, confirmed_by_count desc, updated_at desc
  ) as state_rank,
  io.*
from investment_opportunities io
where deleted_at is null
  and (is_tracked or is_watchlisted or expires_at is null or expires_at > now())
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

grant select on public_opportunity_action_board to anon;
