'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message.includes('not authorized') || error.message.includes('invite')
        ? 'This email is not on the invite list. Contact the admin.'
        : error.message)
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-white tracking-tight">MoneyTrailDash</h1>
          <p className="text-gray-500 text-sm mt-1">OpenClaw Intelligence Cockpit</p>
        </div>

        {sent ? (
          <div className="rounded-lg border border-green-800 bg-green-950/30 p-6 text-center">
            <div className="text-green-400 text-lg mb-2">Check your inbox</div>
            <p className="text-gray-400 text-sm">
              Magic link sent to <span className="text-white">{email}</span>.<br />
              Click the link to sign in. Valid for 1 hour.
            </p>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm text-gray-400 mb-1.5">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full rounded-md bg-gray-900 border border-gray-700 px-3 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500"
              />
            </div>

            {error && (
              <div className="rounded-md bg-red-950/40 border border-red-800 px-3 py-2 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full rounded-md bg-white text-gray-950 font-medium py-2.5 text-sm hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Sending…' : 'Send magic link'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
