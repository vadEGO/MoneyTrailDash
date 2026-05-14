type ActionVariant = 'action-required' | 'monitor' | 'pending' | 'approved' | 'draft' | 'active' | 'watch' | 'research'

const MAP: Record<ActionVariant, string> = {
  'action-required': 'border border-status-red text-status-red',
  'monitor':         'border border-status-amber text-status-amber',
  'pending':         'border border-status-amber text-status-amber',
  'approved':        'border border-status-green text-status-green',
  'draft':           'border border-border text-ink-3',
  'active':          'border border-status-green text-status-green',
  'watch':           'border border-status-blue text-status-blue',
  'research':        'border border-status-purple text-status-purple',
}

export default function ActionBadge({ label }: { label: ActionVariant | string }) {
  const key = label.toLowerCase().replace(' ', '-') as ActionVariant
  const cls = MAP[key] ?? 'border border-border text-ink-3'
  return (
    <span className={`inline-block px-2 py-0.5 text-2xs font-semibold tracking-wide rounded-sm ${cls}`}>
      {label.toUpperCase()}
    </span>
  )
}
