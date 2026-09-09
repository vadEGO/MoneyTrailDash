# MoneyTrailDash review — 2026-09-09

Scope: dashboard code and local verification against base commit `0c343c2`.
No production data, provider health, or deployment freshness was revalidated.

## Implemented: trustworthy clock presentation

The existing price helper treated a numeric quote without an observation date as
fresh. It also accepted a producer's `fresh` status indefinitely, clamped future
quote clocks to zero age, and let inconsistent quotes reach entry-zone rendering.
The shared section freshness chip could label invalid/future dates LIVE.

Acceptance criteria:

- Missing, malformed, or future observation dates never produce fresh quotes.
- Cached `price_age_hours` and export timestamps cannot replace observation time.
- The existing seven-day display expiry overrides a saved fresh/aging label;
  producer stale/aging warnings are never upgraded.
- Invalid prices cannot produce an entry-zone verdict.
- A usable numeric value survives clock errors in the drawer with an explicit
  CLOCK MISSING or CLOCK INVALID label.
- Aging/stale entry context is visibly qualified; invalid or expired quotes leave
  the current board and remain discoverable in the review queue.
- Invalid section clocks and invalid freshness thresholds never render LIVE.
- Canonical scores, source clocks, database rows, and execution permissions are
  unchanged. Display-time classification is conservative and read-only.

These criteria are covered by price, review-routing, formatting, and rendered
component regression tests in the normal `npm test` command.

## Prioritized follow-up

1. **Complete preview isolation.** The environment check now runs from
   `prebuild`. A preview configured with production credentials fails before
   deployment (verified on the branch deployment); a correctly isolated preview
   passes locally with ref `ddxueqwksoqdkrvpclbt`. Configure those three Preview
   variables in Vercel, then verify signed-in flows against the isolated project.
2. **Test authentication failure states.** Middleware returns early when public
   configuration is absent. Review the intended fail-closed behavior together
   with page/client configuration handling; add missing-config and expired-session
   route tests. This review did not establish a production data exposure.
3. **Repair the operator documentation.** The roadmap's last-reviewed date is
   July 29; README points to a stable root release coordinator absent during this
   inspection. Confirm current runtime ownership and schedules before updating
   operating claims. Do not infer freshness from old snapshots or reinstall an
   orchestrator without checking whether another system replaced it.
4. **Add real outcome calibration before expanding signals.** It remains planned
   in the roadmap. Define dated prediction cohorts, horizon-specific outcomes,
   missing-outcome coverage, and comparison baselines before publishing accuracy
   claims. Company catalyst coverage should follow reliable primary-source dates.
5. **Broaden clock handling beyond this slice.** Evidence, level, and review
   status strings still depend on published refreshes. Specify their individual
   expiry contracts and add equivalent lapse tests; do not reuse the quote SLA.

## Verification and release status

- `npm test`: passed, including clock-integrity regressions.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed locally without production credentials.
- `npm run release:test`: passed (7 coordinator tests plus preview checks).
- React review: no new requests, effects, subscriptions, or dependencies; warnings
  use text as well as color, with pure classification shared across consumers.
- Browser interaction and authenticated production paths were not verified.
- PR #27 is open. The Vercel preview for commit `7f239c5` failed closed because
  Vercel Preview still supplies the production Supabase ref; production remains
  on the last known-good deployment. The release is intentionally blocked until
  Preview variables are corrected, then requires exact-commit verification and a
  validated release manifest.
