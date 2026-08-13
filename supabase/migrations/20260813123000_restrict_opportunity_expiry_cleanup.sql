create or replace function public.cleanup_expired_investment_opportunities()
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  affected integer;
begin
  update public.investment_opportunities
  set deleted_at = now(),
      soft_archived_at = now(),
      closed_at = null,
      lifecycle_status = 'soft_archived',
      lifecycle_reason = 'expired decision horizon',
      lifecycle_managed_by = 'opportunity_expiry_cleanup',
      lifecycle_policy_version = 2,
      updated_at = now()
  where deleted_at is null
    and coalesce(is_tracked, false) = false
    and coalesce(is_watchlisted, false) = false
    and expires_at is not null
    and expires_at < now();

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.cleanup_expired_investment_opportunities() from public;
revoke all on function public.cleanup_expired_investment_opportunities() from anon;
revoke all on function public.cleanup_expired_investment_opportunities() from authenticated;
grant execute on function public.cleanup_expired_investment_opportunities() to service_role;
