const canonicalProductionRef = 'iinzcnqwhltxjilpkojr'
const productionRef =
  process.env.MONEYTRAIL_PRODUCTION_SUPABASE_REF || canonicalProductionRef
const environment = process.env.VERCEL_ENV || 'local'

function projectRef(url) {
  try {
    const hostname = new URL(url).hostname
    const match = hostname.match(/^([a-z0-9]+)\.supabase\.co$/i)
    return match?.[1] || null
  } catch {
    return null
  }
}

if (environment !== 'preview') {
  console.log(JSON.stringify({
    status: 'skipped',
    reason: `VERCEL_ENV=${environment}; preview isolation gate is preview-only`,
  }))
  process.exit(0)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const declaredRef = process.env.MONEYTRAIL_PREVIEW_SUPABASE_REF
const declaredEnvironment = process.env.MONEYTRAIL_SUPABASE_ENV
const actualRef = projectRef(url)
const errors = []

if (productionRef !== canonicalProductionRef) {
  errors.push('MONEYTRAIL_PRODUCTION_SUPABASE_REF does not match the canonical production ref')
}
if (!url || !actualRef) {
  errors.push('NEXT_PUBLIC_SUPABASE_URL must be a valid Supabase project URL')
}
if (actualRef === canonicalProductionRef) {
  errors.push('Vercel preview is configured with the production Supabase project')
}
if (declaredEnvironment !== 'preview') {
  errors.push('MONEYTRAIL_SUPABASE_ENV must equal preview')
}
if (!declaredRef) {
  errors.push('MONEYTRAIL_PREVIEW_SUPABASE_REF is required')
} else if (actualRef && declaredRef !== actualRef) {
  errors.push('MONEYTRAIL_PREVIEW_SUPABASE_REF does not match NEXT_PUBLIC_SUPABASE_URL')
}

console.log(JSON.stringify({
  status: errors.length === 0 ? 'valid' : 'invalid',
  environment,
  production_ref: productionRef,
  preview_ref: actualRef,
  errors,
}, null, 2))

process.exit(errors.length === 0 ? 0 : 1)
