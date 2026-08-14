'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

// Five surfaces. Funnel is the single idea board; Portfolio is the build guidance
// (heat, allocation vs plan, sized actions); Macro is the market/regime context;
// Research is the shared reasoning pane; Health is ops telemetry. The old
// Cockpit/Watchlist/Action/Ideas/Theses/Council/Library/Risk routes were all
// views of these and now redirect here.
const NAV = [
  { href: '/',          label: 'FUNNEL',    icon: IdeasIcon },
  { href: '/portfolio', label: 'PORTFOLIO', icon: PortfolioIcon },
  { href: '/paper',     label: 'PAPER',     icon: PortfolioIcon },
  { href: '/macro',     label: 'MACRO',     icon: MacroIcon },
  { href: '/research',  label: 'RESEARCH',  icon: LibraryIcon },
  { href: '/health',    label: 'HEALTH',    icon: HealthIcon },
]

const COLLAPSE_KEY = 'mtd.sidebar.collapsed'

export default function Sidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)          // mobile drawer
  const [collapsed, setCollapsed] = useState(false) // desktop rail

  // Restore the collapsed preference (desktop only) once on mount.
  useEffect(() => {
    try { setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1') } catch {}
  }, [])

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev
      try { localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0') } catch {}
      return next
    })
  }

  // Close drawer on route change
  useEffect(() => { setOpen(false) }, [pathname])

  // Close on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // `compact` collapses labels to an icon-only rail (desktop). The mobile drawer
  // always passes compact=false so it shows full labels.
  const navContent = (compact: boolean) => (
    <>
      {/* Suite label */}
      <div className={`pt-4 pb-3 border-b border-border ${compact ? 'px-0' : 'px-4'}`}>
        <div className={`flex items-center gap-2 ${compact ? 'justify-center' : ''}`}>
          <div className="w-6 h-6 bg-black rounded-sm flex items-center justify-center shrink-0">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="white">
              <rect x="2" y="2" width="5" height="5"/><rect x="9" y="2" width="5" height="5"/>
              <rect x="2" y="9" width="5" height="5"/><rect x="9" y="9" width="5" height="5"/>
            </svg>
          </div>
          {!compact && (
            <div>
              <div className="text-2xs font-semibold text-ink leading-none">Intelligence Suite</div>
              <div className="text-2xs text-ink-3 font-mono mt-0.5">v2.4.0-STABLE</div>
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              title={compact ? label : undefined}
              aria-label={label}
              className={`flex items-center gap-2.5 py-2.5 text-2xs font-semibold tracking-widest transition-colors ${
                compact ? 'px-0 justify-center' : 'px-4'
              } ${active ? 'bg-black text-white' : 'text-ink-3 hover:text-ink hover:bg-surface-dim'}`}
            >
              <Icon size={14} active={active} />
              {!compact && label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className={`border-t border-border py-4 space-y-2 ${compact ? 'px-2' : 'px-4'}`}>
        <Link href="#" title={compact ? 'Support' : undefined} className={`flex items-center gap-2 text-2xs text-ink-3 hover:text-ink transition-colors ${compact ? 'justify-center' : ''}`}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
          </svg>
          {!compact && 'SUPPORT'}
        </Link>
        <Link href="/health" title={compact ? 'Logs' : undefined} className={`flex items-center gap-2 text-2xs text-ink-3 hover:text-ink transition-colors ${compact ? 'justify-center' : ''}`}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
          </svg>
          {!compact && 'LOGS'}
        </Link>
        {!compact && (
          <button className="w-full mt-1 bg-status-red text-white text-2xs font-semibold tracking-wider py-1.5 rounded-sm hover:bg-red-700 transition-colors">
            EMERGENCY KILLSWITCH
          </button>
        )}
      </div>
    </>
  )

  return (
    <>
      {/* ── Desktop sidebar (always visible ≥ md) ── */}
      <aside className={`hidden md:flex shrink-0 border-r border-border bg-surface flex-col h-screen transition-[width] duration-200 ${collapsed ? 'w-14' : 'w-40'}`}>
        <div className={`h-12 border-b border-border flex items-center ${collapsed ? 'justify-center px-0' : 'justify-between px-4'}`}>
          {!collapsed && <span className="font-mono font-semibold text-sm tracking-tight text-ink">MONEYTRAIL</span>}
          <button
            onClick={toggleCollapsed}
            className="p-1 rounded text-ink-3 hover:text-ink hover:bg-surface-dim transition-colors"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {/* Chevron points the way it will move */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {collapsed
                ? <polyline points="9 18 15 12 9 6"/>
                : <polyline points="15 18 9 12 15 6"/>}
            </svg>
          </button>
        </div>
        {navContent(collapsed)}
      </aside>

      {/* ── Mobile: top bar + slide-in drawer ── */}
      <div className="md:hidden">
        {/* Top bar */}
        <div className="fixed top-0 left-0 right-0 z-50 h-12 border-b border-border bg-surface flex items-center justify-between px-4">
          <span className="font-mono font-semibold text-sm tracking-tight text-ink">MONEYTRAIL</span>
          <button
            onClick={() => setOpen(o => !o)}
            className="p-1.5 rounded text-ink-3 hover:text-ink hover:bg-surface-dim transition-colors"
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            {open ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            )}
          </button>
        </div>

        {/* Backdrop */}
        {open && (
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
        )}

        {/* Drawer */}
        <aside className={`fixed top-0 left-0 z-50 h-full w-48 bg-surface border-r border-border flex flex-col transform transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}>
          <div className="h-12 border-b border-border flex items-center justify-between px-4">
            <span className="font-mono font-semibold text-sm tracking-tight text-ink">MONEYTRAIL</span>
            <button onClick={() => setOpen(false)} className="text-ink-3 hover:text-ink">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          {navContent(false)}
        </aside>
      </div>
    </>
  )
}

// --- Icon components ---
function IdeasIcon({ size, active }: { size: number; active: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={active ? 'white' : 'currentColor'} strokeWidth="2">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
      <polyline points="16 7 22 7 22 13"/>
    </svg>
  )
}
function PortfolioIcon({ size, active }: { size: number; active: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={active ? 'white' : 'currentColor'} strokeWidth="2">
      <path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/>
      <rect x="12" y="8" width="3" height="10"/><rect x="17" y="4" width="3" height="14"/>
    </svg>
  )
}
function MacroIcon({ size, active }: { size: number; active: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={active ? 'white' : 'currentColor'} strokeWidth="2">
      <path d="M12 2a10 10 0 100 20 10 10 0 000-20z"/><path d="M2 12h20"/>
      <path d="M12 2a15 15 0 014 10 15 15 0 01-4 10 15 15 0 01-4-10 15 15 0 014-10z"/>
    </svg>
  )
}
function LibraryIcon({ size, active }: { size: number; active: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={active ? 'white' : 'currentColor'} strokeWidth="2">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
    </svg>
  )
}
function HealthIcon({ size, active }: { size: number; active: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={active ? 'white' : 'currentColor'} strokeWidth="2">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  )
}
