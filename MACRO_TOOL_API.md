# Macro Tool API

MoneyTrailDash exposes cached, read-only macro APIs backed by Supabase public views. The primary interface is the regional traffic-light model for `GLOBAL`, `US`, `EUROZONE`, `UK`, `JAPAN`, `AUSTRALIA`, and `CANADA`.

## Authority Boundary

OpenClaw is the sole orchestrator for macro provider calls and authoritative scoring. It owns official-source requests, parsing, backfills, normalization, freshness and coverage checks, pillar scores, headline traffic lights, global aggregation, driver selection, and Supabase export.

MoneyTrailDash is a read-only consumer. The dashboard and its route handlers:

- read only Supabase public views;
- never call Treasury, FRED, ECB, BoE, BoJ/MoF, RBA, Bank of Canada, or another upstream provider;
- never calculate or repair an authoritative regional score;
- never write macro data or scoring state; and
- never substitute embedded defaults when data is missing.

Missing, invalid, or stale critical data is displayed as grey/unavailable. UI thresholding of a published pillar score is presentation only; it does not change the upstream score.

A new scoring model remains in shadow until seven consecutive successful daily cohorts contain all six regions with valid critical inputs, at least 70% coverage, and at least three pillars. Failed or missing days reset the streak. The public views expose shadow rows as grey and mask headlines, pillars, momentum, and drivers; live colours activate only on cohort seven. The scheduled OpenClaw alert enforces the same gate.

## Regional Endpoints

### `GET /api/macro/regions`

Reads `public_macro_regional_latest` and returns the latest published row per matching region.

Query parameters:

- `region`: one canonical code. `EU`, `EUROPE`, and `EURO ZONE` normalize to `EUROZONE`.
- `trafficLight`: `green`, `amber`, `red`, or `grey`.
- `includeStale`: `true` by default; set `false` to exclude rows marked stale.
- `limit`: defaults to `20`, bounded to `1–50`.

Response:

```json
{
  "regions": [
    {
      "id": "regional-score-id",
      "region": "US",
      "as_of": "2026-08-01",
      "risk_score": 68.4,
      "traffic_light": "green",
      "cycle_phase": "expansion",
      "rates_score": 72.1,
      "credit_score": 70.2,
      "growth_score": 63.8,
      "inflation_score": 58.3,
      "liquidity_fx_score": 66.9,
      "coverage_ratio": 0.91,
      "is_stale": false,
      "weekly_change": 2.4,
      "monthly_change": 5.1,
      "top_positive_drivers": ["2Y yield easing while credit remains stable"],
      "top_negative_drivers": ["Inflation momentum remains elevated"],
      "source_count": 11,
      "updated_at": "2026-08-01T07:10:00Z"
    }
  ],
  "count": 1,
  "status": "live",
  "diagnostics": null,
  "filters": {
    "region": "US",
    "trafficLight": null,
    "includeStale": true,
    "limit": 20
  }
}
```

### `GET /api/macro/regions/history`

Reads `public_macro_regional_history` in reverse chronological order.

Query parameters:

- `region`: the same canonical code and aliases as the latest endpoint.
- `from`: optional inclusive date in `YYYY-MM-DD` format.
- `to`: optional inclusive date in `YYYY-MM-DD` format.
- `limit`: defaults to `180`, bounded to `1–1000`.

The response uses the same row contract under `history`, plus `count`, `status`, `diagnostics`, and normalized `filters`. Invalid regions, dates, booleans, or date ranges return HTTP `400`. A valid request with no matching published data returns HTTP `200`, an empty array, `status: "unavailable"`, and a diagnostic message.

Both regional endpoints set `Cache-Control: s-maxage=300, stale-while-revalidate=60` and declare a five-minute Next.js revalidation window.

## Regional Row Contract

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Stable published score identifier. |
| `region` | string | Canonical region code. |
| `as_of` | ISO date or null | Score observation date. |
| `risk_score` | number or null | Upstream 0–100 investment-risk-posture score. |
| `traffic_light` | string or null | Upstream `green`, `amber`, `red`, or `grey` classification. |
| `cycle_phase` | string or null | Separate economic-cycle classification; not the traffic light. |
| `rates_score` | number or null | Rates and sovereign-bond pillar. |
| `credit_score` | number or null | Credit and financial-stress pillar. |
| `growth_score` | number or null | Growth-momentum pillar. |
| `inflation_score` | number or null | Inflation-pressure pillar. |
| `liquidity_fx_score` | number or null | Liquidity and currency-pressure pillar. |
| `coverage_ratio` | number or null | Valid input coverage, normally represented from 0 to 1. |
| `is_stale` | boolean or null | Whether freshness rules invalidate a live colour. |
| `weekly_change` | number or null | Headline score change versus one week earlier. |
| `monthly_change` | number or null | Headline score change versus one month earlier. |
| `top_positive_drivers` | string array or null | Largest constructive upstream contributions. |
| `top_negative_drivers` | string array or null | Largest defensive upstream contributions. |
| `source_count` | number or null | Distinct sources contributing to the published row. |
| `updated_at` | ISO timestamp or null | Supabase publication time. |

The dashboard renders green at 65–100, amber at 40–64, and red below 40 for published pillar scores. It forcibly renders stale or scoreless rows as grey even if malformed upstream data contains another colour.

Normalized observations retain separate observation, provider-release, first-seen, and availability timestamps. Freshness is evaluated upstream from the observation period plus configured release lag and grace, so a recent fetch cannot make an old series look current.

## Supporting Endpoints

- `GET /api/macro/data`: latest normalized observations; optional `sourceKind`, `seriesId`, `country`, and `limit` filters.
- `GET /api/macro/sources`: source coverage, freshness, and adapter health.
- `GET /api/macro/context`: latest legacy regime snapshot and stored asset overlays.
- `GET /api/macro/overlays`: stored overlays; optional `symbol`, `assetClass`, `stance`, and `limit` filters.
- `GET /api/macro/history`: legacy regime history with optional `limit`.
- `GET /api/macro/health`: live/partial/unavailable status and endpoint inventory.
- `GET|POST /api/macro/score`: returns a directly matched, already-published asset overlay or unavailable. It does not infer a score from themes.
- `POST /api/macro/score/batch`: the same stored-overlay lookup for up to 200 items. It does not mutate state.
- `GET /api/fear-greed`: reads only `CRYPTO_FEAR_GREED`, `STOCK_FEAR_GREED`, and `VIXCLS` from `public_macro_data_latest`. Index values and `signal_label` strings are returned verbatim; VIX is supplemental and is never converted into a stock sentiment score.

The fear/greed endpoint validates the published observation date against its release-lag/grace or freshness-SLA metadata. Missing, stale, malformed, future-dated, or scoreless rows return `null` and appear in `unavailable_series`; the response status is `live`, `partial`, or `unavailable`. A missing or stale VIX does not invalidate an otherwise valid published stock index, but it makes the response partial and omits the optional `vix` field.

Supporting endpoints also return empty/unavailable states without embedded fallback scores or snapshots. Legacy overlay score endpoints accept only finite upstream scores from 0 through 100 inclusive; malformed or out-of-range stored values are rejected as unavailable rather than clamped. A macro score is research context, not a standalone trade instruction.
