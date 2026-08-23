-- Structured, evidence-aware thesis quality read model.
-- This is a monitoring contract only: it cannot create an executable trade.

create table if not exists public.thesis_quality_records (
  id text primary key,
  symbol text not null,
  asset_name text,
  asset_class text,
  primary_thesis text not null,
  title text not null,
  claim text not null,
  mechanism text not null,
  horizon text not null,
  status text not null check (status in ('validated', 'watch', 'research', 'quarantine', 'unclassified')),
  quality_score numeric not null check (quality_score between 0 and 100),
  confidence numeric not null check (confidence between 0 and 1),
  evidence_status text not null check (evidence_status in ('fresh', 'aging', 'stale', 'missing')),
  evidence_last_confirmed_at timestamptz,
  source_count integer not null default 0,
  confirming_source_count integer not null default 0,
  contradicting_evidence_count integer not null default 0,
  supporting_evidence text[] not null default '{}',
  contradicting_evidence text[] not null default '{}',
  unknowns text[] not null default '{}',
  invalidation_conditions text[] not null default '{}',
  leading_indicators jsonb not null default '[]'::jsonb,
  next_test text not null,
  next_test_due_at timestamptz,
  best_expression text,
  adjudication_decision text,
  adjudication_reason_codes text[] not null default '{}',
  counter_thesis text,
  scenarios jsonb not null default '{}'::jsonb,
  source_details jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null
);

create index if not exists thesis_quality_records_board_idx
  on public.thesis_quality_records (status, quality_score desc, updated_at desc);
create index if not exists thesis_quality_records_symbol_idx
  on public.thesis_quality_records (symbol, updated_at desc);

alter table public.thesis_quality_records enable row level security;

drop policy if exists thesis_quality_records_public_read on public.thesis_quality_records;
create policy thesis_quality_records_public_read
  on public.thesis_quality_records
  for select
  to anon, authenticated
  using (true);

revoke all on table public.thesis_quality_records from public, anon, authenticated;
grant select on table public.thesis_quality_records to anon, authenticated;
grant all on table public.thesis_quality_records to service_role;

create or replace view public.public_thesis_quality
with (security_invoker = true) as
select *
from public.thesis_quality_records
order by quality_score desc, updated_at desc;

revoke all on public.public_thesis_quality from public, anon, authenticated;
grant select on public.public_thesis_quality to anon, authenticated;
