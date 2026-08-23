-- Keep runtime configuration heartbeats separate from real LLM outcomes.
-- `configured` means OpenClaw selected the model; it is not a model call.

create or replace view public_dashboard_summary as
select
  (select completed_at from sync_batches where status = 'success' order by completed_at desc nulls last limit 1) as last_synced_at,
  (select created_at from council_runs order by created_at desc nulls last limit 1) as last_council_run_at,
  (select count(*) from opportunities) as opportunity_count,
  (select count(*) from theses) as thesis_count,
  (select count(*) from council_runs) as council_run_count,
  (select count(*) from claims) as claim_count,
  (select count(*) from insights) as insight_count,
  (select coalesce(avg(case when status = 'fallback' then 1 else 0 end), 0)
   from llm_reasoning_audit
   where status in ('ok', 'fallback', 'failed')
     and created_at > now() - interval '7 days') as llm_fallback_rate;

create or replace view public_llm_health as
select
  date_trunc('day', created_at) as day,
  model,
  count(*) as calls,
  count(*) filter (where status = 'ok') as ok_count,
  count(*) filter (where status = 'fallback') as fallback_count,
  count(*) filter (where status = 'failed') as failed_count,
  count(*) filter (where status = 'configured') as configured_count
from llm_reasoning_audit
group by 1, 2
order by day desc nulls last;
