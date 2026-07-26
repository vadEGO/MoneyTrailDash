-- These views expose intentionally public-safe portfolio summaries. Make the
-- caller's RLS policies authoritative instead of running with view-owner rights.
alter view public.public_thesis_allocation
  set (security_invoker = true);

alter view public.public_portfolio_proposal
  set (security_invoker = true);
