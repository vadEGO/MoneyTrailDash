'use client'

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div role="alert" className="border border-border rounded bg-surface p-6">
    <h2 className="font-semibold text-ink mb-2">Dashboard data could not be loaded</h2>
    <p className="text-sm text-ink-2 mb-4">The data connection returned an error. Counts and pipeline status are unavailable.</p>
    <button onClick={reset} className="border border-border rounded px-4 py-2 text-sm">Try again</button>
  </div>
}
