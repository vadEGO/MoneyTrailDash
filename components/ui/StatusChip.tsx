type StatusVariant = 'red' | 'amber' | 'green' | 'blue' | 'purple' | 'grey'

interface StatusChipProps {
  label: string
  variant?: StatusVariant
  dot?: boolean
}

const VARIANTS: Record<StatusVariant, { dot: string; text: string; bg: string }> = {
  red:    { dot: 'bg-status-red',    text: 'text-status-red',    bg: 'bg-red-50' },
  amber:  { dot: 'bg-status-amber',  text: 'text-status-amber',  bg: 'bg-amber-50' },
  green:  { dot: 'bg-status-green',  text: 'text-status-green',  bg: 'bg-green-50' },
  blue:   { dot: 'bg-status-blue',   text: 'text-status-blue',   bg: 'bg-blue-50' },
  purple: { dot: 'bg-status-purple', text: 'text-status-purple', bg: 'bg-purple-50' },
  grey:   { dot: 'bg-ink-3',         text: 'text-ink-2',         bg: 'bg-surface-dim' },
}

export default function StatusChip({ label, variant = 'grey', dot = true }: StatusChipProps) {
  const v = VARIANTS[variant]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-2xs font-semibold ${v.bg} ${v.text}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${v.dot}`} />}
      {label}
    </span>
  )
}
