import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useIdentity } from '@/lib/identity-context'
import { supabase } from '@/lib/supabase'
import { useEffect, useMemo, useRef, useState } from 'react'
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
  Swords,
  Link as LinkIcon,
  Flame,
  Zap,
  Upload,
  Volume2,
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

type MatchRow = {
  id: string
  lobby_id: string
  player_a_id: string
  player_b_id: string
  status: string
  genre: string | null
  round_number: number
  current_round?: number | null
  player_a_rounds: number
  player_b_rounds: number
  winner_id: string | null
  submit_deadline_at: string | null
  listening_started_at: string | null
  listening_player: string | null
  listening_ends_at: string | null
  created_at: string
  updated_at: string
}

type SubmissionRow = {
  id: string
  match_id: string
  round_number: number
  user_id: string
  song_title: string | null
  song_url: string
  source_type: string
  start_timestamp: number
  end_timestamp: number
  created_at: string
}

type SongVoteRow = {
  id: string
  match_id: string
  round_number: number
  voter_id: string
  voted_for_id: string
  created_at: string
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

function statusLabel(status: string) {
  if (status === 'waiting') return 'Waiting'
  if (status === 'genreVoting') return 'Genre Voting'
  if (status === 'inMatch') return 'In Match'
  if (status === 'finished') return 'Closed'
  return status
}

function matchStatusLabel(status: string) {
  if (status === 'submitting') return 'Song Submissions'
  if (status === 'listening') return 'Listening'
  if (status === 'voting') return 'Voting'
  if (status === 'finished') return 'Finished'
  return status
}

function expectedScore(playerElo: number, opponentElo: number) {
  return 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400))
}

function calculateElo(playerElo: number, opponentElo: number, score: 0 | 1, k = 32) {
  const expected = expectedScore(playerElo, opponentElo)
  return Math.round(playerElo + k * (score - expected))
}

function getDisplayName(profile?: ProfileRow) {
  if (!profile) return 'Unknown'
  return profile.display_name || profile.username || 'User'
}

function secondsBetween(start: number, end: number) {
  return Math.max(0, end - start)
}

function formatTime(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function getFileExt(fileName: string) {
  const parts = fileName.split('.')
  return parts.length > 1 ? parts.pop()?.toLowerCase() || 'mp3' : 'mp3'
}

function SongWarsLobbyPage() {
  const { lobbyId } = Route.useParams()
  const { user, ready } = useIdentity()
  const navigate = useNavigate()
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const [lobby, setLobby] = useState<LobbyRow | null>(null)
  const [players, setPlayers] = useState<LobbyPlayerRow[]>([])
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({})
  const [votes, setVotes] = useState<GenreVoteRow[]>([])
  const [match, setMatch] = useState<MatchRow | null>(null)
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([])
  const [songVotes, setSongVotes] = useState<SongVoteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState('')
  const [message, setMessage] = useState('')

  const [songTitle, setSongTitle] = useState('')
  const [songUrl, setSongUrl] = useState('')
  const [songFile, setSongFile] = useState<File | null>(null)
  const [startTimestamp, setStartTimestamp] = useState('0')
  const [endTimestamp, setEndTimestamp] = useState('30')
  const [nowTick, setNowTick] = useState(Date.now())
  const [audioError, setAudioError] = useState('')

  useEffect(() => {
    if (ready && !user) {
      navigate({ to: '/signin' })
    }
  }, [ready, user, navigate])

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const isHost = !!user && !!lobby && lobby.host_id === user.id
  const isInLobby = !!user && players.some((p) => p.user_id === user.id)
  const myVote = user ? votes.find((v) => v.user_id === user.id) : null

  const currentRound = match?.round_number ?? match?.current_round ?? 1
  const isPlayerA = !!user && !!match && match.player_a_id === user.id
  const isPlayerB = !!user && !!match && match.player_b_id === user.id
  const isBattler = isPlayerA || isPlayerB

  const playerAProfile = match ? profiles[match.player_a_id] : undefined
  const playerBProfile = match ? profiles[match.player_b_id] : undefined

  const playerASubmission = match
    ? submissions.find((s) => s.user_id === match.player_a_id && s.round_number === currentRound)
    : null

  const playerBSubmission = match
    ? submissions.find((s) => s.user_id === match.player_b_id && s.round_number === currentRound)
    : null

  const mySubmission = user
    ? submissions.find((s) => s.user_id === user.id && s.round_number === currentRound)
    : null

  const mySongVote = user
    ? songVotes.find((v) => v.voter_id === user.id && v.round_number === currentRound)
    : null

  const playerAVotes = match
    ? songVotes.filter((v) => v.voted_for_id === match.player_a_id && v.round_number === currentRound).length
    : 0

  const playerBVotes = match
    ? songVotes.filter((v) => v.voted_for_id === match.player_b_id && v.round_number === currentRound).length
    : 0

  const submitTimeLeft = match?.submit_deadline_at
    ? Math.max(0, Math.ceil((new Date(match.submit_deadline_at).getTime() - nowTick) / 1000))
    : 0

  const listeningTimeLeft = match?.listening_ends_at
    ? Math.max(0, Math.ceil((new Date(match.listening_ends_at).getTime() - nowTick) / 1000))
    : 0

  const listeningSubmission =
    match?.listening_player === 'A'
      ? playerASubmission
      : match?.listening_player === 'B'
        ? playerBSubmission
        : null

  const listeningProfile =
    match?.listening_player === 'A'
      ? playerAProfile
      : match?.listening_player === 'B'
        ? playerBProfile
        : undefined

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

  const loadLobby = async (showSpinner = false) => {
    if (!user) return

    if (showSpinner) {
      setLoading(true)
    }

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

    const { data: activeMatch, error: matchError } = await supabase
      .from('songwars_matches')
      .select('*')
      .eq('lobby_id', lobbyId)
      .neq('status', 'finished')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (matchError) {
      console.error('Song Wars match load error:', matchError)
      setMatch(null)
      setSubmissions([])
      setSongVotes([])
    } else {
      setMatch(activeMatch ?? null)

      if (activeMatch) {
        const round = activeMatch.round_number ?? activeMatch.current_round ?? 1

        const { data: submissionRows, error: submissionsError } = await supabase
          .from('songwars_submissions')
          .select('*')
          .eq('match_id', activeMatch.id)
          .eq('round_number', round)

        if (submissionsError) {
          console.error('Song Wars submissions load error:', submissionsError)
          setSubmissions([])
        } else {
          setSubmissions(submissionRows ?? [])
        }

        const { data: songVoteRows, error: songVotesError } = await supabase
          .from('songwars_votes')
          .select('*')
          .eq('match_id', activeMatch.id)
          .eq('round_number', round)

        if (songVotesError) {
          console.error('Song Wars round votes load error:', songVotesError)
          setSongVotes([])
        } else {
          setSongVotes(songVoteRows ?? [])
        }
      } else {
        setSubmissions([])
        setSongVotes([])
      }
    }

    const profileIds = Array.from(
      new Set([
        ...cleanPlayers.map((p) => p.user_id),
        activeMatch?.player_a_id,
        activeMatch?.player_b_id,
      ].filter(Boolean) as string[])
    )

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

    setLoading(false)
  }

  useEffect(() => {
    if (!user) return

    loadLobby(true)

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
        () => loadLobby(false)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'songwars_lobby_players',
          filter: `lobby_id=eq.${lobbyId}`,
        },
        () => loadLobby(false)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'songwars_genre_votes',
          filter: `lobby_id=eq.${lobbyId}`,
        },
        () => loadLobby(false)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'songwars_matches',
          filter: `lobby_id=eq.${lobbyId}`,
        },
        () => loadLobby(false)
      )
      .subscribe()

    const polling = setInterval(() => loadLobby(false), 3000)

    return () => {
      clearInterval(polling)
      supabase.removeChannel(channel)
    }
  }, [user, lobbyId])

  useEffect(() => {
    if (match?.status !== 'listening' || !listeningSubmission || !audioRef.current) return

    const audio = audioRef.current
    setAudioError('')
    audio.src = listeningSubmission.song_url
    audio.currentTime = listeningSubmission.start_timestamp
    audio.volume = 1

    const playPromise = audio.play()

    if (playPromise) {
      playPromise.catch(() => {
        setAudioError('Click Play Audio to hear this clip. Some browsers block automatic playback.')
      })
    }
  }, [match?.status, match?.listening_player, listeningSubmission?.id])

  useEffect(() => {
    if (!isHost || !match) return

    const interval = setInterval(async () => {
      if (!match) return

      if (match.status === 'submitting' && match.submit_deadline_at) {
        const deadlinePassed = Date.now() >= new Date(match.submit_deadline_at).getTime()

        if (deadlinePassed && playerASubmission && playerBSubmission) {
          await startListening()
        }
      }

      if (match.status === 'listening' && match.listening_ends_at) {
        const ended = Date.now() >= new Date(match.listening_ends_at).getTime()

        if (ended) {
          await advanceListening()
        }
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [isHost, match, playerASubmission, playerBSubmission])

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
      await loadLobby(false)
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
      await loadLobby(false)
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
      await loadLobby(false)
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
      setMessage(`${activeGenre} won. Start the first match.`)
      await loadLobby(false)
    }

    setActionLoading('')
  }

  const startMatch = async () => {
    if (!isHost || !lobby) return

    setActionLoading('startMatch')
    setMessage('')

    if (players.length < 2) {
      setMessage('Need at least 2 players to start a match.')
      setActionLoading('')
      return
    }

    if (!lobby.active_genre) {
      setMessage('Finish genre voting first.')
      setActionLoading('')
      return
    }

    const orderedPlayers = [...players].sort((a, b) => {
      if (lobby.current_champion_id === a.user_id) return -1
      if (lobby.current_champion_id === b.user_id) return 1
      return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
    })

    const playerA = orderedPlayers[0]?.user_id
    const playerB = orderedPlayers.find((p) => p.user_id !== playerA)?.user_id

    if (!playerA || !playerB) {
      setMessage('Could not select two players.')
      setActionLoading('')
      return
    }

    const submitDeadline = new Date(Date.now() + 5 * 60 * 1000).toISOString()

    const { data: newMatch, error } = await supabase
      .from('songwars_matches')
      .insert({
        lobby_id: lobbyId,
        player_a_id: playerA,
        player_b_id: playerB,
        status: 'submitting',
        genre: lobby.active_genre,
        round_number: 1,
        current_round: 1,
        player_a_rounds: 0,
        player_b_rounds: 0,
        submit_deadline_at: submitDeadline,
        listening_started_at: null,
        listening_player: null,
        listening_ends_at: null,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error || !newMatch) {
      console.error('Start match error:', error)
      setMessage(error?.message ?? 'Could not start match.')
      setActionLoading('')
      return
    }

    setMessage('Match started. Players have 5 minutes to submit songs.')
    await loadLobby(false)
    setActionLoading('')
  }

  const uploadSongFile = async () => {
    if (!songFile || !match || !user) return null

    const ext = getFileExt(songFile.name)
    const safeName = `${match.id}/round-${currentRound}/${user.id}-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('songwars-submissions')
      .upload(safeName, songFile, {
        cacheControl: '3600',
        upsert: true,
        contentType: songFile.type || (ext === 'wav' ? 'audio/wav' : 'audio/mpeg'),
      })

    if (uploadError) {
      throw uploadError
    }

    const { data } = supabase.storage
      .from('songwars-submissions')
      .getPublicUrl(safeName)

    return data.publicUrl
  }

  const startListening = async () => {
    if (!match || !playerASubmission) return

    const duration = secondsBetween(playerASubmission.start_timestamp, playerASubmission.end_timestamp)
    const now = new Date()
    const endsAt = new Date(now.getTime() + duration * 1000).toISOString()

    await supabase
      .from('songwars_matches')
      .update({
        status: 'listening',
        listening_started_at: now.toISOString(),
        listening_player: 'A',
        listening_ends_at: endsAt,
        updated_at: now.toISOString(),
      })
      .eq('id', match.id)

    await loadLobby(false)
  }

  const advanceListening = async () => {
    if (!match) return

    if (match.listening_player === 'A' && playerBSubmission) {
      const duration = secondsBetween(playerBSubmission.start_timestamp, playerBSubmission.end_timestamp)
      const now = new Date()
      const endsAt = new Date(now.getTime() + duration * 1000).toISOString()

      await supabase
        .from('songwars_matches')
        .update({
          listening_player: 'B',
          listening_started_at: now.toISOString(),
          listening_ends_at: endsAt,
          updated_at: now.toISOString(),
        })
        .eq('id', match.id)

      await loadLobby(false)
      return
    }

    await supabase
      .from('songwars_matches')
      .update({
        status: 'voting',
        listening_player: null,
        listening_ends_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', match.id)

    await loadLobby(false)
  }

  const submitSong = async () => {
    if (!user || !match || !isBattler) return

    setActionLoading('submitSong')
    setMessage('')

    const cleanTitle = songTitle.trim() || songFile?.name || 'Untitled song'
    const start = Number(startTimestamp)
    const end = Number(endTimestamp)
    const length = end - start

    if (!songFile && !songUrl.trim()) {
      setMessage('Upload an MP3/WAV file or paste a direct song link.')
      setActionLoading('')
      return
    }

    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      setMessage('Start and end timestamps must be numbers.')
      setActionLoading('')
      return
    }

    if (length < 10) {
      setMessage('Clip must be at least 10 seconds.')
      setActionLoading('')
      return
    }

    if (length > 45) {
      setMessage('Clip cannot be longer than 45 seconds.')
      setActionLoading('')
      return
    }

    if (songFile) {
      const lower = songFile.name.toLowerCase()
      if (!lower.endsWith('.mp3') && !lower.endsWith('.wav')) {
        setMessage('Only MP3 and WAV uploads are allowed.')
        setActionLoading('')
        return
      }
    }

    try {
      const uploadedUrl = songFile ? await uploadSongFile() : null
      const finalUrl = uploadedUrl || songUrl.trim()
      const sourceType = songFile ? 'upload' : 'link'

      const { error } = await supabase
        .from('songwars_submissions')
        .upsert(
          {
            match_id: match.id,
            round_number: currentRound,
            user_id: user.id,
            song_title: cleanTitle,
            song_url: finalUrl,
            source_type: sourceType,
            start_timestamp: start,
            end_timestamp: end,
          },
          {
            onConflict: 'match_id,round_number,user_id',
          }
        )

      if (error) {
        console.error('Submit song error:', error)
        setMessage(error.message)
        setActionLoading('')
        return
      }

      setSongTitle('')
      setSongUrl('')
      setSongFile(null)
      setStartTimestamp('0')
      setEndTimestamp('30')

      const { data: allSubs } = await supabase
        .from('songwars_submissions')
        .select('*')
        .eq('match_id', match.id)
        .eq('round_number', currentRound)

      const hasA = (allSubs ?? []).some((s) => s.user_id === match.player_a_id)
      const hasB = (allSubs ?? []).some((s) => s.user_id === match.player_b_id)

      if (hasA && hasB) {
        const aSub = (allSubs ?? []).find((s) => s.user_id === match.player_a_id)

        if (aSub) {
          const duration = secondsBetween(aSub.start_timestamp, aSub.end_timestamp)
          const now = new Date()
          const endsAt = new Date(now.getTime() + duration * 1000).toISOString()

          await supabase
            .from('songwars_matches')
            .update({
              status: 'listening',
              listening_started_at: now.toISOString(),
              listening_player: 'A',
              listening_ends_at: endsAt,
              updated_at: now.toISOString(),
            })
            .eq('id', match.id)
        }
      }

      setMessage('Song submitted.')
      await loadLobby(false)
    } catch (error: any) {
      console.error('Upload song error:', error)
      setMessage(error?.message ?? 'Could not upload song.')
    }

    setActionLoading('')
  }

  const castSongVote = async (votedForId: string) => {
    if (!user || !match) return

    setActionLoading(`songVote-${votedForId}`)
    setMessage('')

    if (user.id === match.player_a_id || user.id === match.player_b_id) {
      setMessage('Battlers cannot vote in their own round.')
      setActionLoading('')
      return
    }

    const { error } = await supabase
      .from('songwars_votes')
      .upsert(
        {
          match_id: match.id,
          round_number: currentRound,
          voter_id: user.id,
          voted_for_id: votedForId,
        },
        {
          onConflict: 'match_id,round_number,voter_id',
        }
      )

    if (error) {
      console.error('Cast song vote error:', error)
      setMessage(error.message)
    } else {
      setMessage('Vote submitted.')
      await loadLobby(false)
    }

    setActionLoading('')
  }

  const ensureStats = async (userId: string) => {
    const { data } = await supabase
      .from('songwars_stats')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (data) return data as StatsRow

    const { data: created, error } = await supabase
      .from('songwars_stats')
      .upsert(
        {
          user_id: userId,
          xp: 0,
          elo: 1200,
          wins: 0,
          losses: 0,
          win_streak: 0,
          peak_elo: 1200,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id',
        }
      )
      .select()
      .single()

    if (error) throw error
    return created as StatsRow
  }

  const finishMatch = async (winnerId: string, loserId: string) => {
    if (!match || !lobby) return

    const winnerStats = await ensureStats(winnerId)
    const loserStats = await ensureStats(loserId)

    const newWinnerElo = calculateElo(winnerStats.elo ?? 1200, loserStats.elo ?? 1200, 1)
    const newLoserElo = calculateElo(loserStats.elo ?? 1200, winnerStats.elo ?? 1200, 0)

    await supabase
      .from('songwars_stats')
      .upsert(
        {
          user_id: winnerId,
          xp: (winnerStats.xp ?? 0) + 25,
          elo: newWinnerElo,
          wins: (winnerStats.wins ?? 0) + 1,
          losses: winnerStats.losses ?? 0,
          win_streak: (winnerStats.win_streak ?? 0) + 1,
          peak_elo: Math.max(winnerStats.peak_elo ?? 1200, newWinnerElo),
          favorite_genre: lobby.active_genre,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )

    await supabase
      .from('songwars_stats')
      .upsert(
        {
          user_id: loserId,
          xp: (loserStats.xp ?? 0) + 10,
          elo: newLoserElo,
          wins: loserStats.wins ?? 0,
          losses: (loserStats.losses ?? 0) + 1,
          win_streak: 0,
          peak_elo: Math.max(loserStats.peak_elo ?? 1200, newLoserElo),
          favorite_genre: loserStats.favorite_genre ?? lobby.active_genre,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )

    const voterIds = Array.from(
      new Set(songVotes.filter((v) => v.round_number === currentRound).map((v) => v.voter_id))
    )

    for (const voterId of voterIds) {
      if (voterId === winnerId || voterId === loserId) continue
      const voterStats = await ensureStats(voterId)

      await supabase
        .from('songwars_stats')
        .upsert(
          {
            user_id: voterId,
            xp: (voterStats.xp ?? 0) + 2,
            elo: voterStats.elo ?? 1200,
            wins: voterStats.wins ?? 0,
            losses: voterStats.losses ?? 0,
            win_streak: voterStats.win_streak ?? 0,
            peak_elo: voterStats.peak_elo ?? 1200,
            favorite_genre: voterStats.favorite_genre,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
    }

    await supabase
      .from('songwars_matches')
      .update({
        status: 'finished',
        winner_id: winnerId,
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', match.id)

    await supabase
      .from('songwars_lobbies')
      .update({
        current_champion_id: winnerId,
        status: 'inMatch',
        updated_at: new Date().toISOString(),
      })
      .eq('id', lobbyId)

    await supabase
      .from('songwars_lobby_players')
      .update({
        eliminated: true,
      })
      .eq('lobby_id', lobbyId)
      .eq('user_id', loserId)
  }

  const resolveRound = async () => {
    if (!isHost || !match) return

    setActionLoading('resolveRound')
    setMessage('')

    if (match.status !== 'voting') {
      setMessage('Listen phase must finish before resolving.')
      setActionLoading('')
      return
    }

    if (!playerASubmission || !playerBSubmission) {
      setMessage('Both players need submissions.')
      setActionLoading('')
      return
    }

    let roundWinnerId = match.player_a_id

    if (playerBVotes > playerAVotes) {
      roundWinnerId = match.player_b_id
    } else if (playerAVotes === playerBVotes) {
      roundWinnerId = Math.random() > 0.5 ? match.player_a_id : match.player_b_id
    }

    const nextARounds = match.player_a_rounds + (roundWinnerId === match.player_a_id ? 1 : 0)
    const nextBRounds = match.player_b_rounds + (roundWinnerId === match.player_b_id ? 1 : 0)

    if (nextARounds >= 2 || nextBRounds >= 2) {
      const winnerId = nextARounds >= 2 ? match.player_a_id : match.player_b_id
      const loserId = winnerId === match.player_a_id ? match.player_b_id : match.player_a_id

      await supabase
        .from('songwars_matches')
        .update({
          player_a_rounds: nextARounds,
          player_b_rounds: nextBRounds,
          updated_at: new Date().toISOString(),
        })
        .eq('id', match.id)

      await finishMatch(winnerId, loserId)
      setMessage(`${getDisplayName(profiles[winnerId])} won the match.`)
      await loadLobby(false)
      setActionLoading('')
      return
    }

    const nextRound = currentRound + 1
    const submitDeadline = new Date(Date.now() + 5 * 60 * 1000).toISOString()

    const { error } = await supabase
      .from('songwars_matches')
      .update({
        status: 'submitting',
        round_number: nextRound,
        current_round: nextRound,
        player_a_rounds: nextARounds,
        player_b_rounds: nextBRounds,
        submit_deadline_at: submitDeadline,
        listening_started_at: null,
        listening_player: null,
        listening_ends_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', match.id)

    if (error) {
      console.error('Resolve round error:', error)
      setMessage(error.message)
    } else {
      setMessage(`Round ${currentRound} resolved. Round ${nextRound} started.`)
      await loadLobby(false)
    }

    setActionLoading('')
  }

  const handleAudioTimeUpdate = () => {
    if (!audioRef.current || !listeningSubmission) return

    if (audioRef.current.currentTime >= listeningSubmission.end_timestamp) {
      audioRef.current.pause()
    }
  }

  const playAudioManually = async () => {
    if (!audioRef.current || !listeningSubmission) return

    setAudioError('')
    audioRef.current.currentTime = listeningSubmission.start_timestamp

    try {
      await audioRef.current.play()
    } catch {
      setAudioError('Your browser blocked autoplay. Click play on the audio controls.')
    }
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
          onClick={() => loadLobby(true)}
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

                  {isHost && lobby.status === 'inMatch' && !match && (
                    <button
                      onClick={startMatch}
                      disabled={!!actionLoading}
                      className="flex items-center gap-2 px-4 py-2.5 bg-white text-zinc-950 rounded-xl text-sm font-semibold hover:bg-zinc-200 transition-colors disabled:opacity-50"
                    >
                      <Swords size={15} />
                      Start Match
                    </button>
                  )}
                </div>
              </div>

              {isHost && lobby.status === 'waiting' && players.length < 2 && (
                <p className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-3 py-2 mt-4">
                  Start Now unlocks when at least 2 players are in the lobby.
                </p>
              )}
            </div>

            {lobby.status !== 'inMatch' && (
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
            )}

            {lobby.status === 'inMatch' && match && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Swords size={15} className="text-red-400" />
                      Round {currentRound} · {matchStatusLabel(match.status)}
                    </h2>
                    <p className="text-xs text-zinc-500">
                      Best of 3 · {match.genre ?? lobby.active_genre}
                    </p>
                  </div>

                  <div className="text-xs text-zinc-400 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2">
                    {getDisplayName(playerAProfile)} {match.player_a_rounds} - {match.player_b_rounds}{' '}
                    {getDisplayName(playerBProfile)}
                  </div>
                </div>

                {match.status === 'submitting' && (
                  <div className="px-5 py-4 border-b border-zinc-800 bg-purple-500/5">
                    <p className="text-sm font-semibold text-white">
                      Submit timer: {formatTime(submitTimeLeft)}
                    </p>
                    <p className="text-xs text-zinc-500">
                      Player A and Player B have 5 minutes to upload or link a song clip.
                    </p>
                  </div>
                )}

                {match.status === 'listening' && listeningSubmission && (
                  <div className="px-5 py-5 border-b border-zinc-800 bg-zinc-950">
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                      <div>
                        <p className="text-xs uppercase tracking-wider text-purple-300 mb-1">
                          Now Playing
                        </p>
                        <h3 className="text-lg font-bold text-white">
                          {getDisplayName(listeningProfile)} · {listeningSubmission.song_title}
                        </h3>
                        <p className="text-xs text-zinc-500">
                          Clip {listeningSubmission.start_timestamp}s - {listeningSubmission.end_timestamp}s · Next phase in {formatTime(listeningTimeLeft)}
                        </p>
                      </div>

                      <button
                        onClick={playAudioManually}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white text-zinc-950 rounded-xl text-sm font-semibold hover:bg-zinc-200 transition-colors"
                      >
                        <Volume2 size={15} />
                        Play Audio
                      </button>
                    </div>

                    <audio
                      ref={audioRef}
                      controls
                      onTimeUpdate={handleAudioTimeUpdate}
                      className="w-full"
                    />

                    {audioError && (
                      <p className="text-xs text-yellow-400 mt-3">
                        {audioError}
                      </p>
                    )}

                    <p className="text-xs text-zinc-500 mt-3">
                      Uploaded MP3/WAV files play directly here. Some outside links may not support in-page playback.
                    </p>
                  </div>
                )}

                <div className="p-5 grid md:grid-cols-2 gap-4">
                  <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4">
                    <div className="flex items-center gap-3 mb-4">
                      {playerAProfile?.avatar_url ? (
                        <img src={playerAProfile.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-xs text-zinc-400">
                          A
                        </div>
                      )}

                      <div>
                        <p className="text-sm font-semibold text-white">{getDisplayName(playerAProfile)}</p>
                        <p className="text-xs text-zinc-500">Player A · {playerAVotes} votes</p>
                      </div>
                    </div>

                    {playerASubmission ? (
                      <div className="space-y-3">
                        <p className="text-sm font-medium text-white">{playerASubmission.song_title}</p>
                        <p className="text-xs text-zinc-500">
                          Clip: {playerASubmission.start_timestamp}s - {playerASubmission.end_timestamp}s · {playerASubmission.source_type}
                        </p>
                        <a
                          href={playerASubmission.song_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 text-xs text-purple-300 hover:text-purple-200"
                        >
                          <LinkIcon size={13} />
                          Open song
                        </a>
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-500">Waiting for submission.</p>
                    )}

                    {match.status === 'voting' && !isBattler && (
                      <button
                        onClick={() => castSongVote(match.player_a_id)}
                        disabled={!!actionLoading}
                        className={`mt-4 w-full py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
                          mySongVote?.voted_for_id === match.player_a_id
                            ? 'bg-purple-500 text-white'
                            : 'bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white'
                        }`}
                      >
                        Vote Player A
                      </button>
                    )}
                  </div>

                  <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4">
                    <div className="flex items-center gap-3 mb-4">
                      {playerBProfile?.avatar_url ? (
                        <img src={playerBProfile.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-xs text-zinc-400">
                          B
                        </div>
                      )}

                      <div>
                        <p className="text-sm font-semibold text-white">{getDisplayName(playerBProfile)}</p>
                        <p className="text-xs text-zinc-500">Player B · {playerBVotes} votes</p>
                      </div>
                    </div>

                    {playerBSubmission ? (
                      <div className="space-y-3">
                        <p className="text-sm font-medium text-white">{playerBSubmission.song_title}</p>
                        <p className="text-xs text-zinc-500">
                          Clip: {playerBSubmission.start_timestamp}s - {playerBSubmission.end_timestamp}s · {playerBSubmission.source_type}
                        </p>
                        <a
                          href={playerBSubmission.song_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 text-xs text-purple-300 hover:text-purple-200"
                        >
                          <LinkIcon size={13} />
                          Open song
                        </a>
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-500">Waiting for submission.</p>
                    )}

                    {match.status === 'voting' && !isBattler && (
                      <button
                        onClick={() => castSongVote(match.player_b_id)}
                        disabled={!!actionLoading}
                        className={`mt-4 w-full py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
                          mySongVote?.voted_for_id === match.player_b_id
                            ? 'bg-purple-500 text-white'
                            : 'bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white'
                        }`}
                      >
                        Vote Player B
                      </button>
                    )}
                  </div>
                </div>

                {isBattler && match.status === 'submitting' && (
                  <div className="p-5 border-t border-zinc-800">
                    <h3 className="text-sm font-semibold text-white mb-3">
                      {mySubmission ? 'Update your song submission' : 'Submit your song'}
                    </h3>

                    <div className="grid md:grid-cols-4 gap-3">
                      <input
                        value={songTitle}
                        onChange={(e) => setSongTitle(e.target.value)}
                        placeholder="Song title"
                        className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
                      />

                      <input
                        value={songUrl}
                        onChange={(e) => setSongUrl(e.target.value)}
                        placeholder="Direct song link, optional if uploading"
                        className="md:col-span-2 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
                      />

                      <label className="flex items-center justify-center gap-2 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-300 hover:text-white cursor-pointer">
                        <Upload size={15} />
                        {songFile ? songFile.name.slice(0, 18) : 'Upload MP3/WAV'}
                        <input
                          type="file"
                          accept=".mp3,.wav,audio/mpeg,audio/wav,audio/x-wav"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0] ?? null
                            setSongFile(file)
                            if (file && !songTitle.trim()) {
                              setSongTitle(file.name.replace(/\.(mp3|wav)$/i, ''))
                            }
                          }}
                        />
                      </label>

                      <div className="grid grid-cols-2 gap-2 md:col-span-1">
                        <input
                          value={startTimestamp}
                          onChange={(e) => setStartTimestamp(e.target.value)}
                          placeholder="Start"
                          className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
                        />
                        <input
                          value={endTimestamp}
                          onChange={(e) => setEndTimestamp(e.target.value)}
                          placeholder="End"
                          className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
                        />
                      </div>
                    </div>

                    <p className="text-xs text-zinc-500 mt-2">
                      Clip must be 10-45 seconds. MP3/WAV uploads play directly in the lobby.
                    </p>

                    <button
                      onClick={submitSong}
                      disabled={!!actionLoading}
                      className="mt-4 flex items-center gap-2 px-4 py-2.5 bg-white text-zinc-950 rounded-xl text-sm font-semibold hover:bg-zinc-200 transition-colors disabled:opacity-50"
                    >
                      <Zap size={15} />
                      Submit Song
                    </button>
                  </div>
                )}

                {isHost && match.status === 'voting' && (
                  <div className="p-5 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">Resolve Round</p>
                      <p className="text-xs text-zinc-500">
                        Current votes: {getDisplayName(playerAProfile)} {playerAVotes} · {getDisplayName(playerBProfile)} {playerBVotes}
                      </p>
                    </div>

                    <button
                      onClick={resolveRound}
                      disabled={!!actionLoading}
                      className="flex items-center gap-2 px-4 py-2.5 bg-white text-zinc-950 rounded-xl text-sm font-semibold hover:bg-zinc-200 transition-colors disabled:opacity-50"
                    >
                      <CheckCircle size={15} />
                      Resolve Round
                    </button>
                  </div>
                )}
              </div>
            )}

            {lobby.status === 'inMatch' && !match && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy size={16} className="text-yellow-400" />
                  <p className="text-sm font-semibold text-white">Ready for match</p>
                </div>
                <p className="text-xs text-zinc-500">
                  Host can start the next 1v1 battle.
                </p>
              </div>
            )}
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
                const isChampion = player.user_id === lobby.current_champion_id
                const isEliminated = player.eliminated === true

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
                        {isChampion && <Flame size={13} className="text-orange-400" />}
                      </p>
                      {username && (
                        <p className="text-xs text-zinc-500 truncate">@{username}</p>
                      )}
                      {isEliminated && (
                        <p className="text-[11px] text-red-400">Eliminated from rotation</p>
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
