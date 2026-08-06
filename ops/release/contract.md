# MoneyTrail Release Contract

MoneyTrail improvements ship as one traceable release across GitHub, OpenClaw,
Supabase, and Vercel. A feature is incomplete when it exists only in a local
checkout, automation report, database, or dashboard preview.

## Mandatory sequence

1. Run the candidate value gate. A no-op is a valid successful run.
2. Claim the shared MoneyTrail release lease before editing or opening a PR.
3. Capture source, analysis, export, schema, count, freshness, scheduler,
   queue/circuit, and production baselines.
4. Implement the complete OpenClaw-to-Supabase-to-dashboard contract.
5. Commit only intended files and push a reviewable GitHub branch/PR.
6. Apply migrations to an isolated Supabase preview branch and verify RLS,
   grants, security-invoker views, advisors, data, provenance, and freshness.
7. Verify a Vercel preview built from the same tested Git SHA and configured
   against the isolated Supabase preview project.
8. Merge the verified Git state. Apply the production Supabase expand/backfill
   phase, then deploy or promote the exact tested Vercel artifact.
9. Verify commit identity, live routes, runtime errors, Supabase security/data,
   OpenClaw execution, scheduler health, and affected/adjacent freshness.
10. Finalize the versioned release manifest and release the shared lease.

## Hard invariants

- Codex is the research/product brain; OpenClaw is the deterministic execution
  layer; Supabase is the versioned data contract; MoneyTrailDash is the decision
  surface.
- Scheduled and manual execution use the same idempotent OpenClaw entry point.
- Preview deployments must never read or write the production Supabase project.
- Source, analysis, and export freshness move only after their respective work
  succeeds.
- The last known-good data contract and Vercel deployment stay active until the
  replacement passes.
- Invalidated derived data triggers a full rebuild/backfill from canonical
  sources before atomic cutover.
- A production release must identify its Git commit/PR, OpenClaw workflow,
  Supabase migrations and project refs, Vercel deployments and commit, freshness
  comparison, and rollback targets.
- Private/raw subscriber material remains local. Never print or commit secrets.
