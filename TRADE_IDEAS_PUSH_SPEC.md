# Trade Ideas Push Specification
**MoneyTrailDash — Watchlist / Ideas Leaderboard**

This document tells your local OpenClaw org exactly what to push to Supabase to populate
the `/ideas` leaderboard and `/ideas/[symbol]` detail page in MoneyTrailDash.

---

## Supabase Connection

```
Project URL: https://iinzcnqwhltxjilpkojr.supabase.co
REST API:    https://iinzcnqwhltxjilpkojr.supabase.co/rest/v1/
```

Auth for writes: **service-role key** (stored in `secrets/.env.supabase`).
Use header: `Authorization: Bearer <service_role_key>` + `apikey: <service_role_key>`.

Reads from the dashboard use the publishable key — your bot never needs that.

---

## Write Order

Always write in this order (foreign key constraints):

```
1. symbols           ← register the ticker first
2. trade_ideas       ← one row per idea, references symbols.symbol
3. trade_idea_scores ← one row per idea, references trade_ideas.idea_id
4. trade_idea_levels ← one row per price level, references trade_ideas.idea_id
5. market_candles    ← OHLCV rows, keyed by symbol + interval + ts
```

All upserts. Use `Prefer: resolution=merge-duplicates` header.

---

## Table 1: `symbols`

**Primary key:** `symbol` (TEXT)

Register every ticker you push ideas for. One row per ticker, update `last_price`
and `price_updated_at` on each sync.

| Column | Type | Required | Notes |
|---|---|---|---|
| `symbol` | TEXT | YES | Uppercase ticker. e.g. `"BTC"`, `"NVDA"`, `"GLD"` |
| `asset_name` | TEXT | no | Full name. e.g. `"Bitcoin"`, `"Nvidia Corp"` |
| `asset_class` | TEXT | no | `"crypto"` \| `"stock"` \| `"etf"` \| `"commodity"` \| `"fx"` \| `"unknown"` |
| `exchange` | TEXT | no | `"NASDAQ"`, `"NYSE"`, `"hyperliquid"`, `"coinbase"` |
| `instrument_type` | TEXT | no | `"spot"` \| `"perp"` \| `"leveraged"` \| `"inverse"` |
| `tradingview_id` | TEXT | no | TradingView symbol for chart links. e.g. `"NASDAQ:NVDA"`, `"BINANCE:BTCUSDT"` |
| `coingecko_id` | TEXT | no | For price fetching. e.g. `"bitcoin"`, `"solana"` |
| `last_price` | REAL | no | Current price in USD |
| `price_updated_at` | TIMESTAMPTZ | no | ISO-8601 timestamp of price fetch |

**Example:**
```json
{
  "symbol": "BTC",
  "asset_name": "Bitcoin",
  "asset_class": "crypto",
  "instrument_type": "spot",
  "tradingview_id": "BINANCE:BTCUSDT",
  "coingecko_id": "bitcoin",
  "last_price": 103250.00,
  "price_updated_at": "2026-05-15T09:00:00Z"
}
```

---

## Table 2: `trade_ideas`

**Primary key:** `idea_id` (TEXT) — you choose this, must be stable across syncs.
**Foreign key:** `symbol` → `symbols.symbol`

One row per trade idea. If the same idea is re-synced (e.g. RV updates the rank),
upsert with the same `idea_id` to update in place.

| Column | Type | Required | Notes |
|---|---|---|---|
| `idea_id` | TEXT | YES | Stable unique ID. Suggested: `"rv_<source_rank>_<symbol>"` or a UUID |
| `symbol` | TEXT | YES | Must exist in `symbols` table first |
| `source` | TEXT | YES | `"realvision"` — or your source name |
| `source_url` | TEXT | no | Direct URL to the original idea |
| `source_author` | TEXT | no | Trader/author name from RV |
| `source_rank` | INT | no | RV leaderboard rank at time of capture (1 = top) |
| `pl_pct` | REAL | no | RV-reported P/L %. e.g. `24.5` for +24.5%, `-8.3` for a loss |
| `direction` | TEXT | no | `"long"` \| `"short"` \| `"watch"` \| `"pair"` |
| `time_horizon` | TEXT | no | `"days"` \| `"weeks"` \| `"months"` \| `"years"` |
| `entry_min` | REAL | no | Lower bound of entry zone in USD |
| `entry_max` | REAL | no | Upper bound of entry zone in USD |
| `stop_loss` | REAL | no | Stop loss price in USD |
| `take_profit_1` | REAL | no | First take-profit price |
| `take_profit_2` | REAL | no | Second take-profit price |
| `take_profit_3` | REAL | no | Third take-profit price |
| `risk_reward` | REAL | no | R/R ratio. e.g. `2.8` means 2.8x |
| `levels_source` | TEXT | no | `"rv_explicit"` if RV stated levels, `"openclaw_derived"` if you computed them, `"manual"` |
| `status` | TEXT | YES | `"active"` \| `"watch"` \| `"closed"` \| `"expired"` — **default `"active"`** |
| `decision` | TEXT | no | `"setup_active"` \| `"watch_for_entry"` \| `"research_further"` \| `"avoid"` |
| `research_only` | BOOLEAN | YES | **Always `true`.** This field must never be false. |
| `closed_at` | TIMESTAMPTZ | no | Set when status changes to `"closed"` |
| `outcome` | TEXT | no | `"win"` \| `"loss"` \| `"breakeven"` \| `"expired"` — set on close |
| `notes` | TEXT | no | Free-form notes |
| `raw_payload` | JSONB | no | Full original source row for audit/re-parsing |
| `created_at` | TIMESTAMPTZ | no | Defaults to `NOW()` |
| `updated_at` | TIMESTAMPTZ | no | Update this on every sync |

**Example — active long:**
```json
{
  "idea_id": "rv_3_BTC",
  "symbol": "BTC",
  "source": "realvision",
  "source_author": "Raoul Pal",
  "source_rank": 3,
  "pl_pct": 24.5,
  "direction": "long",
  "time_horizon": "months",
  "entry_min": 85000,
  "entry_max": 90000,
  "stop_loss": 72000,
  "take_profit_1": 110000,
  "take_profit_2": 140000,
  "take_profit_3": null,
  "risk_reward": 2.8,
  "levels_source": "rv_explicit",
  "status": "active",
  "decision": "watch_for_entry",
  "research_only": true,
  "updated_at": "2026-05-15T09:00:00Z"
}
```

**Closing an idea:**
```json
{
  "idea_id": "rv_3_BTC",
  "status": "closed",
  "outcome": "win",
  "closed_at": "2026-06-01T00:00:00Z",
  "pl_pct": 31.2
}
```

---

## Table 3: `trade_idea_scores`

**Primary key:** `idea_id` (TEXT) — same as `trade_ideas.idea_id`

Balanced 100-point score breakdown. All 8 components should sum to `total_score`.

| Column | Type | Required | Notes |
|---|---|---|---|
| `idea_id` | TEXT | YES | Must exist in `trade_ideas` |
| `symbol` | TEXT | YES | Denormalised — copy from the idea |
| `total_score` | REAL | no | 0–100. Sum of all weighted components |
| `source_quality` | REAL | no | 0–15. Author track record, source credibility |
| `evidence_quality` | REAL | no | 0–15. How well-evidenced the thesis is |
| `technical_setup` | REAL | no | 0–15. Chart structure, entry quality |
| `risk_reward_score` | REAL | no | 0–15. Based on R/R ratio |
| `thesis_fit` | REAL | no | 0–15. Alignment with your investment theses |
| `macro_liquidity_fit` | REAL | no | 0–10. Macro environment fit |
| `portfolio_relevance` | REAL | no | 0–10. Overlap with existing portfolio |
| `freshness` | REAL | no | 0–5. How recent the idea is |
| `scored_at` | TIMESTAMPTZ | no | Defaults to `NOW()` |

**Weights must sum to 100:** 15+15+15+15+15+10+10+5 = 100.

**Minimum viable score push** — if you only have a few signals, omit the rest
and set what you know. The leaderboard will sort by `total_score DESC NULLS LAST`
so null-score ideas appear at the bottom.

**Example:**
```json
{
  "idea_id": "rv_3_BTC",
  "symbol": "BTC",
  "total_score": 82.0,
  "source_quality": 13.0,
  "evidence_quality": 12.0,
  "technical_setup": 11.5,
  "risk_reward_score": 13.0,
  "thesis_fit": 12.5,
  "macro_liquidity_fit": 9.0,
  "portfolio_relevance": 8.0,
  "freshness": 3.0,
  "scored_at": "2026-05-15T09:00:00Z"
}
```

---

## Table 4: `trade_idea_levels`

**Primary key:** `id` (UUID) — auto-generated, leave null on insert.
**Foreign key:** `idea_id` → `trade_ideas.idea_id` (nullable — you can push symbol-level
levels without tying them to a specific idea).

One row per price level. Push as many as you have. The chart on `/ideas/[symbol]`
renders all of them as overlays.

| Column | Type | Required | Notes |
|---|---|---|---|
| `id` | UUID | NO | Auto-generated. Omit on insert. |
| `symbol` | TEXT | YES | Ticker this level belongs to |
| `idea_id` | TEXT | no | Link to a specific idea (optional) |
| `level_type` | TEXT | YES | See allowed values below |
| `price` | REAL | YES | Price in USD |
| `source` | TEXT | YES | `"rv_explicit"` \| `"openclaw_derived"` \| `"manual"` — **required, no default** |
| `label` | TEXT | no | Display label on chart. e.g. `"TP1"`, `"Key resistance"`, `"200d MA"` |
| `created_at` | TIMESTAMPTZ | no | Defaults to `NOW()` |

**Allowed `level_type` values:**

| Value | Chart rendering | Meaning |
|---|---|---|
| `entry_min` | Green shaded zone bottom | Lower entry price |
| `entry_max` | Green shaded zone top | Upper entry price |
| `stop_loss` | Red solid horizontal line | Stop loss |
| `tp1` | Green dashed line | Take profit 1 |
| `tp2` | Green dashed line | Take profit 2 |
| `tp3` | Green dashed line | Take profit 3 |
| `resistance` | **Amber dotted line** | Key resistance level |
| `support` | Blue dotted line | Key support level |

**Example — push all levels for one idea:**
```json
[
  { "symbol": "BTC", "idea_id": "rv_3_BTC", "level_type": "entry_min",  "price": 85000, "source": "rv_explicit", "label": "Entry low" },
  { "symbol": "BTC", "idea_id": "rv_3_BTC", "level_type": "entry_max",  "price": 90000, "source": "rv_explicit", "label": "Entry high" },
  { "symbol": "BTC", "idea_id": "rv_3_BTC", "level_type": "stop_loss",  "price": 72000, "source": "rv_explicit", "label": "Stop" },
  { "symbol": "BTC", "idea_id": "rv_3_BTC", "level_type": "tp1",        "price": 110000, "source": "rv_explicit", "label": "TP1" },
  { "symbol": "BTC", "idea_id": "rv_3_BTC", "level_type": "tp2",        "price": 140000, "source": "rv_explicit", "label": "TP2" },
  { "symbol": "BTC", "idea_id": "rv_3_BTC", "level_type": "resistance", "price": 96000, "source": "openclaw_derived", "label": "Dec ATH resistance" },
  { "symbol": "BTC", "idea_id": "rv_3_BTC", "level_type": "resistance", "price": 73000, "source": "openclaw_derived", "label": "Prior ATH" },
  { "symbol": "BTC", "idea_id": "rv_3_BTC", "level_type": "support",    "price": 68000, "source": "openclaw_derived", "label": "Accumulation zone" }
]
```

**Note on re-syncing levels:** Because levels have auto-generated UUIDs, upserts
don't naturally deduplicate. Two options:
- **Option A (simple):** Delete all levels for a symbol before re-inserting.
  `DELETE FROM trade_idea_levels WHERE idea_id = 'rv_3_BTC'`
- **Option B (stable IDs):** Generate deterministic IDs:
  `uuid5(idea_id + level_type + str(price))` — then use `merge-duplicates` upsert.

---

## Table 5: `market_candles`

**Primary key:** `(symbol, interval, ts)` — composite, safe to upsert.

OHLCV data for the price chart. Push the last 90 daily candles per active symbol.
The chart uses `interval = '1d'` by default.

| Column | Type | Required | Notes |
|---|---|---|---|
| `symbol` | TEXT | YES | Must match `symbols.symbol` |
| `interval` | TEXT | YES | `"1d"` \| `"4h"` \| `"1h"` |
| `ts` | TIMESTAMPTZ | YES | Candle open time. e.g. `"2026-05-15T00:00:00Z"` |
| `open` | REAL | no | Open price |
| `high` | REAL | no | High price |
| `low` | REAL | no | Low price |
| `close` | REAL | no | Close price |
| `volume` | REAL | no | Volume in base currency |
| `source` | TEXT | no | `"yahoo"` \| `"coingecko"` \| `"hyperliquid"` \| `"binance"` |

**Example — one daily candle:**
```json
{
  "symbol": "BTC",
  "interval": "1d",
  "ts": "2026-05-14T00:00:00Z",
  "open": 102100.0,
  "high": 104800.0,
  "low": 101300.0,
  "close": 103250.0,
  "volume": 28500.0,
  "source": "coingecko"
}
```

---

## REST API Upsert Pattern

All writes use the Supabase REST API with `merge-duplicates`:

```python
import httpx

SUPABASE_URL = "https://iinzcnqwhltxjilpkojr.supabase.co"
SERVICE_ROLE_KEY = "<your_service_role_key>"

HEADERS = {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates,return=minimal",
}

def upsert(table: str, rows: list[dict]) -> None:
    """Upsert rows to Supabase table. Batches in 500-row chunks."""
    for i in range(0, len(rows), 500):
        chunk = rows[i:i + 500]
        resp = httpx.post(
            f"{SUPABASE_URL}/rest/v1/{table}",
            headers=HEADERS,
            json=chunk,
            timeout=30,
        )
        resp.raise_for_status()
```

**Full push sequence:**
```python
# 1. Register symbols
upsert("symbols", symbol_rows)

# 2. Push ideas (research_only=True always)
for idea in idea_rows:
    idea["research_only"] = True
upsert("trade_ideas", idea_rows)

# 3. Push scores
upsert("trade_idea_scores", score_rows)

# 4. Push levels (delete-first if re-syncing)
# Option A: delete then insert
for idea_id in idea_ids_being_resynced:
    httpx.delete(
        f"{SUPABASE_URL}/rest/v1/trade_idea_levels",
        headers=HEADERS,
        params={"idea_id": f"eq.{idea_id}"},
    )
upsert("trade_idea_levels", level_rows)

# 5. Push candles (safe to upsert, PK deduplicates)
upsert("market_candles", candle_rows)
```

---

## Status Lifecycle

```
active   → watch        (downgrade: still visible on leaderboard)
active   → closed       (set closed_at + outcome)
active   → expired      (time horizon passed, no clean close)
watch    → active       (upgrade: setup improved)
watch    → closed
```

The leaderboard (`/ideas`) shows `status IN ('active')` only.
Closed ideas appear in the History tab on the symbol detail page.

---

## Minimum Viable Push

If you only have partial data, this is enough to show a row on the leaderboard:

```json
// symbols
{ "symbol": "NVDA", "asset_name": "Nvidia", "asset_class": "stock" }

// trade_ideas — minimum required fields
{
  "idea_id": "rv_1_NVDA",
  "symbol": "NVDA",
  "source": "realvision",
  "status": "active",
  "research_only": true,
  "direction": "long",
  "source_author": "Author Name",
  "source_rank": 1
}
```

Everything else (scores, levels, candles) is optional and adds progressively
richer display on the detail page.

---

## What Populates Where

| Data pushed | What appears on the dashboard |
|---|---|
| `symbols` + `trade_ideas` | Row on `/ideas` leaderboard |
| `trade_idea_scores.total_score` | Score bar on leaderboard row |
| `trade_idea_scores` (all 8) | Score breakdown panel on `/ideas/[symbol]` |
| `trade_idea_levels` (entry/SL/TP) | Price levels on SVG chart |
| `trade_idea_levels` (resistance) | Amber dotted lines on chart + pill list |
| `trade_idea_levels` (support) | Blue dotted lines on chart |
| `market_candles` | Candlestick chart body |
| `trade_ideas.status = 'closed'` | Moves to History tab, off leaderboard |

---

## Safety Rules

1. `research_only` must always be `true`. The dashboard enforces this but your
   push code should set it explicitly.
2. No broker, order, wallet, or execution fields exist in this schema. Do not add them.
3. Never push `real_positions` quantities or cost basis — portfolio holdings are
   private and stay in MoneyTrail SQLite only.
4. RLS is enabled: your service-role key bypasses it for writes. Never expose
   the service-role key to the frontend.
