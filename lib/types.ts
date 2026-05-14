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
  strength: number
  lifecycle_stage: string
  crowding_score: number
  top_expressions: Array<{ symbol: string; score: number }>
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
}

export interface Database {
  public: {
    Tables: {
      persona_positions: { Row: PersonaPosition }
      public_research: { Row: PublicResearch }
      public_lilo: { Row: PublicLilo }
      public_tp_layers: { Row: PublicTpLayer }
      dashboard_snapshots: { Row: DashboardSnapshot }
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
    }
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
