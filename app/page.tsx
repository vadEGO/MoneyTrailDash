import { createClient } from '@/lib/supabase-server'
import HeatIndicator from '@/components/HeatIndicator'
import SignalRadarTable from '@/components/SignalRadarTable'
import type { DashboardSnapshot } from '@/lib/types'
import Link from 'next/link'

async function getLatestSnapshot(): Promise<DashboardSnapshot | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('dashboard_snapshots')
    .select('*')
    .order('generated_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .single()
  return data ?? null
}

function PipelineBanner({ snap }: { snap: DashboardSnapshot }) {
  const { currently_running, generated_at, pipeline_status } = snap

  if (currently_running && generated_at) {
    const ageMs = Date.now() - new Date(generated_at).getTime()
    if (ageMs > 2 * 60 * 60 * 1000) {
      return (
        <div className="rounded-lg border border-red-800 bg-red-950/30 px-4 py-3 text-red-400 text-sm mb-6 flex items-center gap-2">
          🔴 <strong>Pipeline appears stuck</strong> — started over 2h ago and has not completed.
          Check <code className="bg-red-950/50 px-1 rounded text-xs">logs/</code> for errors.
        </div>
      )
    }
    return (
      <div className="rounded-lg border border-amber-800 bg-amber-950/20 px-4 py-3 text-amber-400 text-sm mb-6 flex items-center gap-2">
        ⏳ Pipeline is currently running…
      </div>
    )
  }

  const failed = pipeline_status?.stages_failed ?? []
  if (failed.length > 0) {
    return (
      <div className="rounded-lg border border-red-800 bg-red-950/30 px-4 py-3 text-red-400 text-sm mb-6">
        ❌ <strong>Stages failed:</strong> {failed.join(', ')}
      </div>
    )
  }

  return null
}

export default async function CockpitPage() {
  const snap = await getLatestSnapshot()

  if (!snap) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
        <div className="text-gray-600 text-6xl mb-4">📊</div>
        <h1 className="text-2xl font-bold text-white mb-2">Pipeline not yet run</h1>
        <p className="text-gray-500 text-sm max-w-sm">
          Run <code className="bg-gray-800 px-1.5 py-0.5 rounded text-xs">python scripts/run_daily.py</code> in MoneyTrail
          to populate the dashboard.
        </p>
      </div>
    )
  }

  const topSignals = (snap.signal_radar ?? [])
    .sort((a, b) => b.signal_score - a.signal_score)
    .slice(0, 5)

  const pendingCount = snap.pending_approvals?.length ?? 0

  return (
    <div className="space-y-6">
      <PipelineBanner snap={snap} />

      {/* Header row */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white">Command Cockpit</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {snap.generated_at
              ? `Last updated ${new Date(snap.generated_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`
              : 'No timestamp'}
          </p>
        </div>
        {pendingCount > 0 && (
          <div className="rounded-lg border border-amber-800 bg-amber-950/20 px-4 py-2 text-sm text-amber-400 flex items-center gap-2">
            ⚠️ <strong>{pendingCount}</strong> pending approval{pendingCount > 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Portfolio heat */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-6">
        <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-4">Portfolio Heat</div>
        {snap.portfolio_heat ? (
          <HeatIndicator
            score={snap.portfolio_heat.score}
            status={snap.portfolio_heat.status}
            blockedActions={snap.portfolio_heat.blocked_actions}
          />
        ) : (
          <div className="text-gray-600 text-sm">No heat data</div>
        )}
      </div>

      {/* Top signals preview */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/60">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white tracking-wide uppercase">Top Signals Today</h2>
          <Link href="/signals" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
            View all →
          </Link>
        </div>
        <div className="p-5">
          {topSignals.length > 0 ? (
            <SignalRadarTable rows={topSignals} generatedAt={snap.generated_at} />
          ) : (
            <div className="text-gray-600 text-sm text-center py-6">No signals above threshold</div>
          )}
        </div>
      </div>

      {/* Board nav cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { href: '/signals', label: 'Signal Radar', count: snap.signal_radar?.length, icon: '📡' },
          { href: '/thesis',  label: 'Thesis Board', count: snap.thesis_board?.length, icon: '🎯' },
          { href: '/audit',   label: 'Model Audit',  count: snap.model_audit_board?.length, icon: '📋' },
        ].map(card => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-xl border border-gray-800 bg-gray-900/40 px-4 py-4 hover:border-gray-600 hover:bg-gray-900/60 transition-all group"
          >
            <div className="text-2xl mb-2">{card.icon}</div>
            <div className="text-white font-semibold text-sm group-hover:text-blue-400 transition-colors">{card.label}</div>
            {card.count != null && (
              <div className="text-gray-500 text-xs mt-0.5">{card.count} rows</div>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}
