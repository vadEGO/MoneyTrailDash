import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import StatusChip from '@/components/ui/StatusChip'
import FreshnessChip from '@/components/FreshnessChip'
import {
  getCouncilRuns,
  getPersonaPositions,
  getResearchLibrary,
  getTheses,
  pct,
} from '@/lib/openclaw'

// Research — the single reading surface for the reasoning behind the funnel.
// It folds together what used to be three separate boards (Council, Theses,
// Library) into one scannable page: the latest council consensus, the live
// belief register, and the public research record. Per-idea research is reached
// from the IdeaDrawer; this page is the shared / cross-idea view.
export default async function ResearchPage() {
  const [runs, theses, library] = await Promise.all([
    getCouncilRuns(6),
    getTheses(20),
    getResearchLibrary(60),
  ])
  const current = runs[0]
  const personas = current ? await getPersonaPositions(current.id) : []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Research"
        subtitle="The reasoning behind the funnel — council consensus, the belief register, and the public research record."
        status={current ? (
          <span className="inline-flex items-center gap-2">
            <StatusChip label={current.decision_state ?? 'research'} variant="blue" />
            <FreshnessChip label="council" at={current.created_at} />
          </span>
        ) : undefined}
      />

      {/* ── Latest council consensus ──────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-2xs font-semibold tracking-widest text-ink-3 uppercase">Latest Council</h2>
        {!current ? (
          <Card><div className="px-6 py-10 text-center text-sm text-ink-3">No council runs synced yet</div></Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <Card title="Consensus View" action={<span className="font-mono text-2xs">{pct(current.confidence)} confidence</span>}>
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-ink mb-2">{current.topic}</h3>
                  <p className="text-sm text-ink-2 leading-relaxed">{current.consensus_view}</p>
                  {current.recommended_next_step && (
                    <div className="mt-3 bg-surface-dim rounded p-3 text-xs text-ink-3">
                      <strong className="text-ink">Next:</strong> {current.recommended_next_step}
                    </div>
                  )}
                </div>
              </Card>

              {personas.length > 0 && (
                <Card title="Persona Positions">
                  <div className="divide-y divide-border">
                    {personas.map(persona => (
                      <div key={persona.id} className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <div className="text-sm font-semibold text-ink capitalize">{persona.persona.replace(/_/g, ' ')}</div>
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
              )}
            </div>

            <div className="space-y-4">
              <ListCard title="Agreements" items={current.agreements ?? []} />
              <ListCard title="Disagreements" items={current.disagreements ?? []} />
              <ListCard title="Change Mind If" items={current.what_would_change_our_mind ?? []} />
            </div>
          </div>
        )}
      </section>

      {/* ── Belief register ───────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-2xs font-semibold tracking-widest text-ink-3 uppercase">Belief Register</h2>
        {theses.length === 0 ? (
          <Card><div className="px-4 py-10 text-center text-ink-3 text-sm">No theses synced yet</div></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {theses.map(thesis => (
              <Card key={thesis.id} title={thesis.status ?? 'research'}>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <h3 className="text-md font-semibold text-ink leading-tight">{thesis.topic}</h3>
                    <div className="text-right shrink-0">
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
      </section>

      {/* ── Research library ──────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-2xs font-semibold tracking-widest text-ink-3 uppercase">Library</h2>
        <Card>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3">
            {library.length === 0 ? (
              <div className="col-span-2 px-4 py-10 text-center text-sm text-ink-3">No public research records synced yet</div>
            ) : library.map(row => (
              <div key={`${row.record_type}-${row.id}`} className="border border-border rounded bg-surface p-4">
                <div className="flex items-center gap-2 mb-2">
                  <StatusChip label={row.record_type} variant={libVariant(row.record_type)} />
                  <span className="text-2xs font-mono text-ink-3">{row.materiality ?? row.research_priority ?? 'public'}</span>
                </div>
                <h3 className="text-sm font-semibold text-ink mb-1 line-clamp-2">{row.title}</h3>
                <p className="text-xs text-ink-3 line-clamp-3">{row.summary ?? 'No summary available.'}</p>
                {row.topic && <div className="mt-3 text-2xs text-ink-3">{row.topic}</div>}
              </div>
            ))}
          </div>
        </Card>
      </section>
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

function libVariant(type: string): 'red' | 'amber' | 'green' | 'blue' | 'purple' | 'grey' {
  if (type === 'insight') return 'blue'
  if (type === 'evidence_pack') return 'green'
  if (type.includes('report')) return 'purple'
  return 'grey'
}
