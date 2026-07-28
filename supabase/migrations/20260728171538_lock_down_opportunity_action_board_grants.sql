-- The action board is a public read model, not a writable API surface.
-- Explicit revocation prevents project-level default privileges from leaving
-- DELETE/INSERT/UPDATE/etc. attached when the view is created or replaced.
revoke all privileges on public.public_opportunity_action_board from anon, authenticated;
grant select on public.public_opportunity_action_board to anon, authenticated;
