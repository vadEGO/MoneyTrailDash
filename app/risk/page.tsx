import { redirect } from 'next/navigation'

// Risk/portfolio context now lives on the Market & Macro page.
export default function Page() {
  redirect('/macro')
}
