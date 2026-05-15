# MoneyTrailDash

MoneyTrailDash is the Vercel-facing cockpit for OpenClaw's Follow the Money Engine. It reads public-safe Supabase views and shows the current operating picture: opportunity watchlist, thesis register, council reasoning, research library, risk flags, reports, and engine health.

## Infrastructure

- Frontend: Next.js 14 App Router on Vercel.
- Database: Supabase project `iinzcnqwhltxjilpkojr`.
- Public read model: Supabase views prefixed with `public_`.
- Private write model: OpenClaw exports redacted intelligence records with a Supabase service role key.
- Source engine: `/Users/vaddylandbot/.openclaw/workspace/intelligence`.

## Supabase Setup

Apply the migration in `supabase/migrations/001_openclaw_cockpit.sql`. It creates the cockpit tables, enables RLS on the base tables, and grants anonymous read access only to the curated public views.

Vercel needs:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://iinzcnqwhltxjilpkojr.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

OpenClaw needs this only in its local/private runtime, never in Vercel:

```bash
SUPABASE_URL=https://iinzcnqwhltxjilpkojr.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
```

## OpenClaw Export

The exporter lives at:

```bash
/Users/vaddylandbot/.openclaw/workspace/scripts/export_cockpit_to_supabase.py
```

It reads JSONL and markdown outputs from the intelligence engine, redacts local paths and secret-shaped values, then upserts the cockpit tables. If the service role key is missing, it exits safely without breaking the daily engine run.

The daily equilibrium workflow now calls the exporter after sharper reasoning finishes, so the dashboard refreshes after each successful OpenClaw cycle.

Manual checks:

```bash
python /Users/vaddylandbot/.openclaw/workspace/scripts/export_cockpit_to_supabase.py --dry-run
python /Users/vaddylandbot/.openclaw/workspace/scripts/export_cockpit_to_supabase.py --workflow-name manual_export
```

## Cockpit Views

- `/`: operating overview.
- `/watchlist`: ranked opportunity watchlist with why-now, next action, and change-my-mind logic.
- `/theses`: strategic thesis register with confidence movement.
- `/council`: latest council consensus and persona positions.
- `/library`: searchable research/claim/evidence/report library.
- `/risk`: public risk flags and constraints.
- `/health`: sync freshness and LLM reasoning audit.

## Safety Boundary

This dashboard is research and decision support only. It does not introduce trading, wallet, portfolio execution, or transaction flows.
