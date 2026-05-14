import type { Metadata } from 'next'
import localFont from 'next/font/local'
import Link from 'next/link'
import './globals.css'

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
})
const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
})

export const metadata: Metadata = {
  title: 'MoneyTrailDash',
  description: 'OpenClaw Investment Intelligence Cockpit',
}

const NAV_LINKS = [
  { href: '/',          label: 'Cockpit' },
  { href: '/signals',   label: 'Signals' },
  { href: '/thesis',    label: 'Thesis' },
  { href: '/audit',     label: 'Audit' },
]

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-950 text-gray-100 min-h-screen`}>
        <nav className="sticky top-0 z-50 border-b border-gray-800 bg-gray-950/90 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-6 h-12">
            <Link href="/" className="text-white font-bold text-sm tracking-tight shrink-0">
              MoneyTrailDash
            </Link>
            <div className="flex items-center gap-1">
              {NAV_LINKS.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-gray-400 hover:text-white text-sm px-3 py-1.5 rounded-md hover:bg-gray-800 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          {children}
        </main>
      </body>
    </html>
  )
}
