// TypeScript types mirroring Supabase tables and dashboard_data.json shape

// --- dashboard_data.json sub-types ---

export interface PortfolioHeat {
  score: number
  status: 'green' | 'amber' | 'red'
  color?: string
  blocked_actions?: string[]
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

export interface TradeabilityRow {
  asset: string
  symbol: string
  venue: string
  market_type: string
  tradeable: boolean
  volume_24h?: number
  open_interest?: number
  spread_bps?: number
  status: string
  last_checked?: string
}

export interface ThesisBoardRow {
  thesis: string
  strength: number
  lifecycle_stage: string
  crowding_score: number
  top_expressions: Array<{ symbol: string; score: number }>
}

export interface LiloBoardRow {
  asset: string
  symbol: string
  position_role: string
  lilo_mode?: string
  current_action?: string
  next_layer?: string  // e.g. "Add: -25% from $X" or "TP1: +40% → sell 15%"
}

export interface AllocationRow {
  allocation_name: string
  return_ytd?: number
  cagr?: number
  max_drawdown?: number
  volatility?: number
  thesis_fit?: number
  score?: number
}

export interface AuditRow {
  asset: string
  decision_date: string
  score: number
  decision: string
  outcome_30d?: number
  outcome_90d?: number
  category?: 'TP' | 'TN' | 'FP' | 'FN'
}

export interface PendingApproval {
  asset: string
  action: string
  size_pct?: number
  entry_price?: number
  thesis?: string
  created_at: string
}

export interface PipelineStatus {
  last_run?: string
  stages_failed?: string[]
  next_scheduled?: string
  currently_running?: boolean
}

// --- Supabase table rows ---

export interface DashboardSnapshot {
  id: string
  generated_at: string | null
  currently_running: boolean
  portfolio_heat: PortfolioHeat | null
  signal_radar: SignalRadarRow[] | null
  tradeability_board: TradeabilityRow[] | null
  thesis_board: ThesisBoardRow[] | null
  lilo_board: LiloBoardRow[] | null
  allocation_board: AllocationRow[] | null
  model_audit_board: AuditRow[] | null
  pending_approvals: PendingApproval[] | null
  pipeline_status: PipelineStatus | null
  synced_at: string
}

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

// Minimal Database interface for typed Supabase client
export interface Database {
  public: {
    Tables: {
      dashboard_snapshots: { Row: DashboardSnapshot }
      public_research: { Row: PublicResearch }
      public_lilo: { Row: PublicLilo }
      public_tp_layers: { Row: PublicTpLayer }
      symbols: { Row: { symbol: string; asset_name: string | null; asset_class: string | null; last_price: number | null; tradingview_id: string | null } }
      trade_ideas: { Row: TradeIdeaDetail }
      trade_idea_scores: { Row: { idea_id: string; symbol: string; total_score: number | null } }
      trade_idea_levels: { Row: ChartOverlayLevel & { id: string; created_at: string } }
      market_candles: { Row: MarketCandle }
    }
    Views: {
      public_trade_idea_leaderboard: { Row: TradeIdeaLeaderboardRow }
      public_symbol_trade_ideas: { Row: TradeIdeaDetail }
      public_symbol_chart_overlays: { Row: ChartOverlayLevel }
    }
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
