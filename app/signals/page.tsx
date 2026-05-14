import { createClient } from '@/lib/supabase-server'
import BoardCard from '@/components/BoardCard'
import SignalRadarTable from '@/components/SignalRadarTable'
import type { DashboardSnapshot } from '@/lib/types'

export default async function SignalsPage() {
  const supabase = createClient()
  const { data } = await supabase
    .from('dashboard_snapshots')
    .select('signal_radar, generated_at')
    .order('generated_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .single()
  const snap = data as Pick<DashboardSnapshot, 'signal_radar' | 'generated_at'> | null

  const rows = snap?.signal_radar ?? []

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-white">Signal Radar</h1>
      <BoardCard title="All Signals" generatedAt={snap?.generated_at}>
        <SignalRadarTable rows={rows} generatedAt={snap?.generated_at} />
      </BoardCard>
    </div>
  )
}
