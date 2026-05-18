import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useIdentity } from '@/lib/identity-context'
import { supabase } from '@/lib/supabase'
import { useEffect, useMemo, useState } from 'react'
import {
  Music2,
  Trophy,
  Flame,
  Zap,
  Crown,
  Users,
  Plus,
  RefreshCcw,
  Search,
  Swords,
  Radio,
  Medal,
  XCircle,
} from 'lucide-react'

export const Route = createFileRoute('/songwars')({
  component: SongWarsPage,
})

type LobbyRow = {
  id: string
  name: string
  host_id: string
  status: string
  active_genre: string | null
  max_players: number
  current_champion_id: string | null
  created_at: string
  updated_at: string
  closed_at?: string | null
}

type LobbyPlayerRow = {
  id: string
  lobby_id: string
  user_id: string
  joined_at: string
  eliminated: boolean | null
  left_at?: string | null
}

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

const GENRES = [
  'Underground Rap',
  'Indie',
  'Alternative',
  'Opium',
  'Rock',
  'Hyperpop',
  'Pop',
  'Random',
]

function rankFromElo(elo: number, legendPosition?: number | null) {
  if (legendPosition && legendPosition <= 500) return 'Legend'
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

function statusLabel(status: string) {
  if (status === 'waiting') return 'Waiting'
  if (status === 'genreVoting') return 'Genre Voting'
  if (status === 'inMatch') return 'In Match'
  if (status === 'finished') return 'Closed'
  return status
}

function SongWarsPage() {
  const { user, ready } = useIdentity()
  const navigate = useNavigate()

  const [stats, setStats] = useState<StatsRow | null>(null)
  const [lobbies, setLobbies] = useState<LobbyRow[]>([])
  const [playerCounts, setPlayerCounts] = useState<Record<string, number>>({})
  const [myLobbyIds, setMyLobbyIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState('')
  const [message, setMessage] = useState('')
  const [lobbyName, setLobbyName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (ready && !user) {
      navigate({ to: '/signin' })
    }
  }, [ready, user, navigate])

  const loadStats = async () => {
    if (!user) return

    const { data: existing, error } = await supabase
      .from('songwars_stats')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      console.error('Song Wars stats load error:', error)
      return
    }

    if (existing) {
      setStats(existing)
      return
    }

    const { data: created, error: createError } = await supabase
      .from('songwars_stats')
      .upsert(
        {
          user_id: user.id,
          xp: 0,
          elo: 1200,
          wins: 0,
          losses: 0,
          win_streak: 0,
          peak_elo: 1200,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single()

    if (createError) {
      console.error('Song Wars stats create error:', createError)
      return
    }

    setStats(created)
  }

  const loadLobbies = async () => {
    if (!user) return

    setLoading(true)

    const { data: lobbyRows, error } = await supabase
      .from('songwars_lobbies')
      .select('*')
      .neq('status', 'finished')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Song Wars lobby load error:', error)
      setLobbies([])
      setLoading(false)
      return
    }

    const rows = lobbyRows ?? []
    setLobbies(rows)

    const lobbyIds = rows.map((l) => l.id)

    if (lobbyIds.length > 0) {
      const { data: players, error: playersError } = await supabase
        .from('songwars_lobby_players')
        .select('*')
        .in('lobby_id', lobbyIds)

      if (playersError) {
        console.error('Song Wars player count error:', playersError)
      } else {
        const counts: Record<string, number> = {}
        const mine = new Set<string>()

        for (const p of (players ?? []) as LobbyPlayerRow[]) {
          counts[p.lobby_id] = (counts[p.lobby_id] ?? 0) + 1

          if (p.user_id === user.id) {
            mine.add(p.lobby_id)
          }
        }

        setPlayerCounts(counts)
        setMyLobbyIds(mine)
      }
    } else {
      setPlayerCounts({})
      setMyLobbyIds(new Set())
    }

    setLoading(false)
  }

  const loadAll = async () => {
    await Promise.all([loadStats(), loadLobbies()])
  }

  useEffect(() => {
    if (!user) return

    loadAll()

    const channel = supabase
      .channel(`songwars_home_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'songwars_lobbies',
        },
        () => {
          loadLobbies()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'songwars_lobby_players',
        },
        () => {
          loadLobbies()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'songwars_stats',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          loadStats()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  const filteredLobbies = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return lobbies

    return lobbies.filter((lobby) => {
      return (
        lobby.name.toLowerCase().includes(q) ||
        lobby.id.toLowerCase().includes(q) ||
        (lobby.active_genre ?? '').toLowerCase().includes(q)
      )
    })
  }, [lobbies, search])

  const leaveOtherActiveLobbies = async () => {
    if (!user) return

    const { data: activeLobbies, error } = await supabase
      .from('songwars_lobbies')
      .select('id,status')
      .neq('status', 'finished')

    if (error) {
      console.error('Load active Song Wars lobbies error:', error)
      return
    }

    const activeIds = (activeLobbies ?? []).map((l) => l.id)

    if (activeIds.length === 0) return

    const { error: deleteError } = await supabase
      .from('songwars_lobby_players')
      .delete()
      .eq('user_id', user.id)
      .in('lobby_id', activeIds)

    if (deleteError) {
      console.error('Leave other Song Wars lobbies error:', deleteError)
    }
  }

  const closeLobby = async (lobbyId: string) => {
    if (!user) return

    if (!confirm('Close this lobby?')) return

    setActionLoading(`close-${lobbyId}`)
    setMessage('')

    const { error } = await supabase
      .from('songwars_lobbies')
      .update({
        status: 'finished',
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', lobbyId)
      .eq('host_id', user.id)

    if (error) {
      console.error('Close lobby error:', error)
      setMessage(error.message)
      setActionLoading('')
      return
    }

    setMessage('Lobby closed.')
    await loadLobbies()
    setActionLoading('')
  }

  const createLobby = async () => {
    if (!user) return

    setActionLoading('create')
    setMessage('')

    await leaveOtherActiveLobbies()

    const { error: closeOldError } = await supabase
      .from('songwars_lobbies')
      .update({
        status: 'finished',
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('host_id', user.id)
      .neq('status', 'finished')

    if (closeOldError) {
      console.error('Close old hosted lobbies error:', closeOldError)
    }

    const cleanName = lobbyName.trim() || 'Song Wars Lobby'

    const { data: lobby, error } = await supabase
      .from('songwars_lobbies')
      .insert({
        name: cleanName,
        host_id: user.id,
        status: 'waiting',
        max_players: 20,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error || !lobby) {
      console.error('Create Song Wars lobby error:', error)
      setMessage(error?.message ?? 'Could not create lobby.')
      setActionLoading('')
      return
    }

    const { error: joinError } = await supabase
      .from('songwars_lobby_players')
      .upsert(
        {
          lobby_id: lobby.id,
          user_id: user.id,
          eliminated: false,
        },
        {
          onConflict: 'lobby_id,user_id',
        }
      )

    if (joinError) {
      console.error('Auto-join lobby error:', joinError)
      setMessage(joinError.message)
      setActionLoading('')
      return
    }

    setLobbyName('')
    setActionLoading('')

    window.location.href = `/songwars/lobby/${lobby.id}`
  }

  const joinLobby = async (lobbyId: string) => {
    if (!user) return

    setActionLoading(lobbyId)
    setMessage('')

    const { data: lobby, error: lobbyError } = await supabase
      .from('songwars_lobbies')
      .select('*')
      .eq('id', lobbyId)
      .maybeSingle()

    if (lobbyError || !lobby) {
      console.error('Join lobby lookup error:', lobbyError)
      setMessage('Lobby not found.')
      setActionLoading('')
      return
    }

    if (lobby.status === 'finished') {
      setMessage('This lobby is already closed.')
      setActionLoading('')
      return
    }

    const alreadyJoined = myLobbyIds.has(lobbyId)

    if (!alreadyJoined) {
      const { count, error: countError } = await supabase
        .from('songwars_lobby_players')
        .select('*', { count: 'exact', head: true })
        .eq('lobby_id', lobbyId)

      if (countError) {
        console.error('Lobby count error:', countError)
        setMessage(countError.message)
        setActionLoading('')
        return
      }

      if ((count ?? 0) >= (lobby.max_players ?? 20)) {
        setMessage('This lobby is full.')
        setActionLoading('')
        return
      }

      await leaveOtherActiveLobbies()

      const { error } = await supabase
        .from('songwars_lobby_players')
        .upsert(
          {
            lobby_id: lobbyId,
            user_id: user.id,
            eliminated: false,
          },
          {
            onConflict: 'lobby_id,user_id',
          }
        )

      if (error) {
        console.error('Join lobby error:', error)
        setMessage(error.message)
        setActionLoading('')
        return
      }
    }

    setJoinCode('')
    setActionLoading('')

    window.location.href = `/songwars/lobby/${lobbyId}`
  }

  const joinByCode = async () => {
    const clean = joinCode.trim()
    if (!clean) return
    await joinLobby(clean)
  }

  if (!ready || !user) {
    return (
      <div className="flex items-center justify-center h-full bg-zinc-950">
        <div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  const elo = stats?.elo ?? 1200
  const xp = stats?.xp ?? 0
  const wins = stats?.wins ?? 0
  const losses = stats?.losses ?? 0
  const streak = stats?.win_streak ?? 0
  const peak = stats?.peak_elo ?? 1200
  const rank = rankFromElo(elo)

  return (
    <div className="flex flex-col h-full bg-zinc-950 overflow-y-auto">
      <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-white flex items-center gap-2">
            <Music2 size={16} className="text-purple-400" />
            Song Wars
          </h1>
          <p className="text-xs text-zinc-500">1v1 ranked music battles</p>
        </div>

        <button
          onClick={loadAll}
          className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors"
        >
          <RefreshCcw size={14} />
          Refresh
        </button>
      </div>

      <div className="max-w-6xl w-full mx-auto px-5 py-6 space-y-6">
        {message && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-xs text-zinc-300">
            {message}
          </div>
        )}

        <div className="grid lg:grid-cols-4 gap-4">
          <div className="lg:col-span-2 bg-gradient-to-br from-purple-500/10 to-zinc-900 border border-purple-500/20 rounded-2xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-purple-300 mb-1">
                  Your Rank
                </p>
                <h2 className="text-3xl font-bold text-white flex items-center gap-2">
                  {rank}
                  {rank === 'Legend' && <Crown size={22} className="text-yellow-400" />}
                </h2>
                <p className="text-sm text-zinc-400 mt-1">
                  {elo} ELO · Peak {peak}
                </p>
              </div>

              <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center">
                <Medal size={26} className="text-white" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-5">
              <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-3">
                <Zap size={14} className="text-yellow-400 mb-1" />
                <p className="text-lg font-bold text-white">{xp}</p>
                <p className="text-[11px] text-zinc-500">Song XP</p>
              </div>

              <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-3">
                <Trophy size={14} className="text-emerald-400 mb-1" />
                <p className="text-lg font-bold text-white">{wins}-{losses}</p>
                <p className="text-[11px] text-zinc-500">{winRate(wins, losses)}% win rate</p>
              </div>

              <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-3">
                <Flame size={14} className="text-orange-400 mb-1" />
                <p className="text-lg font-bold text-white">{streak}</p>
                <p className="text-[11px] text-zinc-500">Win streak</p>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Plus size={16} className="text-zinc-400" />
              <h3 className="text-sm font-semibold text-white">Create Lobby</h3>
            </div>

            <input
              value={lobbyName}
              onChange={(e) => setLobbyName(e.target.value)}
              placeholder="Lobby name"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 mb-3"
            />

            <button
              onClick={createLobby}
              disabled={actionLoading === 'create'}
              className="w-full flex items-center justify-center gap-2 bg-white text-zinc-950 rounded-xl py-2.5 text-sm font-semibold hover:bg-zinc-200 transition-colors disabled:opacity-50"
            >
              <Swords size={15} />
              Create
            </button>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Radio size={16} className="text-zinc-400" />
              <h3 className="text-sm font-semibold text-white">Join by ID</h3>
            </div>

            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="Paste lobby ID"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 mb-3"
            />

            <button
              onClick={joinByCode}
              disabled={!joinCode.trim() || !!actionLoading}
              className="w-full flex items-center justify-center gap-2 bg-zinc-800 border border-zinc-700 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-zinc-700 transition-colors disabled:opacity-50"
            >
              <Users size={15} />
              Join
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-white">Open Lobbies</h2>
                <p className="text-xs text-zinc-500">You can only be in one lobby at a time</p>
              </div>

              <div className="relative w-48">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
                />
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-16">
                <div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
              </div>
            ) : filteredLobbies.length === 0 ? (
              <div className="text-center py-16 px-5">
                <Music2 size={30} className="text-zinc-700 mx-auto mb-3" />
                <p className="text-sm font-medium text-white mb-1">No lobbies yet</p>
                <p className="text-xs text-zinc-500">Create the first Song Wars lobby.</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800">
                {filteredLobbies.map((lobby) => {
                  const count = playerCounts[lobby.id] ?? 0
                  const joined = myLobbyIds.has(lobby.id)
                  const full = count >= (lobby.max_players ?? 20)
                  const isHost = lobby.host_id === user.id

                  return (
                    <div
                      key={lobby.id}
                      className="px-5 py-4 flex items-center justify-between gap-4 hover:bg-zinc-950/40 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-semibold text-white truncate">
                            {lobby.name}
                          </p>

                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400">
                            {statusLabel(lobby.status)}
                          </span>

                          {joined && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300">
                              Joined
                            </span>
                          )}

                          {isHost && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-300">
                              Host
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-zinc-500 truncate">
                          ID: {lobby.id}
                        </p>

                        <div className="flex flex-wrap gap-2 mt-2">
                          <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                            <Users size={12} />
                            {count}/{lobby.max_players ?? 20}
                          </span>

                          <span className="text-[11px] text-zinc-500">
                            Genre: {lobby.active_genre ?? 'Not chosen'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isHost && (
                          <button
                            onClick={() => closeLobby(lobby.id)}
                            disabled={!!actionLoading}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                          >
                            <XCircle size={13} />
                            Close
                          </button>
                        )}

                        <button
                          onClick={() => joinLobby(lobby.id)}
                          disabled={!!actionLoading || (full && !joined)}
                          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${
                            joined
                              ? 'bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white'
                              : 'bg-white text-zinc-950 hover:bg-zinc-200'
                          }`}
                        >
                          {joined ? 'Enter' : full ? 'Full' : 'Join'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 h-fit">
            <h2 className="text-sm font-semibold text-white mb-2">Genres</h2>
            <p className="text-xs text-zinc-500 mb-4">
              Lobby members vote before battles start. Ties are picked randomly.
            </p>

            <div className="flex flex-wrap gap-2">
              {GENRES.map((genre) => (
                <span
                  key={genre}
                  className="px-3 py-1.5 rounded-full bg-zinc-950 border border-zinc-800 text-xs text-zinc-400"
                >
                  {genre}
                </span>
              ))}
            </div>

            <div className="mt-6 border-t border-zinc-800 pt-4">
              <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">
                Coming Next
              </h3>
              <div className="space-y-2 text-xs text-zinc-500">
                <p>• Genre voting room</p>
                <p>• 1v1 match setup</p>
                <p>• Song submission</p>
                <p>• Voting + ELO updates</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
