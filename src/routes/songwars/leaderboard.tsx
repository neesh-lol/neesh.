import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useIdentity } from '@/lib/identity-context'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import { ArrowLeft, Trophy, RefreshCcw, Crown } from 'lucide-react'

export const Route = createFileRoute('/songwars/leaderboard')({
  component: SongWarsLeaderboardPage,
})

type StatsRow = {
  user_id: string
  xp: number
  elo: number
  wins: number
  losses: number
  win_streak: number
  peak_elo: number
  favorite_genre: string | null
}

type ProfileRow = {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  is_premium: boolean | null
}

type Row = StatsRow & {
  profile?: ProfileRow
}

function getRankName(elo: number, position: number) {
  if (position <= 500) return 'Legend'
  if (elo >= 2200) return 'Champion'
  if (elo >= 1900) return 'Master'
  if (elo >= 1600) return 'Diamond'
  if (elo >= 1400) return 'Platinum'
  if (elo >= 1100) return 'Gold'
  if (elo >= 800) return 'Silver'
  return 'Bronze'
}

function winRate(wins: number, losses: number) {
  const total = wins + losses
  if (total === 0) return 0
  return Math.round((wins / total) * 100)
}

function getDisplayName(profile?: ProfileRow) {
  return profile?.display_name || profile?.username || 'Unknown User'
}

function SongWarsLeaderboardPage() {
  const { user, ready } = useIdentity()
  const navigate = useNavigate()

  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (ready && !user) {
      navigate({ to: '/signin' })
    }
  }, [ready, user, navigate])

  const loadLeaderboard = async () => {
    setLoading(true)
    setMessage('')

    const { data: statsRows, error: statsError } = await supabase
      .from('songwars_stats')
      .select('*')
      .order('elo', { ascending: false })
      .limit(500)

    if (statsError) {
      console.error('Song Wars leaderboard stats error:', statsError)
      setMessage(statsError.message)
      setRows([])
      setLoading(false)
      return
    }

    const stats = statsRows ?? []
    const userIds = stats.map((s) => s.user_id)

    if (userIds.length === 0) {
      setRows([])
      setLoading(false)
      return
    }

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id,username,display_name,avatar_url,is_premium')
      .in('id', userIds)

    if (profilesError) {
      console.error('Song Wars leaderboard profiles error:', profilesError)
    }

    const profileMap: Record<string, ProfileRow> = {}

    for (const profile of profiles ?? []) {
      profileMap[profile.id] = profile
    }

    setRows(
      stats.map((stat) => ({
        ...stat,
        profile: profileMap[stat.user_id],
      }))
    )

    setLoading(false)
  }

  useEffect(() => {
    if (!user) return
    loadLeaderboard()
  }, [user])

  if (!ready || !user) {
    return (
      <div className="flex items-center justify-center h-full bg-zinc-950">
        <div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950 overflow-y-auto">
      <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate({ to: '/songwars' })}
            className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} />
          </button>

          <div>
            <h1 className="text-sm font-semibold text-white flex items-center gap-2">
              <Trophy size={16} className="text-yellow-400" />
              Song Wars Ranked Leaderboard
            </h1>
            <p className="text-xs text-zinc-500">
              Top players by ELO
            </p>
          </div>
        </div>

        <button
          onClick={loadLeaderboard}
          className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors"
        >
          <RefreshCcw size={14} />
          Refresh
        </button>
      </div>

      <div className="max-w-5xl w-full mx-auto px-5 py-6 space-y-5">
        {message && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-xs text-red-300">
            {message}
          </div>
        )}

        <div className="bg-gradient-to-br from-yellow-500/10 to-zinc-900 border border-yellow-500/20 rounded-2xl p-5">
          <p className="text-xs uppercase tracking-wider text-yellow-300 mb-1">
            Ranked Song Wars
          </p>
          <h2 className="text-3xl font-bold text-white flex items-center gap-2">
            Top 500
            <Crown size={24} className="text-yellow-400" />
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            Top Legend players only. Reach 2500 ELO to appear.
          </p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800">
            <h2 className="text-sm font-semibold text-white">Rankings</h2>
            <p className="text-xs text-zinc-500">Sorted by highest ELO</p>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-16 px-5">
              <Trophy size={32} className="text-zinc-700 mx-auto mb-3" />
              <p className="text-sm font-medium text-white mb-1">No ranked players yet</p>
              <p className="text-xs text-zinc-500">
                Ranked Song Wars results will show here after matches are played.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {rows.map((row, index) => {
                const position = index + 1
                const rankName = getRankName(row.elo ?? 1200, position)
                const name = getDisplayName(row.profile)
                const username = row.profile?.username
                const rate = winRate(row.wins ?? 0, row.losses ?? 0)

                return (
                  <div
                    key={row.user_id}
                    className="px-5 py-4 flex items-center gap-4 hover:bg-zinc-950/40 transition-colors"
                  >
                    <div className="w-10 text-center shrink-0">
                      <span className="text-sm font-bold text-zinc-400">
                        #{position}
                      </span>
                    </div>

                    {row.profile?.avatar_url ? (
                      <img
                        src={row.profile.avatar_url}
                        alt=""
                        className="w-11 h-11 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-zinc-800 flex items-center justify-center text-xs text-zinc-400 shrink-0">
                        {name.slice(0, 2).toUpperCase()}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-white truncate">
                          {name}
                        </p>

                        {row.profile?.is_premium && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white text-zinc-950 font-bold">
                            NEESH.+
                          </span>
                        )}

                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300">
                          {rankName}
                        </span>
                      </div>

                      <p className="text-xs text-zinc-500">
                        {username ? `@${username}` : 'No username'} · Favorite: {row.favorite_genre ?? 'None yet'}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-bold text-white">{row.elo ?? 1200}</p>
                      <p className="text-[11px] text-zinc-500">ELO</p>
                    </div>

                    <div className="hidden sm:block text-right">
                      <p className="text-sm font-bold text-white">
                        {row.wins ?? 0}-{row.losses ?? 0}
                      </p>
                      <p className="text-[11px] text-zinc-500">{rate}% WR</p>
                    </div>

                    <div className="hidden md:block text-right">
                      <p className="text-sm font-bold text-white">{row.win_streak ?? 0}</p>
                      <p className="text-[11px] text-zinc-500">Streak</p>
                    </div>

                    <div className="hidden md:block text-right">
                      <p className="text-sm font-bold text-white">{row.peak_elo ?? 1200}</p>
                      <p className="text-[11px] text-zinc-500">Peak</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
