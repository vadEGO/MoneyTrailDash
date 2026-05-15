import { createClient } from '@/lib/supabase-server'
import type {
  DashboardSummary,
  EngineHealthRow,
  LlmHealthRow,
  PersonaPosition,
  PublicCouncilRun,
  PublicOpportunity,
  PublicReport,
  PublicThesis,
  ResearchLibraryRow,
} from '@/lib/types'

function hasSupabaseConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
}

export async function getDashboardSummary(): Promise<DashboardSummary | null> {
  if (!hasSupabaseConfig()) return null
  const supabase = createClient()
  const { data } = await supabase.from('public_dashboard_summary').select('*').single()
  return data ?? null
}

export async function getOpportunities(limit = 20): Promise<PublicOpportunity[]> {
  if (!hasSupabaseConfig()) return []
  const supabase = createClient()
  const { data } = await supabase
    .from('public_opportunity_watchlist')
    .select('*')
    .order('rank', { ascending: true })
    .limit(limit)
  return data ?? []
}

export async function getTheses(limit = 20): Promise<PublicThesis[]> {
  if (!hasSupabaseConfig()) return []
  const supabase = createClient()
  const { data } = await supabase
    .from('public_thesis_register')
    .select('*')
    .order('confidence', { ascending: false, nullsFirst: false })
    .limit(limit)
  return data ?? []
}

export async function getCouncilRuns(limit = 10): Promise<PublicCouncilRun[]> {
  if (!hasSupabaseConfig()) return []
  const supabase = createClient()
  const { data } = await supabase
    .from('public_latest_council_runs')
    .select('*')
    .order('created_at', { ascending: false, nullsFirst: false })
    .limit(limit)
  return data ?? []
}

export async function getPersonaPositions(councilRunId: string): Promise<PersonaPosition[]> {
  if (!hasSupabaseConfig()) return []
  const supabase = createClient()
  const { data } = await supabase
    .from('public_persona_positions')
    .select('*')
    .eq('council_run_id', councilRunId)
    .order('persona', { ascending: true })
  return data ?? []
}

export async function getResearchLibrary(limit = 80): Promise<ResearchLibraryRow[]> {
  if (!hasSupabaseConfig()) return []
  const supabase = createClient()
  const { data } = await supabase
    .from('public_research_library')
    .select('*')
    .order('created_at', { ascending: false, nullsFirst: false })
    .limit(limit)
  return data ?? []
}

export async function getEngineHealth(limit = 20): Promise<EngineHealthRow[]> {
  if (!hasSupabaseConfig()) return []
  const supabase = createClient()
  const { data } = await supabase
    .from('public_engine_health')
    .select('*')
    .limit(limit)
  return data ?? []
}

export async function getReports(limit = 20): Promise<PublicReport[]> {
  if (!hasSupabaseConfig()) return []
  const supabase = createClient()
  const { data } = await supabase
    .from('public_reports')
    .select('*')
    .order('report_date', { ascending: false, nullsFirst: false })
    .limit(limit)
  return data ?? []
}

export async function getLlmHealth(limit = 14): Promise<LlmHealthRow[]> {
  if (!hasSupabaseConfig()) return []
  const supabase = createClient()
  const { data } = await supabase
    .from('public_llm_health')
    .select('*')
    .limit(limit)
  return data ?? []
}

export function formatAge(iso?: string | null) {
  if (!iso) return 'Never synced'
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export function pct(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return `${Math.round(Number(value) * 100)}%`
}
