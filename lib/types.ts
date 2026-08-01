export interface DashboardSummary {
  last_synced_at: string | null
  last_council_run_at: string | null
  opportunity_count: number | null
  thesis_count: number | null
  council_run_count: number | null
  claim_count: number | null
  insight_count: number | null
  llm_fallback_rate: number | null
}

export interface PublicOpportunity {
  rank: number
  opportunity_id: string
  title: string
  status: string | null
  strategic_relevance: number | null
  tactical_timing: number | null
  evidence_strength: number | null
  novelty_score: number | null
  portfolio_fit_score_public: number | null
  total_score: number | null
  themes: string[] | null
  assets_or_targets_public: string[] | null
  why_now: string | null
  what_would_change_the_view: string | null
  next_step: string | null
  updated_at: string | null
}

export interface PublicThesis {
  id: string
  topic: string
  status: string | null
  confidence: number | null
  confidence_movement: string | null
  decision_state: string | null
  core_reasoning: string | null
  next_step: string | null
  agreements: string[] | null
  counterpoints: string[] | null
  invalidation_conditions: string[] | null
  last_changed_reason: string | null
  last_updated: string | null
}

export interface PublicCouncilRun {
  id: string
  topic_pack_id: string | null
  topic: string
  decision_state: string | null
  confidence: number | null
  consensus_view: string | null
  recommended_next_step: string | null
  agreements: string[] | null
  disagreements: string[] | null
  most_important_uncertainties: string[] | null
  what_would_change_our_mind: string[] | null
  personal_constraints_public: string[] | null
  reasoning_mode: string | null
  llm_model: string | null
  created_at: string | null
}

export interface PersonaPosition {
  id: string
  council_run_id: string | null
  persona: string
  thesis: string | null
  supporting_evidence: string[] | null
  counterpoints: string[] | null
  risks: string[] | null
  investment_implications: string | null
  what_would_change_my_mind: string[] | null
  confidence: number | null
  reasoning_mode: string | null
  created_at: string | null
}

export interface ResearchLibraryRow {
  id: string
  record_type: string
  topic: string | null
  title: string | null
  summary: string | null
  materiality: string | null
  research_priority: string | null
  source_family: string | null
  created_at: string | null
}

export interface EngineHealthRow {
  sync_batch_id: string
  status: string | null
  last_synced_at: string | null
  workflow_name: string | null
  records_claims: number | null
  records_insights: number | null
  records_opportunities: number | null
  records_council_runs: number | null
  error_summary: string | null
  is_stale: boolean | null
}

export interface MacroRegimeSnapshot {
  id: string
  source: string
  source_title: string | null
  source_author: string | null
  report_date: string | null
  as_of: string | null
  macro_season_global: string | null
  macro_season_us: string | null
  macro_season_europe: string | null
  growth_phase: string | null
  liquidity_trend: string | null
  financial_conditions: string | null
  dollar_view: string | null
  rates_view: string | null
  oil_shock_status: string | null
  policy_view: string | null
  risk_posture: string | null
  headline_score: number | null
  liquidity_score: number | null
  growth_score: number | null
  inflation_risk_score: number | null
  policy_support_score: number | null
  risk_asset_score: number | null
  defensive_score: number | null
  summary_public: string | null
  key_signals: string[] | null
  risks_public: string[] | null
  opportunities_public: string[] | null
  scoring_weights: Record<string, number> | null
  created_at: string | null
  updated_at: string | null
}

export interface MacroAssetOverlay {
  id: string
  snapshot_id: string
  asset_class: string | null
  symbol: string | null
  display_name: string | null
  macro_score: number | null
  stance: string | null
  rationale_public: string | null
  risk_flags_public: string[] | null
  beneficiary_themes: string[] | null
  updated_at: string | null
  report_date?: string | null
  macro_season_global?: string | null
  macro_season_us?: string | null
  macro_season_europe?: string | null
  growth_phase?: string | null
  liquidity_trend?: string | null
  risk_posture?: string | null
}

export interface MacroDataPoint {
  id: string
  schema_version: number | null
  source: string
  source_kind: string | null
  provider: string | null
  series_id: string
  indicator_name: string | null
  country: string | null
  region: string | null
  metric_key: string | null
  pillar: string | null
  tenor: string | null
  frequency: string | null
  observation_date: string | null
  release_date: string | null
  available_at: string | null
  available_at_basis: string | null
  release_estimated: boolean | null
  first_seen_at: string | null
  data_vintage: string | null
  is_revised: boolean | null
  revision_count: number | null
  revision_detected_at: string | null
  value: number | null
  unit: string | null
  change_1p: number | null
  change_3p: number | null
  freshness_sla_hours: number | null
  expected_release_lag_hours: number | null
  freshness_grace_hours: number | null
  quality_grade: string | null
  critical: boolean | null
  risk_direction: string | null
  value_type: string | null
  score_transform: string | null
  signal_label: string | null
  latest: boolean | null
  source_url: string | null
  relevance_tags: string[] | null
  fetched_at: string | null
}

export interface MacroSourceStatus {
  id: string
  source: string
  source_kind: string | null
  provider: string | null
  region: string | null
  enabled: boolean | null
  cadence: string | null
  adapter: string | null
  status: string | null
  points_ingested: number | null
  expected_items: number | null
  active_items: number | null
  failed_items: string[] | null
  history_insufficient_items: string[] | null
  critical_expected: number | null
  critical_active: number | null
  stale_items: string[] | null
  is_stale: boolean | null
  oldest_observation_date: string | null
  newest_observation_date: string | null
  freshness_basis: string | null
  last_error: string | null
  activation_note: string | null
  documentation_url: string | null
  checked_at: string | null
}

export type MacroTrafficLight = 'green' | 'amber' | 'red' | 'grey'

export interface MacroRegionalScore {
  id: string
  region: string
  as_of: string | null
  risk_score: number | null
  traffic_light: MacroTrafficLight | string | null
  cycle_phase: string | null
  rates_score: number | null
  credit_score: number | null
  growth_score: number | null
  inflation_score: number | null
  liquidity_fx_score: number | null
  coverage_ratio: number | null
  is_stale: boolean | null
  weekly_change: number | null
  monthly_change: number | null
  top_positive_drivers: string[] | null
  top_negative_drivers: string[] | null
  source_count: number | null
  updated_at: string | null
}

export interface PublicReport {
  id: string
  report_type: string
  report_date: string | null
  title: string | null
  markdown_public: string | null
  summary: string | null
  created_at: string | null
}

export interface LlmHealthRow {
  day: string | null
  model: string | null
  calls: number | null
  ok_count: number | null
  fallback_count: number | null
  failed_count: number | null
}

export interface RvTradeIdea {
  rank: number | null
  id: string
  slug: string | null
  title: string
  symbol: string | null
  normalized_symbol: string | null
  market: string | null
  asset_class: string | null
  action: string | null
  direction: string | null
  status: string | null
  is_live: boolean | null
  is_tracked: boolean | null
  is_watchlisted: boolean | null
  author_name: string | null
  vote_in: number | null
  vote_out: number | null
  vote_watching: number | null
  comments_count: number | null
  current_price: number | null
  entry_price: number | null
  stop_loss: number | null
  take_profit: number | null
  risk_reward: number | null
  total_return: number | null
  source_url: string | null
  source_created_at: string | null
  source_updated_at: string | null
  expires_at: string | null
  total_score: number | null
  verdict: string | null
  source_quality: number | null
  evidence_quality: number | null
  technical_setup: number | null
  risk_reward_score: number | null
  thesis_fit: number | null
  macro_liquidity_fit: number | null
  portfolio_relevance: number | null
  freshness: number | null
  reasoning_summary: string | null
  invalidation: string | null
  next_action: string | null
  price_state: string | null
  computed_at: string | null
}

export interface RvTradeEvent {
  id: string
  idea_id: string | null
  event_type: string
  title: string | null
  symbol: string | null
  old_value: string | null
  new_value: string | null
  detail: string | null
  event_at: string | null
  sync_batch_id: string | null
}

export interface RvTradeSyncStatus {
  sync_batch_id: string
  status: string | null
  last_synced_at: string | null
  workflow_name: string | null
  records_rv_trade_ideas: number | null
  records_rv_trade_events: number | null
  error_summary: string | null
  is_stale: boolean | null
}

export interface SourceDetail {
  source: string
  source_url?: string | null
  author?: string | null
  score_contrib?: number | null
  notes?: string | null
  confirmed_at?: string | null
}

export interface OpportunityAction {
  state_rank: number | null
  id: string
  sources: string[] | null
  confirmed_by_count: number | null
  source_details: SourceDetail[] | null
  source: string
  source_record_id: string | null
  symbol: string | null
  normalized_symbol: string | null
  title: string
  thesis: string | null
  direction: string | null
  asset_class: string | null
  status: string | null
  action_state: string
  lifecycle: string
  total_score: number | null
  thesis_score: number | null
  entry_score: number | null
  risk_reward_score: number | null
  catalyst_score: number | null
  source_score: number | null
  liquidity_score: number | null
  portfolio_fit_score: number | null
  current_price: number | null
  ideal_entry: number | null
  entry_min: number | null
  entry_max: number | null
  do_not_chase_above: number | null
  stop_loss: number | null
  take_profit_1: number | null
  take_profit_2: number | null
  take_profit_3: number | null
  trailing_exit_trigger: string | null
  invalidation: string | null
  why_now: string | null
  next_action: string | null
  what_to_watch: string | null
  evidence_last_confirmed_at: string | null
  evidence_review_due_at: string | null
  evidence_sla_days: number | null
  evidence_age_days: number | null
  evidence_freshness_status: 'fresh' | 'aging' | 'stale' | 'missing' | null
  evidence_review_reason: string | null
  evidence_review_priority_score: number | null
  evidence_review_priority_tier: 'critical' | 'high' | 'standard' | null
  evidence_review_priority_reason: string | null
  evidence_duplicate_setup_count?: number
  source_url: string | null
  is_tracked: boolean | null
  is_watchlisted: boolean | null
  expires_at: string | null
  deleted_at: string | null
  discovered_at: string | null
  updated_at: string | null
}

export interface EntryExitPlan {
  id: string
  opportunity_id: string
  plan_type: string
  entry_zone: string | null
  exit_plan: string | null
  risk_notes: string | null
  confidence: number | null
  updated_at: string | null
  symbol: string | null
  normalized_symbol: string | null
  title: string | null
  action_state: string | null
  total_score: number | null
}

export interface OpportunityEngineEvent {
  id: string
  opportunity_id: string | null
  event_type: string
  action_state: string | null
  symbol: string | null
  title: string | null
  detail: string | null
  event_at: string | null
  sync_batch_id: string | null
}

// Legacy MoneyTrail asset-detail tables retained so older routes compile while the
// cockpit moves to OpenClaw public views.
export interface PublicResearch {
  id: string
  asset: string
  symbol: string | null
  asset_type: string | null
  research_level: number | null
  research_summary: string | null
  bull_case: string | null
  bear_case: string | null
  risks: string | null
  evidence_quality_score: number | null
  thesis_fit_score: number | null
  final_decision: string | null
  created_at: string | null
}

export interface PublicLilo {
  id: string
  asset: string
  position_role: string | null
  core_percentage: number | null
  tactical_percentage: number | null
  speculative_percentage: number | null
  aggression_level: string | null
  plan_id: string | null
  entry_min: number | null
  entry_max: number | null
  stop_price: number | null
  thesis_invalidation: string | null
  risk_per_position_pct: number | null
  plan_status: string | null
  expires_at: string | null
  updated_at: string | null
}

export interface PublicTpLayer {
  id: string
  lilo_id: string | null
  asset: string
  layer_number: number | null
  target_price: number | null
  sell_percentage: number | null
  reason: string | null
  status: string | null
}

// --- Legacy MoneyTrail snapshot types (used by older routes) ---
export interface SignalRadarRow {
  asset: string
  symbol: string
  signal_score: number
  mention_count: number
  source_count: number
  sentiment: 'bullish' | 'mixed' | 'neutral' | 'bearish'
  crowding_score: number
  research_priority: string
  status: string
  last_seen?: string
}

export interface ThesisBoardRow {
  thesis: string
  display_name: string
  strength: number
  lifecycle_stage: string
  crowding_score: number
  is_placeholder: boolean
  top_expressions: Array<{ symbol: string; score: number; is_placeholder: boolean }>
}

export interface MacroFitRow {
  idea_id: string
  symbol: string
  asset_class: string | null
  direction: string | null
  playbook_key: string | null
  playbook_stance: string | null
  macro_fit_score: number | null
  label: 'tailwind' | 'neutral' | 'headwind' | 'unknown' | null
  rationale: string | null
  regime_season: string | null
  scored_at: string | null
}

export interface PortfolioActionRow {
  symbol: string
  thesis: string | null
  direction: string | null
  composite_score: number | null
  action: string | null
  target_pct: number | null
  reason: string | null
  heat_score: number | null
  heat_level: 'cool' | 'warm' | 'hot' | null
  proposed_at: string | null
}

export interface ThesisAllocationRow {
  thesis: string
  display_name: string | null
  current_pct: number | null
  target_pct: number | null
  max_pct: number | null
  headroom_pct: number | null
  nav: number | null
  updated_at: string | null
}

export interface PortfolioProposalRow {
  symbol: string
  thesis: string | null
  direction: string | null
  composite_score: number | null
  action: string | null      // enter_starter | add | hold | blocked | skip
  target_pct: number | null
  reason: string | null
  heat_score: number | null
  heat_level: 'cool' | 'warm' | 'hot' | null
  proposed_at: string | null
}

export interface CompositeRow {
  idea_id: string
  symbol: string
  asset_class: string | null
  direction: string | null
  macro_fit_score: number | null
  macro_label: string | null
  technical_score: number | null
  technical_label: string | null
  trend: string | null
  rsi: number | null
  composite_score: number | null
  regime_season: string | null
  scored_at: string | null
}

export interface MacroRegimeData {
  id: string
  active_season: 'spring' | 'summer' | 'fall' | 'winter' | null
  active_phase: 'rec' | 'exp' | 'slo' | 'con' | null
  season_conviction: 'low' | 'medium' | 'high' | null
  phase_conviction: 'low' | 'medium' | 'high' | null
  season_notes: string | null
  phase_notes: string | null
  country_phases: Record<string, string> | null
  last_updated: string | null
  updated_by: string | null
}

export interface AuditRow {
  asset: string
  decision_date: string
  score: number | null
  decision: string | null
  outcome_30d: number | null
  outcome_90d: number | null
  category: string | null
}

export interface DashboardSnapshot {
  id: string
  generated_at: string | null
  currently_running: boolean
  signal_radar: SignalRadarRow[] | null
  thesis_board: ThesisBoardRow[] | null
}

// --- Trade Ideas types ---

export interface TradeIdeaLeaderboardRow {
  symbol: string
  asset_name: string | null
  asset_class: string | null
  last_price: number | null
  tradingview_id: string | null
  idea_id: string
  direction: string | null
  source_author: string | null
  source_rank: number | null
  entry_min: number | null
  entry_max: number | null
  stop_loss: number | null
  take_profit_1: number | null
  risk_reward: number | null
  levels_source: string | null
  time_horizon: string | null
  decision: string | null
  pl_pct: number | null
  status: string
  total_score: number | null
}

export interface TradeIdeaDetail extends TradeIdeaLeaderboardRow {
  source_quality: number | null
  evidence_quality: number | null
  technical_setup: number | null
  risk_reward_score: number | null
  thesis_fit: number | null
  macro_liquidity_fit: number | null
  portfolio_relevance: number | null
  freshness: number | null
  take_profit_2: number | null
  take_profit_3: number | null
  source_url: string | null
  notes: string | null
}

export interface ChartOverlayLevel {
  symbol: string
  idea_id: string | null
  level_type: string  // entry_min | entry_max | stop_loss | tp1 | tp2 | tp3 | resistance | support
  price: number
  source: string
  label: string | null
}

export interface MarketCandle {
  symbol: string
  interval: string
  ts: string
  open: number | null
  high: number | null
  low: number | null
  close: number | null
  volume: number | null
}

// Per-section freshness roll-up, written by MoneyTrail's run_section.py and
// synced to Supabase. Drives the per-section freshness chips on the dashboard.
export interface SectionStatus {
  section: string
  display_name: string | null
  status: string            // completed | failed | running | skipped
  cadence: string | null    // daily | hourly | weekly | on_demand
  stale_after_hours: number | null
  last_run_at: string | null
  last_ok_at: string | null
  stages: string | null
  records_processed: number | null
  error: string | null
  updated_at: string | null
}

export interface Database {
  public: {
    Tables: {
      persona_positions: { Row: PersonaPosition }
      public_research: { Row: PublicResearch }
      public_lilo: { Row: PublicLilo }
      public_tp_layers: { Row: PublicTpLayer }
      dashboard_snapshots: { Row: DashboardSnapshot }
      macro_regime: { Row: MacroRegimeData }
      symbols: { Row: { symbol: string; asset_name: string | null; asset_class: string | null; last_price: number | null; tradingview_id: string | null } }
      trade_ideas: { Row: TradeIdeaDetail }
      trade_idea_scores: { Row: { idea_id: string; symbol: string; total_score: number | null } }
      trade_idea_levels: { Row: ChartOverlayLevel & { id: string; created_at: string } }
      market_candles: { Row: MarketCandle }
    }
    Views: {
      public_dashboard_summary: { Row: DashboardSummary }
      public_opportunity_watchlist: { Row: PublicOpportunity }
      public_thesis_register: { Row: PublicThesis }
      public_latest_council_runs: { Row: PublicCouncilRun }
      public_persona_positions: { Row: PersonaPosition }
      public_research_library: { Row: ResearchLibraryRow }
      public_engine_health: { Row: EngineHealthRow }
      public_reports: { Row: PublicReport }
      public_llm_health: { Row: LlmHealthRow }
      public_trade_idea_leaderboard: { Row: TradeIdeaLeaderboardRow }
      public_symbol_trade_ideas: { Row: TradeIdeaDetail }
      public_symbol_chart_overlays: { Row: ChartOverlayLevel }
      public_rv_trade_leaderboard: { Row: RvTradeIdea }
      public_rv_trade_history: { Row: RvTradeIdea }
      public_rv_trade_events: { Row: RvTradeEvent }
      public_rv_trade_sync_status: { Row: RvTradeSyncStatus }
      public_opportunity_action_board: { Row: OpportunityAction }
      public_entry_exit_plans: { Row: EntryExitPlan }
      public_opportunity_engine_events: { Row: OpportunityEngineEvent }
      public_rv_trade_macro_fit: { Row: MacroFitRow }
      public_rv_trade_composite: { Row: CompositeRow }
      public_portfolio_actions: { Row: PortfolioActionRow }
      public_portfolio_proposal: { Row: PortfolioProposalRow }
      public_thesis_allocation: { Row: ThesisAllocationRow }
      public_section_status: { Row: SectionStatus }
      public_macro_regime_latest: { Row: MacroRegimeSnapshot }
      public_macro_regime_history: { Row: MacroRegimeSnapshot }
      public_macro_asset_overlays: { Row: MacroAssetOverlay }
      public_macro_data_latest: { Row: MacroDataPoint }
      public_macro_source_status: { Row: MacroSourceStatus }
      public_macro_regional_latest: { Row: MacroRegionalScore }
      public_macro_regional_history: { Row: MacroRegionalScore }
    }
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
