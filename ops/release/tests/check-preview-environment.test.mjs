import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const script = resolve(process.cwd(), 'ops/release/check-preview-environment.mjs')

function run(env) {
  return spawnSync(process.execPath, [script], {
    env: { ...process.env, ...env },
    encoding: 'utf8',
  })
}

const production = run({
  VERCEL_ENV: 'preview',
  NEXT_PUBLIC_SUPABASE_URL: 'https://iinzcnqwhltxjilpkojr.supabase.co',
  MONEYTRAIL_SUPABASE_ENV: 'preview',
  MONEYTRAIL_PREVIEW_SUPABASE_REF: 'iinzcnqwhltxjilpkojr',
})
assert.equal(production.status, 1)
assert.match(production.stdout, /production Supabase project/)

const disguisedProduction = run({
  VERCEL_ENV: 'preview',
  NEXT_PUBLIC_SUPABASE_URL: 'https://iinzcnqwhltxjilpkojr.supabase.co',
  MONEYTRAIL_SUPABASE_ENV: 'preview',
  MONEYTRAIL_PREVIEW_SUPABASE_REF: 'iinzcnqwhltxjilpkojr',
  MONEYTRAIL_PRODUCTION_SUPABASE_REF: 'not-the-production-ref',
})
assert.equal(disguisedProduction.status, 1)
assert.match(disguisedProduction.stdout, /canonical production ref/)
assert.match(disguisedProduction.stdout, /production Supabase project/)

const isolated = run({
  VERCEL_ENV: 'preview',
  NEXT_PUBLIC_SUPABASE_URL: 'https://previewprojectref.supabase.co',
  MONEYTRAIL_SUPABASE_ENV: 'preview',
  MONEYTRAIL_PREVIEW_SUPABASE_REF: 'previewprojectref',
})
assert.equal(isolated.status, 0)
assert.match(isolated.stdout, /"status": "valid"/)

const local = run({ VERCEL_ENV: 'development' })
assert.equal(local.status, 0)
assert.match(local.stdout, /"status":"skipped"/)

console.log('preview environment isolation tests passed')
