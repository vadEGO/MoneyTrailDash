alter table public.investment_opportunities
  add column if not exists lifecycle_status text not null default 'active',
  add column if not exists soft_archived_at timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists lifecycle_reason text,
  add column if not exists lifecycle_last_reviewed_at timestamptz,
  add column if not exists lifecycle_managed_by text,
  add column if not exists lifecycle_policy_version integer not null default 1;

alter table public.investment_opportunities
  drop constraint if exists investment_opportunities_lifecycle_status_check;

alter table public.investment_opportunities
  add constraint investment_opportunities_lifecycle_status_check
  check (lifecycle_status in ('active', 'soft_archived', 'closed'));

update public.investment_opportunities
set lifecycle_status = case when deleted_at is null then 'active' else 'soft_archived' end,
    soft_archived_at = case when deleted_at is null then null else coalesce(soft_archived_at, deleted_at) end,
    closed_at = case when deleted_at is null then null else closed_at end,
    lifecycle_reason = coalesce(
      lifecycle_reason,
      case
        when deleted_at is null then 'active before lifecycle contract v2'
        when exists (
          select 1 from public.opportunity_engine_events event
          where event.opportunity_id = investment_opportunities.id
            and event.event_type = 'stale_idea_archived'
        ) then 'deterministic source-SLA retirement imported into lifecycle contract v2'
        else 'legacy soft archive imported into lifecycle contract v2'
      end
    ),
    lifecycle_managed_by = coalesce(
      lifecycle_managed_by,
      case when exists (
        select 1 from public.opportunity_engine_events event
        where event.opportunity_id = investment_opportunities.id
          and event.event_type = 'stale_idea_archived'
      ) then 'openclaw_stale_lifecycle' else 'legacy_import' end
    ),
    lifecycle_policy_version = 2;

create index if not exists investment_opportunities_lifecycle_review_idx
  on public.investment_opportunities (lifecycle_status, soft_archived_at)
  where lifecycle_status in ('soft_archived', 'closed');

comment on column public.investment_opportunities.lifecycle_status is
  'Versioned OpenClaw lifecycle state. Closed retains the record and provenance; it is never a hard delete.';
comment on column public.investment_opportunities.lifecycle_last_reviewed_at is
  'Monthly closure-review clock. This must not be used as source, analysis, or export freshness.';

create or replace function public.apply_opportunity_lifecycle_transitions(
  p_transitions jsonb,
  p_reviewed_at timestamptz,
  p_policy_version integer
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  updated_count integer := 0;
  event_count integer := 0;
begin
  if jsonb_typeof(p_transitions) is distinct from 'array' then
    raise exception 'p_transitions must be a JSON array';
  end if;

  with transitions as (
    select *
    from jsonb_to_recordset(p_transitions) as item(
      opportunity_id text,
      lifecycle_status text,
      deleted_at timestamptz,
      soft_archived_at timestamptz,
      closed_at timestamptz,
      reason text,
      managed_by text,
      event_id text,
      event_type text,
      action_state text,
      symbol text,
      title text,
      detail text
    )
  ), changed as (
    update public.investment_opportunities opportunity
    set lifecycle_status = transition.lifecycle_status,
        deleted_at = transition.deleted_at,
        soft_archived_at = transition.soft_archived_at,
        closed_at = transition.closed_at,
        lifecycle_last_reviewed_at = p_reviewed_at,
        lifecycle_reason = transition.reason,
        lifecycle_managed_by = coalesce(transition.managed_by, opportunity.lifecycle_managed_by),
        lifecycle_policy_version = p_policy_version
    from transitions transition
    where opportunity.id = transition.opportunity_id
    returning opportunity.id
  )
  select count(*) into updated_count from changed;

  with transitions as (
    select *
    from jsonb_to_recordset(p_transitions) as item(
      opportunity_id text,
      lifecycle_status text,
      deleted_at timestamptz,
      soft_archived_at timestamptz,
      closed_at timestamptz,
      reason text,
      managed_by text,
      event_id text,
      event_type text,
      action_state text,
      symbol text,
      title text,
      detail text
    )
  ), inserted as (
    insert into public.opportunity_engine_events
      (id, opportunity_id, event_type, action_state, symbol, title, detail, event_at, sync_batch_id)
    select event_id, opportunity_id, event_type, action_state, symbol, title, detail, p_reviewed_at, null
    from transitions
    where event_id is not null
    on conflict (id) do nothing
    returning id
  )
  select count(*) into event_count from inserted;

  if updated_count <> jsonb_array_length(p_transitions) then
    raise exception 'lifecycle transition target mismatch: updated %, requested %',
      updated_count, jsonb_array_length(p_transitions);
  end if;

  return jsonb_build_object('updated', updated_count, 'events_inserted', event_count);
end;
$$;

revoke all on function public.apply_opportunity_lifecycle_transitions(jsonb, timestamptz, integer) from public;
revoke all on function public.apply_opportunity_lifecycle_transitions(jsonb, timestamptz, integer) from anon;
revoke all on function public.apply_opportunity_lifecycle_transitions(jsonb, timestamptz, integer) from authenticated;
grant execute on function public.apply_opportunity_lifecycle_transitions(jsonb, timestamptz, integer) to service_role;
