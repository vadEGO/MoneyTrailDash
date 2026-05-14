import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import StatusChip from '@/components/ui/StatusChip'
import { getTheses, pct } from '@/lib/openclaw'

export default async function ThesesPage() {
  const theses = await getTheses(50)

  return (
    <div>
      <PageHeader
        title="Thesis Register"
        subtitle="Evolving OpenClaw belief register with confidence movement."
      />

      {theses.length === 0 ? (
        <Card><div className="px-4 py-12 text-center text-ink-3 text-sm">No theses synced yet</div></Card>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {theses.map(thesis => (
            <Card key={thesis.id} title={thesis.status ?? 'research'}>
              <div className="p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h3 className="text-md font-semibold text-ink leading-tight">{thesis.topic}</h3>
                  <div className="text-right">
                    <div className="font-mono text-lg font-bold text-ink">{pct(thesis.confidence)}</div>
                    <div className="text-2xs text-ink-3">{thesis.confidence_movement ?? 'new'}</div>
                  </div>
                </div>
                <p className="text-sm text-ink-2 leading-relaxed line-clamp-4">{thesis.core_reasoning}</p>
                <div className="mt-3 flex items-center gap-2">
                  <StatusChip label={thesis.decision_state ?? 'research'} variant="blue" />
                  <span className="text-xs text-ink-3 truncate">{thesis.next_step}</span>
                </div>
                {(thesis.invalidation_conditions ?? []).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="text-2xs font-semibold tracking-widest text-ink-3 uppercase mb-1">Change View If</div>
                    <ul className="text-xs text-ink-3 space-y-1">
                      {(thesis.invalidation_conditions ?? []).slice(0, 3).map(item => <li key={item}>◇ {item}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

