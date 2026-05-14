import type { PublicResearch } from '@/lib/types'
import StatusBadge from '@/components/StatusBadge'

interface ResearchSummaryProps {
  research: PublicResearch | null
}

export default function ResearchSummary({ research }: ResearchSummaryProps) {
  if (!research) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-5">
        <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-3">Research</div>
        <p className="text-gray-600 text-sm">No research pack available for this asset yet.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Research Pack</div>
        <div className="flex items-center gap-2">
          {research.final_decision && <StatusBadge status={research.final_decision} />}
          {research.evidence_quality_score != null && (
            <span className="text-xs text-gray-500">
              Evidence: <span className="text-gray-300 font-mono">{research.evidence_quality_score.toFixed(1)}</span>
            </span>
          )}
          {research.thesis_fit_score != null && (
            <span className="text-xs text-gray-500">
              Thesis fit: <span className="text-gray-300 font-mono">{research.thesis_fit_score.toFixed(1)}</span>
            </span>
          )}
        </div>
      </div>

      {research.research_summary && (
        <p className="text-gray-300 text-sm leading-relaxed">{research.research_summary}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {research.bull_case && (
          <div className="rounded-lg border border-green-900 bg-green-950/20 p-3">
            <div className="text-xs text-green-500 font-semibold uppercase tracking-wide mb-1.5">Bull case</div>
            <p className="text-green-300/80 text-xs leading-relaxed">{research.bull_case}</p>
          </div>
        )}
        {research.bear_case && (
          <div className="rounded-lg border border-red-900 bg-red-950/20 p-3">
            <div className="text-xs text-red-500 font-semibold uppercase tracking-wide mb-1.5">Bear case</div>
            <p className="text-red-300/80 text-xs leading-relaxed">{research.bear_case}</p>
          </div>
        )}
      </div>

      {research.risks && (
        <div className="rounded-lg border border-amber-900 bg-amber-950/10 p-3">
          <div className="text-xs text-amber-500 font-semibold uppercase tracking-wide mb-1.5">Risks</div>
          <p className="text-amber-300/70 text-xs leading-relaxed">{research.risks}</p>
        </div>
      )}

      {research.created_at && (
        <div className="text-xs text-gray-600">
          Research as of {new Date(research.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
      )}
    </div>
  )
}
