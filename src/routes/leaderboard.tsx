import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useIdentity } from '@/lib/identity-context'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import { Trophy, Flame } from 'lucide-react'
import { VerifiedBadge, FOUNDER_USERNAME } from '@/components/VerifiedBadge'

export const Route = createFileRoute('/leaderboard')({
  component: LeaderboardPage,
})

interface LeaderEntry {
  id: string
  netlifyId: string
  displayName: string
  username: string | null
  avatarUrl: string
  interests: string[]
  messageCount: number
  totalXp: number
  currentStreak: number
  isPremium?: boolean
  isFounderOverride?: boolean
}

function Avatar({ name, url }: { name: string; url?: string }) {
  if (url) return <img src={url} alt={name} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
  return (
    <div className="w-9 h-9 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-medium text-white flex-shrink-0">
      {name.slice(0, 2).toUpperCase()}
    </div>
  )
}

function LeaderboardPage() {
  const { user, ready } = useIdentity()
  const navigate = useNavigate()
  const [entries, setEntries] = useState<LeaderEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (ready && !user) navigate({ to: '/signin' })
  }, [ready, user, navigate])

  useEffect(() => {
    if (!user) return

    async function loadLeaderboard() {
      setLoading(true)

      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          display_name,
          username,
          avatar_url,
          interests,
          message_count,
          total_xp,
          current_streak,
          is_premium,
          is_founder_override
        `)
        .order('total_xp', { ascending: false })
        .limit(100)

      if (error) {
        console.error('Leaderboard load error:', error)
        setEntries([])
        setLoading(false)
        return
      }

      const mapped: LeaderEntry[] = (data ?? []).map((p: any) => ({
        id: p.id,
        netlifyId: p.id,
        displayName: p.display_name ?? 'User',
        username: p.username ?? null,
        avatarUrl: p.avatar_url ?? '',
        interests: p.interests ?? [],
        messageCount: p.message_count ?? 0,
        totalXp: p.total_xp ?? 0,
        currentStreak: p.current_streak ?? 0,
        isPremium: p.is_premium ?? false,
        isFounderOverride: p.is_founder_override ?? false,
      }))

      setEntries(mapped)
      setLoading(false)
    }

    loadLeaderboard()
  }, [user])

  if (!ready || !user) return null

  const rankIcon = (i: number) => {
    if (i === 0) return <span className="text-sm font-bold">🥇</span>
    if (i === 1) return <span className="text-sm font-bold">🥈</span>
    if (i === 2) return <span className="text-sm font-bold">🥉</span>
    return <span className="text-zinc-600 text-sm w-6 text-center">{i + 1}</span>
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      <div className="px-5 py-4 border-b border-zinc-800">
        <h1 className="text-sm font-semibold text-white flex items-center gap-2">
          <Trophy size={16} className="text-yellow-400" /> Leaderboard
        </h1>
        <p className="text-xs text-zinc-500">Ranked by XP · All Time</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center mt-20">
            <div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
          </div>
        )}

        {!loading && entries.length === 0 && (
          <p className="text-zinc-600 text-sm text-center mt-20">No entries yet. Start chatting to rank up!</p>
        )}

        {entries.map((entry, i) => (
          <div
            key={entry.id}
            className={`flex items-center gap-4 px-5 py-3.5 border-b border-zinc-900 hover:bg-zinc-900/50 transition-colors ${entry.netlifyId === user.id ? 'bg-zinc-900/30' : ''}`}
          >
            <div className="w-8 flex items-center justify-center flex-shrink-0">
              {rankIcon(i)}
            </div>

            <Avatar name={entry.displayName} url={entry.avatarUrl || undefined} />

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {entry.displayName}
                {entry.username && (
                  <span className="ml-1.5 text-zinc-500 font-normal">@{entry.username}</span>
                )}
                {entry.username === FOUNDER_USERNAME && <VerifiedBadge username={entry.username} size={15} className="ml-1.5" />}
                {entry.username !== FOUNDER_USERNAME && entry.isPremium && <VerifiedBadge isPremium size={15} className="ml-1.5" />}
                {entry.netlifyId === user.id && (
                  <span className="ml-2 text-xs text-zinc-500">(you)</span>
                )}
              </p>

              <div className="flex items-center gap-3 mt-0.5">
                {entry.interests && entry.interests.length > 0 && (
                  <span className="text-xs text-zinc-600 truncate">
                    {entry.interests.slice(0, 3).map((t) => `#${t}`).join(' ')}
                  </span>
                )}

                {entry.currentStreak > 0 && (
                  <span className="text-xs text-orange-400 flex items-center gap-0.5 flex-shrink-0">
                    <Flame size={10} /> {entry.currentStreak}d
                  </span>
                )}
              </div>
            </div>

            <div className="text-right flex-shrink-0">
              <p className="text-sm font-semibold text-yellow-400">{entry.totalXp.toLocaleString()} XP</p>
              <p className="text-xs text-zinc-600">{entry.messageCount} msgs</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
