'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import Link from 'next/link'
import type { PublicResearch, PublicLilo, PublicTpLayer, SignalRadarRow, DashboardSnapshot } from '@/lib/types'
import ResearchSummary from '@/components/AssetDetail/ResearchSummary'
import LiloPanel from '@/components/AssetDetail/LiloPanel'
import DcaPanel from '@/components/AssetDetail/DcaPanel'
import StatusBadge from '@/components/StatusBadge'

interface Props {
  params: { symbol: string }
}

export default function AssetDetailPage({ params }: Props) {
  const { symbol } = params
  const [research, setResearch] = useState<PublicResearch | null>(null)
  const [lilo, setLilo] = useState<PublicLilo | null>(null)
  const [tpLayers, setTpLayers] = useState<PublicTpLayer[]>([])
  const [signalRow, setSignalRow] = useState<SignalRadarRow | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function fetchAll() {
      setLoading(true)
      const [researchRes, liloRes, tpRes, snapRes] = await Promise.all([
        supabase.from('public_research').select('*').eq('symbol', symbol).limit(1).single(),
        supabase.from('public_lilo').select('*').eq('asset', symbol).limit(1).single(),
        supabase.from('public_tp_layers').select('*').eq('asset', symbol).order('layer_number'),
        supabase.from('dashboard_snapshots').select('signal_radar').order('generated_at', { ascending: false, nullsFirst: false }).limit(1).single(),
      ])

      setResearch(researchRes.data ?? null)
      setLilo(liloRes.data ?? null)
      setTpLayers(tpRes.data ?? [])

      const snap = snapRes.data as Pick<DashboardSnapshot, 'signal_radar'> | null
      if (snap?.signal_radar) {
        const found = snap.signal_radar.find(r => r.symbol === symbol) ?? null
        setSignalRow(found)
      }

      setLoading(false)
    }

    fetchAll()
  }, [symbol])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-gray-600 text-sm">Loading {symbol}…</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div className="flex items-start gap-4 flex-wrap">
        <div>
          <Link href="/signals" className="text-xs text-gray-500 hover:text-gray-300 transition-colors mb-2 inline-block">
            ← Signal Radar
          </Link>
          <h1 className="text-2xl font-black text-white tracking-tight">
            {symbol}
            {research?.asset && research.asset !== symbol && (
              <span className="text-gray-500 font-normal text-lg ml-2">{research.asset}</span>
            )}
          </h1>
        </div>

        {/* Signal stats */}
        {signalRow && (
          <div className="flex flex-wrap gap-3 text-sm ml-auto">
            <div className="rounded-lg bg-gray-800/60 px-3 py-2">
              <div className="text-xs text-gray-500 mb-0.5">Signal Score</div>
              <div className={`font-mono font-bold ${signalRow.signal_score >= 70 ? 'text-green-400' : signalRow.signal_score >= 50 ? 'text-amber-400' : 'text-gray-400'}`}>
                {signalRow.signal_score?.toFixed(0) ?? '—'}
              </div>
            </div>
            <div className="rounded-lg bg-gray-800/60 px-3 py-2">
              <div className="text-xs text-gray-500 mb-0.5">Sentiment</div>
              <div className={`font-medium capitalize ${signalRow.sentiment === 'bullish' ? 'text-green-400' : signalRow.sentiment === 'bearish' ? 'text-red-400' : 'text-amber-400'}`}>
                {signalRow.sentiment ?? '—'}
              </div>
            </div>
            <div className="rounded-lg bg-gray-800/60 px-3 py-2">
              <div className="text-xs text-gray-500 mb-0.5">Priority</div>
              <div className="text-white capitalize text-sm">{signalRow.research_priority?.replace('_', ' ') ?? '—'}</div>
            </div>
            {signalRow.status && (
              <div className="flex items-center">
                <StatusBadge status={signalRow.status} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main content: research left, LILO + DCA right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ResearchSummary research={research} />
        <div className="space-y-4">
          <LiloPanel lilo={lilo} tpLayers={tpLayers} />
          <DcaPanel lilo={lilo} />
        </div>
      </div>
    </div>
  )
}
