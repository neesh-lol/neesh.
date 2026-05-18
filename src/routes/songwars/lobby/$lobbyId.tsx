import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useIdentity } from '@/lib/identity-context'
import { supabase } from '@/lib/supabase'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Music2,
  Users,
  Crown,
  Vote,
  Play,
  RefreshCcw,
  CheckCircle,
  Trophy,
  XCircle,
  LogOut,
} from 'lucide-react'

export const Route = createFileRoute('/songwars/lobby/$lobbyId')({
  component: SongWarsLobbyPage,
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
}

type LobbyPlayerRow = {
  id: string
  lobby_id: string
  user_id: string
  joined_at: string
  eliminated: boolean | null
}

type ProfileRow = {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  is_premium: boolean | null
  is_founder_override: boolean | null
}

type GenreVoteRow = {
  id: string
  lobby_id: string
  user_id: string
  genre: string
  created_at: string
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

function statusLabel(status: string) {
  if (status === 'waiting') return 'Waiting'
  if (status === 'genreVoting') return 'Genre Voting'
  if (status === 'inMatch') return 'In Match'
  if (status === 'finished') return 'Closed'
  return status
}

function SongWarsLobbyPage() {
  const { lobbyId } = Route.useParams()
  const { user, ready } = useIdentity()
  const navigate = useNavigate()

  const [lobby, setLobby] = useState<LobbyRow | null>(null)
  const [players, setPlayers] = useState<LobbyPlayerRow[]>([])
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({})
  const [votes, setVotes] = useState<GenreVoteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (ready && !user) {
      navigate({ to: '/signin' })
    }
  }, [ready, user, navigate])

  const isHost = !!user && !!lobby && lobby.host_id === user.id
  const isInLobby = !!user && players.some((p) => p.user_id === user.id)
  const myVote = user ? votes.find((v) => v.user_id === user.id) : null

  const voteCounts = useMemo(() => {
    const counts: Record<string, number> = {}

    for (const genre of GENRES) {
      counts[genre] = 0
    }

    for (const vote of votes) {
      counts[vote.genre] = (counts[vote.genre] ?? 0) + 1
    }

    return counts
  }, [votes])

  const loadLobby = async () => {
    if (!user) return

    setLoading(true)

    const { data: lobbyData, error: lobbyError } = await supabase
      .from('songwars_lobbies')
      .select('*')
      .eq('id', lobbyId)
      .maybeSingle()

    if (lobbyError || !lobbyData) {
      console.error('Song Wars lobby load error:', lobbyError)
      setLobby(null)
      setLoading(false)
      return
    }

    setLobby(lobbyData)

    const { data: playerRows, error: playersError } = await supabase
      .from('songwars_lobby_players')
      .select('*')
      .eq('lobby_id', lobbyId)
      .order('joined_at', { ascending: true })

    if (playersError) {
      console.error('Song Wars players load error:', playersError)
      setPlayers([])
      setLoading(false)
      return
    }

    const cleanPlayers = playerRows ?? []
    setPlayers(cleanPlayers)

    const profileIds = cleanPlayers.map((p) => p.user_id)

    if (profileIds.length > 0) {
      const { data: profileRows, error: profileError } = await supabase
        .from('profiles')
        .select('id,username,display_name,avatar_url,is_premium,is_founder_override')
        .in('id', profileIds)

      if (profileError) {
        console.error('Song Wars profile load error:', profileError)
      } else {
        const map: Record<string, ProfileRow> = {}

        for (const profile of profileRows ?? []) {
          map[profile.id] = profile
        }

        setProfiles(map)
      }
    } else {
      setProfiles({})
    }

    const { data: voteRows, error: votesError } = await supabase
      .from('songwars_genre_votes')
      .select('*')
      .eq('lobby_id', lobbyId)

    if (votesError) {
      console.error('Song Wars genre votes load error:', votesError)
      setVotes([])
    } else {
      setVotes(voteRows ?? [])
    }

    setLoading(false)
  }

  useEffect(() => {
    if (!user) return

    loadLobby()

    const channel = supabase
      .channel(`songwars_lobby_${lobbyId}_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'songwars_lobbies',
          filter: `id=eq.${lobbyId}`,
        },
        () => loadLobby()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'songwars_lobby_players',
          filter: `lobby_id=eq.${lobbyId}`,
        },
        () => loadLobby()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'songwars_genre_votes',
          filter: `lobby_id=eq.${lobbyId}`,
        },
        () => loadLobby()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, lobbyId])

  const joinLobby = async () => {
    if (!user || !lobby) return

    setActionLoading('join')
    setMessage('')

    if (lobby.status === 'finished') {
      setMessage('This lobby is closed.')
      setActionLoading('')
      return
    }

    if (players.length >= lobby.max_players && !isInLobby) {
      setMessage('This lobby is full.')
      setActionLoading('')
      return
    }

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
    } else {
      setMessage('Joined lobby.')
      await loadLobby()
    }

    setActionLoading('')
  }

  const leaveLobby = async () => {
    if (!user) return

    if (isHost) {
      setMessage('Hosts can close the lobby instead of leaving.')
      return
    }

    if (!confirm('Leave this Song Wars queue?')) return

    setActionLoading('leave')
    setMessage('')

    const { error } = await supabase
      .from('songwars_lobby_players')
      .delete()
      .eq('lobby_id', lobbyId)
      .eq('user_id', user.id)

    if (error) {
      console.error('Leave lobby error:', error)
      setMessage(error.message)
      setActionLoading('')
      return
    }

    navigate({ to: '/songwars' })
  }

  const closeLobby = async () => {
    if (!isHost) return

    if (!confirm('Close this lobby? Everyone will be sent back to Song Wars.')) return

    setActionLoading('close')
    setMessage('')

    const { error } = await supabase
      .from('songwars_lobbies')
      .update({
        status: 'finished',
        updated_at: new Date().toISOString(),
      })
      .eq('id', lobbyId)

    if (error) {
      console.error('Close lobby error:', error)
      setMessage(error.message)
      setActionLoading('')
      return
    }

    setMessage('Lobby closed.')
    setActionLoading('')
    navigate({ to: '/songwars' })
  }

  const startGenreVoting = async () => {
    if (!isHost) return

    setActionLoading('genreVoting')
    setMessage('')

    if (players.length < 2) {
      setMessage('You need at least 2 players to start.')
      setActionLoading('')
      return
    }

    const { error: deleteVotesError } = await supabase
      .from('songwars_genre_votes')
      .delete()
      .eq('lobby_id', lobbyId)

    if (deleteVotesError) {
      console.error('Clear old genre votes error:', deleteVotesError)
    }

    const { error } = await supabase
      .from('songwars_lobbies')
      .update({
        status: 'genreVoting',
        active_genre: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', lobbyId)

    if (error) {
      console.error('Start genre voting error:', error)
      setMessage(error.message)
    } else {
      setMessage('Genre voting started.')
      await loadLobby()
    }

    setActionLoading('')
  }

  const castGenreVote = async (genre: string) => {
    if (!user || !isInLobby) return

    setActionLoading(`vote-${genre}`)
    setMessage('')

    const { error } = await supabase
      .from('songwars_genre_votes')
      .upsert(
        {
          lobby_id: lobbyId,
          user_id: user.id,
          genre,
        },
        {
          onConflict: 'lobby_id,user_id',
        }
      )

    if (error) {
      console.error('Cast genre vote error:', error)
      setMessage(error.message)
    } else {
      setMessage(`Voted for ${genre}.`)
      await loadLobby()
    }

    setActionLoading('')
  }

  const finishGenreVoting = async () => {
    if (!isHost || !lobby) return

    setActionLoading('finishGenre')
    setMessage('')

    let winningGenres: string[] = []
    let highest = -1

    for (const genre of GENRES) {
      const count = voteCounts[genre] ?? 0

      if (count > highest) {
        highest = count
        winningGenres = [genre]
      } else if (count === highest) {
        winningGenres.push(genre)
      }
    }

    if (highest <= 0) {
      winningGenres = ['Random']
    }

    const winner =
      winningGenres[Math.floor(Math.random() * winningGenres.length)] || 'Random'

    const activeGenre =
      winner === 'Random'
        ? GENRES.filter((g) => g !== 'Random')[
            Math.floor(Math.random() * (GENRES.length - 1))
          ]
        : winner

    const { error } = await supabase
      .from('songwars_lobbies')
      .update({
        status: 'inMatch',
        active_genre: activeGenre,
        updated_at: new Date().toISOString(),
      })
      .eq('id', lobbyId)

    if (error) {
      console.error('Finish genre voting error:', error)
      setMessage(error.message)
    } else {
      setMessage(`${activeGenre} won. Match system is next.`)
      await loadLobby()
    }

    setActionLoading('')
  }

  if (!ready || !user || loading) {
    return (
      <div className="flex items-center justify-center h-full bg-zinc-950">
        <div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  if (!lobby || lobby.status === 'finished') {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-zinc-950 px-5 text-center">
        <Music2 size={32} className="text-zinc-700 mb-3" />
        <h1 className="text-lg font-semibold text-white mb-1">
          {lobby?.status === 'finished' ? 'Lobby closed' : 'Lobby not found'}
        </h1>
        <p className="text-sm text-zinc-500 mb-4">
          {lobby?.status === 'finished'
            ? 'The host closed this Song Wars lobby.'
            : 'This Song Wars lobby does not exist.'}
        </p>
        <button
          onClick={() => navigate({ to: '/songwars' })}
          className="px-4 py-2 bg-white text-zinc-950 rounded-lg text-sm font-semibold"
        >
          Back to Song Wars
        </button>
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

          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-white flex items-center gap-2 truncate">
              <Music2 size={16} className="text-purple-400" />
              {lobby.name}
            </h1>
            <p className="text-xs text-zinc-500 truncate">
              ID: {lobby.id}
            </p>
          </div>
        </div>

        <button
          onClick={loadLobby}
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

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-500 mb-1">
                    Lobby Status
                  </p>
                  <h2 className="text-2xl font-bold text-white">
                    {statusLabel(lobby.status)}
                  </h2>
                  <p className="text-sm text-zinc-500 mt-1">
                    Active genre: {lobby.active_genre ?? 'Not chosen yet'}
                  </p>
                  <p className="text-xs text-zinc-600 mt-1">
                    {players.length}/{lobby.max_players ?? 20} players · minimum 2 to start
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {!isInLobby && (
                    <button
                      onClick={joinLobby}
                      disabled={!!actionLoading}
                      className="px-4 py-2.5 bg-white text-zinc-950 rounded-xl text-sm font-semibold hover:bg-zinc-200 transition-colors disabled:opacity-50"
                    >
                      Join Lobby
                    </button>
                  )}

                  {isInLobby && !isHost && (
                    <button
                      onClick={leaveLobby}
                      disabled={!!actionLoading}
                      className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-xl text-sm font-semibold hover:text-white transition-colors disabled:opacity-50"
                    >
                      <LogOut size={15} />
                      Leave Queue
                    </button>
                  )}

                  {isHost && (
                    <button
                      onClick={closeLobby}
                      disabled={!!actionLoading}
                      className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-sm font-semibold hover:bg-red-500/20 transition-colors disabled:opacity-50"
                    >
                      <XCircle size={15} />
                      Close Lobby
                    </button>
                  )}

                  {isHost && lobby.status === 'waiting' && (
                    <button
                      onClick={startGenreVoting}
                      disabled={!!actionLoading || players.length < 2}
                      className="flex items-center gap-2 px-4 py-2.5 bg-purple-500 text-white rounded-xl text-sm font-semibold hover:bg-purple-600 transition-colors disabled:opacity-40"
                    >
                      <Play size={15} />
                      Start Now
                    </button>
                  )}

                  {isHost && lobby.status === 'genreVoting' && (
                    <button
                      onClick={finishGenreVoting}
                      disabled={!!actionLoading}
                      className="flex items-center gap-2 px-4 py-2.5 bg-white text-zinc-950 rounded-xl text-sm font-semibold hover:bg-zinc-200 transition-colors disabled:opacity-50"
                    >
                      <Vote size={15} />
                      Finish Vote
                    </button>
                  )}
                </div>
              </div>

              {isHost && lobby.status === 'waiting' && players.length < 2 && (
                <p className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-3 py-2 mt-4">
                  Start Now unlocks when at least 2 players are in the lobby.
                </p>
              )}

              {lobby.status === 'inMatch' && (
                <div className="mt-5 bg-zinc-950 border border-zinc-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy size={16} className="text-yellow-400" />
                    <p className="text-sm font-semibold text-white">
                      Match system coming next
                    </p>
                  </div>
                  <p className="text-xs text-zinc-500">
                    Genre is locked. Next we’ll add player pairing, song submissions,
                    round voting, XP, and ELO updates.
                  </p>
                </div>
              )}
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-800">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Vote size={15} className="text-purple-400" />
                  Genre Voting
                </h2>
                <p className="text-xs text-zinc-500">
                  One vote per player. Host finishes voting to lock the genre.
                </p>
              </div>

              {lobby.status === 'waiting' ? (
                <div className="p-5 text-sm text-zinc-500">
                  Waiting for host to press Start Now.
                </div>
              ) : (
                <div className="p-5 grid sm:grid-cols-2 gap-3">
                  {GENRES.map((genre) => {
                    const count = voteCounts[genre] ?? 0
                    const selected = myVote?.genre === genre

                    return (
                      <button
                        key={genre}
                        onClick={() => lobby.status === 'genreVoting' && castGenreVote(genre)}
                        disabled={lobby.status !== 'genreVoting' || !isInLobby || !!actionLoading}
                        className={`text-left rounded-xl border p-4 transition-colors disabled:opacity-60 ${
                          selected
                            ? 'bg-purple-500/10 border-purple-500/40'
                            : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-white">{genre}</p>
                          {selected && <CheckCircle size={16} className="text-purple-400" />}
                        </div>
                        <p className="text-xs text-zinc-500 mt-1">
                          {count} vote{count === 1 ? '' : 's'}
                        </p>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden h-fit">
            <div className="px-5 py-4 border-b border-zinc-800">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Users size={15} />
                Players
              </h2>
              <p className="text-xs text-zinc-500">
                {players.length}/{lobby.max_players ?? 20} joined
              </p>
            </div>

            <div className="divide-y divide-zinc-800">
              {players.map((player, index) => {
                const profile = profiles[player.user_id]
                const displayName = profile?.display_name ?? 'User'
                const username = profile?.username ?? null
                const isPlayerHost = player.user_id === lobby.host_id

                return (
                  <div key={player.id} className="px-5 py-4 flex items-center gap-3">
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-xs text-zinc-400">
                        {displayName.slice(0, 2).toUpperCase()}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white flex items-center gap-1.5 truncate">
                        {displayName}
                        {isPlayerHost && <Crown size={13} className="text-yellow-400" />}
                      </p>
                      {username && (
                        <p className="text-xs text-zinc-500 truncate">@{username}</p>
                      )}
                    </div>

                    <span className="text-xs text-zinc-600">
                      #{index + 1}
                    </span>
                  </div>
                )
              })}

              {players.length === 0 && (
                <div className="px-5 py-8 text-center text-sm text-zinc-500">
                  No players yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
