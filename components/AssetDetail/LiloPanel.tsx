import type { PublicLilo, PublicTpLayer } from '@/lib/types'

interface LiloPanelProps {
  lilo: PublicLilo | null
  tpLayers: PublicTpLayer[]
}

function formatPrice(p: number | null | undefined): string {
  if (p == null) return '—'
  if (p > 1000) return `$${p.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  if (p > 1) return `$${p.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  return `$${p.toFixed(4)}`
}

export default function LiloPanel({ lilo, tpLayers }: LiloPanelProps) {
  if (!lilo) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-5">
        <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-3">LILO Plan</div>
        <p className="text-gray-600 text-sm">No LILO plan for this asset yet.</p>
      </div>
    )
  }

  const pendingLayers = tpLayers.filter(l => l.status === 'pending').sort((a, b) => (a.layer_number ?? 0) - (b.layer_number ?? 0))

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-5 space-y-4">
      <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold">LILO Plan</div>

      {/* Position role + allocation split */}
      <div className="flex flex-wrap gap-3 text-sm">
        {lilo.position_role && (
          <div className="rounded-lg bg-gray-800/60 px-3 py-2">
            <div className="text-xs text-gray-500 mb-0.5">Role</div>
            <div className="text-white capitalize font-medium">{lilo.position_role}</div>
          </div>
        )}
        {lilo.aggression_level && (
          <div className="rounded-lg bg-gray-800/60 px-3 py-2">
            <div className="text-xs text-gray-500 mb-0.5">Aggression</div>
            <div className="text-white capitalize font-medium">{lilo.aggression_level}</div>
          </div>
        )}
        {lilo.core_percentage != null && (
          <div className="rounded-lg bg-gray-800/60 px-3 py-2">
            <div className="text-xs text-gray-500 mb-0.5">Core / Tactical / Speculative</div>
            <div className="text-white font-mono text-sm">
              {lilo.core_percentage}% / {lilo.tactical_percentage ?? 0}% / {lilo.speculative_percentage ?? 0}%
            </div>
          </div>
        )}
      </div>

      {/* Entry / Stop */}
      {(lilo.entry_min != null || lilo.entry_max != null || lilo.stop_price != null) && (
        <div className="rounded-lg border border-blue-900 bg-blue-950/20 p-3 space-y-1.5">
          <div className="text-xs text-blue-400 font-semibold uppercase tracking-wide">Entry Plan</div>
          {lilo.entry_min != null && lilo.entry_max != null && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500 text-xs">Entry range:</span>
              <span className="text-white font-mono">{formatPrice(lilo.entry_min)} – {formatPrice(lilo.entry_max)}</span>
            </div>
          )}
          {lilo.stop_price != null && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500 text-xs">Stop:</span>
              <span className="text-red-400 font-mono">{formatPrice(lilo.stop_price)}</span>
            </div>
          )}
          {lilo.risk_per_position_pct != null && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500 text-xs">Risk per position:</span>
              <span className="text-amber-400 font-mono">{lilo.risk_per_position_pct}%</span>
            </div>
          )}
          {lilo.plan_status && (
            <div className="text-xs text-gray-600 capitalize">Status: {lilo.plan_status}</div>
          )}
        </div>
      )}

      {/* Take-profit layers */}
      {pendingLayers.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Take-Profit Layers</div>
          {pendingLayers.map(layer => (
            <div key={layer.id} className="flex items-center gap-3 rounded-lg bg-green-950/20 border border-green-900/40 px-3 py-2">
              <span className="text-xs text-green-500 font-bold font-mono w-6">TP{layer.layer_number}</span>
              <span className="text-white font-mono font-medium">{formatPrice(layer.target_price)}</span>
              {layer.sell_percentage != null && (
                <span className="text-green-400 text-xs">→ sell {layer.sell_percentage}%</span>
              )}
              {layer.reason && (
                <span className="text-gray-500 text-xs ml-auto truncate max-w-[200px]">{layer.reason}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Thesis invalidation */}
      {lilo.thesis_invalidation && (
        <div className="rounded-lg border border-gray-700 bg-gray-800/40 p-3">
          <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">Thesis invalidation</div>
          <p className="text-gray-400 text-xs leading-relaxed">{lilo.thesis_invalidation}</p>
        </div>
      )}
    </div>
  )
}
