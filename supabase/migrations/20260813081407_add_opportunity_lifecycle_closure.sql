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
