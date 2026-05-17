import { createFileRoute } from '@tanstack/react-router'
import { useIdentity } from '@/lib/identity-context'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import { Ban, LogOut } from 'lucide-react'

export const Route = createFileRoute('/banned')({
  component: BannedPage,
})

type BanRow = {
  id: string
  user_id: string
  reason: string | null
  active: boolean | null
  created_at: string | null
}

function BannedPage() {
  const { user, ready, logout } = useIdentity()
  const [ban, setBan] = useState<BanRow | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadBan() {
      if (!user) {
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('user_bans')
        .select('*')
        .eq('user_id', user.id)
        .eq('active', true)
        .maybeSingle()

      if (error) {
        console.error('Ban page load error:', error)
      }

      setBan(data ?? null)
      setLoading(false)
    }

    if (ready) loadBan()
  }, [ready, user])

  if (!ready || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center px-5">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
          <Ban size={28} className="text-red-400" />
        </div>

        <h1 className="text-xl font-bold text-white mb-2">
          Account banned
        </h1>

        <p className="text-sm text-zinc-400 mb-5">
          Your account has been restricted from using neesh.
        </p>

        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-left mb-5">
          <p className="text-xs uppercase tracking-wider text-zinc-600 mb-1">
            Reason
          </p>
          <p className="text-sm text-zinc-300">
            {ban?.reason || 'No reason provided.'}
          </p>

          {ban?.created_at && (
            <p className="text-xs text-zinc-600 mt-3">
              Banned on{' '}
              {new Date(ban.created_at).toLocaleDateString([], {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          )}
        </div>

        <button
          onClick={() => logout()}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white text-zinc-950 rounded-xl text-sm font-semibold hover:bg-zinc-200 transition-colors"
        >
          <LogOut size={16} />
          Sign out
        </button>

        <p className="text-[11px] text-zinc-600 mt-4">
          If you think this was a mistake, contact the site owner.
        </p>
      </div>
    </div>
  )
}
