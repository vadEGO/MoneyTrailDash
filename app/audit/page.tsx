import { createClient } from '@/lib/supabase-server'
import BoardCard from '@/components/BoardCard'
import AuditTable from '@/components/AuditTable'
import type { DashboardSnapshot } from '@/lib/types'

export default async function AuditPage() {
  const supabase = createClient()
  const { data } = await supabase
    .from('dashboard_snapshots')
    .select('model_audit_board, generated_at')
    .order('generated_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .single()
  const snap = data as Pick<DashboardSnapshot, 'model_audit_board' | 'generated_at'> | null

  const rows = snap?.model_audit_board ?? []

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-white">Model Audit Board</h1>
      <BoardCard title="Decision Outcomes" generatedAt={snap?.generated_at}>
        <AuditTable rows={rows} />
      </BoardCard>
    </div>
  )
}
