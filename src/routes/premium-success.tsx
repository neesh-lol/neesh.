import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useIdentity } from '@/lib/identity-context'
import { useEffect, useState } from 'react'
import { CheckCircle, Crown, MessageSquare, Palette, ChevronRight, Loader2 } from 'lucide-react'

export const Route = createFileRoute('/premium-success')({
  component: PremiumSuccessPage,
})

function PremiumSuccessPage() {
  const { user, ready } = useIdentity()
  const navigate = useNavigate()
  const [verified, setVerified] = useState(false)
  const [checking, setChecking] = useState(true)
  const [retries, setRetries] = useState(0)

  useEffect(() => {
    if (ready && !user) navigate({ to: '/signin' })
  }, [ready, user])

  useEffect(() => {
    if (!ready || !user) return

    let cancelled = false
    const verify = async () => {
      try {
        const res = await fetch('/api/subscription')
        if (!res.ok) throw new Error()
        const data = await res.json()
        if (data.isPremium) {
          if (!cancelled) {
            setVerified(true)
            setChecking(false)
          }
          return
        }
      } catch {}

      if (!cancelled && retries < 5) {
        setTimeout(() => {
          if (!cancelled) setRetries(r => r + 1)
        }, 2000)
      } else if (!cancelled) {
        setChecking(false)
      }
    }

    verify()
    return () => { cancelled = true }
  }, [ready, user, retries])

  if (!ready || !user) {
    return (
      <div className="flex items-center justify-center h-full bg-zinc-950">
        <div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950 overflow-y-auto">
      <div className="max-w-lg mx-auto w-full px-5 py-16 space-y-8">
        <div className="text-center space-y-4">
          {checking ? (
            <>
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-zinc-800/50 border border-zinc-700">
                <Loader2 size={32} className="text-white animate-spin" />
              </div>
              <h1 className="text-2xl font-bold text-white">Verifying subscription...</h1>
              <p className="text-sm text-zinc-400 max-w-xs mx-auto">
                Confirming your neesh.+ membership. This may take a moment.
              </p>
            </>
          ) : (
            <>
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/30">
                <CheckCircle size={40} className="text-emerald-400" />
              </div>
              <h1 className="text-2xl font-bold text-white">Welcome to neesh.+</h1>
              <p className="text-sm text-zinc-400 max-w-xs mx-auto">
                {verified
                  ? 'Your subscription is active. All premium features are now unlocked.'
                  : 'Payment received! Your premium features will activate shortly.'}
              </p>
            </>
          )}
        </div>

        {!checking && (
          <>
            <div className="space-y-3">
              <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider text-center">You now have access to</h3>
              <div className="grid gap-3">
                <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <CheckCircle size={16} className="text-emerald-400 flex-shrink-0" />
                  <span className="text-sm text-white">Verified badge on your profile</span>
                </div>
                <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <CheckCircle size={16} className="text-emerald-400 flex-shrink-0" />
                  <span className="text-sm text-white">GIF profile pictures & banners</span>
                </div>
                <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <CheckCircle size={16} className="text-emerald-400 flex-shrink-0" />
                  <span className="text-sm text-white">Custom profile theme colors</span>
                </div>
                <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <CheckCircle size={16} className="text-emerald-400 flex-shrink-0" />
                  <span className="text-sm text-white">Exclusive members-only chat</span>
                </div>
                <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <CheckCircle size={16} className="text-emerald-400 flex-shrink-0" />
                  <span className="text-sm text-white">Streak protection freezes</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => navigate({ to: '/premium-chat' })}
                className="w-full flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <MessageSquare size={16} className="text-white" />
                  <span className="text-sm text-white">Join NEESH.+ Chat</span>
                </div>
                <ChevronRight size={14} className="text-zinc-600" />
              </button>
              <button
                onClick={() => navigate({ to: '/profile' })}
                className="w-full flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Palette size={16} className="text-white" />
                  <span className="text-sm text-white">Customize Your Profile</span>
                </div>
                <ChevronRight size={14} className="text-zinc-600" />
              </button>
              <button
                onClick={() => navigate({ to: '/premium' })}
                className="w-full flex items-center justify-center gap-2 py-3 text-sm text-zinc-500 hover:text-white transition-colors"
              >
                <Crown size={14} />
                View membership details
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
