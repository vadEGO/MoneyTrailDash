-- Do not treat non-call configuration audit rows as successful model calls.
-- Null means there were no inference calls in the trailing 7-day window.
create or replace view public_dashboard_summary as
select
  (select completed_at from sync_batches where status = 'success'
   order by completed_at desc nulls last limit 1) as last_synced_at,
  (select created_at from council_runs
   order by created_at desc nulls last limit 1) as last_council_run_at,
  (select count(*) from public_opportunity_action_board) as opportunity_count,
  (select count(*) from theses) as thesis_count,
  (select count(*) from council_runs) as council_run_count,
  (select count(*) from claims) as claim_count,
  (select count(*) from insights) as insight_count,
  (select avg(case when status = 'fallback' then 1 else 0 end)
   from llm_reasoning_audit
   where status in ('ok', 'fallback', 'failed')
     and created_at > now() - interval '7 days') as llm_fallback_rate;
