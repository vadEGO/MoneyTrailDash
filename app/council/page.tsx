import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import StatusChip from '@/components/ui/StatusChip'
import { getCouncilRuns, getPersonaPositions, pct } from '@/lib/openclaw'

export default async function CouncilPage() {
  const runs = await getCouncilRuns(10)
  const current = runs[0]
  const personas = current ? await getPersonaPositions(current.id) : []

  return (
    <div>
      <PageHeader
        title="Council Room"
        subtitle="Multi-persona deliberation and consensus decisions."
        status={current ? <StatusChip label={current.decision_state ?? 'research'} variant="blue" /> : undefined}
      />

      {!current ? (
        <Card><div className="px-6 py-16 text-center text-sm text-ink-3">No council runs synced yet</div></Card>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 space-y-4">
            <Card title="Consensus View" action={<span className="font-mono text-2xs">{pct(current.confidence)} confidence</span>}>
              <div className="p-4">
                <h2 className="text-lg font-semibold text-ink mb-2">{current.topic}</h2>
                <p className="text-sm text-ink-2 leading-relaxed">{current.consensus_view}</p>
                <div className="mt-3 bg-surface-dim rounded p-3 text-xs text-ink-3">
                  <strong className="text-ink">Next:</strong> {current.recommended_next_step}
                </div>
              </div>
            </Card>

            <Card title="Persona Positions">
              <div className="divide-y divide-border">
                {personas.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-ink-3">No persona details synced for this run</div>
                ) : personas.map(persona => (
                  <div key={persona.id} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="text-sm font-semibold text-ink capitalize">{persona.persona.replace('_', ' ')}</div>
                        <div className="text-2xs font-mono text-ink-3">{persona.reasoning_mode ?? 'reasoned'}</div>
                      </div>
                      <span className="font-mono text-xs text-ink">{pct(persona.confidence)}</span>
                    </div>
                    <p className="text-sm text-ink-2 leading-relaxed">{persona.thesis}</p>
                    {(persona.counterpoints ?? []).length > 0 && (
                      <div className="mt-2 text-xs text-ink-3">Counterpoint: {(persona.counterpoints ?? [])[0]}</div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <ListCard title="Agreements" items={current.agreements ?? []} />
            <ListCard title="Disagreements" items={current.disagreements ?? []} />
            <ListCard title="Change Mind If" items={current.what_would_change_our_mind ?? []} />
            <ListCard title="Public Constraints" items={current.personal_constraints_public ?? []} />
          </div>
        </div>
      )}
    </div>
  )
}

function ListCard({ title, items }: { title: string; items: string[] }) {
  return (
    <Card title={title}>
      <div className="divide-y divide-border">
        {items.length === 0 ? (
          <div className="px-4 py-4 text-xs text-ink-3">None surfaced</div>
        ) : items.slice(0, 5).map(item => (
          <div key={item} className="px-4 py-3 text-xs text-ink-2">◇ {item}</div>
        ))}
      </div>
    </Card>
  )
}

