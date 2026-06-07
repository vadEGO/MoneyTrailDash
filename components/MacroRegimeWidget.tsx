'use client'

import { useState } from 'react'
import StatusChip from '@/components/ui/StatusChip'
import type { MacroRegimeData } from '@/lib/types'

// ── Static playbook data (no Supabase call needed) ──────────────────────────

type Direction = 'up' | 'down' | 'neutral'
type Season = 'spring' | 'summer' | 'fall' | 'winter'
type Phase = 'rec' | 'exp' | 'slo' | 'con'

interface SeasonDef {
  label: string
  emoji: string
  subtitle: string
  description: string
  growth: string
  inflation: string
  assetClasses: { key: string; label: string; direction: Direction }[]
  sectorsUp: string[]
  sectorsDown: string[]
}

const SEASONS: Record<Season, SeasonDef> = {
  spring: {
    label: 'Spring',
    emoji: '🌸',
    subtitle: 'Disinflationary Boom',
    description: 'Rising growth · Falling inflation',
    growth: 'rising',
    inflation: 'falling',
    assetClasses: [
      { key: 'equities', label: 'Equities', direction: 'up' },
      { key: 'credit', label: 'Credit', direction: 'up' },
      { key: 'commodities', label: 'Commodities', direction: 'down' },
      { key: 'bonds', label: 'Bonds', direction: 'down' },
      { key: 'cash', label: 'Cash', direction: 'down' },
      { key: 'crypto', label: 'Crypto', direction: 'up' },
    ],
    sectorsUp: ['Technology', 'Semis', 'Discretionary', 'Homebuilders'],
    sectorsDown: ['Energy', 'Utilities', 'Healthcare', 'Gold Miners'],
  },
  summer: {
    label: 'Summer',
    emoji: '☀️',
    subtitle: 'Inflationary Boom',
    description: 'Rising growth · Rising inflation',
    growth: 'rising',
    inflation: 'rising',
    assetClasses: [
      { key: 'equities', label: 'Equities', direction: 'up' },
      { key: 'credit', label: 'Credit', direction: 'up' },
      { key: 'commodities', label: 'Commodities', direction: 'up' },
      { key: 'bonds', label: 'Bonds', direction: 'down' },
      { key: 'cash', label: 'Cash', direction: 'down' },
      { key: 'crypto', label: 'Crypto', direction: 'up' },
    ],
    sectorsUp: ['Energy', 'Materials', 'Industrials', 'Financials', 'Semis'],
    sectorsDown: ['Staples', 'Utilities', 'Real Estate'],
  },
  fall: {
    label: 'Fall',
    emoji: '🍂',
    subtitle: 'Stagflation',
    description: 'Falling growth · Rising inflation',
    growth: 'falling',
    inflation: 'rising',
    assetClasses: [
      { key: 'equities', label: 'Equities', direction: 'down' },
      { key: 'credit', label: 'Credit', direction: 'down' },
      { key: 'commodities', label: 'Commodities', direction: 'up' },
      { key: 'bonds', label: 'Bonds', direction: 'neutral' },
      { key: 'cash', label: 'Cash', direction: 'up' },
      { key: 'crypto', label: 'Crypto', direction: 'down' },
    ],
    sectorsUp: ['Energy', 'Gold Miners', 'Materials'],
    sectorsDown: ['Technology', 'Discretionary', 'Homebuilders'],
  },
  winter: {
    label: 'Winter',
    emoji: '❄️',
    subtitle: 'Deflationary Bust',
    description: 'Falling growth · Falling inflation',
    growth: 'falling',
    inflation: 'falling',
    assetClasses: [
      { key: 'equities', label: 'Equities', direction: 'down' },
      { key: 'credit', label: 'Credit', direction: 'neutral' },
      { key: 'commodities', label: 'Commodities', direction: 'down' },
      { key: 'bonds', label: 'Bonds', direction: 'up' },
      { key: 'cash', label: 'Cash', direction: 'up' },
      { key: 'crypto', label: 'Crypto', direction: 'down' },
    ],
    sectorsUp: ['Healthcare', 'Staples', 'Utilities', 'Quality'],
    sectorsDown: ['Energy', 'Materials', 'Financials', 'Small Caps'],
  },
}

const PHASE_LABELS: Record<Phase, string> = {
  rec: 'Recovery',
  exp: 'Expansion',
  slo: 'Slowdown',
  con: 'Contraction',
}

const COUNTRY_LABELS: Record<string, string> = {
  us: 'US',
  canada: 'Canada',
  uk: 'UK',
  euro_zone: 'Euro Zone',
  germany: 'Germany',
  france: 'France',
  italy: 'Italy',
  spain: 'Spain',
  major_5_asia: 'Major 5 Asia',
  china: 'China',
  india: 'India',
  indonesia: 'Indonesia',
  japan: 'Japan',
  south_korea: 'South Korea',
  australia: 'Australia',
  south_africa: 'South Africa',
  brazil: 'Brazil',
  mexico: 'Mexico',
  global: 'Global',
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function directionVariant(d: Direction): 'green' | 'red' | 'grey' {
  if (d === 'up') return 'green'
  if (d === 'down') return 'red'
  return 'grey'
}

function directionLabel(d: Direction): string {
  if (d === 'up') return '↑'
  if (d === 'down') return '↓'
  return '→'
}

function convictionVariant(c: string | null): 'green' | 'amber' | 'red' | 'grey' {
  if (c === 'high') return 'green'
  if (c === 'medium') return 'amber'
  if (c === 'low') return 'red'
  return 'grey'
}

function phaseVariant(p: string): 'green' | 'amber' | 'red' | 'grey' {
  if (p === 'rec') return 'green'
  if (p === 'exp') return 'amber'
  if (p === 'slo' || p === 'con') return 'red'
  return 'grey'
}

function isStale(lastUpdated: string | null): boolean {
  if (!lastUpdated) return true
  const age = Date.now() - new Date(lastUpdated).getTime()
  return age > 14 * 24 * 60 * 60 * 1000
}

function formatDate(iso: string | null): string {
  if (!iso) return 'never'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function sortCountriesByDivergence(
  countryPhases: Record<string, string>,
  globalPhase: string
): [string, string][] {
  const entries = Object.entries(countryPhases).filter(([k]) => k !== 'global')
  return entries.sort(([, a], [, b]) => {
    const aDiverges = a !== globalPhase ? 0 : 1
    const bDiverges = b !== globalPhase ? 0 : 1
    return aDiverges - bDiverges
  })
}

// ── Subviews ──────────────────────────────────────────────────────────────────

function SeasonsView({ regime }: { regime: MacroRegimeData }) {
  const [showSectors, setShowSectors] = useState(false)
  const [showGrid, setShowGrid] = useState(false)

  const season = regime.active_season as Season | null
  const def = season ? SEASONS[season] : null

  if (!def || !season) {
    return (
      <div className="px-4 py-4 text-sm text-ink-3">
        No season set.{' '}
        <span className="font-mono text-xs">update_macro_regime.py --season summer</span>
      </div>
    )
  }

  return (
    <div className="px-4 py-3 space-y-3">
      {/* Hero: season identity */}
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xl">{def.emoji}</span>
          <span className="font-semibold text-md text-ink">{def.label.toUpperCase()}</span>
          <StatusChip
            label={(regime.season_conviction ?? 'unknown').toUpperCase()}
            variant={convictionVariant(regime.season_conviction)}
          />
        </div>
        <div className="text-xs text-ink-2 font-medium">{def.subtitle}</div>
        <div className="text-xs text-ink-3 mt-0.5">{def.description}</div>
      </div>

      {/* Staleness + updated by */}
      <div className="flex items-center gap-2 text-2xs text-ink-3 font-mono">
        <span>Updated {formatDate(regime.last_updated)}{regime.updated_by ? ` by ${regime.updated_by}` : ''}</span>
        {isStale(regime.last_updated) && (
          <StatusChip label="STALE" variant="amber" />
        )}
      </div>

      {/* Asset class playbook */}
      <div>
        <div className="text-2xs font-semibold tracking-widest text-ink-3 uppercase mb-1.5">Asset Classes</div>
        <div className="flex flex-wrap gap-1.5">
          {def.assetClasses.map(({ key, label, direction }) => (
            <span
              key={key}
              className={`inline-flex items-center gap-0.5 text-xs font-mono px-1.5 py-0.5 rounded border ${
                direction === 'up'
                  ? 'border-green-200 bg-green-50 text-green-700'
                  : direction === 'down'
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-border bg-surface-dim text-ink-3'
              }`}
            >
              {label} {directionLabel(direction)}
            </span>
          ))}
        </div>
      </div>

      {/* Sector detail (collapsible) */}
      <div>
        <button
          className="text-2xs text-ink-3 hover:text-ink flex items-center gap-1"
          onClick={() => setShowSectors(!showSectors)}
        >
          <span>{showSectors ? '▾' : '▸'}</span>
          <span className="font-semibold tracking-widest uppercase">Sector Detail</span>
        </button>
        {showSectors && (
          <div className="mt-1.5 space-y-1">
            <div className="text-2xs text-ink-3">
              <span className="text-green-600 font-medium">Favor: </span>
              {def.sectorsUp.join(' · ')}
            </div>
            <div className="text-2xs text-ink-3">
              <span className="text-red-600 font-medium">Avoid: </span>
              {def.sectorsDown.join(' · ')}
            </div>
          </div>
        )}
      </div>

      {/* 2×2 quadrant position (collapsible) */}
      <div>
        <button
          className="text-2xs text-ink-3 hover:text-ink flex items-center gap-1"
          onClick={() => setShowGrid(!showGrid)}
        >
          <span>{showGrid ? '▾' : '▸'}</span>
          <span className="font-semibold tracking-widest uppercase">Cycle Position</span>
        </button>
        {showGrid && (
          <div className="mt-2 grid grid-cols-2 gap-1 text-center">
            {(['spring', 'summer', 'winter', 'fall'] as Season[]).map(s => (
              <div
                key={s}
                className={`rounded border py-2 text-xs ${
                  s === season
                    ? 'border-ink bg-surface-dim font-semibold text-ink'
                    : 'border-border text-ink-3'
                }`}
              >
                <div>{SEASONS[s].emoji}</div>
                <div className="text-2xs mt-0.5">{SEASONS[s].label}</div>
                {s === season && <div className="text-2xs mt-0.5 text-ink-3">{SEASONS[s].subtitle}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function MomentumView({ regime }: { regime: MacroRegimeData }) {
  const [showAll, setShowAll] = useState(false)

  const globalPhase = regime.country_phases?.['global'] ?? regime.active_phase ?? 'exp'
  const phases = regime.country_phases ?? {}
  const sorted = sortCountriesByDivergence(phases, globalPhase)
  const visible = showAll ? sorted : sorted.slice(0, 8)

  return (
    <div className="px-4 py-3 space-y-3">
      {/* Global summary badge */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-ink-3 font-semibold">Global</span>
        <StatusChip
          label={PHASE_LABELS[globalPhase as Phase] ?? globalPhase.toUpperCase()}
          variant={phaseVariant(globalPhase)}
        />
        {regime.phase_conviction && (
          <StatusChip
            label={(regime.phase_conviction ?? '').toUpperCase()}
            variant={convictionVariant(regime.phase_conviction)}
          />
        )}
      </div>

      {/* Staleness */}
      <div className="flex items-center gap-2 text-2xs text-ink-3 font-mono">
        <span>Updated {formatDate(regime.last_updated)}{regime.updated_by ? ` by ${regime.updated_by}` : ''}</span>
        {isStale(regime.last_updated) && (
          <StatusChip label="STALE" variant="amber" />
        )}
      </div>

      {/* Country table */}
      {sorted.length > 0 && (
        <div>
          <div className="text-2xs font-semibold tracking-widest text-ink-3 uppercase mb-1.5">
            By Country
            <span className="ml-1 font-normal text-ink-3">(divergences first)</span>
          </div>
          <div className="space-y-1">
            {visible.map(([country, phase]) => (
              <div key={country} className="flex items-center justify-between">
                <span className="text-xs text-ink-2">{COUNTRY_LABELS[country] ?? country}</span>
                <StatusChip
                  label={PHASE_LABELS[phase as Phase] ?? phase.toUpperCase()}
                  variant={phaseVariant(phase)}
                />
              </div>
            ))}
          </div>
          {sorted.length > 8 && (
            <button
              className="mt-2 text-2xs text-ink-3 hover:text-ink"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? '▾ Show fewer' : `▸ Show all ${sorted.length}`}
            </button>
          )}
        </div>
      )}

      {/* Phase legend */}
      <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border">
        {(['rec', 'exp', 'slo', 'con'] as Phase[]).map(p => (
          <div key={p} className="flex items-center gap-1">
            <StatusChip label={p.toUpperCase()} variant={phaseVariant(p)} />
            <span className="text-2xs text-ink-3">{PHASE_LABELS[p]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main widget ───────────────────────────────────────────────────────────────

export default function MacroRegimeWidget({ regime }: { regime: MacroRegimeData | null }) {
  const [tab, setTab] = useState<'seasons' | 'momentum'>('seasons')

  return (
    <div className="bg-surface border border-border rounded shadow-card">
      {/* Card header with toggle */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-xs font-semibold tracking-widest text-ink-3 uppercase">Macro Regime</span>
        <div className="flex gap-1">
          <button
            onClick={() => setTab('seasons')}
            className={`text-2xs px-2 py-1 rounded transition-colors ${
              tab === 'seasons'
                ? 'bg-ink text-surface font-semibold'
                : 'text-ink-3 hover:text-ink'
            }`}
          >
            🌸 Seasons
          </button>
          <button
            onClick={() => setTab('momentum')}
            className={`text-2xs px-2 py-1 rounded transition-colors ${
              tab === 'momentum'
                ? 'bg-ink text-surface font-semibold'
                : 'text-ink-3 hover:text-ink'
            }`}
          >
            📈 Momentum
          </button>
        </div>
      </div>

      {/* Content */}
      {!regime ? (
        <div className="px-4 py-6 space-y-1">
          <div className="text-sm text-ink-3">No regime configured</div>
          <div className="font-mono text-2xs text-ink-3">
            python update_macro_regime.py --season summer
          </div>
        </div>
      ) : tab === 'seasons' ? (
        <SeasonsView regime={regime} />
      ) : (
        <MomentumView regime={regime} />
      )}
    </div>
  )
}
