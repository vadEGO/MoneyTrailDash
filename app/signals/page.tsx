import { redirect } from 'next/navigation'

// Signals are now the Watchlist — redirect for backwards compat
export default function SignalsPage() {
  redirect('/watchlist')
}
