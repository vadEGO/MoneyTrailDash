-- Deterministic regional macro risk posture produced by OpenClaw.
-- Scoring stays outside Postgres; these objects store and expose its audit trail.

alter table sync_batches
  add column if not exists records_macro_regional_scores integer not null default 0,
  add column if not exists records_macro_score_components integer not null default 0;

alter table macro_data_points
  add column if not exists schema_version integer not null default 1,
  add column if not exists region text,
  add column if not exists metric_key text,
  add column if not exists pillar text,
  add column if not exists tenor text,
  add column if not exists release_date timestamptz,
  add column if not exists available_at timestamptz,
  add column if not exists available_at_basis text,
  add column if not exists release_estimated boolean not null default true,
  add column if not exists first_seen_at timestamptz,
  add column if not exists data_vintage timestamptz,
  add column if not exists is_revised boolean not null default false,
  add column if not exists revision_count integer not null default 0,
  add column if not exists revision_detected_at timestamptz,
  add column if not exists freshness_sla_hours integer,
  add column if not exists expected_release_lag_hours integer,
  add column if not exists freshness_grace_hours integer,
  add column if not exists quality_grade text,
  add column if not exists critical boolean not null default false,
  add column if not exists risk_direction text,
  add column if not exists value_type text,
  add column if not exists score_transform text,
  add column if not exists signal_label text;

alter table macro_source_status
  add column if not exists region text,
  add column if not exists failed_items text[] not null default '{}',
  add column if not exists history_insufficient_items text[] not null default '{}',
  add column if not exists critical_expected integer not null default 0,
  add column if not exists critical_active integer not null default 0,
  add column if not exists stale_items text[] not null default '{}',
  add column if not exists is_stale boolean not null default false,
  add column if not exists oldest_observation_date date,
  add column if not exists newest_observation_date date,
  add column if not exists freshness_basis text,
  add column if not exists documentation_url text;

create index if not exists macro_data_points_scoring_idx
  on macro_data_points (region, metric_key, observation_date desc nulls last);

create table if not exists macro_regional_scores (
  id text primary key,
  region text not null,
  score_date date not null,
  score numeric,
  signal text not null,
  cycle_phase text not null default 'unclassified',
  rates_score numeric,
  credit_score numeric,
  growth_score numeric,
  inflation_score numeric,
  liquidity_fx_score numeric,
  coverage_ratio numeric not null default 0,
  valid_pillars integer not null default 0,
  stale_critical boolean not null default false,
  critical_inputs_invalid boolean not null default false,
  grey_reasons text[] not null default '{}',
  change_1w numeric,
  change_1m numeric,
  top_positive_driver text,
  top_negative_driver text,
  model_version text not null,
  computed_at timestamptz not null,
  constraint macro_regional_scores_region_check
    check (region in ('US', 'EUROZONE', 'UK', 'JAPAN', 'AUSTRALIA', 'CANADA', 'GLOBAL')),
  constraint macro_regional_scores_signal_check
    check (signal in ('green', 'amber', 'red', 'grey')),
  constraint macro_regional_scores_score_check
    check (score is null or score between 0 and 100),
  constraint macro_regional_scores_coverage_check
    check (coverage_ratio between 0 and 1),
  constraint macro_regional_scores_valid_pillars_check
    check (valid_pillars between 0 and 5),
  unique (region, score_date, model_version)
);

create table if not exists macro_score_components (
  id text primary key,
  regional_score_id text not null references macro_regional_scores(id) on delete cascade,
  region text not null,
  score_date date not null,
  pillar text not null,
  metric_key text not null,
  indicator_name text,
  series_id text,
  source text,
  provider text,
  schema_version integer,
  source_url text,
  observation_date date,
  release_date timestamptz,
  available_at timestamptz,
  available_at_basis text,
  release_estimated boolean not null default true,
  first_seen_at timestamptz,
  data_vintage timestamptz,
  raw_value numeric,
  transformed_value numeric,
  score_transform text,
  risk_direction text,
  percentile numeric,
  normalized_score numeric,
  component_weight numeric not null default 0,
  contribution numeric not null default 0,
  history_start date,
  history_end date,
  history_observations integer not null default 0,
  history_days integer not null default 0,
  freshness_sla_hours integer,
  expected_release_lag_hours integer,
  freshness_grace_hours integer,
  stale_after timestamptz,
  freshness_basis text,
  age_hours numeric,
  stale boolean not null default false,
  critical boolean not null default false,
  valid boolean not null default false,
  status text not null,
  quality_grade text,
  context_note text,
  computed_at timestamptz not null,
  constraint macro_score_components_region_check
    check (region in ('US', 'EUROZONE', 'UK', 'JAPAN', 'AUSTRALIA', 'CANADA')),
  constraint macro_score_components_pillar_check
    check (pillar in ('rates', 'credit', 'growth', 'inflation', 'liquidity_fx')),
  constraint macro_score_components_percentile_check
    check (percentile is null or percentile between 0 and 1),
  constraint macro_score_components_normalized_check
    check (normalized_score is null or normalized_score between 0 and 100),
  constraint macro_score_components_weight_check
    check (component_weight between 0 and 1),
  unique (regional_score_id, metric_key)
);

create index if not exists macro_regional_scores_latest_idx
  on macro_regional_scores (region, score_date desc, computed_at desc);
create index if not exists macro_score_components_score_idx
  on macro_score_components (regional_score_id, pillar, metric_key);
create index if not exists macro_score_components_source_idx
  on macro_score_components (source, series_id, observation_date desc nulls last);

comment on table macro_regional_scores is
  'Daily deterministic risk-posture scores produced locally by OpenClaw; grey scores remain null.';
comment on table macro_score_components is
  'Auditable inputs, transformations, freshness checks, weights, and signed score contributions.';
comment on column macro_score_components.contribution is
  'Signed contribution around neutral 50; 50 + the valid component contributions reconciles the headline score.';

alter table macro_regional_scores enable row level security;
alter table macro_score_components enable row level security;

alter table macro_data_points enable row level security;
alter table macro_source_status enable row level security;

drop policy if exists macro_data_points_public_read on macro_data_points;
create policy macro_data_points_public_read
  on macro_data_points
  for select
  to anon, authenticated
  using (true);

drop policy if exists macro_source_status_public_read on macro_source_status;
create policy macro_source_status_public_read
  on macro_source_status
  for select
  to anon, authenticated
  using (true);

drop policy if exists macro_regional_scores_public_read on macro_regional_scores;
create policy macro_regional_scores_public_read
  on macro_regional_scores
  for select
  to anon, authenticated
  using (true);

drop policy if exists macro_score_components_public_read on macro_score_components;
create policy macro_score_components_public_read
  on macro_score_components
  for select
  to anon, authenticated
  using (true);

revoke all on table macro_regional_scores from public, anon, authenticated;
revoke all on table macro_score_components from public, anon, authenticated;
grant select on table macro_regional_scores to anon, authenticated;
grant select on table macro_score_components to anon, authenticated;
grant all on table macro_regional_scores to service_role;
grant all on table macro_score_components to service_role;
revoke all on table macro_data_points from public, anon, authenticated;
revoke all on table macro_source_status from public, anon, authenticated;
grant select on table macro_data_points to anon, authenticated;
grant select on table macro_source_status to anon, authenticated;
grant all on table macro_data_points to service_role;
grant all on table macro_source_status to service_role;

create or replace view public_macro_data_latest
with (security_invoker = true) as
select *
from macro_data_points
where latest = true
order by source_kind, series_id, country nulls first;

create or replace view public_macro_source_status
with (security_invoker = true) as
select *
from macro_source_status
order by checked_at desc, source;

create or replace view public_macro_regional_history
with (security_invoker = true) as
with regional_cohorts as (
  select
    base.model_version,
    base.score_date,
    (
      count(distinct base.region) = 6
      and bool_and(
        base.score is not null
        and base.signal <> 'grey'
        and base.coverage_ratio >= 0.70
        and base.valid_pillars >= 3
        and not base.stale_critical
        and not base.critical_inputs_invalid
      )
    ) as successful
  from macro_regional_scores base
  where base.region in ('US', 'EUROZONE', 'UK', 'JAPAN', 'AUSTRALIA', 'CANADA')
  group by base.model_version, base.score_date
),
successful_cohorts as (
  select
    cohort.model_version,
    cohort.score_date,
    cohort.score_date - (
      row_number() over (
        partition by cohort.model_version
        order by cohort.score_date
      )
    )::integer as streak_group
  from regional_cohorts cohort
  where cohort.successful
),
cohort_streaks as (
  select
    cohort.model_version,
    cohort.score_date,
    count(*) over (
      partition by cohort.model_version, cohort.streak_group
      order by cohort.score_date
      rows between unbounded preceding and current row
    ) as shadow_cycle_count
  from successful_cohorts cohort
),
scored as (
  select
    base.*,
    coalesce(streak.shadow_cycle_count, 0) as shadow_cycle_count
  from macro_regional_scores base
  left join cohort_streaks streak
    on streak.model_version = base.model_version
   and streak.score_date = base.score_date
)
select
  s.id,
  s.region,
  s.score_date as as_of,
  case when s.shadow_cycle_count >= 7 then s.score else null end as risk_score,
  case when s.shadow_cycle_count >= 7 then s.signal else 'grey' end as traffic_light,
  s.cycle_phase,
  case when s.shadow_cycle_count >= 7 then s.rates_score else null end as rates_score,
  case when s.shadow_cycle_count >= 7 then s.credit_score else null end as credit_score,
  case when s.shadow_cycle_count >= 7 then s.growth_score else null end as growth_score,
  case when s.shadow_cycle_count >= 7 then s.inflation_score else null end as inflation_score,
  case when s.shadow_cycle_count >= 7 then s.liquidity_fx_score else null end as liquidity_fx_score,
  s.coverage_ratio,
  (
    s.shadow_cycle_count < 7
    or s.signal = 'grey'
    or s.stale_critical
    or s.critical_inputs_invalid
  ) as is_stale,
  case when s.shadow_cycle_count >= 7 then s.change_1w else null end as weekly_change,
  case when s.shadow_cycle_count >= 7 then s.change_1m else null end as monthly_change,
  case
    when s.shadow_cycle_count < 7 or s.top_positive_driver is null then array[]::text[]
    else array[s.top_positive_driver]
  end as top_positive_drivers,
  case
    when s.shadow_cycle_count < 7 or s.top_negative_driver is null then array[]::text[]
    else array[s.top_negative_driver]
  end as top_negative_drivers,
  case
    when s.region = 'GLOBAL' then (
      select count(distinct (c.source, c.series_id))
      from macro_score_components c
      where c.score_date = s.score_date
        and c.valid
        and c.source is not null
    )
    else (
      select count(distinct (c.source, c.series_id))
      from macro_score_components c
      where c.regional_score_id = s.id
        and c.valid
        and c.source is not null
    )
  end as source_count,
  s.computed_at as updated_at
from scored s
where s.score_date >= current_date - interval '5 years';

create or replace view public_macro_regional_latest
with (security_invoker = true) as
select
  ranked.id,
  ranked.region,
  ranked.as_of,
  ranked.risk_score,
  ranked.traffic_light,
  ranked.cycle_phase,
  ranked.rates_score,
  ranked.credit_score,
  ranked.growth_score,
  ranked.inflation_score,
  ranked.liquidity_fx_score,
  ranked.coverage_ratio,
  ranked.is_stale,
  ranked.weekly_change,
  ranked.monthly_change,
  ranked.top_positive_drivers,
  ranked.top_negative_drivers,
  ranked.source_count,
  ranked.updated_at
from (
  select
    history.*,
    row_number() over (
      partition by history.region
      order by history.as_of desc, history.updated_at desc, history.id desc
    ) as recency_rank
  from public_macro_regional_history history
) ranked
where ranked.recency_rank = 1;

create or replace view public_macro_score_components
with (security_invoker = true) as
select
  c.id,
  c.regional_score_id,
  c.region,
  c.score_date as as_of,
  c.pillar,
  c.metric_key,
  c.indicator_name,
  c.series_id,
  c.source,
  c.provider,
  c.schema_version,
  c.source_url,
  c.observation_date,
  c.release_date,
  c.available_at,
  c.available_at_basis,
  c.release_estimated,
  c.first_seen_at,
  c.data_vintage,
  c.raw_value,
  c.transformed_value,
  c.score_transform,
  c.risk_direction,
  c.percentile,
  c.normalized_score,
  c.component_weight,
  c.contribution,
  c.history_start,
  c.history_end,
  c.history_observations,
  c.history_days,
  c.freshness_sla_hours,
  c.expected_release_lag_hours,
  c.freshness_grace_hours,
  c.stale_after,
  c.freshness_basis,
  c.age_hours,
  c.stale,
  c.critical,
  c.valid,
  c.status,
  c.quality_grade,
  c.context_note,
  c.computed_at as updated_at
from macro_score_components c;

revoke all on public_macro_regional_latest from public, anon, authenticated;
revoke all on public_macro_regional_history from public, anon, authenticated;
revoke all on public_macro_score_components from public, anon, authenticated;
revoke all on public_macro_data_latest from public, anon, authenticated;
revoke all on public_macro_source_status from public, anon, authenticated;
grant select on public_macro_regional_latest to anon, authenticated;
grant select on public_macro_regional_history to anon, authenticated;
grant select on public_macro_score_components to anon, authenticated;
grant select on public_macro_data_latest to anon, authenticated;
grant select on public_macro_source_status to anon, authenticated;
