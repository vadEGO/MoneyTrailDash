import { createClient } from '@/lib/supabase-server'
import type { PublicResearch } from '@/lib/types'
import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import StatusChip from '@/components/ui/StatusChip'
import Link from 'next/link'

function docTypeVariant(level: number | null): { label: string; variant: 'blue' | 'green' | 'red' | 'grey' } {
  if (!level || level <= 1) return { label: 'SIGNAL', variant: 'grey' }
  if (level === 2) return { label: 'QUICK', variant: 'blue' }
  if (level === 3) return { label: 'RESEARCH', variant: 'green' }
  return { label: 'DEEP', variant: 'red' }
}

export default async function LibraryPage() {
  const supabase = createClient()
  const { data: rows } = await supabase
    .from('public_research')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  const research = (rows ?? []) as PublicResearch[]

  const counts = {
    insight: research.filter(r => (r.research_level ?? 0) >= 3).length,
    evidence: research.filter(r => (r.research_level ?? 0) === 2).length,
    claim: research.filter(r => (r.research_level ?? 0) === 1).length,
  }

  return (
    <div>
      <PageHeader
        title="Research Library"
        subtitle={`Showing ${research.length} results`}
        action={
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 border border-border rounded px-3 py-1.5 text-xs text-ink hover:bg-surface-dim transition-colors">
              Sort: Relevance ↕
            </button>
            <button className="flex items-center gap-1.5 border border-border rounded px-3 py-1.5 text-xs text-ink hover:bg-surface-dim transition-colors">
              ⊞
            </button>
          </div>
        }
      />

      <div className="flex gap-6">
        {/* Filters sidebar */}
        <div className="w-48 shrink-0 space-y-4">
          <div>
            <h3 className="text-2xs font-semibold tracking-widest text-ink-3 uppercase mb-2">Document Type</h3>
            <div className="space-y-1.5">
              {[
                { label: `Insight (${counts.insight})`, checked: true },
                { label: `Evidence Pack (${counts.evidence})`, checked: true },
                { label: `Claim (${counts.claim})`, checked: true },
                { label: `Raw Data (${research.length})`, checked: false },
              ].map(f => (
                <label key={f.label} className="flex items-center gap-2 text-sm text-ink cursor-pointer">
                  <input type="checkbox" defaultChecked={f.checked} className="rounded-sm border-border" />
                  {f.label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-2xs font-semibold tracking-widest text-ink-3 uppercase mb-2">Materiality Level</h3>
            <div className="space-y-1.5">
              {['Critical', 'High', 'Moderate'].map(l => (
                <label key={l} className="flex items-center gap-2 text-sm text-ink cursor-pointer">
                  <input type="checkbox" defaultChecked={l !== 'Critical'} className="rounded-sm border-border" />
                  <span className="dot-red w-1.5 h-1.5 rounded-full" style={{ background: l === 'Critical' ? '#e02424' : l === 'High' ? '#d97706' : '#059669' }} />
                  {l}
                </label>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-2xs font-semibold tracking-widest text-ink-3 uppercase mb-2">Recency</h3>
            <select className="w-full border border-border rounded px-2 py-1.5 text-xs text-ink bg-surface focus:outline-none focus:border-black">
              <option>Past 30 Days</option>
              <option>Past 90 Days</option>
              <option>All Time</option>
            </select>
          </div>
        </div>

        {/* Results grid */}
        <div className="flex-1">
          {research.length === 0 ? (
            <Card>
              <div className="px-6 py-16 text-center">
                <div className="text-4xl mb-3">📚</div>
                <div className="text-md font-semibold text-ink mb-1">Library is empty</div>
                <p className="text-sm text-ink-3">Run the MoneyTrail pipeline to generate research packs.</p>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {research.map(r => {
                const dt = docTypeVariant(r.research_level)
                const confidence = r.evidence_quality_score ?? 0
                return (
                  <Link key={r.id} href={`/asset/${r.symbol ?? r.asset}`}>
                    <div className={`border rounded bg-surface p-4 hover:border-black transition-colors h-full ${dt.variant === 'red' ? 'border-l-2 border-l-status-red' : 'border-border'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <StatusChip label={dt.label} variant={dt.variant} />
                        <span className="text-2xs font-mono text-ink-3">ID: {r.id.slice(-6).toUpperCase()}</span>
                      </div>
                      <h3 className="text-sm font-semibold text-ink mb-1 line-clamp-2">
                        {r.asset || r.symbol} — {r.research_summary ? r.research_summary.slice(0, 60) + '…' : 'Research pack'}
                      </h3>
                      <p className="text-xs text-ink-3 line-clamp-2 mb-3">
                        {r.research_summary ?? 'No summary available.'}
                      </p>
                      <div className="flex items-center justify-between">
                        {confidence > 0 && (
                          <>
                            <div className="flex-1 h-0.5 bg-border mr-2 rounded-full overflow-hidden">
                              <div className="h-full bg-black rounded-full" style={{ width: `${confidence * 10}%` }} />
                            </div>
                            <span className="text-2xs font-mono text-ink-3">{(confidence * 10).toFixed(0)}% Confidence</span>
                          </>
                        )}
                        <div className="flex gap-1 ml-2">
                          {r.asset_type && (
                            <span className="text-2xs bg-blue-50 text-status-blue px-1.5 py-0.5 rounded-sm">{r.asset_type}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
