import { unstable_cache } from 'next/cache'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase-server'
import type { Database } from '@/lib/types'
import type {
  DashboardSummary,
  EngineHealthRow,
  EntryExitPlan,
  CompositeRow,
  LlmHealthRow,
  MacroAssetOverlay,
  MacroDataPoint,
  MacroFitRow,
  MacroRegimeData,
  MarketCatalystEvent,
  MacroRegimeSnapshot,
  MacroRegionalScore,
  MacroSourceStatus,
  PortfolioActionRow,
  PortfolioProposalRow,
  ThesisAllocationRow,
  OpportunityAction,
  OpportunityEngineEvent,
  PersonaPosition,
  PublicCouncilRun,
  PublicOpportunity,
  PublicReport,
  PublicThesis,
  ThesisQualityRow,
  ResearchLibraryRow,
  RvTradeEvent,
  RvTradeIdea,
  RvTradeSyncStatus,
  SectionStatus,
  ThesisBoardRow,
  TickerStance,
} from '@/lib/types'

// How long a cached query result is reused before the underlying Supabase
// query runs again. The pipeline syncs a handful of times per day, so a few
// minutes of staleness is invisible to users but collapses dozens of refetches
// (including AutoRefresh / router.refresh) into a single round trip.
const REVALIDATE_SECONDS = 300

function hasSupabaseConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
}

// A cookie-less anon client. Every table read below targets a `public_*` view
// that is `grant select ... to anon`, so the data does not depend on the signed
// in user — auth is enforced separately in middleware.ts. Using a client WITHOUT
// cookies() is what lets these fetches be statically cached; the previous
// cookie-bound client forced every page to render dynamically and refetch on
// every request, which was the main driver of egress.
function anonClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } }
  )
}

// Wrap a fetcher so its result is cached across requests for REVALIDATE_SECONDS.
// `keyParts` must uniquely identify the query (name + any args), since
// unstable_cache keys on them.
function cached<T>(keyParts: string[], fn: () => Promise<T>) {
  return unstable_cache(fn, keyParts, { revalidate: REVALIDATE_SECONDS })()
}

export async function getDashboardSummary(): Promise<DashboardSummary | null> {
  if (!hasSupabaseConfig()) return null
  return cached(['dashboard_summary'], async () => {
    const { data } = await anonClient().from('public_dashboard_summary').select('*').single()
    return data ?? null
  })
}

export async function getOpportunities(limit = 20): Promise<PublicOpportunity[]> {
  if (!hasSupabaseConfig()) return []
  return cached(['opportunities', String(limit)], async () => {
    const { data } = await anonClient()
      .from('public_opportunity_watchlist')
      .select('*')
      .order('rank', { ascending: true })
      .limit(limit)
    return data ?? []
  })
}

export async function getTheses(limit = 20): Promise<PublicThesis[]> {
  if (!hasSupabaseConfig()) return []
  return cached(['theses', String(limit)], async () => {
    const { data } = await anonClient()
      .from('public_thesis_register')
      .select('*')
      .order('confidence', { ascending: false, nullsFirst: false })
      .limit(limit)
    return data ?? []
  })
}

export async function getThesisQuality(limit = 30): Promise<ThesisQualityRow[]> {
  if (!hasSupabaseConfig()) return []
  return cached(['thesis_quality', String(limit)], async () => {
    const { data } = await anonClient()
      .from('public_thesis_quality')
      .select('*')
      .order('quality_score', { ascending: false, nullsFirst: false })
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(limit)
    return data ?? []
  })
}

export async function getCouncilRuns(limit = 10): Promise<PublicCouncilRun[]> {
  if (!hasSupabaseConfig()) return []
  return cached(['council_runs', String(limit)], async () => {
    const { data } = await anonClient()
      .from('public_latest_council_runs')
      .select('*')
      .order('created_at', { ascending: false, nullsFirst: false })
      .limit(limit)
    return data ?? []
  })
}

export async function getPersonaPositions(councilRunId: string): Promise<PersonaPosition[]> {
  if (!hasSupabaseConfig()) return []
  return cached(['persona_positions', councilRunId], async () => {
    const { data } = await anonClient()
      .from('public_persona_positions')
      .select('*')
      .eq('council_run_id', councilRunId)
      .order('persona', { ascending: true })
    return data ?? []
  })
}

export async function getResearchLibrary(limit = 80): Promise<ResearchLibraryRow[]> {
  if (!hasSupabaseConfig()) return []
  return cached(['research_library', String(limit)], async () => {
    const { data } = await anonClient()
      .from('public_research_library')
      .select('*')
      .order('created_at', { ascending: false, nullsFirst: false })
      .limit(limit)
    return data ?? []
  })
}

export async function getEngineHealth(limit = 20): Promise<EngineHealthRow[]> {
  if (!hasSupabaseConfig()) return []
  return cached(['engine_health', String(limit)], async () => {
    const { data } = await anonClient()
      .from('public_engine_health')
      .select('*')
      .limit(limit)
    return data ?? []
  })
}

export async function getReports(limit = 20): Promise<PublicReport[]> {
  if (!hasSupabaseConfig()) return []
  return cached(['reports', String(limit)], async () => {
    const { data } = await anonClient()
      .from('public_reports')
      .select('*')
      .order('report_date', { ascending: false, nullsFirst: false })
      .limit(limit)
    return data ?? []
  })
}

export async function getLlmHealth(limit = 14): Promise<LlmHealthRow[]> {
  if (!hasSupabaseConfig()) return []
  return cached(['llm_health', String(limit)], async () => {
    const { data } = await anonClient()
      .from('public_llm_health')
      .select('*')
      .limit(limit)
    return data ?? []
  })
}

export async function getRvTradeIdeas(limit = 80): Promise<RvTradeIdea[]> {
  if (!hasSupabaseConfig()) return []
  return cached(['rv_trade_ideas', String(limit)], async () => {
    const { data } = await anonClient()
      .from('public_rv_trade_leaderboard')
      .select('*')
      .order('rank', { ascending: true })
      .limit(limit)
    return data ?? []
  })
}

export async function getRvTradeEvents(limit = 40): Promise<RvTradeEvent[]> {
  if (!hasSupabaseConfig()) return []
  return cached(['rv_trade_events', String(limit)], async () => {
    const { data } = await anonClient()
      .from('public_rv_trade_events')
      .select('*')
      .order('event_at', { ascending: false, nullsFirst: false })
      .limit(limit)
    return data ?? []
  })
}

export async function getRvTradeSyncStatus(limit = 10): Promise<RvTradeSyncStatus[]> {
  if (!hasSupabaseConfig()) return []
  return cached(['rv_trade_sync_status', String(limit)], async () => {
    const { data } = await anonClient()
      .from('public_rv_trade_sync_status')
      .select('*')
      .limit(limit)
    return data ?? []
  })
}

export async function getOpportunityActions(limit = 120): Promise<OpportunityAction[]> {
  if (!hasSupabaseConfig()) return []
  return cached(['opportunity_actions', String(limit)], async () => {
    const { data } = await anonClient()
      .from('public_opportunity_action_board')
      .select('*')
      .limit(limit)
    return data ?? []
  })
}

// Server-side view of the same per-ticker split the funnel computes from raw rows.
// Useful as a cross-check that client grouping matches the read model, and cheaper
// than pulling every row when only the counts are needed.
export async function getTickerStanceRollup(limit = 300): Promise<TickerStance[]> {
  if (!hasSupabaseConfig()) return []
  return cached(['ticker_stance_rollup', String(limit)], async () => {
    const { data } = await anonClient()
      .from('public_ticker_stance_rollup')
      .select('*')
      .limit(limit)
    return data ?? []
  })
}

export async function getEntryExitPlans(limit = 80): Promise<EntryExitPlan[]> {
  if (!hasSupabaseConfig()) return []
  return cached(['entry_exit_plans', String(limit)], async () => {
    const { data } = await anonClient()
      .from('public_entry_exit_plans')
      .select('*')
      .order('total_score', { ascending: false, nullsFirst: false })
      .limit(limit)
    return data ?? []
  })
}

export async function getOpportunityEngineEvents(limit = 40): Promise<OpportunityEngineEvent[]> {
  if (!hasSupabaseConfig()) return []
  return cached(['opportunity_engine_events', String(limit)], async () => {
    const { data } = await anonClient()
      .from('public_opportunity_engine_events')
      .select('*')
      .order('event_at', { ascending: false, nullsFirst: false })
      .limit(limit)
    return data ?? []
  })
}

export async function getMacroFit(limit = 200): Promise<MacroFitRow[]> {
  if (!hasSupabaseConfig()) return []
  return cached(['macro_fit', String(limit)], async () => {
    const { data } = await anonClient()
      .from('public_rv_trade_macro_fit')
      .select('*')
      .order('macro_fit_score', { ascending: false, nullsFirst: false })
      .limit(limit)
    return data ?? []
  })
}

export async function getComposite(limit = 200): Promise<CompositeRow[]> {
  if (!hasSupabaseConfig()) return []
  return cached(['composite', String(limit)], async () => {
    const { data } = await anonClient()
      .from('public_rv_trade_composite')
      .select('*')
      .order('composite_score', { ascending: false, nullsFirst: false })
      .limit(limit)
    return data ?? []
  })
}

export async function getPortfolioActions(limit = 50): Promise<PortfolioActionRow[]> {
  if (!hasSupabaseConfig()) return []
  return cached(['portfolio_actions', String(limit)], async () => {
    const { data } = await anonClient()
      .from('public_portfolio_actions')
      .select('*')
      .limit(limit)
    return data ?? []
  })
}

export async function getThesisAllocation(): Promise<ThesisAllocationRow[]> {
  if (!hasSupabaseConfig()) return []
  return cached(['thesis_allocation'], async () => {
    const { data } = await anonClient()
      .from('public_thesis_allocation')
      .select('*')
    return data ?? []
  })
}

export async function getPortfolioProposal(limit = 200): Promise<PortfolioProposalRow[]> {
  if (!hasSupabaseConfig()) return []
  return cached(['portfolio_proposal', String(limit)], async () => {
    const { data } = await anonClient()
      .from('public_portfolio_proposal')
      .select('*')
      .limit(limit)
    return data ?? []
  })
}

export async function getMacroRegime(): Promise<MacroRegimeData | null> {
  if (!hasSupabaseConfig()) return null
  const supabase = createClient()
  const { data } = await supabase
    .from('macro_regime')
    .select('*')
    .eq('id', 'current')
    .single()
  return data ?? null
}

export async function getMarketCatalystEvents(limit = 8): Promise<MarketCatalystEvent[]> {
  if (!hasSupabaseConfig()) return []
  return cached(['market_catalyst_events', String(limit)], async () => {
    const { data } = await anonClient()
      .from('public_market_catalyst_events')
      .select('*')
      .order('event_at', { ascending: true })
      .limit(limit)
    return data ?? []
  })
}

export async function getMacroRegimeSnapshot(): Promise<MacroRegimeSnapshot | null> {
  if (!hasSupabaseConfig()) return null
  return cached(['macro_regime_snapshot'], async () => {
    const { data } = await anonClient()
      .from('public_macro_regime_latest')
      .select('*')
      .single()
    return data ?? null
  })
}

export async function getMacroHistory(limit = 12): Promise<MacroRegimeSnapshot[]> {
  if (!hasSupabaseConfig()) return []
  const boundedLimit = Math.max(1, Math.min(50, Math.trunc(limit)))
  return cached(['macro_history', String(boundedLimit)], async () => {
    const { data } = await anonClient()
      .from('public_macro_regime_history')
      .select('*')
      .limit(boundedLimit)
    return data ?? []
  })
}

export async function getMacroAssetOverlays(limit = 80): Promise<MacroAssetOverlay[]> {
  if (!hasSupabaseConfig()) return []
  const boundedLimit = Math.max(1, Math.min(240, Math.trunc(limit)))
  return cached(['macro_asset_overlays', String(boundedLimit)], async () => {
    const { data } = await anonClient()
      .from('public_macro_asset_overlays')
      .select('*')
      .order('macro_score', { ascending: false, nullsFirst: false })
      .limit(boundedLimit)
    return data ?? []
  })
}

export async function getMacroDataLatest(limit = 160): Promise<MacroDataPoint[]> {
  if (!hasSupabaseConfig()) return []
  const boundedLimit = Math.max(1, Math.min(300, Math.trunc(limit)))
  return cached(['macro_data_latest', String(boundedLimit)], async () => {
    const { data } = await anonClient()
      .from('public_macro_data_latest')
      .select('*')
      .limit(boundedLimit)
    return data ?? []
  })
}

export async function getMacroDataLatestForSeries(seriesIds: readonly string[]): Promise<MacroDataPoint[]> {
  if (!hasSupabaseConfig()) return []
  const normalized = Array.from(new Set(seriesIds.map(value => value.trim()).filter(Boolean))).slice(0, 50)
  if (normalized.length === 0) return []
  return cached(['macro_data_series', ...normalized], async () => {
    const { data } = await anonClient()
      .from('public_macro_data_latest')
      .select('*')
      .in('series_id', normalized)
      .order('observation_date', { ascending: false, nullsFirst: false })
    return data ?? []
  })
}

export async function getMacroSourceStatus(limit = 80): Promise<MacroSourceStatus[]> {
  if (!hasSupabaseConfig()) return []
  const boundedLimit = Math.max(1, Math.min(120, Math.trunc(limit)))
  return cached(['macro_source_status', String(boundedLimit)], async () => {
    const { data } = await anonClient()
      .from('public_macro_source_status')
      .select('*')
      .limit(boundedLimit)
    return data ?? []
  })
}

export interface MacroRegionalLatestFilters {
  region?: string | null
  trafficLight?: string | null
  includeStale?: boolean
  limit?: number
}

export interface MacroRegionalHistoryFilters {
  region?: string | null
  from?: string | null
  to?: string | null
  limit?: number
}

export async function getMacroRegionalLatest(filters: MacroRegionalLatestFilters = {}): Promise<MacroRegionalScore[]> {
  if (!hasSupabaseConfig()) return []
  const limit = Math.max(1, Math.min(50, Math.trunc(filters.limit ?? 20)))
  let query = anonClient()
    .from('public_macro_regional_latest')
    .select('*')
    .order('region', { ascending: true })
    .limit(limit)
  if (filters.region) query = query.eq('region', filters.region)
  if (filters.trafficLight) query = query.eq('traffic_light', filters.trafficLight)
  if (filters.includeStale === false) query = query.eq('is_stale', false)
  const { data } = await query
  return data ?? []
}

export async function getMacroRegionalHistory(filters: MacroRegionalHistoryFilters = {}): Promise<MacroRegionalScore[]> {
  if (!hasSupabaseConfig()) return []
  const limit = Math.max(1, Math.min(1000, Math.trunc(filters.limit ?? 180)))
  let query = anonClient()
    .from('public_macro_regional_history')
    .select('*')
    .order('as_of', { ascending: false, nullsFirst: false })
    .order('region', { ascending: true })
    .limit(limit)
  if (filters.region) query = query.eq('region', filters.region)
  if (filters.from) query = query.gte('as_of', filters.from)
  if (filters.to) query = query.lte('as_of', filters.to)
  const { data } = await query
  return data ?? []
}

export async function getLatestSnapshot(): Promise<{ thesis_board: ThesisBoardRow[] | null }> {
  if (!hasSupabaseConfig()) return { thesis_board: null }
  const supabase = createClient()
  const { data } = await supabase
    .from('dashboard_snapshots')
    .select('*')
    .order('generated_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .single()
  if (!data) return { thesis_board: null }
  const snap = data as { thesis_board?: ThesisBoardRow[] | null }
  return { thesis_board: snap.thesis_board ?? null }
}

// Per-section freshness, written by MoneyTrail's run_section.py. Returns a map
// keyed by section name so each surface can look up its own last-run/stale state
// independently of the global pipeline sync time.
export async function getSectionStatus(): Promise<Record<string, SectionStatus>> {
  if (!hasSupabaseConfig()) return {}
  return cached(['section_status'], async () => {
    const { data } = await anonClient().from('public_section_status').select('*')
    const out: Record<string, SectionStatus> = {}
    for (const row of (data ?? []) as SectionStatus[]) out[row.section] = row
    return out
  })
}

// Re-exported from lib/fmt.ts so existing import sites (`@/lib/openclaw`) keep
// working while there is a single canonical definition of these formatters.
export { formatAge, pct } from './fmt'
