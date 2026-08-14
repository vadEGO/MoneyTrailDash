import type { OpportunityAction } from '@/lib/types'

/**
 * Price feed health for the funnel.
 *
 * Price observation time is independent from source, analysis, export, and
 * trade-level clocks. Re-exporting a row must never make a quote look newer.
 *
 * This is more than cosmetic. Entry, stop and target are derived from
 * current_price (entry_max lands on the price itself, entry_min on price x 0.985),
 * so a row with no price has no plan at all, and an entry verdict computed from a
 * six-week-old quote is actively misleading rather than merely old. Both used to
 * render as a bare em-dash, which is why a dead pipeline leg could sit unnoticed.
 */

// Equity and ETF ideas re-export every couple of days, so a week with no write
// means that class's feed has stopped rather than merely lagged.
export const STALE_PRICE_DAYS = 7

export type PriceHealth = 'fresh' | 'aging' | 'stale' | 'missing' | 'inconsistent'

export function priceAgeDays(row: OpportunityAction, now = Date.now()): number | null {
  if (row.price_as_of) {
    const ms = now - new Date(row.price_as_of).getTime()
    return Number.isFinite(ms) ? Math.max(0, ms / 86_400_000) : null
  }
  if (row.price_age_hours != null && Number.isFinite(Number(row.price_age_hours))) {
    return Math.max(0, Number(row.price_age_hours)) / 24
  }
  return null
}

export function priceHealth(row: OpportunityAction, now = Date.now()): PriceHealth {
  const contractStatus = row.price_freshness_status
  if (row.current_price == null) {
    return contractStatus === 'fresh' || contractStatus === 'aging' || contractStatus === 'stale'
      ? 'inconsistent'
      : 'missing'
  }
  if (contractStatus) return contractStatus
  const age = priceAgeDays(row, now)
  return age != null && age > STALE_PRICE_DAYS ? 'stale' : 'fresh'
}

/** With no price there is nothing to derive the levels from, so the row cannot be traded. */
export function hasNoPlan(row: OpportunityAction): boolean {
  return (row.entry_min ?? row.ideal_entry) == null
    && row.stop_loss == null
    && row.take_profit_1 == null
}

export interface ClassFeed {
  assetClass: string
  ideas: number
  /** Age of the newest market observation for this class, never export age. */
  lastWriteDays: number | null
  missing: number
  unactionable: number
  stale: boolean
}

export interface PriceFeedSummary {
  missing: number
  unactionable: number
  staleClasses: ClassFeed[]
  classes: ClassFeed[]
}

export function summarisePriceFeed(rows: OpportunityAction[], now = Date.now()): PriceFeedSummary {
  const byClass = new Map<string, OpportunityAction[]>()
  for (const r of rows) {
    const key = r.asset_class ?? 'unknown'
    const list = byClass.get(key) ?? []
    list.push(r)
    byClass.set(key, list)
  }

  const classes: ClassFeed[] = Array.from(byClass.entries())
    .map(([assetClass, list]) => {
      const ages = list
        .map(r => priceAgeDays(r, now))
        .filter((a): a is number => a != null)
      const lastWriteDays = ages.length > 0 ? Math.min(...ages) : null
      return {
        assetClass,
        ideas: list.length,
        lastWriteDays,
        missing: list.filter(r => r.current_price == null).length,
        unactionable: list.filter(r => r.current_price == null && hasNoPlan(r)).length,
        stale: list.every(r => ['stale', 'missing', 'inconsistent'].includes(priceHealth(r, now))),
      }
    })
    // Most neglected class first — that is the one worth acting on.
    .sort((a, b) => (b.lastWriteDays ?? -1) - (a.lastWriteDays ?? -1))

  return {
    missing: rows.filter(r => r.current_price == null).length,
    unactionable: rows.filter(r => r.current_price == null && hasNoPlan(r)).length,
    staleClasses: classes.filter(c => c.stale),
    classes,
  }
}

export function fmtPriceAge(days: number | null): string {
  if (days == null) return 'unknown'
  if (days < 1) return `${Math.max(1, Math.round(days * 24))}h`
  return `${Math.round(days)}d`
}
