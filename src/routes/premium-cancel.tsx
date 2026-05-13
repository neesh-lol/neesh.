import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useIdentity } from '@/lib/identity-context'
import { useEffect } from 'react'
import { ArrowLeft, Crown } from 'lucide-react'

export const Route = createFileRoute('/premium-cancel')({
  component: PremiumCancelPage,
})

function PremiumCancelPage() {
  const { user, ready } = useIdentity()
  const navigate = useNavigate()

  useEffect(() => {
    if (ready && !user) navigate({ to: '/signin' })
  }, [ready, user])

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
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-zinc-900 border border-zinc-800">
            <Crown size={36} className="text-zinc-600" />
          </div>
          <h1 className="text-2xl font-bold text-white">Checkout canceled</h1>
          <p className="text-sm text-zinc-500 max-w-xs mx-auto">
            No worries — your account is unchanged. You can subscribe to neesh.+ anytime you're ready.
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => navigate({ to: '/premium' })}
            className="w-full py-3.5 bg-white text-zinc-950 font-semibold rounded-xl text-sm hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2"
          >
            <Crown size={16} />
            Try again
          </button>
          <button
            onClick={() => navigate({ to: '/home' })}
            className="w-full flex items-center justify-center gap-2 py-3 text-sm text-zinc-500 hover:text-white transition-colors"
          >
            <ArrowLeft size={14} />
            Back to home
          </button>
        </div>
      </div>
    </div>
  )
}
