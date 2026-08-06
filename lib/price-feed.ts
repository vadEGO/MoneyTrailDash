import type { OpportunityAction } from '@/lib/types'

/**
 * Price feed health for the funnel.
 *
 * The action board carries no price_updated_at of its own — current_price is
 * written by the exporter as part of the row, so the row's updated_at is the age
 * of the quote.
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

export type PriceHealth = 'ok' | 'stale' | 'missing'

export function priceAgeDays(row: OpportunityAction, now = Date.now()): number | null {
  if (!row.updated_at) return null
  const ms = now - new Date(row.updated_at).getTime()
  return Number.isFinite(ms) ? ms / 86_400_000 : null
}

export function priceHealth(row: OpportunityAction, now = Date.now()): PriceHealth {
  if (row.current_price == null) return 'missing'
  const age = priceAgeDays(row, now)
  return age != null && age > STALE_PRICE_DAYS ? 'stale' : 'ok'
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
  /** Age of the most recent write for this class — when the exporter last touched it. */
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
        stale: lastWriteDays != null && lastWriteDays > STALE_PRICE_DAYS,
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
