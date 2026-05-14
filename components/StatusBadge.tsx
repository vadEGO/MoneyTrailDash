interface StatusBadgeProps {
  status: string
  size?: 'sm' | 'md'
}

const STATUS_MAP: Record<string, { icon: string; label: string; cls: string }> = {
  tradeable:       { icon: '✅', label: 'Tradeable',    cls: 'text-green-400 bg-green-950/30' },
  pass:            { icon: '✅', label: 'Pass',         cls: 'text-green-400 bg-green-950/30' },
  research_only:   { icon: '⚫', label: 'Research',     cls: 'text-gray-400 bg-gray-800/40' },
  log_only:        { icon: '⚫', label: 'Log only',     cls: 'text-gray-500 bg-gray-800/30' },
  proxy_candidate: { icon: '🔄', label: 'Proxy',        cls: 'text-blue-400 bg-blue-950/30' },
  stale_data:      { icon: '⚠️', label: 'Stale',        cls: 'text-amber-400 bg-amber-950/30' },
  watch:           { icon: '⚠️', label: 'Watch',        cls: 'text-amber-400 bg-amber-950/30' },
  reject:          { icon: '❌', label: 'Reject',       cls: 'text-red-400 bg-red-950/30' },
  failed:          { icon: '❌', label: 'Failed',       cls: 'text-red-400 bg-red-950/30' },
  accept:          { icon: '✅', label: 'Accept',       cls: 'text-green-400 bg-green-950/30' },
  conditional:     { icon: '⚠️', label: 'Conditional',  cls: 'text-amber-400 bg-amber-950/30' },
}

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const mapped = STATUS_MAP[status?.toLowerCase()] ?? {
    icon: '○', label: status ?? '—', cls: 'text-gray-500 bg-gray-800/30'
  }
  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'

  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium ${padding} ${mapped.cls}`}>
      <span>{mapped.icon}</span>
      <span>{mapped.label}</span>
    </span>
  )
}
