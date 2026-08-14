# MoneyTrail: System Bible

MoneyTrail is a research and decision-support system. It turns local evidence
into auditable, freshness-aware investment research. It does not execute trades,
connect wallets, or present stale data as current.

This README is the canonical orientation and operating runbook for MoneyTrail.
Read it at the start of every MoneyTrail session. Before finishing a material
run, update the verified snapshot, known risks, and recent changes when observed
facts have changed. Never advance a freshness claim merely because this file,
the dashboard, or a deployment changed.

## Golden rules

1. OpenClaw is the deterministic execution layer and owns ingestion, enrichment,
   normalization, scoring, retries, ledgers, freshness, and scheduling.
2. Supabase is the versioned target data contract. Base tables retain canonical
   and audit data; `public_` views expose only public-safe read models.
3. MoneyTrailDash is the decision surface. It displays published state and never
   invents replacement scores, prices, or freshness timestamps.
4. Source, analysis, export, market-price, level, and review clocks are separate.
   One clock succeeding cannot make another clock fresh.
5. Manual and scheduled runs use the same idempotent engine entry point.
6. Every release uses a clean isolated worktree, shared release lease, reviewable
   GitHub PR, isolated Supabase/Vercel preview, exact tested commit, and verified
   production artifact.
7. Private/raw subscriber material stays local. Public output carries provenance
   and summaries, never raw paid content or secrets.
8. Last-known-good remains active until its replacement passes end to end.

## Architecture and ownership

```text
Local evidence and public sources
        ↓
OpenClaw canonical engine
  scripts/run_moneytrail_engine.py
  scripts/export_cockpit_to_supabase.py
  data/moneytrail-engine/*
        ↓
Supabase project iinzcnqwhltxjilpkojr
  private/base tables + RLS
  curated public_* views
        ↓
MoneyTrailDash (Next.js App Router)
        ↓
Vercel production: money-trail-dash.vercel.app
```

Key paths:

- Dashboard repository: `/Users/vaddylandbot/.openclaw/workspace/MoneyTrailDash`
- OpenClaw workspace: `/Users/vaddylandbot/.openclaw/workspace`
- Engine entry point: `scripts/run_moneytrail_engine.py`
- Supabase exporter: `scripts/export_cockpit_to_supabase.py`
- Runtime state and ledgers: `data/moneytrail-engine/`
- Release coordinator: `ops/moneytrail-release/moneytrail_release.py`
- Release contract: `ops/moneytrail-release/contract.md`
- Product roadmap: `PRODUCT_ROADMAP.md`
- Versioned runtime guards/installers: `ops/openclaw/`
- Versioned database changes: `supabase/migrations/`

## Data and freshness contract

The action board is an attention-routing surface, not a trade instruction.
Every visible idea must make these clocks independently inspectable:

- Evidence: when a qualifying source last confirmed the thesis.
- Market price: when the numeric quote was observed and by which provider.
- Levels: when entry, stop, and targets were last revalidated.
- OpenClaw review: when the deterministic review graph last evaluated the row.
- Export: when a payload was successfully published to Supabase.

Re-export, deployment, README updates, and review-only passes must not advance
source, analysis, price, or level freshness.

### What “Market price” means

`current_price` is the latest observed market quote used for context. It is not
an entry price, fair value, target, or broker-confirmed executable quote.

The complete quote contract is:

- `current_price`: numeric observed value.
- `price_as_of`: observation timestamp, never export timestamp.
- `price_source`: provider and normalized symbol.
- `price_age_hours`: age derived from `price_as_of`.
- `price_freshness_status`: `fresh`, `aging`, `stale`, or `missing`.
- `price_freshness_reason`: operator-facing explanation.

Market price and trade levels are independent. Selecting or withholding a stale
level owner must never erase a fresh market quote. The dashboard displays:

- Fresh: value, observation age, and source.
- Aging/stale: value retained for context, visibly qualified in amber.
- Missing: `NO QUOTE`.
- Clock/value disagreement: `VALUE MISSING`, treated as a producer defect.

No stale or missing quote can make an idea actionable. Entry, stop, target, and
risk/reward remain governed by their separate level/evidence clocks.

## Canonical run path and schedules

All recurring producers run through the versioned capacity guard and lifecycle
wrapper into `scripts/run_moneytrail_engine.py`.

| Australia/Sydney | Workflow | Required outcome |
| --- | --- | --- |
| 06:40 daily | Feeds refresh | Ingest, publish feed state, complete review graph |
| 07:40 daily | Macro refresh | Refresh sources, scores, catalysts, publish |
| 08:10 daily | Filings refresh | Refresh filings and publish |
| 08:50 daily | Analysis refresh | Rebuild analysis and publish |
| 10:20 daily | Valuation/trade ideas | Refresh quotes, consolidate ideas, publish/review |
| 10:50 daily | Portfolio stale review | Review only; never imply broker confirmation |
| 13:20 daily | Export queue replay | Replay idempotent queued exports |
| 13:50 daily | Stale idea review | Refresh deterministic review state |
| First Sunday | Soft archive review | Reversible lifecycle review; no hard deletes |

Read-only operator checks:

```bash
python3 /Users/vaddylandbot/.openclaw/workspace/scripts/moneytrail_healthcheck.py --json
openclaw cron list --json
python3 /Users/vaddylandbot/.openclaw/workspace/ops/moneytrail-release/moneytrail_release.py status
python3 /Users/vaddylandbot/.openclaw/workspace/ops/moneytrail-release/moneytrail_release.py verify-runtime
python3 /Users/vaddylandbot/.openclaw/workspace/ops/moneytrail-release/moneytrail_release.py verify-automations
```

## Session checklist

At the start of every MoneyTrail session:

1. Read this README, the release contract, automation memory, and roadmap.
2. Check the shared lease before considering edits.
3. Capture Git/PR, OpenClaw scheduler/ledger/circuit/queue, Supabase freshness,
   and Vercel production identity.
4. Inspect source, analysis, export, price, level, and review timestamps separately.
5. Select one bounded, non-duplicative candidate and run the coordinator gate.

Before closing a material run:

1. Verify the exact tested commit and all affected/adjacent consumers.
2. Update the verified snapshot below with observed facts only.
3. Update known risks and recent changes when they materially changed.
4. Record the release/no-op in automation memory.
5. Release the shared lease with a validated manifest for shipped work.

## Local development

```bash
cd /Users/vaddylandbot/.openclaw/workspace/MoneyTrailDash
npm ci
npm test
npx tsc --noEmit
npm run build
npm run release:test
```

Supabase/Vercel configuration:

```bash
# Public dashboard variables only
NEXT_PUBLIC_SUPABASE_URL=https://iinzcnqwhltxjilpkojr.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...

# OpenClaw local/private runtime only — never commit or expose in Vercel clients
SUPABASE_URL=https://iinzcnqwhltxjilpkojr.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
```

The dashboard has no service-role fallback. Public schemas require RLS on base
tables, least-privilege grants, security-invoker views, and advisor checks.

## Release workflow

The full contract lives in `ops/moneytrail-release/contract.md`. Compactly:

1. Gate candidate value and health.
2. Claim the shared lease.
3. Create a clean worktree from current remote `main`.
4. Capture before-state counts, schemas, health, timestamps, and outputs.
5. Implement and test the complete OpenClaw → Supabase → dashboard slice.
6. Push a reviewable branch/PR.
7. Prove migrations, RLS/grants/advisors/data in isolated Supabase preview.
8. Prove a commit-matched Vercel preview against that preview database.
9. Review, merge, apply production migration/backfill, and promote the exact
   tested artifact.
10. Verify live GitHub/Supabase/Vercel/OpenClaw identity and release the lease.

Never point a preview at production Supabase. Never rebuild derived data from
an export snapshot when canonical source data is available.

## Dashboard routes

- `/`: unified opportunity funnel, health and decision overview.
- `/decisions`: decision ledger with horizon, review, invalidation, and outcomes.
- `/filings`: institutional filing context.
- `/theses`: thesis register, confidence, and research requests.
- `/council`: council reasoning and disagreements.
- `/library`: public-safe research/evidence library.
- `/macro`: regional macro model, source coverage, and catalysts.
- `/health`: published and local engine health.

Authentication remains mandatory. This is research-only software.

## Verified operating snapshot

Last verified: 2026-08-14 11:32 AEST, before the effective-price release.

- GitHub `vadEGO/MoneyTrailDash`: remote `main` at `8b0ef4a`; no open PRs.
- Vercel production: `dpl_8gHMmTd6yemVapQADF56rVtspr9g`, exact `8b0ef4a`.
- Supabase production: `iinzcnqwhltxjilpkojr`, Auth/REST reachable.
- Opportunities: 1,822 total; 72 active, 1,750 soft archived, 0 closed.
- Public action board: 73 rows; 60 fresh price clocks, one aging, seven missing,
  five legacy/null statuses; only 16 rows exposed a numeric `current_price` due
  to the consolidation defect addressed by the current release.
- Latest successful decision export: `2026-08-14T00:22:44Z`.
- Circuit closed, DNS healthy, export queue empty, about 88 GiB disk free.
- Scores remain dated `2026-08-03`; holdings remain unconfirmed since
  `2026-07-05`; public portfolio actions remain empty.

## Known risks and next work

- Reconcile scheduler-aware health: feeds retains failed scheduler state while a
  later successful export can make the compact healthcheck appear green.
- Fix the RAG-context dependency ordering for the 06:40 feeds job.
- Backfill insufficient BoE 2Y/10Y curve history.
- Restore published feed-item freshness and stale canonical scores.
- Confirm holdings from broker/wallet records before portfolio actionability.
- `moneytraildash.com` currently fails local DNS; Vercel alias remains healthy.
- Delete disposable preview Supabase project `ddxueqwksoqdkrvpclbt` when project
  deletion access is available.

## Recent changes

- 2026-08-14: Effective market-price contract and README-as-system-bible release
  in progress.
- 2026-08-13: Added reversible active/soft-archived/closed lifecycle and monthly
  first-Sunday review; no hard deletion.
- 2026-08-13: Soft-archived stale untracked ideas while preserving canonical
  source rows, scores, and audit history.

## Safety boundary

MoneyTrail supports research and review. It does not place orders, size trades,
move funds, or claim that unconfirmed holdings or stale quotes are executable.
