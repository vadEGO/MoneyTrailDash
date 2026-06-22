import { redirect } from 'next/navigation'

// Per-asset detail now lives in the IdeaDrawer on the Funnel board, which reads
// the unified investment_opportunities object instead of the legacy
// public_research / public_lilo / public_tp_layers tables.
export default function AssetPage() {
  redirect('/')
}
