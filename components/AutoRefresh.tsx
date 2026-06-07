'use client'

import { useEffect, useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'

const INTERVAL_MS = 15 * 60 * 1000 // 15 minutes

export default function AutoRefresh() {
  const router = useRouter()
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [secondsAgo, setSecondsAgo] = useState(0)

  const refresh = useCallback(() => {
    router.refresh()
    setLastRefresh(new Date())
    setSecondsAgo(0)
  }, [router])

  // Auto-refresh every 15 min, but ONLY while the tab is visible.
  // A hidden/backgrounded tab refetches nothing — this prevents idle tabs
  // from silently draining Supabase egress around the clock.
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined

    const start = () => {
      if (interval) return
      interval = setInterval(refresh, INTERVAL_MS)
    }
    const stop = () => {
      if (interval) clearInterval(interval)
      interval = undefined
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') start()
      else stop()
    }

    onVisibility() // honor the tab's initial state
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      stop()
    }
  }, [refresh])

  // Tick the "X min ago" counter every 30s
  useEffect(() => {
    const tick = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastRefresh.getTime()) / 1000))
    }, 30_000)
    return () => clearInterval(tick)
  }, [lastRefresh])

  const label = secondsAgo < 60 ? 'just now'
    : secondsAgo < 3600 ? `${Math.floor(secondsAgo / 60)}m ago`
    : `${Math.floor(secondsAgo / 3600)}h ago`

  return (
    <div className="flex items-center gap-2">
      <span className="text-2xs font-mono text-ink-3">refreshed {label}</span>
      <button
        onClick={refresh}
        className="flex items-center gap-1 text-2xs text-ink-3 hover:text-ink transition-colors border border-border rounded px-1.5 py-0.5 hover:bg-surface-dim"
        title="Refresh now"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M23 4v6h-6M1 20v-6h6"/>
          <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
        </svg>
        refresh
      </button>
    </div>
  )
}
