import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useIdentity } from '@/lib/identity-context'
import { supabase } from '@/lib/supabase'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Trophy,
  Crown,
  Medal,
  Flame,
  Search,
  RefreshCcw,
  Music2,
  TrendingUp,
} from 'lucide-react'

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
  updated_at: string
}

type ProfileRow = {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  is_premium: boolean | null
  is_founder_override: boolean | null
}

type LeaderboardRow = StatsRow & {
  profile?: ProfileRow
}

function rankFromElo(elo: number, position: number) {
  if (elo >= 2500 && position <= 500) return 'Legend'
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
  if (!profile) return 'Unknown'
  return profile.display_name || profile.username || 'User'
}

function rankBadgeClasses(rank: string) {
  if (rank === 'Legend') return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300'
  if (rank === 'Champion') return 'bg-orange-500/10 border-orange-500/30 text-orange-300'
  if (rank === 'Master') return 'bg-purple-500/10 border-purple-500/30 text-purple-300'
  if (rank === 'Diamond') return 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
  if (rank === 'Platinum') return 'bg-sky-500/10 border-sky-500/30 text-sky-300'
  if (rank === 'Gold') return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300'
  if (rank === 'Silver') return 'bg-zinc-400/10 border-zinc-400/30 text-zinc-300'
  return 'bg-orange-900/20 border-orange-700/30 text-orange-400'
}

function SongWarsLeaderboardPage() {
  const { user, ready } = useIdentity()
  const navigate = useNavigate()

  const [rows, setRows] = useState<LeaderboardRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
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
      .gte('elo', 2500)
      .order('elo', { ascending: false })
      .limit(500)

    if (statsError) {
      console.error('Song Wars leaderboard load error:', statsError)
      setMessage(statsError.message)
      setRows([])
      setLoading(false)
      return
    }

    const cleanStats = (statsRows ?? []).filter((row) => (row.elo ?? 0) >= 2500)
    const userIds = cleanStats.map((row) => row.user_id)

    if (userIds.length === 0) {
      setRows([])
      setLoading(false)
      return
    }

    const { data: profileRows, error: profileError } = await supabase
      .from('profiles')
      .select('id,username,display_name,avatar_url,is_premium,is_founder_override')
      .in('id', userIds)

    if (profileError) {
      console.error('Song Wars leaderboard profile error:', profileError)
    }

    const profileMap: Record<string, ProfileRow> = {}

    for (const profile of profileRows ?? []) {
      profileMap[profile.id] = profile
    }

    const combined: LeaderboardRow[] = cleanStats.map((stat) => ({
      ...stat,
      profile: profileMap[stat.user_id],
    }))

    setRows(combined)
    setLoading(false)
  }

  useEffect(() => {
    if (!user) return
    loadLeaderboard()
  }, [user])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows

    return rows.filter((row) => {
      const name = getDisplayName(row.profile).toLowerCase()
      const username = row.profile?.username?.toLowerCase() ?? ''
      const genre = row.favorite_genre?.toLowerCase() ?? ''

      return name.includes(q) || username.includes(q) || genre.includes(q)
    })
  }, [rows, search])

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
        <div className="flex items-center gap-3 min-w-0">
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
              Legend leaderboard · 2500+ ELO only
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

      <div className="max-w-6xl w-full mx-auto px-5 py-6 space-y-6">
        {message && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-xs text-red-300">
            {message}
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-4">
          <div className="md:col-span-2 bg-gradient-to-br from-yellow-500/10 to-zinc-900 border border-yellow-500/20 rounded-2xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-yellow-300 mb-1">
                  Ranked Song Wars
                </p>
                <h2 className="text-3xl font-bold text-white">
                  Top 500
                </h2>
                <p className="text-sm text-zinc-400 mt-1">
                  Only players with 2500+ ELO can appear here. Top 500 Legend players are ranked by ELO.
                </p>
              </div>

              <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center">
                <Crown size={26} className="text-yellow-400" />
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <p className="text-xs uppercase tracking-wider text-zinc-500 mb-2">
              Search
            </p>

            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Username or genre"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
              />
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Medal size={15} />
                Rankings
              </h2>
              <p className="text-xs text-zinc-500">
                Only 2500+ ELO players are shown
              </p>
            </div>

            <p className="text-xs text-zinc-500">
              {filteredRows.length} player{filteredRows.length === 1 ? '' : 's'}
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="text-center py-16 px-5">
              <Music2 size={30} className="text-zinc-700 mx-auto mb-3" />
              <p className="text-sm font-medium text-white mb-1">No Legend players yet</p>
              <p className="text-xs text-zinc-500">Reach 2500 ELO to appear on the ranked leaderboard.</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {filteredRows.map((row, index) => {
                const position = rows.findIndex((r) => r.user_id === row.user_id) + 1
                const rank = rankFromElo(row.elo ?? 1200, position)
                const profile = row.profile
                const displayName = getDisplayName(profile)
                const username = profile?.username
                const rate = winRate(row.wins ?? 0, row.losses ?? 0)

                return (
                  <div
                    key={row.user_id}
                    className="px-5 py-4 flex items-center gap-4 hover:bg-zinc-950/40 transition-colors"
                  >
                    <div className="w-10 text-center shrink-0">
                      {position === 1 ? (
                        <Crown size={20} className="text-yellow-400 mx-auto" />
                      ) : position === 2 ? (
                        <Trophy size={19} className="text-zinc-300 mx-auto" />
                      ) : position === 3 ? (
                        <Medal size={19} className="text-orange-400 mx-auto" />
                      ) : (
                        <span className="text-sm font-bold text-zinc-500">
                          #{position}
                        </span>
                      )}
                    </div>

                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt=""
                        className="w-11 h-11 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-zinc-800 flex items-center justify-center text-xs text-zinc-400 shrink-0">
                        {displayName.slice(0, 2).toUpperCase()}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-white truncate">
                          {displayName}
                        </p>

                        {profile?.is_premium && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white text-zinc-950 font-bold">
                            NEESH.+
                          </span>
                        )}

                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${rankBadgeClasses(rank)}`}>
                          {rank}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2 mt-1">
                        {username && (
                          <p className="text-xs text-zinc-500">@{username}</p>
                        )}

                        <p className="text-xs text-zinc-600">
                          Favorite: {row.favorite_genre ?? 'None yet'}
                        </p>
                      </div>
                    </div>

                    <div className="hidden md:grid grid-cols-4 gap-4 text-right min-w-[360px]">
                      <div>
                        <p className="text-sm font-bold text-white">{row.elo ?? 1200}</p>
                        <p className="text-[11px] text-zinc-500">ELO</p>
                      </div>

                      <div>
                        <p className="text-sm font-bold text-white">
                          {row.wins ?? 0}-{row.losses ?? 0}
                        </p>
                        <p className="text-[11px] text-zinc-500">{rate}% WR</p>
                      </div>

                      <div>
                        <p className="text-sm font-bold text-white flex items-center justify-end gap-1">
                          <Flame size={13} className="text-orange-400" />
                          {row.win_streak ?? 0}
                        </p>
                        <p className="text-[11px] text-zinc-500">Streak</p>
                      </div>

                      <div>
                        <p className="text-sm font-bold text-white flex items-center justify-end gap-1">
                          <TrendingUp size={13} className="text-emerald-400" />
                          {row.peak_elo ?? 1200}
                        </p>
                        <p className="text-[11px] text-zinc-500">Peak</p>
                      </div>
                    </div>

                    <div className="md:hidden text-right shrink-0">
                      <p className="text-sm font-bold text-white">{row.elo ?? 1200}</p>
                      <p className="text-[11px] text-zinc-500">ELO</p>
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
