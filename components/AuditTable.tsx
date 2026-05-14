import type { AuditRow } from '@/lib/types'

interface AuditTableProps {
  rows: AuditRow[]
}

function categoryBadge(category: string | undefined) {
  const map: Record<string, { label: string; cls: string }> = {
    TP: { label: 'True Positive',  cls: 'text-green-400 bg-green-950/30 border-green-900' },
    TN: { label: 'True Negative',  cls: 'text-blue-400 bg-blue-950/30 border-blue-900' },
    FP: { label: 'False Positive', cls: 'text-red-400 bg-red-950/30 border-red-900' },
    FN: { label: 'False Negative', cls: 'text-amber-400 bg-amber-950/30 border-amber-900' },
  }
  const m = map[category ?? '']
  if (!m) return <span className="text-gray-600 text-xs">—</span>
  return (
    <span className={`text-xs border rounded px-1.5 py-0.5 ${m.cls}`}>{m.label}</span>
  )
}

function outcomePct(v: number | null | undefined) {
  if (v == null) return <span className="text-gray-600">—</span>
  const pct = (v * 100).toFixed(1)
  return (
    <span className={`font-mono font-medium ${v > 0 ? 'text-green-400' : v < 0 ? 'text-red-400' : 'text-gray-400'}`}>
      {v > 0 ? '+' : ''}{pct}%
    </span>
  )
}

export default function AuditTable({ rows }: AuditTableProps) {
  if (!rows || rows.length === 0) {
    return (
      <div className="text-center py-10 text-gray-600 text-sm">
        No decisions aged 30+ days yet — check back after first month
      </div>
    )
  }

  const sorted = [...rows].sort((a, b) =>
    new Date(b.decision_date).getTime() - new Date(a.decision_date).getTime()
  )

  return (
    <div className="overflow-x-auto -mx-5">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-500 text-xs uppercase tracking-wide border-b border-gray-800">
            <th className="text-left pl-5 pr-3 py-2">Asset</th>
            <th className="text-left px-3 py-2">Date</th>
            <th className="text-right px-3 py-2">Score</th>
            <th className="text-left px-3 py-2">Decision</th>
            <th className="text-right px-3 py-2">30d</th>
            <th className="text-right px-3 py-2">90d</th>
            <th className="text-left px-3 py-2 pr-5">Category</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/50">
          {sorted.map((row, i) => (
            <tr key={`${row.asset}-${row.decision_date}-${i}`} className="hover:bg-gray-800/20 transition-colors">
              <td className="pl-5 pr-3 py-3 font-mono font-bold text-white">{row.asset}</td>
              <td className="px-3 py-3 text-gray-400 text-xs">
                {row.decision_date ? new Date(row.decision_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '—'}
              </td>
              <td className="text-right px-3 py-3 font-mono text-gray-300">{row.score?.toFixed(0) ?? '—'}</td>
              <td className="px-3 py-3 capitalize text-gray-400">{row.decision ?? '—'}</td>
              <td className="text-right px-3 py-3">{outcomePct(row.outcome_30d)}</td>
              <td className="text-right px-3 py-3">{outcomePct(row.outcome_90d)}</td>
              <td className="px-3 py-3 pr-5">{categoryBadge(row.category)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
