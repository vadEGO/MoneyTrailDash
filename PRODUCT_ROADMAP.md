# MoneyTrail Product Roadmap

Last reviewed: 2026-07-27

MoneyTrail is a research and decision-support system. Evidence quality, disagreement, invalidation, and freshness must be visible before an idea feels actionable. It does not execute trades.

## Prioritized Roadmap

| Priority | Feature | User value | Status |
| --- | --- | --- | --- |
| P0 | Evidence-expiry review queue | Prevents a fresh export timestamp from making aging source evidence look current | Shipped 2026-07-27 |
| P1 | Thesis-to-position exposure graph | Shows correlated theme concentration across current positions | Shipped 2026-07-27 |
| P2 | Valuation contradiction review queue | Exposes adverse shadow-valuation disagreement | Shipped 2026-07-26 |
| P3 | Catalyst calendar | Creates dated pre/post-event review tasks for earnings, filings, unlocks, and policy events | Next candidate |
| P4 | Decision outcome calibration | Tests score bands and source mixes against subsequent outcomes | Planned |
| P5 | Scenario stress cards | Shows sensitivity to rates, oil, USD, liquidity, and crypto-beta shocks | Discovery |

## 2026-07-27 Decision

The exporter now derives a source-aware review deadline from each source confirmation, preserves canonical scores, and emits stable research events for stale or undated evidence. The Funnel exposes the resulting review queue and the idea drawer explains the source date, SLA, and deadline.

Initial review windows are 7 days for fast-moving social evidence, 14 days for RealVision and YouTube, 30 days for valuation shadows, and 60 days from the report period for lagged 13F evidence. A newer qualifying source can keep a multi-source idea current; merely re-exporting a row cannot.

SEC guidance confirms Form 13F can arrive up to 45 days after quarter-end, while current Form 8-K disclosure is generally due within four business days. That supports source-specific timing instead of one universal freshness rule:

- <https://www.sec.gov/rules-regulations/staff-guidance/division-investment-management-frequently-asked-questions/frequently-asked-questions-about-form-13f>
- <https://www.investor.gov/introduction-investing/investing-basics/glossary/form-8-k>

## Next Review

Measure stale-queue volume and alert burden, then build the catalyst calendar on top of the review-deadline contract.
