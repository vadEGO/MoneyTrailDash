import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'
import Sidebar from '@/components/Sidebar'

export const metadata: Metadata = {
  title: 'MoneyTrailDash',
  description: 'OpenClaw Intelligence Suite',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="flex h-screen overflow-hidden bg-surface text-ink font-sans">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Top bar */}
          <header className="h-12 border-b border-border flex items-center justify-between px-6 shrink-0 bg-surface">
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Search OpenClaw..."
                className="w-64 h-8 text-sm border border-border rounded bg-surface-dim px-3 placeholder-ink-3 focus:outline-none focus:border-black focus:border-[1.5px]"
              />
            </div>
            <div className="flex items-center gap-3">
              <button className="text-ink-3 hover:text-ink transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>
              </button>
              <button className="text-ink-3 hover:text-ink transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 10-16 0"/></svg>
              </button>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto bg-surface-dim p-6">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
