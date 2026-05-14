import { createClient } from '@/lib/supabase-server'
import BoardCard from '@/components/BoardCard'
import ThesisTable from '@/components/ThesisTable'
import type { DashboardSnapshot } from '@/lib/types'

export default async function ThesisPage() {
  const supabase = createClient()
  const { data } = await supabase
    .from('dashboard_snapshots')
    .select('thesis_board, generated_at')
    .order('generated_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .single()
  const snap = data as Pick<DashboardSnapshot, 'thesis_board' | 'generated_at'> | null

  const rows = snap?.thesis_board ?? []

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-white">Thesis Board</h1>
      <BoardCard title="Investment Theses" generatedAt={snap?.generated_at}>
        <ThesisTable rows={rows} />
      </BoardCard>
    </div>
  )
}
