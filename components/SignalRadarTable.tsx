import Link from 'next/link'
import type { SignalRadarRow } from '@/lib/types'

interface SignalRadarTableProps {
  rows: SignalRadarRow[]
  generatedAt?: string | null
}

function sentimentColor(s: string) {
  if (s === 'bullish') return 'text-green-400'
  if (s === 'bearish') return 'text-red-400'
  if (s === 'mixed') return 'text-amber-400'
  return 'text-gray-400'
}

function priorityBadge(p: string) {
  const map: Record<string, string> = {
    level_4: 'bg-green-950/40 text-green-400 border-green-900',
    level_3: 'bg-blue-950/40 text-blue-400 border-blue-900',
    level_2: 'bg-amber-950/40 text-amber-400 border-amber-900',
    watchlist: 'bg-gray-800 text-gray-400 border-gray-700',
    log_only: 'bg-gray-900 text-gray-600 border-gray-800',
  }
  return map[p] ?? 'bg-gray-800 text-gray-500 border-gray-700'
}

export default function SignalRadarTable({ rows, generatedAt }: SignalRadarTableProps) {
  if (!rows || rows.length === 0) {
    return (
      <div className="text-center py-10 text-gray-600 text-sm">
        No signals above threshold
        {generatedAt ? ` — pipeline ran at ${new Date(generatedAt).toLocaleTimeString()}` : ''}
      </div>
    )
  }

  const sorted = [...rows].sort((a, b) => b.signal_score - a.signal_score)

  return (
    <div className="overflow-x-auto -mx-5">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-500 text-xs uppercase tracking-wide border-b border-gray-800">
            <th className="text-left pl-5 pr-3 py-2">Asset</th>
            <th className="text-right px-3 py-2">Score</th>
            <th className="text-right px-3 py-2">Mentions</th>
            <th className="text-right px-3 py-2">Sources</th>
            <th className="text-left px-3 py-2">Sentiment</th>
            <th className="text-left px-3 py-2">Priority</th>
            <th className="text-left px-3 py-2 pr-5">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/50">
          {sorted.map(row => (
            <tr
              key={row.symbol}
              className="hover:bg-gray-800/30 transition-colors cursor-pointer group"
            >
              <td className="pl-5 pr-3 py-3">
                <Link href={`/asset/${row.symbol}`} className="flex items-center gap-2">
                  <span className="font-mono font-bold text-white group-hover:text-blue-400 transition-colors">
                    {row.symbol}
                  </span>
                  {row.asset && row.asset !== row.symbol && (
                    <span className="text-gray-500 text-xs">{row.asset}</span>
                  )}
                </Link>
              </td>
              <td className="text-right px-3 py-3">
                <span className={`font-mono font-bold ${row.signal_score >= 70 ? 'text-green-400' : row.signal_score >= 50 ? 'text-amber-400' : 'text-gray-400'}`}>
                  {row.signal_score?.toFixed(0) ?? '—'}
                </span>
              </td>
              <td className="text-right px-3 py-3 text-gray-400 font-mono">
                {row.mention_count ?? '—'}
              </td>
              <td className="text-right px-3 py-3 text-gray-400 font-mono">
                {row.source_count ?? '—'}
              </td>
              <td className="px-3 py-3">
                <span className={`font-medium capitalize ${sentimentColor(row.sentiment)}`}>
                  {row.sentiment ?? '—'}
                </span>
              </td>
              <td className="px-3 py-3">
                <span className={`text-xs border rounded px-1.5 py-0.5 ${priorityBadge(row.research_priority)}`}>
                  {row.research_priority?.replace('_', ' ') ?? '—'}
                </span>
              </td>
              <td className="px-3 py-3 pr-5 text-gray-500 text-xs capitalize">
                {row.status?.replace('_', ' ') ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
