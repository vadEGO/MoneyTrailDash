alter table investment_opportunities
  add column if not exists evidence_review_priority_score integer,
  add column if not exists evidence_review_priority_tier text,
  add column if not exists evidence_review_priority_reason text;

alter table investment_opportunities
  drop constraint if exists investment_opportunities_evidence_review_priority_score_check,
  drop constraint if exists investment_opportunities_evidence_review_priority_tier_check;

alter table investment_opportunities
  add constraint investment_opportunities_evidence_review_priority_score_check
    check (evidence_review_priority_score is null or evidence_review_priority_score between 0 and 100),
  add constraint investment_opportunities_evidence_review_priority_tier_check
    check (evidence_review_priority_tier is null or evidence_review_priority_tier in ('critical', 'high', 'standard'));

create index if not exists investment_opportunities_evidence_priority_idx
  on investment_opportunities (evidence_review_priority_score desc, total_score desc)
  where evidence_freshness_status in ('stale', 'missing');

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
