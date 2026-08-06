# MoneyTrail Product Roadmap

Last reviewed: 2026-07-29

MoneyTrail is a research and decision-support system. Evidence quality, disagreement, invalidation, and freshness must be visible before an idea feels actionable. It does not execute trades.

## Prioritized Roadmap

| Priority | Feature | User value | Status |
| --- | --- | --- | --- |
| P0 | Evidence-review daily batch | Deduplicates stale setups by symbol and routes a bounded, risk-ranked review batch | Shipped 2026-07-28 |
| P1 | Evidence-expiry review queue | Prevents a fresh export timestamp from making aging source evidence look current | Shipped 2026-07-27 |
| P2 | Thesis-to-position exposure graph | Shows correlated theme concentration across current positions | Shipped 2026-07-27 |
| P3 | Valuation contradiction review queue | Exposes adverse shadow-valuation disagreement | Shipped 2026-07-26 |
| P4 | FOMC event-risk horizon | Creates official-source dated pre/post policy review tasks without changing idea scores | Shipped 2026-07-29 |
| P5 | Company catalyst coverage | Adds primary-source earnings and material-filing events to idea-specific review windows | Next candidate |
| P6 | Decision outcome calibration | Tests score bands and source mixes against subsequent outcomes | Planned |
| P7 | Scenario stress cards | Shows sensitivity to rates, oil, USD, liquidity, and crypto-beta shocks | Discovery |

## 2026-07-29 Decision

Selected an official-source FOMC event-risk horizon as the first bounded catalyst-calendar slice. The live board contains 424 ideas: 390 have a catalyst score of at least 10, while only 5 expose a recognizable date in their watch text. A broad earnings/token calendar would multiply source-quality problems; the Federal Reserve publishes a stable, public meeting schedule with decision timing.

The OpenClaw macro source stage now fetches the official FOMC schedule, creates deterministic pre-event and post-event research windows, and exports only public-safe event metadata. The Funnel surface shows the active task and upcoming decisions. This is an attention and risk-awareness overlay only: canonical scores, lifecycle states, portfolio proposals, and trade execution remain untouched.

The Market & Macro placement from the original change was dropped: that page was rebuilt around the Regional Macro Risk Board, so the panel would have needed a new home there. Worth revisiting as a follow-up.

## Release Governance

MoneyTrail product work uses the versioned controls in `ops/release`. A
candidate may produce a successful no-op when it does not clear the value and
safety threshold. Any implementation must claim the shared release lease,
publish a release manifest, use an isolated Supabase project for Vercel
previews, and preserve exact Git/Supabase/Vercel/OpenClaw release identity.

The two scheduled Codex automations are not independent deployers. They share
one release lease, so only one may own implementation and production release at
a time. A busy lease or overlapping active PR requires the other automation to
exit without changing state.

## 2026-07-28 Decision

Selected evidence-review batching after the live payload measured 352 stale setup rows, including 319 still marked ready. Those rows represented 242 unique symbols, so 110 rows duplicated review effort. Adding catalysts before reducing that burden would worsen the attention problem.

The exporter now derives a 0–100 review-priority score from action state, canonical score band, SLA overrun, source-confirmation breadth, and tracked/watchlisted status. The score routes attention only: it does not change canonical setup scores or lifecycle states. The Funnel collapses duplicate stale setups by symbol, exposes the full ranked queue, and presents a daily batch of the top 20 symbols.

## 2026-07-27 Decision

The exporter now derives a source-aware review deadline from each source confirmation, preserves canonical scores, and emits stable research events for stale or undated evidence. The Funnel exposes the resulting review queue and the idea drawer explains the source date, SLA, and deadline.

Initial review windows are 7 days for fast-moving social evidence, 14 days for RealVision and YouTube, 30 days for valuation shadows, and 60 days from the report period for lagged 13F evidence. A newer qualifying source can keep a multi-source idea current; merely re-exporting a row cannot.

SEC guidance confirms Form 13F can arrive up to 45 days after quarter-end, while current Form 8-K disclosure is generally due within four business days. That supports source-specific timing instead of one universal freshness rule:

- <https://www.sec.gov/rules-regulations/staff-guidance/division-investment-management-frequently-asked-questions/frequently-asked-questions-about-form-13f>
- <https://www.investor.gov/introduction-investing/investing-basics/glossary/form-8-k>

## Next Review

Measure whether event windows trigger timely macro-fit refreshes. The next catalyst slice should add company-specific earnings and material SEC filing events using primary-source identifiers, with explicit missing-date coverage rather than inferred dates.
