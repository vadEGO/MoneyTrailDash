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

`moneytrail_capacity_jobs.json` versions the five canonical producer/publisher job payloads. Verify the live scheduler without changing it:

```bash
python3 MoneyTrailDash/ops/openclaw/install_moneytrail_capacity_jobs.py
```

After the exact commit is reviewed and promoted, install and immediately verify those payloads with `--apply`. The installer validates each live job ID/name pair before mutation and refuses an unexpected target.
