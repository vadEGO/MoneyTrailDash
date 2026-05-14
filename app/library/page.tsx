import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import StatusChip from '@/components/ui/StatusChip'
import { getResearchLibrary } from '@/lib/openclaw'

export default async function LibraryPage() {
  const rows = await getResearchLibrary(100)
  const counts = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.record_type] = (acc[row.record_type] ?? 0) + 1
    return acc
  }, {})

  return (
    <div>
      <PageHeader
        title="Research Library"
        subtitle={`${rows.length} public-redacted records`}
      />

      <div className="grid grid-cols-4 gap-3 mb-4">
        {Object.entries({ Claims: counts.claim ?? 0, Insights: counts.insight ?? 0, Evidence: counts.evidence_pack ?? 0, Reports: counts.morning_brief ?? 0 }).map(([label, value]) => (
          <div key={label} className="bg-surface border border-border rounded p-4">
            <div className="text-2xs font-semibold tracking-widest text-ink-3 uppercase mb-2">{label}</div>
            <div className="font-mono text-lg font-bold text-ink">{value}</div>
          </div>
        ))}
      </div>

      <Card>
        <div className="grid grid-cols-2 gap-3 p-3">
          {rows.length === 0 ? (
            <div className="col-span-2 px-4 py-12 text-center text-sm text-ink-3">No public research records synced yet</div>
          ) : rows.map(row => (
            <div key={`${row.record_type}-${row.id}`} className="border border-border rounded bg-surface p-4">
              <div className="flex items-center gap-2 mb-2">
                <StatusChip label={row.record_type} variant={variant(row.record_type)} />
                <span className="text-2xs font-mono text-ink-3">{row.materiality ?? row.research_priority ?? 'public'}</span>
              </div>
              <h3 className="text-sm font-semibold text-ink mb-1 line-clamp-2">{row.title}</h3>
              <p className="text-xs text-ink-3 line-clamp-3">{row.summary ?? 'No summary available.'}</p>
              <div className="mt-3 text-2xs text-ink-3">{row.topic}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function variant(type: string): 'red' | 'amber' | 'green' | 'blue' | 'purple' | 'grey' {
  if (type === 'claim') return 'grey'
  if (type === 'insight') return 'blue'
  if (type === 'evidence_pack') return 'green'
  if (type.includes('report')) return 'purple'
  return 'grey'
}

