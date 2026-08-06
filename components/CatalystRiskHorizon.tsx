import StatusChip from '@/components/ui/StatusChip'
import type { MarketCatalystEvent } from '@/lib/types'

interface PhaseCopy {
  label: string
  variant: 'red' | 'amber' | 'green' | 'blue' | 'purple' | 'grey'
  task: string
}

// event_phase is computed by the view, so an unrecognised value means the view and
// this component have drifted. Fall back rather than crash the page on a lookup miss.
const FALLBACK_PHASE: PhaseCopy = {
  label: 'Scheduled',
  variant: 'grey',
  task: 'No action yet. Keep the event visible while reviewing idea timing.',
}

const PHASE_COPY: Record<string, PhaseCopy> = {
  scheduled: {
    label: 'Scheduled',
    variant: 'grey' as const,
    task: 'No action yet. Keep the event visible while reviewing idea timing.',
  },
  pre_review: {
    label: 'Pre-review',
    variant: 'amber' as const,
    task: 'Before adding risk, re-check macro sensitivity, levels, sizing, and invalidation.',
  },
  in_progress: {
    label: 'In progress',
    variant: 'red' as const,
    task: 'Event risk is live. Avoid treating pre-event scores or price levels as settled.',
  },
  post_review: {
    label: 'Post-review',
    variant: 'blue' as const,
    task: 'Re-score macro fit and validate the market reaction before promoting any setup.',
  },
  complete: {
    label: 'Complete',
    variant: 'green' as const,
    task: 'Review window closed. Confirm the pipeline captured the new regime evidence.',
  },
}

function formatEventTime(value: string) {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(value))
}

function relativeDays(value: string) {
  const deltaHours = (new Date(value).getTime() - Date.now()) / 3_600_000
  if (Math.abs(deltaHours) < 1) return 'now'
  if (deltaHours > 0 && deltaHours < 48) return `in ${Math.ceil(deltaHours)}h`
  if (deltaHours < 0 && deltaHours > -48) return `${Math.ceil(Math.abs(deltaHours))}h ago`
  const days = Math.ceil(Math.abs(deltaHours) / 24)
  return deltaHours > 0 ? `in ${days}d` : `${days}d ago`
}

export default function CatalystRiskHorizon({ events }: { events: MarketCatalystEvent[] }) {
  if (!events.length) return null

  const visible = events
    .filter(event => event.event_phase !== 'complete')
    .slice(0, 4)
  const rows = visible.length ? visible : events.slice(-1)
  const lead = rows[0]
  const phase = PHASE_COPY[lead.event_phase] ?? FALLBACK_PHASE

  return (
    <section className="mb-4 rounded border border-border bg-surface" aria-labelledby="catalyst-horizon-title">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="catalyst-horizon-title" className="text-sm font-semibold text-ink">Policy event-risk horizon</h2>
            <StatusChip label={phase.label} variant={phase.variant} />
            <span className="font-mono text-2xs uppercase text-ink-3">{relativeDays(lead.event_at)}</span>
          </div>
          <p className="mt-1 text-xs text-ink-2">{phase.task}</p>
        </div>
        <a
          href={lead.source_url}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 font-mono text-2xs uppercase text-status-blue hover:underline"
        >
          Federal Reserve source ↗
        </a>
      </div>

      <div className="divide-y divide-border">
        {rows.map(event => {
          const eventPhase = PHASE_COPY[event.event_phase] ?? FALLBACK_PHASE
          return (
            <div key={event.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-ink">{event.title}</span>
                  {event.has_projections && <span className="font-mono text-2xs uppercase text-status-blue">SEP</span>}
                </div>
                <p className="mt-0.5 text-2xs text-ink-3">{event.summary_public}</p>
              </div>
              <div className="text-left sm:text-right">
                <div className="font-mono text-xs text-ink">{formatEventTime(event.event_at)}</div>
                <div className="mt-0.5 text-2xs text-ink-3">{eventPhase.label} · {relativeDays(event.event_at)}</div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
