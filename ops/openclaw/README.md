# MoneyTrail OpenClaw runtime guards

`moneytrail_capacity_guard.py` is the versioned entry point for both manual and scheduled MoneyTrail runs. It samples free bytes, free percentage, and free inodes before launching the canonical OpenClaw engine. The guard fails closed with exit code 75 when headroom is below the larger of:

- 10 GiB absolute free space; or
- twice the expected 4 GiB peak write footprint.

The defaults are configurable through `MONEYTRAIL_MINIMUM_FREE_BYTES`, `MONEYTRAIL_MINIMUM_FREE_PERCENT`, `MONEYTRAIL_EXPECTED_PEAK_WRITE_BYTES`, and `MONEYTRAIL_RESERVE_MULTIPLIER`.

The state ledger is atomically replaced at `data/moneytrail-engine/capacity_state.json`. A failed or blocked run preserves the prior `last_success`, so deployment or a failed re-export cannot masquerade as fresh source, analysis, or export work.

Manual and scheduled invocations use the same shape:

```bash
python3 MoneyTrailDash/ops/openclaw/moneytrail_capacity_guard.py \
  --workspace /Users/vaddylandbot/.openclaw/workspace \
  --workflow-name moneytrail_feeds_refresh \
  -- python3 scripts/run_moneytrail_engine.py \
  --mode frequent \
  --workflow-name moneytrail_feeds_refresh \
  --stages sources,export \
  --source-groups feeds \
  --export-sections feeds \
  --require-export \
  --require-stage-success
```

Scheduled job payloads should call this wrapper rather than invoking `run_moneytrail_engine.py` directly. The wrapper does not replace the engine, alter section freshness, or bypass its queue/circuit behavior.

`moneytrail_stale_idea_lifecycle.py` runs inside the capacity guard, immediately
before and after the canonical engine. It soft-archives an untracked idea only
after its evidence has missed three complete source-SLA windows, or after 30
days with no dated evidence. Tracked, holding, and exiting rows are protected.
The source row and score remain in Supabase; `deleted_at` only removes it from
the live action-board view. If a later canonical export supplies current
evidence, the same stable row is automatically restored and an audit event is
written. Its state ledger is atomically maintained at
`data/moneytrail-engine/stale_idea_lifecycle_state.json`.

This ordering prevents old rows from polluting the funnel before a run and
rechecks them after an export. A failed engine cannot reactivate anything, and
the lifecycle exits non-zero when its final Supabase verification fails. After
the archive cutover it regenerates the existing OpenClaw review queue, so the
dashboard's review count and the local audit artifact cover only ideas that are
still inside the re-evaluation window.

`moneytrail_capacity_jobs.json` versions the five canonical producer/publisher job payloads. Verify the live scheduler without changing it:

```bash
python3 MoneyTrailDash/ops/openclaw/install_moneytrail_capacity_jobs.py
```

After the exact commit is reviewed and promoted, install and immediately verify those payloads with `--apply`. The installer validates each live job ID/name pair before mutation and refuses an unexpected target.
