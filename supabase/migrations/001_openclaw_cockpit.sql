create extension if not exists pgcrypto;

create table if not exists sync_batches (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null check (status in ('running', 'success', 'partial', 'failed')),
  source_host text,
  workflow_name text,
  records_claims integer not null default 0,
  records_insights integer not null default 0,
  records_opportunities integer not null default 0,
  records_council_runs integer not null default 0,
  error_summary text,
  created_at timestamptz not null default now()
);

create table if not exists engine_runs (
  id text primary key,
  sync_batch_id uuid references sync_batches(id) on delete set null,
  run_type text not null,
  started_at timestamptz,
  completed_at timestamptz,
  status text not null default 'success',
  claims_added integer not null default 0,
  insights_added integer not null default 0,
  topic_packs_processed integer not null default 0,
  evidence_packs_created integer not null default 0,
  opportunities_created integer not null default 0,
  council_runs_created integer not null default 0,
  llm_calls_made integer not null default 0,
  llm_success_count integer not null default 0,
  llm_fallback_count integer not null default 0,
  log_excerpt_public text,
  created_at timestamptz not null default now()
);

create table if not exists claims (
  claim_id text primary key,
  raw_item_id text,
  claim_text text,
  claim_type text,
  topic_tags text[] not null default '{}',
  assets_redacted text[] not null default '{}',
  source_family text,
  source_name text,
  content_path_hash text,
  time_horizon text,
  materiality text,
  claim_confidence numeric,
  reasoning_mode text,
  reasoning_summary text,
  created_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists insights (
  insight_id text primary key,
  claim_id text references claims(claim_id) on delete set null,
  claim_text text,
  insight_classes text[] not null default '{}',
  strategic_weight numeric,
  tactical_weight numeric,
  opportunity_potential numeric,
  risk_relevance numeric,
  portfolio_relevance numeric,
  materiality text,
  research_priority text,
  requires_external_research boolean not null default false,
  user_relevance_reason_public text,
  counterpoints text[] not null default '{}',
  evidence_refs text[] not null default '{}',
  reasoning_mode text,
  llm_model text,
  created_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists topic_packs (
  topic_pack_id text primary key,
  topic text not null,
  why_now text,
  source_families jsonb not null default '{}'::jsonb,
  linked_claim_count integer not null default 0,
  linked_insight_count integer not null default 0,
  required_personas text[] not null default '{}',
  strategic_weight numeric,
  tactical_weight numeric,
  portfolio_relevance numeric,
  created_at timestamptz
);

create table if not exists opportunities (
  opportunity_id text primary key,
  title text not null,
  origin text,
  opportunity_type text,
  themes text[] not null default '{}',
  assets_or_targets_public text[] not null default '{}',
  strategic_relevance numeric,
  tactical_timing numeric,
  evidence_strength numeric,
  novelty_score numeric,
  portfolio_fit_score_public numeric,
  total_score numeric,
  status text,
  fit_reason_public text,
  created_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists council_runs (
  id text primary key,
  topic_pack_id text,
  topic text not null,
  decision_state text,
  confidence numeric,
  consensus_view text,
  recommended_next_step text,
  agreements text[] not null default '{}',
  disagreements text[] not null default '{}',
  most_important_uncertainties text[] not null default '{}',
  what_would_change_our_mind text[] not null default '{}',
  personal_constraints_public text[] not null default '{}',
  reasoning_mode text,
  llm_model text,
  created_at timestamptz
);

create table if not exists persona_positions (
  id text primary key,
  council_run_id text references council_runs(id) on delete cascade,
  persona text not null,
  thesis text,
  supporting_evidence text[] not null default '{}',
  counterpoints text[] not null default '{}',
  risks text[] not null default '{}',
  investment_implications text,
  what_would_change_my_mind text[] not null default '{}',
  confidence numeric,
  reasoning_mode text,
  created_at timestamptz not null default now()
);

create table if not exists theses (
  id text primary key,
  topic text not null,
  status text,
  confidence numeric,
  confidence_movement text,
  decision_state text,
  core_reasoning text,
  next_step text,
  agreements text[] not null default '{}',
  counterpoints text[] not null default '{}',
  invalidation_conditions text[] not null default '{}',
  last_changed_reason text,
  last_updated timestamptz
);

create table if not exists evidence_packs (
  id text primary key,
  topic text not null,
  research_mode text,
  status text,
  results_count integer not null default 0,
  evidence_pack_markdown_public text,
  supporting_evidence_summary text,
  contradicting_evidence_summary text,
  open_questions text[] not null default '{}',
  created_at timestamptz
);

create table if not exists reports (
  id text primary key,
  report_type text not null,
  report_date date,
  title text,
  markdown_public text,
  summary text,
  created_at timestamptz
);

create table if not exists llm_reasoning_audit (
  id text primary key,
  prompt_type text,
  status text,
  model text,
  linked_record_ids text[] not null default '{}',
  fallback_reason text,
  created_at timestamptz
);

create index if not exists claims_created_at_idx on claims(created_at desc);
create index if not exists insights_priority_idx on insights(research_priority, materiality);
create index if not exists opportunities_score_idx on opportunities(total_score desc);
create index if not exists council_runs_created_at_idx on council_runs(created_at desc);
create index if not exists theses_confidence_idx on theses(confidence desc);
create index if not exists reports_date_idx on reports(report_date desc);

alter table sync_batches enable row level security;
alter table engine_runs enable row level security;
alter table claims enable row level security;
alter table insights enable row level security;
alter table topic_packs enable row level security;
alter table opportunities enable row level security;
alter table council_runs enable row level security;
alter table persona_positions enable row level security;
alter table theses enable row level security;
alter table evidence_packs enable row level security;
alter table reports enable row level security;
alter table llm_reasoning_audit enable row level security;

create or replace view public_dashboard_summary as
select
  (select completed_at from sync_batches where status = 'success' order by completed_at desc nulls last limit 1) as last_synced_at,
  (select created_at from council_runs order by created_at desc nulls last limit 1) as last_council_run_at,
  (select count(*) from opportunities) as opportunity_count,
  (select count(*) from theses) as thesis_count,
  (select count(*) from council_runs) as council_run_count,
  (select count(*) from claims) as claim_count,
  (select count(*) from insights) as insight_count,
  (select coalesce(avg(case when status = 'fallback' then 1 else 0 end), 0) from llm_reasoning_audit where created_at > now() - interval '7 days') as llm_fallback_rate;

create or replace view public_latest_council_runs as
select *
from council_runs
order by created_at desc nulls last;

create or replace view public_persona_positions as
select *
from persona_positions;

create or replace view public_opportunity_watchlist as
select
  row_number() over (order by total_score desc nulls last, created_at desc nulls last) as rank,
  opportunity_id,
  title,
  status,
  strategic_relevance,
  tactical_timing,
  evidence_strength,
  novelty_score,
  portfolio_fit_score_public,
  total_score,
  themes,
  assets_or_targets_public,
  fit_reason_public as why_now,
  coalesce(
    (select array_to_string(cr.what_would_change_our_mind[1:2], '; ') from council_runs cr where cr.topic = opportunities.title order by cr.created_at desc nulls last limit 1),
    'More evidence, valuation, timing, or thesis invalidation data'
  ) as what_would_change_the_view,
  coalesce(
    (select cr.recommended_next_step from council_runs cr where cr.topic = opportunities.title order by cr.created_at desc nulls last limit 1),
    'Investigate'
  ) as next_step,
  updated_at
from opportunities;

create or replace view public_thesis_register as
select *
from theses
order by confidence desc nulls last, last_updated desc nulls last;

create or replace view public_research_library as
select
  claim_id as id,
  'claim'::text as record_type,
  coalesce(array_to_string(topic_tags, ', '), 'general') as topic,
  claim_text as title,
  reasoning_summary as summary,
  materiality,
  null::text as research_priority,
  source_family,
  created_at
from claims
union all
select
  insight_id as id,
  'insight'::text as record_type,
  coalesce(array_to_string(insight_classes, ', '), 'insight') as topic,
  left(coalesce(claim_text, 'Insight'), 160) as title,
  coalesce(reasoning_summary, user_relevance_reason_public) as summary,
  materiality,
  research_priority,
  null::text as source_family,
  created_at
from insights
union all
select
  id,
  'evidence_pack'::text as record_type,
  topic,
  topic as title,
  coalesce(supporting_evidence_summary, contradicting_evidence_summary) as summary,
  null::text as materiality,
  status as research_priority,
  null::text as source_family,
  created_at
from evidence_packs
union all
select
  id,
  report_type as record_type,
  report_type as topic,
  title,
  summary,
  null::text as materiality,
  null::text as research_priority,
  null::text as source_family,
  created_at
from reports;

create or replace view public_engine_health as
select
  sb.id as sync_batch_id,
  sb.status,
  sb.completed_at as last_synced_at,
  sb.workflow_name,
  sb.records_claims,
  sb.records_insights,
  sb.records_opportunities,
  sb.records_council_runs,
  sb.error_summary,
  (now() - sb.completed_at) > interval '26 hours' as is_stale
from sync_batches sb
order by sb.started_at desc
limit 20;

create or replace view public_reports as
select *
from reports
order by report_date desc nulls last, created_at desc nulls last;

create or replace view public_llm_health as
select
  date_trunc('day', created_at) as day,
  model,
  count(*) as calls,
  count(*) filter (where status = 'ok') as ok_count,
  count(*) filter (where status = 'fallback') as fallback_count,
  count(*) filter (where status = 'failed') as failed_count
from llm_reasoning_audit
group by 1, 2
order by day desc nulls last;

grant usage on schema public to anon;
grant select on
  public_dashboard_summary,
  public_latest_council_runs,
  public_persona_positions,
  public_opportunity_watchlist,
  public_thesis_register,
  public_research_library,
  public_engine_health,
  public_reports,
  public_llm_health
to anon;
