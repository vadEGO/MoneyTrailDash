import StatusChip from '@/components/ui/StatusChip'
import { CORE_SECTIONS, sectionHealth } from '@/lib/pipeline-health'
import { formatAge } from '@/lib/fmt'
import type { SectionStatus } from '@/lib/types'

export default function PipelineStatus({ sections }: { sections: Record<string, SectionStatus> }) {
  return (
    <section aria-label="Pipeline freshness" className="border border-border rounded bg-surface mb-4 p-4">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-sm font-semibold text-ink">Data → analysis → dashboard</h2>
        <a href="/health" className="text-xs underline text-ink-3">Pipeline details</a>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {CORE_SECTIONS.map(key => {
          const row = sections[key]
          const state = sectionHealth(row)
          return <div key={key}>
            <div className="text-xs text-ink-2 mb-1">{row?.display_name ?? key.replaceAll('_', ' ')}</div>
            <StatusChip {...state} />
            <div className="text-2xs text-ink-3 mt-1">Last good: {formatAge(row?.last_ok_at)}</div>
          </div>
        })}
      </div>
      <p className="text-2xs text-ink-3 mt-3">Each section has its own freshness clock. A dashboard publish does not refresh the underlying research.</p>
    </section>
  )
}
