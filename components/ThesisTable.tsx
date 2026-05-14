import Link from 'next/link'
import type { ThesisBoardRow } from '@/lib/types'

interface ThesisTableProps {
  rows: ThesisBoardRow[]
}

function lifecycleColor(stage: string) {
  const map: Record<string, string> = {
    accumulating: 'text-green-400',
    expansion: 'text-green-300',
    crowded: 'text-amber-400',
    distribution: 'text-amber-500',
    declining: 'text-red-400',
    recovering: 'text-blue-400',
  }
  return map[stage?.toLowerCase()] ?? 'text-gray-400'
}

export default function ThesisTable({ rows }: ThesisTableProps) {
  if (!rows || rows.length === 0) {
    return <div className="text-center py-10 text-gray-600 text-sm">No thesis data</div>
  }

  return (
    <div className="overflow-x-auto -mx-5">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-500 text-xs uppercase tracking-wide border-b border-gray-800">
            <th className="text-left pl-5 pr-3 py-2">Thesis</th>
            <th className="text-right px-3 py-2">Strength</th>
            <th className="text-left px-3 py-2">Lifecycle</th>
            <th className="text-right px-3 py-2">Crowding</th>
            <th className="text-left px-3 py-2 pr-5">Top Expressions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/50">
          {rows.map(row => (
            <tr key={row.thesis} className="hover:bg-gray-800/20 transition-colors">
              <td className="pl-5 pr-3 py-3 font-semibold text-white capitalize">
                {row.thesis?.replace('_', ' ') ?? '—'}
              </td>
              <td className="text-right px-3 py-3">
                <span className={`font-mono font-bold ${(row.strength ?? 0) >= 70 ? 'text-green-400' : (row.strength ?? 0) >= 50 ? 'text-amber-400' : 'text-gray-400'}`}>
                  {row.strength?.toFixed(0) ?? '—'}
                </span>
              </td>
              <td className="px-3 py-3">
                <span className={`capitalize font-medium ${lifecycleColor(row.lifecycle_stage)}`}>
                  {row.lifecycle_stage ?? '—'}
                </span>
              </td>
              <td className="text-right px-3 py-3">
                <span className={`font-mono ${(row.crowding_score ?? 0) > 70 ? 'text-red-400' : 'text-gray-400'}`}>
                  {row.crowding_score?.toFixed(0) ?? '—'}
                </span>
              </td>
              <td className="px-3 py-3 pr-5">
                <div className="flex gap-2 flex-wrap">
                  {row.top_expressions?.slice(0, 3).map((expr, i) => (
                    <Link
                      key={expr.symbol}
                      href={`/asset/${expr.symbol}`}
                      className="text-xs font-mono text-blue-400 hover:text-blue-300 border border-blue-900 rounded px-1.5 py-0.5 hover:border-blue-700 transition-colors"
                    >
                      {i + 1}. {expr.symbol}
                      <span className="text-gray-600 ml-1">({expr.score?.toFixed(0)})</span>
                    </Link>
                  ))}
                  {(!row.top_expressions || row.top_expressions.length === 0) && (
                    <span className="text-gray-600">—</span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
