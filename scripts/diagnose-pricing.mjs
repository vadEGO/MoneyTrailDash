/**
 * Read-only health check for the price feed.
 *
 * Answers three things the dashboard cannot show on its own:
 *   1. Which asset classes the exporter is still writing, and when it last did.
 *      A class missing from recent batches has a dead pipeline leg, which looks
 *      identical to "no new ideas" from the UI.
 *   2. How often current_price is null per class. Entry, stop and target are
 *      derived from the price, so a null price means the idea has no plan at all.
 *   3. Whether the candle and symbol tables are reachable and populated, since
 *      an empty market_candles silently downgrades every chart to levels-only.
 *
 * Usage: node scripts/diagnose-pricing.mjs
 */
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.trimStart().startsWith('#'))
    .map(l => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
    }),
)

const BASE = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!BASE || !KEY) {
  console.error('Missing Supabase env vars in .env.local')
  process.exit(1)
}

const HEADERS = { apikey: KEY, Authorization: `Bearer ${KEY}`, Accept: 'application/json' }
const DAY = 86_400_000

async function rows(path, range = '0-9999') {
  const res = await fetch(`${BASE}/rest/v1/${path}`, { headers: { ...HEADERS, Range: range } })
  const text = await res.text()
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}: ${text.slice(0, 200)}`)
  return JSON.parse(text)
}

const ageDays = ts => ts == null ? null : (Date.now() - new Date(ts).getTime()) / DAY
const fmtAge = d => d == null ? 'never' : d < 1 ? `${Math.round(d * 24)}h` : `${d.toFixed(1)}d`

console.log(`host: ${new URL(BASE).host}\n`)

const ideas = await rows(
  'public_opportunity_action_board?select=normalized_symbol,asset_class,current_price,entry_min,stop_loss,take_profit_1,updated_at',
)

// ── 1. Which classes is the exporter still writing? ───────────────────────────
const batches = new Map()
for (const r of ideas) {
  const key = (ageDays(r.updated_at) ?? 0).toFixed(1)
  const b = batches.get(key) ?? new Map()
  b.set(r.asset_class ?? 'null', (b.get(r.asset_class ?? 'null') ?? 0) + 1)
  batches.set(key, b)
}
console.log(`WRITE BATCHES  (${ideas.length} open ideas)`)
console.log('  age        composition')
for (const key of [...batches.keys()].sort((a, b) => Number(a) - Number(b))) {
  const parts = [...batches.get(key)].sort().map(([k, v]) => `${k}=${v}`).join(', ')
  console.log(`  ${`${key}d`.padEnd(9)}  ${parts}`)
}

const lastSeen = new Map()
for (const r of ideas) {
  const cls = r.asset_class ?? 'null'
  const a = ageDays(r.updated_at)
  if (a != null && (!lastSeen.has(cls) || a < lastSeen.get(cls))) lastSeen.set(cls, a)
}
console.log('\nLAST WRITE PER CLASS')
for (const [cls, a] of [...lastSeen].sort((x, y) => x[1] - y[1])) {
  const flag = a > 7 ? '  <-- pipeline leg looks dead' : ''
  console.log(`  ${cls.padEnd(10)} ${fmtAge(a).padEnd(8)}${flag}`)
}

// ── 2. Price coverage, and the plan that depends on it ────────────────────────
console.log('\nPRICE COVERAGE')
console.log(`  ${'class'.padEnd(10)}${'ideas'.padEnd(8)}${'no price'.padEnd(11)}${'no plan'.padEnd(10)}rate`)
const classes = [...new Set(ideas.map(r => r.asset_class ?? 'null'))].sort()
for (const cls of classes) {
  const sub = ideas.filter(r => (r.asset_class ?? 'null') === cls)
  const noPrice = sub.filter(r => r.current_price == null)
  const noPlan = sub.filter(r => r.entry_min == null && r.stop_loss == null && r.take_profit_1 == null)
  console.log(
    `  ${cls.padEnd(10)}${String(sub.length).padEnd(8)}${String(noPrice.length).padEnd(11)}` +
    `${String(noPlan.length).padEnd(10)}${Math.round(noPrice.length / sub.length * 100)}%`,
  )
}

const broken = ideas.filter(r => r.current_price == null)
if (broken.length) {
  console.log('\nIDEAS WITH NO PRICE')
  console.log(`  ${'symbol'.padEnd(10)}${'class'.padEnd(10)}${'entry'.padEnd(8)}${'stop'.padEnd(8)}${'tp1'.padEnd(8)}age`)
  for (const r of broken.sort((a, b) => (a.asset_class ?? '').localeCompare(b.asset_class ?? ''))) {
    const y = v => v == null ? '—' : 'yes'
    console.log(
      `  ${String(r.normalized_symbol).padEnd(10)}${String(r.asset_class ?? '—').padEnd(10)}` +
      `${y(r.entry_min).padEnd(8)}${y(r.stop_loss).padEnd(8)}${y(r.take_profit_1).padEnd(8)}` +
      fmtAge(ageDays(r.updated_at)),
    )
  }
}

// ── 3. Are the chart source tables reachable and populated? ───────────────────
// A missing table answers 404 and a table anon cannot read answers 401/403, so a
// 200 carrying zero rows means reachable but empty — either the exporter never
// wrote it, or RLS is filtering every row. Both leave charts with no candles.
console.log('\nCHART SOURCE TABLES')
for (const t of ['symbols', 'market_candles', 'public_symbol_chart_overlays']) {
  const res = await fetch(`${BASE}/rest/v1/${t}?select=*&limit=1`, {
    headers: { ...HEADERS, Prefer: 'count=exact', Range: '0-0' },
  })
  const count = (res.headers.get('content-range') ?? '?').split('/').pop()
  const note = res.status === 200 && count === '0' ? '  <-- empty: charts fall back to levels only' : ''
  console.log(`  ${t.padEnd(32)} HTTP ${res.status}  rows=${count}${note}`)
}
