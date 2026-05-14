interface HeatIndicatorProps {
  score: number | null | undefined
  status: string | null | undefined
  blockedActions?: string[] | null
}

function heatColor(score: number | null | undefined, status: string | null | undefined) {
  if (status === 'red' || (score != null && score > 80)) return 'text-red-400'
  if (status === 'amber' || (score != null && score > 50)) return 'text-amber-400'
  return 'text-green-400'
}

function heatEmoji(status: string | null | undefined) {
  if (status === 'red') return '🔴'
  if (status === 'amber') return '🟡'
  return '🟢'
}

export default function HeatIndicator({ score, status, blockedActions }: HeatIndicatorProps) {
  if (score == null) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <div className="text-6xl font-bold text-gray-700">—</div>
        <div className="text-gray-600 text-sm mt-2">No heat data</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <div className="flex items-center gap-4">
        <span className="text-6xl font-black tabular-nums leading-none" style={{fontVariantNumeric: 'tabular-nums'}}>
          <span className={heatColor(score, status)}>{score}</span>
          <span className="text-gray-600 text-2xl">/100</span>
        </span>
        <div className="flex flex-col">
          <span className="text-3xl">{heatEmoji(status)}</span>
          <span className={`text-sm font-semibold uppercase tracking-wider mt-1 ${heatColor(score, status)}`}>
            {status ?? 'unknown'}
          </span>
        </div>
      </div>
      {blockedActions && blockedActions.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-1">
          {blockedActions.map(action => (
            <span key={action} className="text-xs bg-red-950/40 text-red-400 border border-red-900 rounded px-2 py-0.5">
              🚫 {action.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
