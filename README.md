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
- Clock/value disagreement: the available side is retained for diagnosis and
  labelled `CLOCK MISSING` or `VALUE MISSING`; it is never treated as fresh.

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
- `/research`: evidence-aware thesis quality, counter-thesis, open gaps, kill criteria, and next tests.
- `/council`: council reasoning and disagreements.
- `/library`: public-safe research/evidence library.
- `/macro`: regional macro model, source coverage, and catalysts.
- `/health`: published and local engine health.

Authentication remains mandatory. This is research-only software.

## Verified operating snapshot

Last verified: 2026-08-14 12:45 AEST, after the healthy effective-price rerun.

- GitHub `vadEGO/MoneyTrailDash`: price PRs `#17` and `#18` merged; the verified
  price-code commit is `ac62bbe` (documentation-only commits may follow).
- Vercel production: GitHub deployment `5899505412`, exact `ac62bbe`, immutable
  URL `money-trail-dash-a305x5erz-vaddys-projects.vercel.app`. Rollback remains
  `dpl_8gHMmTd6yemVapQADF56rVtspr9g` at `8b0ef4a`.
- Supabase production: `iinzcnqwhltxjilpkojr`, Auth/REST reachable.
- Opportunities: 1,822 total; 72 active, 1,750 soft archived, 0 closed.
- Public action board: 73 rows; 63 numeric prices, up from 16; 60 fresh quote
  clocks, one stale, seven missing, and five legacy/null statuses. Two legacy
  rows have a numeric value without a quote clock and are explicitly marked
  inconsistent rather than fresh.
- Healthy price rerun/export batch `17e33daf-80e7-4ec9-ba9e-028d3adeebee`
  completed at `2026-08-14T02:44:50Z`; latest quote observation remains
  `2026-08-14T00:00:00Z`, proving re-export did not refresh the quote clock.
- RAG context is verified against LanceDB table version 197: all 54 expected
  InvestAnswers files are indexed and the 12-asset hybrid context is current.
- Circuit closed, DNS healthy, export queue empty, about 88 GiB disk free.
- Scores remain dated `2026-08-03`; holdings remain unconfirmed since
  `2026-07-05`; public portfolio actions remain empty.

### FollowDaMO production rerun — 2026-08-21

- The production research-only wrapper completed all 16 stages successfully
  with 5,107 raw records, 542 signals, 17 active tradeability rows, and 852
  research packs. Evidence clocks were 16 fresh, 3 aging, and 523 stale; 446
  of those stale signals are now excluded from active research.
- Source clocks now use matching item publication/update dates; snapshot
  collection time is not accepted as evidence. The local trade-idea rebuild
  reduced `ready` setups from 404 to 27, with the remainder retained as
  research-only until dated current evidence exists.
- The corrected production export published 27 canonical ticker-level
  opportunities and 27 entry/exit plans in batch
  `558149f1-0795-4bdf-988e-204e796e9aba`. The OpenClaw review graph applied
  628 review records, 285 updates, and 270 events; it reported 0 actionable
  rows, so the dashboard remains fail-closed.
- The local proof separately reports 27 source setups as ready, 13 as research,
  and 1,360 as feed/candidate; source readiness is not actionability.
- The two failed intermediate export snapshots were moved to macOS Trash after
  the successful retry: one was blocked by a foreign-key dependency and one by
  a repaired bulk-schema mismatch. The live export queue is empty.

### Thesis quality v1 release candidate — 2026-08-23

- Local FollowDaMO proof completed all 16 stages successfully at
  `2026-08-23T05:40:04Z`: 5,180 raw records, 546 signals, 20 active
  tradeability rows, 876 research packs, and 674 thesis-quality records.
- The thesis register currently contains 64 `watch`, 597 `research`, and 13
  `quarantine` records. Its evidence clocks are 41 fresh, 23 aging, 428
  stale, and 182 missing. Stale/missing state is intentionally visible and
  non-actionable.
- PR `#22` merged as `7073709` and adds the Supabase contract and `/research`
  surface. The tested branch passed the dashboard unit/macro tests and
  production build. The stable production alias is
  `money-trail-dash.vercel.app`; the exact tested deployment identity is kept
  in the release manifest rather than treated as a data-freshness signal.
- The reviewed migration is
  `supabase/migrations/20260823060000_thesis_quality_contract.sql`. It creates
  the RLS-protected base table and `public_thesis_quality` security-invoker
  view. It is applied in production as migration
  `20260823103049_thesis_quality_contract_20260823`; both the base table and
  public view contain 674 rows. Per the direct-production release decision,
  no Supabase preview branch was created.
- LanceDB retrieval context is verified against table version 327. The review
  graph handles one bounded context race, locks the corpus during write-back,
  deduplicates repeated source chunks, and refuses to increase thesis
  confidence from undated context.
- The read-only OpenClaw thesis trial reviewed 689 records (15 summary theses
  plus 674 structured quality rows): 621 required revalidation and 53 were
  structurally checked. It found 180 quality rows without a counter-thesis;
  no Supabase review rows or events were written by the trial.
- The governed `moneytrail_valuation_trade_ideas_publish` scheduler rerun
  completed successfully at `2026-08-23T05:48:05Z`: export status is fresh,
  the review graph applied 445 records across all six sections, scheduler
  health is green, and the stale-idea lifecycle reports 0 actionable ideas.
- The production analysis export published the thesis-quality projection after
  migration with batch `d4cb6fd1-304d-41c6-8b19-976932419778`.
  `/research` is live and authentication-gated; unauthenticated requests
  redirect to `/login` as expected.

## Known risks and next work

- Keep the production thesis view synchronized through the scheduled analysis
  export and monitor its evidence clocks; stale/missing thesis evidence remains
  intentionally visible and non-actionable.
- Use the thesis-only OpenClaw trial before any review write-back. The trial
  must remain read-only, must not lift confidence from undated context, and
  should reduce the 621-row revalidation queue through dated evidence,
  counter-theses, and explicit next tests rather than score tuning.
- The bounded RAG-context race repair landed in PR `#22`; verify the next scheduled
  export/review cycle is green after promotion.
- Backfill insufficient BoE 2Y/10Y curve history.
- Keep the production surface fail-closed until evidence, price, levels, and
  review clocks are fresh; the current review graph intentionally exposes no
  actionable rows.
- Verify the newly enabled OECD Composite Leading Indicator feed in a future
  macro export/review cycle; this rerun intentionally published the
  `trade_ideas` decision section only.
- Confirm holdings from broker/wallet records before portfolio actionability.
- `moneytraildash.com` currently fails local DNS; Vercel alias remains healthy.
- Delete disposable preview Supabase project `ddxueqwksoqdkrvpclbt` when project
  deletion access is available.

## Recent changes

- 2026-08-23: Unified thesis and FollowDaMO reasoning with OpenClaw's canonical
  `agents.defaults.model.primary`; removed the stale `openai/gpt-4.1-mini`
  override and deleted the separate reasoning model config. The dashboard's
  LLM audit now records the OpenClaw model actually selected by the runtime.

- 2026-08-23: Added the evidence-aware thesis-quality contract end to end:
  deterministic local register, explicit thesis-family questions, freshness and
  contradiction handling, public-safe Supabase read model, and a dashboard
  research surface showing counter-thesis, gaps, kill criteria, and next tests.
  Quality remains separate from actionability and execution.

- 2026-08-23: Promoted thesis quality to production: applied the Supabase
  contract, published 674 rows, merged PR `#22`, and verified the Vercel
  production deployment and authentication-gated `/research` route.

- 2026-08-23: Hardened the OpenClaw thesis review path: deduplicated repeated
  RAG chunks, blocked confidence increases from undated context, and added a
  structured audit of all 674 thesis-quality rows. The first read-only trial
  produced a 621-row revalidation queue without writing production review
  state.

- 2026-08-21: Hardened the FollowDaMO evidence clock and MoneyTrail mapping;
  collection-time masquerading is blocked, stale/undated setups are demoted
  to research, local mapping remains explicitly quarantined until all clocks
  are current, and the corrected production export/review path completed.

- 2026-08-14: Effective market-price contract shipped in PR `#17`; rebuilt all
  259 canonical opportunity rows and increased visible numeric prices from 16
  to 63 without advancing quote clocks on deployment or re-export alone.
- 2026-08-14: README became the canonical system bible and session-start
  checklist; clock/value disagreement is now explicit and non-actionable.
- 2026-08-14: Reconciled the RAG retrieval context to LanceDB version 197 and
  proved the complete guarded valuation/export/review/lifecycle workflow green.
- 2026-08-14: Enabled the keyless OECD Composite Leading Indicator SDMX feed for
  six core regions. The local canonical run ingested 354 observations with
  4.8 years of history; existing macro UI already exposes the growth pillar and
  source health, so no dashboard component change was needed.
- 2026-08-13: Added reversible active/soft-archived/closed lifecycle and monthly
  first-Sunday review; no hard deletion.
- 2026-08-13: Soft-archived stale untracked ideas while preserving canonical
  source rows, scores, and audit history.

## Safety boundary

MoneyTrail supports research and review. It does not place orders, size trades,
move funds, or claim that unconfirmed holdings or stale quotes are executable.

## Aggressive paper-trading projection

The `paper-aggressive-v1` account is a deterministic local simulation, funded
with a nominal USD 10,000 balance and deliberately configured for high risk
without leverage. It is long-only, uses daily bars and pre-entered stop/target
levels, and can never reach a broker, exchange, wallet, or live order API.

- The canonical, append-only ledger is local in
  `FollowDaMO/data/moneytrail.sqlite`; OpenClaw runs the daily cycle.
- The dashboard reads only the four public-safe projection tables in Supabase:
  `paper_account_snapshots`, `paper_positions`, `paper_trades`, and
  `paper_events`, rendered at `/paper`.
- The remote schema is defined in
  `supabase/migrations/20260814113500_paper_trading.sql`. Apply it before
  enabling the cron export; until then, the local engine remains authoritative
  and export deliberately reports a blocked schema instead of dropping data.
- The execution contract and release commands are in
  `FollowDaMO/PAPER_TRADING_RUNBOOK.md`.
