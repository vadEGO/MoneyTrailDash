import type { PublicLilo } from '@/lib/types'

interface DcaPanelProps {
  lilo: PublicLilo | null
}

function formatPrice(p: number | null | undefined): string {
  if (p == null) return '—'
  if (p > 1000) return `$${p.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  if (p > 1) return `$${p.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  return `$${p.toFixed(4)}`
}

function computeDcaLevels(lilo: PublicLilo): number[] {
  if (lilo.entry_min == null || lilo.entry_max == null) return []

  const { entry_min, entry_max, aggression_level } = lilo

  // Number of DCA entries depends on aggression
  const countMap: Record<string, number> = {
    conservative: 5,
    moderate:     3,
    aggressive:   2,
  }
  const count = countMap[aggression_level?.toLowerCase() ?? ''] ?? 3

  if (count === 1) return [entry_min]
  const step = (entry_max - entry_min) / (count - 1)
  return Array.from({ length: count }, (_, i) => entry_max - i * step)
}

export default function DcaPanel({ lilo }: DcaPanelProps) {
  if (!lilo || (lilo.entry_min == null && lilo.entry_max == null)) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-5">
        <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-3">DCA Plan</div>
        <p className="text-gray-600 text-sm">No entry levels defined yet.</p>
      </div>
    )
  }

  const levels = computeDcaLevels(lilo)

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-5 space-y-4">
      <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold">DCA Entry Plan</div>

      <div className="text-xs text-gray-500">
        Entry range: <span className="text-white font-mono">{formatPrice(lilo.entry_min)} – {formatPrice(lilo.entry_max)}</span>
        {lilo.aggression_level && <span className="ml-2 capitalize text-gray-600">({lilo.aggression_level} mode)</span>}
      </div>

      <div className="space-y-2">
        {levels.map((price, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg bg-blue-950/20 border border-blue-900/30 px-3 py-2">
            <span className="text-xs text-blue-500 font-bold font-mono w-8">#{i + 1}</span>
            <span className="text-white font-mono font-medium">{formatPrice(price)}</span>
            <span className="text-blue-400 text-xs ml-auto">
              {levels.length > 1 ? `${Math.round(100 / levels.length)}% allocation` : 'Full position'}
            </span>
          </div>
        ))}
      </div>

      <p className="text-gray-600 text-xs">
        DCA levels computed from entry range and aggression setting.
        Adjust in MoneyTrail config for precise levels.
      </p>
    </div>
  )
}
