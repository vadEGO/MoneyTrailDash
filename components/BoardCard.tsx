import { ReactNode } from 'react'

interface BoardCardProps {
  title: string
  generatedAt: string | null | undefined
  children: ReactNode
  className?: string
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
      hour12: false,
    })
  } catch {
    return '—'
  }
}

function isStale(iso: string | null | undefined, thresholdHours = 6): boolean {
  if (!iso) return false
  try {
    const ms = Date.now() - new Date(iso).getTime()
    return ms > thresholdHours * 60 * 60 * 1000
  } catch {
    return false
  }
}

export default function BoardCard({ title, generatedAt, children, className }: BoardCardProps) {
  const stale = isStale(generatedAt)

  return (
    <div className={`rounded-xl border bg-gray-900/60 ${stale ? 'border-amber-800' : 'border-gray-800'} ${className ?? ''}`}>
      <div className={`flex items-center justify-between px-5 py-3 border-b ${stale ? 'border-amber-800 bg-amber-950/20' : 'border-gray-800'}`}>
        <h2 className="text-sm font-semibold text-white tracking-wide uppercase">{title}</h2>
        {stale && (
          <span className="text-xs text-amber-400 flex items-center gap-1">
            ⚠️ Stale
          </span>
        )}
      </div>
      <div className="p-5">{children}</div>
      <div className="px-5 pb-3 text-xs text-gray-600">
        {generatedAt ? `Data as of ${formatTime(generatedAt)}` : 'Pipeline not yet run'}
      </div>
    </div>
  )
}
