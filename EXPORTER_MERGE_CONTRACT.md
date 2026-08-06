# Exporter Merge Contract

Last reviewed: 2026-08-06

This describes a change to make in the OpenClaw exporter, which lives outside this
repository:

```bash
/Users/vaddylandbot/.openclaw/workspace/scripts/export_cockpit_to_supabase.py
```

The dashboard side is already done. This document exists so the write side can be
brought in line without re-deriving the reasoning.

## Problem

`investment_opportunities` is keyed on `id`, not on ticker. Nothing in the schema
prevents several rows for the same asset:

```sql
create table if not exists investment_opportunities (
  id text primary key,
  ...
  normalized_symbol text,
  direction text,
  ...
);
```

There is an index on `normalized_symbol` but no unique constraint. So when Patreon,
Discord and a 13F filing all flag the same asset, the exporter inserts three rows.
The live payload measured 352 rows across 242 symbols — 110 duplicated.

Migration `004_multi_source_confirmation.sql` anticipated this and shipped two
helpers, but they are advisory. Nothing calls them, so nothing merges.

## What the dashboard already handles

Do not merge rows to fix the display. The dashboard now aggregates per ticker in
the read layer:

- `supabase/migrations/20260806051300_ticker_stance_rollup.sql` adds
  `public_ticker_stance_rollup`, reporting per ticker: `setup_count`, `bull_count`,
  `bear_count`, `has_disagreement`, and a score-weighted `net_stance`.
- `lib/ticker-aggregate.ts` computes the same split client-side from raw rows.
- `components/FunnelBoard.tsx` shows one row per ticker with every view expandable.

Both layers deliberately keep all rows. A long thesis and a short thesis on the
same asset are the signal, not noise, so the exporter must not collapse them
either.

## The change

Two distinct cases, and only the first should merge.

### Same symbol, same direction — merge

Another source corroborating an existing view should strengthen that row, not add a
new one. Before inserting, ask whether a live row already exists:

```sql
select find_existing_opportunity('BTC', 'long');
```

Returns the `id` of the highest-scoring live row for that symbol and direction, or
`NULL`. On a hit, record the corroboration instead of inserting:

```sql
select add_source_confirmation(
  p_opportunity_id => '<existing id>',
  p_source         => 'patreon',
  p_source_url     => 'https://...',
  p_source_author  => 'author',
  p_score_contrib  => 4,
  p_notes          => 'Independent confirmation of the same setup'
);
```

That appends to `sources`, increments `confirmed_by_count`, adds a `source_details`
entry, and boosts `total_score` by up to 10 with diminishing returns per additional
source. It is idempotent per source: re-running with a source already in the array
is a no-op, so a re-export cannot inflate conviction.

### Same symbol, opposite direction — insert

`find_existing_opportunity` keys on symbol **and** direction, so a short on an asset
that already has a long returns `NULL` and correctly inserts a new row. Keep that
behaviour. The rollup view detects the pair and raises `has_disagreement`, and the
funnel surfaces it as a `DISAGREEMENT` badge.

### Suggested call shape

```python
existing_id = rpc("find_existing_opportunity", {
    "p_symbol": normalized_symbol,
    "p_direction": direction or "long",
})

if existing_id:
    rpc("add_source_confirmation", {
        "p_opportunity_id": existing_id,
        "p_source": source,
        "p_source_url": source_url,
        "p_source_author": author,
        "p_score_contrib": score_contribution,
        "p_notes": notes,
    })
else:
    upsert("investment_opportunities", row)
```

Both helpers are `service_role`-only, matching how the exporter already writes. The
dashboard reads through select-only public views and cannot call them.

## What must not change

- **Do not add a unique constraint on `normalized_symbol`.** It would reject the
  opposing-direction rows the stance rollup depends on.
- **Do not overwrite a row's `thesis` when merging.** `add_source_confirmation`
  only appends to `source_details`, which is what keeps each source's reasoning
  auditable. A merge that rewrote `thesis` would erase the record of why a source
  flagged the asset.
- **Do not merge across lifecycle states.** `find_existing_opportunity` already
  skips `invalidated` and `expired` rows, so a revived idea starts a new record
  rather than reopening a closed one.
- **Do not let re-export refresh evidence dates.** Per `PRODUCT_ROADMAP.md`
  (2026-07-27), only a newer qualifying source may extend freshness; merely
  re-exporting a row must not.

## Verifying

After the exporter change, duplicate same-direction rows should stop growing:

```sql
-- Same symbol and direction appearing more than once means the merge did not fire.
select ticker, bull_count, bear_count, setup_count, has_disagreement
from public_ticker_stance_rollup
where setup_count > 1
order by setup_count desc;
```

Expect remaining `setup_count > 1` rows to be genuine disagreement
(`has_disagreement = true`) or distinct setups, not same-direction repeats.
