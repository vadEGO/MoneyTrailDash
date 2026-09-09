# MoneyTrail release controls

`moneytrail_release.py` is the shared manual and scheduled entry point for
release ownership, candidate gating, automation drift checks, and release
manifest validation.

## Candidate gate

```bash
python3 ops/release/moneytrail_release.py gate \
  --decision-value 85 \
  --coverage-gap 80 \
  --user-impact 75 \
  --evidence-quality 80 \
  --freshness-gain 70 \
  --reversibility 90 \
  --operational-risk 25 \
  --effort 40
```

If the result is `noop`, record the run and stop. Do not invent a feature to
satisfy a schedule.

## Shared release lease

```bash
python3 ops/release/moneytrail_release.py status
python3 ops/release/moneytrail_release.py claim \
  --owner codex-thread-id \
  --automation-id moneytrail-daily-evolution \
  --candidate-id macro-turbulence-board
python3 ops/release/moneytrail_release.py heartbeat \
  --owner codex-thread-id \
  --release-id release-uuid \
  --phase testing
python3 ops/release/moneytrail_release.py release \
  --owner codex-thread-id \
  --release-id release-uuid \
  --outcome completed \
  --manifest-path ops/releases/release-uuid.json
```

The default lease lives outside the Git checkout at
`~/.openclaw/workspace/state/moneytrail_release_lease.json`. Tests and isolated
tools can override it with `--lease-path`.

## Versioned OpenClaw runtime

The release coordinator runtime below remains the control-plane contract for
leases and manifests. MoneyTrail process execution is installed separately into
Hermes' stable runtime so scheduled wrappers and manual OpenClaw checks share the
same hash-pinned launcher:

```bash
python3 ops/openclaw/install_moneytrail_runtime.py \
  --dashboard-root "$PWD" \
  --source-commit "$(git rev-parse HEAD)"
python3 ~/.hermes/runtime/moneytrail/current/launcher.py \
  --process moneytrail_valuation_refresh --check
```

`runtime.json` records the source commit and SHA-256 hashes for the launcher,
canonical process manifest, and migrated runner. A wrapper `--check` is a
configuration validation only; it does not execute a workflow or advance data
freshness.

Install the exact committed coordinator and policy into the stable OpenClaw
runtime path after the Git state has been tested:

```bash
python3 ops/release/moneytrail_release.py install-runtime \
  --source-commit "$(git rev-parse HEAD)"
python3 ~/.openclaw/workspace/ops/moneytrail-release/moneytrail_release.py \
  verify-runtime --source-commit "$(git rev-parse HEAD)"
```

The installer writes a SHA-256 manifest for the coordinator, release contract,
automation policy, and release-manifest schema. Scheduled automations call this
stable runtime copy; Git remains the canonical source.

## Manifest

```bash
python3 ops/release/moneytrail_release.py init-manifest \
  --path ops/releases/release-uuid.json \
  --release-id release-uuid \
  --candidate-id candidate-id \
  --title "Bounded release title"
python3 ops/release/moneytrail_release.py validate-manifest \
  --path ops/releases/release-uuid.json \
  --phase planning
```

Preview validation requires a non-production Supabase ref and matching Git and
Vercel preview commits. Production validation additionally requires Supabase
security/data checks, a READY production deployment matching the merged commit,
no freshness regressions, and rollback targets.

## Preview isolation

`check-preview-environment.mjs` fails closed on a Vercel preview unless:

- `NEXT_PUBLIC_SUPABASE_URL` points to a non-production Supabase project;
- `MONEYTRAIL_SUPABASE_ENV=preview`; and
- `MONEYTRAIL_PREVIEW_SUPABASE_REF` matches the URL project ref.

The gate runs automatically from `prebuild`. Outside a Vercel preview the check
exits zero, so local and production builds are unaffected. A Vercel preview
build fails closed unless its environment is explicitly isolated.

Create the preview Supabase project and set the three variables in Vercel's
Preview environment only. Confirm `npm run release:check-preview` passes with
those values before accepting a preview deployment.

Create the Supabase development branch only after its cost is explicitly
confirmed. Configure these variables in Vercel's Preview environment, never in
Production.

## Automation drift

`verify-automations` compares `automation-policy.json` against the automation
files on the OpenClaw host and only passes there — the policy references absolute
paths under that host's home directory, so it reports both automations missing
when run from a normal checkout. There is no npm alias for that reason; invoke it
directly on the host.
