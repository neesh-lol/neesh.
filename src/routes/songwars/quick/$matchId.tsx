import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useIdentity } from '@/lib/identity-context'
import { supabase } from '@/lib/supabase'
import { SongWarsResultCard } from '@/components/SongWarsResultCard'
import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  Music2,
  Trophy,
  Upload,
  Zap,
  Link as LinkIcon,
  Volume2,
  Users,
  RefreshCcw,
} from 'lucide-react'

export const Route = createFileRoute('/songwars/quick/$matchId')({
  component: QuickSongWarsPage,
})

type QuickMatchRow = {
  id: string
  player_a_id: string
  player_b_id: string
  voter_id: string
  status: string
  round_number: number
  winner_id: string | null
  created_at: string
  updated_at: string
  submit_deadline_at: string | null
  listening_started_at: string | null
  listening_player: string | null
  listening_ends_at: string | null
}

type ProfileRow = {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  is_premium: boolean | null
  is_founder_override: boolean | null
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
  quick_wins?: number | null
  quick_losses?: number | null
  quick_win_streak?: number | null
  best_quick_win_streak?: number | null
  updated_at: string
}

function getDisplayName(profile?: ProfileRow) {
  if (!profile) return 'Unknown'
  return profile.display_name || profile.username || 'User'
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

function clipLength(start: number, end: number) {
  return Math.max(0, end - start)
}

function QuickSongWarsPage() {
  const { matchId } = Route.useParams()
  const { user, ready } = useIdentity()
  const navigate = useNavigate()
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const [match, setMatch] = useState<QuickMatchRow | null>(null)
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({})
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([])
  const [votes, setVotes] = useState<SongVoteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState('')
  const [message, setMessage] = useState('')
  const [audioError, setAudioError] = useState('')

  const [songTitle, setSongTitle] = useState('')
  const [songUrl, setSongUrl] = useState('')
  const [songFile, setSongFile] = useState<File | null>(null)
  const [startTimestamp, setStartTimestamp] = useState('0')
  const [endTimestamp, setEndTimestamp] = useState('30')
  const [nowTick, setNowTick] = useState(Date.now())

  useEffect(() => {
    if (ready && !user) {
      navigate({ to: '/signin' })
    }
  }, [ready, user, navigate])

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const isPlayerA = !!user && !!match && match.player_a_id === user.id
  const isPlayerB = !!user && !!match && match.player_b_id === user.id
  const isVoter = !!user && !!match && match.voter_id === user.id
  const isBattler = isPlayerA || isPlayerB
  const isInMatch = isBattler || isVoter

  const playerAProfile = match ? profiles[match.player_a_id] : undefined
  const playerBProfile = match ? profiles[match.player_b_id] : undefined
  const voterProfile = match ? profiles[match.voter_id] : undefined

  const playerASubmission = match
    ? submissions.find((s) => s.user_id === match.player_a_id)
    : null

  const playerBSubmission = match
    ? submissions.find((s) => s.user_id === match.player_b_id)
    : null

  const mySubmission = user
    ? submissions.find((s) => s.user_id === user.id)
    : null

  const myVote = user ? votes.find((v) => v.voter_id === user.id) : null

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

  const winnerProfile = match?.winner_id ? profiles[match.winner_id] : undefined
  const loserId =
    match?.winner_id && match.winner_id === match.player_a_id
      ? match.player_b_id
      : match?.winner_id && match.winner_id === match.player_b_id
        ? match.player_a_id
        : null
  const loserProfile = loserId ? profiles[loserId] : undefined

  const loadMatch = async (showSpinner = false) => {
    if (!user) return

    if (showSpinner) {
      setLoading(true)
    }

    const { data: matchRow, error: matchError } = await supabase
      .from('songwars_quick_matches')
      .select('*')
      .eq('id', matchId)
      .maybeSingle()

    if (matchError || !matchRow) {
      console.error('Quick match load error:', matchError)
      setMatch(null)
      setLoading(false)
      return
    }

    setMatch(matchRow)

    const ids = [matchRow.player_a_id, matchRow.player_b_id, matchRow.voter_id]

    const { data: profileRows, error: profileError } = await supabase
      .from('profiles')
      .select('id,username,display_name,avatar_url,is_premium,is_founder_override')
      .in('id', ids)

    if (profileError) {
      console.error('Quick match profile load error:', profileError)
    } else {
      const map: Record<string, ProfileRow> = {}

      for (const profile of profileRows ?? []) {
        map[profile.id] = profile
      }

      setProfiles(map)
    }

    const { data: submissionRows, error: submissionError } = await supabase
      .from('songwars_submissions')
      .select('*')
      .eq('match_id', matchId)
      .eq('round_number', 1)

    if (submissionError) {
      console.error('Quick match submissions load error:', submissionError)
      setSubmissions([])
    } else {
      setSubmissions(submissionRows ?? [])
    }

    const { data: voteRows, error: voteError } = await supabase
      .from('songwars_votes')
      .select('*')
      .eq('match_id', matchId)
      .eq('round_number', 1)

    if (voteError) {
      console.error('Quick match votes load error:', voteError)
      setVotes([])
    } else {
      setVotes(voteRows ?? [])
    }

    setLoading(false)
  }

  useEffect(() => {
    if (!user) return

    loadMatch(true)

    const channel = supabase
      .channel(`songwars_quick_${matchId}_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'songwars_quick_matches',
          filter: `id=eq.${matchId}`,
        },
        () => loadMatch(false)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'songwars_submissions',
          filter: `match_id=eq.${matchId}`,
        },
        () => loadMatch(false)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'songwars_votes',
          filter: `match_id=eq.${matchId}`,
        },
        () => loadMatch(false)
      )
      .subscribe()

    const polling = setInterval(() => loadMatch(false), 2500)

    return () => {
      clearInterval(polling)
      supabase.removeChannel(channel)
    }
  }, [user, matchId])

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
        setAudioError('Click Play Audio to hear the clip. Some browsers block automatic playback.')
      })
    }
  }, [match?.status, match?.listening_player, listeningSubmission?.id])

  useEffect(() => {
    if (!match) return

    const interval = setInterval(async () => {
      if (match.status === 'listening' && match.listening_ends_at) {
        const ended = Date.now() >= new Date(match.listening_ends_at).getTime()

        if (ended) {
          await advanceListening()
        }
      }

      if (match.status === 'submitting' && match.submit_deadline_at) {
        const deadlinePassed = Date.now() >= new Date(match.submit_deadline_at).getTime()

        if (deadlinePassed && playerASubmission && playerBSubmission) {
          await startListening()
        }
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [match, playerASubmission, playerBSubmission])

  const uploadSongFile = async () => {
    if (!songFile || !user) return null

    const ext = getFileExt(songFile.name)
    const safePath = `quick-${matchId}/round-1/${user.id}-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('songwars-submissions')
      .upload(safePath, songFile, {
        cacheControl: '3600',
        upsert: true,
        contentType: songFile.type || (ext === 'wav' ? 'audio/wav' : 'audio/mpeg'),
      })

    if (uploadError) throw uploadError

    const { data } = supabase.storage
      .from('songwars-submissions')
      .getPublicUrl(safePath)

    return data.publicUrl
  }

  const startListening = async () => {
    if (!match || !playerASubmission || !playerBSubmission) return

    const duration = clipLength(playerASubmission.start_timestamp, playerASubmission.end_timestamp)
    const now = new Date()
    const endsAt = new Date(now.getTime() + duration * 1000).toISOString()

    await supabase
      .from('songwars_quick_matches')
      .update({
        status: 'listening',
        listening_started_at: now.toISOString(),
        listening_player: 'A',
        listening_ends_at: endsAt,
        updated_at: now.toISOString(),
      })
      .eq('id', match.id)

    await loadMatch(false)
  }

  const advanceListening = async () => {
    if (!match) return

    if (match.listening_player === 'A' && playerBSubmission) {
      const duration = clipLength(playerBSubmission.start_timestamp, playerBSubmission.end_timestamp)
      const now = new Date()
      const endsAt = new Date(now.getTime() + duration * 1000).toISOString()

      await supabase
        .from('songwars_quick_matches')
        .update({
          listening_player: 'B',
          listening_started_at: now.toISOString(),
          listening_ends_at: endsAt,
          updated_at: now.toISOString(),
        })
        .eq('id', match.id)

      await loadMatch(false)
      return
    }

    await supabase
      .from('songwars_quick_matches')
      .update({
        status: 'voting',
        listening_player: null,
        listening_ends_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', match.id)

    await loadMatch(false)
  }

  const submitSong = async () => {
    if (!user || !match || !isBattler) return

    setActionLoading('submit')
    setMessage('')

    const cleanTitle = songTitle.trim() || songFile?.name || 'Untitled song'
    const start = Number(startTimestamp)
    const end = Number(endTimestamp)
    const length = end - start

    if (!songFile && !songUrl.trim()) {
      setMessage('Upload an MP3/WAV file or paste a direct MP3/WAV link.')
      setActionLoading('')
      return
    }

    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      setMessage('Start and end must be numbers.')
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
        setMessage('Only MP3 and WAV files are allowed.')
        setActionLoading('')
        return
      }
    }

    try {
      const uploadedUrl = songFile ? await uploadSongFile() : null
      const finalUrl = uploadedUrl || songUrl.trim()

      const { error } = await supabase
        .from('songwars_submissions')
        .upsert(
          {
            match_id: match.id,
            round_number: 1,
            user_id: user.id,
            song_title: cleanTitle,
            song_url: finalUrl,
            source_type: songFile ? 'upload' : 'link',
            start_timestamp: start,
            end_timestamp: end,
          },
          {
            onConflict: 'match_id,round_number,user_id',
          }
        )

      if (error) {
        console.error('Quick song submit error:', error)
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
        .eq('round_number', 1)

      const hasA = (allSubs ?? []).some((s) => s.user_id === match.player_a_id)
      const hasB = (allSubs ?? []).some((s) => s.user_id === match.player_b_id)

      if (hasA && hasB) {
        const aSub = (allSubs ?? []).find((s) => s.user_id === match.player_a_id)

        if (aSub) {
          const duration = clipLength(aSub.start_timestamp, aSub.end_timestamp)
          const now = new Date()
          const endsAt = new Date(now.getTime() + duration * 1000).toISOString()

          await supabase
            .from('songwars_quick_matches')
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
      await loadMatch(false)
    } catch (error: any) {
      console.error('Quick song upload error:', error)
      setMessage(error?.message ?? 'Could not upload song.')
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
          quick_wins: 0,
          quick_losses: 0,
          quick_win_streak: 0,
          best_quick_win_streak: 0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single()

    if (error) throw error
    return created as StatsRow
  }

  const finishQuickMatch = async (winnerId: string) => {
    if (!match) return

    const loserId = winnerId === match.player_a_id ? match.player_b_id : match.player_a_id

    const winnerStats = await ensureStats(winnerId)
    const loserStats = await ensureStats(loserId)

    const newWinnerStreak = (winnerStats.quick_win_streak ?? 0) + 1

    await supabase
      .from('songwars_stats')
      .upsert(
        {
          user_id: winnerId,
          xp: (winnerStats.xp ?? 0) + 15,
          elo: winnerStats.elo ?? 1200,
          wins: winnerStats.wins ?? 0,
          losses: winnerStats.losses ?? 0,
          win_streak: winnerStats.win_streak ?? 0,
          peak_elo: winnerStats.peak_elo ?? 1200,
          favorite_genre: winnerStats.favorite_genre,
          quick_wins: (winnerStats.quick_wins ?? 0) + 1,
          quick_losses: winnerStats.quick_losses ?? 0,
          quick_win_streak: newWinnerStreak,
          best_quick_win_streak: Math.max(winnerStats.best_quick_win_streak ?? 0, newWinnerStreak),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )

    await supabase
      .from('songwars_stats')
      .upsert(
        {
          user_id: loserId,
          xp: (loserStats.xp ?? 0) + 5,
          elo: loserStats.elo ?? 1200,
          wins: loserStats.wins ?? 0,
          losses: loserStats.losses ?? 0,
          win_streak: loserStats.win_streak ?? 0,
          peak_elo: loserStats.peak_elo ?? 1200,
          favorite_genre: loserStats.favorite_genre,
          quick_wins: loserStats.quick_wins ?? 0,
          quick_losses: (loserStats.quick_losses ?? 0) + 1,
          quick_win_streak: 0,
          best_quick_win_streak: loserStats.best_quick_win_streak ?? 0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )

    await supabase
      .from('songwars_quick_matches')
      .update({
        status: 'finished',
        winner_id: winnerId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', match.id)

    await supabase
      .from('songwars_queue')
      .delete()
      .eq('match_id', match.id)

    setMessage(`${getDisplayName(profiles[winnerId])} won the quick match.`)
    await loadMatch(false)
  }

  const castVote = async (votedForId: string) => {
    if (!user || !match || !isVoter) return

    setActionLoading('vote')
    setMessage('')

    const { error } = await supabase
      .from('songwars_votes')
      .upsert(
        {
          match_id: match.id,
          round_number: 1,
          voter_id: user.id,
          voted_for_id: votedForId,
        },
        {
          onConflict: 'match_id,round_number,voter_id',
        }
      )

    if (error) {
      console.error('Quick vote error:', error)
      setMessage(error.message)
      setActionLoading('')
      return
    }

    await finishQuickMatch(votedForId)
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
      setAudioError('Your browser blocked autoplay. Use the audio controls.')
    }
  }

  if (!ready || !user || loading) {
    return (
      <div className="flex items-center justify-center h-full bg-zinc-950">
        <div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  if (!match) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-zinc-950 px-5 text-center">
        <Music2 size={34} className="text-zinc-700 mb-3" />
        <h1 className="text-lg font-bold text-white mb-1">Quick match not found</h1>
        <p className="text-sm text-zinc-500 mb-4">This match does not exist anymore.</p>
        <button
          onClick={() => navigate({ to: '/songwars' })}
          className="px-4 py-2 bg-white text-zinc-950 rounded-lg text-sm font-semibold"
        >
          Back to Song Wars
        </button>
      </div>
    )
  }

  if (!isInMatch) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-zinc-950 px-5 text-center">
        <Users size={34} className="text-zinc-700 mb-3" />
        <h1 className="text-lg font-bold text-white mb-1">You are not in this match</h1>
        <p className="text-sm text-zinc-500 mb-4">Only the two battlers and selected voter can enter.</p>
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

          <div>
            <h1 className="text-sm font-semibold text-white flex items-center gap-2">
              <Zap size={16} className="text-emerald-400" />
              Quick Match
            </h1>
            <p className="text-xs text-zinc-500">
              Best of 1 · XP only · 2 battle, 1 votes
            </p>
          </div>
        </div>

        <button
          onClick={() => loadMatch(true)}
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

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Status</p>
              <h2 className="text-2xl font-bold text-white capitalize">{match.status}</h2>
              <p className="text-sm text-zinc-500 mt-1">
                {match.status === 'submitting' && `Submit timer: ${formatTime(submitTimeLeft)}`}
                {match.status === 'listening' && `Listening ends in ${formatTime(listeningTimeLeft)}`}
                {match.status === 'voting' && 'The voter chooses the winner.'}
                {match.status === 'finished' && 'Match complete.'}
              </p>
            </div>

            {match.winner_id && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3">
                <p className="text-xs text-emerald-300 mb-1">Winner</p>
                <p className="text-sm font-bold text-white">
                  {getDisplayName(profiles[match.winner_id])}
                </p>
              </div>
            )}
          </div>
        </div>

        {match.status === 'listening' && listeningSubmission && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-emerald-300 mb-1">
                  Now Playing
                </p>
                <h3 className="text-xl font-bold text-white">
                  {getDisplayName(listeningProfile)} · {listeningSubmission.song_title}
                </h3>
                <p className="text-xs text-zinc-500">
                  Clip {listeningSubmission.start_timestamp}s - {listeningSubmission.end_timestamp}s
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
              <p className="text-xs text-yellow-400 mt-3">{audioError}</p>
            )}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="p-5 grid md:grid-cols-2 gap-4">
              <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4">
                <div className="flex items-center gap-3 mb-4">
                  {playerAProfile?.avatar_url ? (
                    <img
                      src={playerAProfile.avatar_url}
                      alt=""
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-xs text-zinc-400">
                      A
                    </div>
                  )}

                  <div>
                    <p className="text-sm font-bold text-white">{getDisplayName(playerAProfile)}</p>
                    <p className="text-xs text-zinc-500">Player A</p>
                  </div>
                </div>

                {playerASubmission ? (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-white">{playerASubmission.song_title}</p>
                    <p className="text-xs text-zinc-500">
                      {playerASubmission.start_timestamp}s - {playerASubmission.end_timestamp}s · {playerASubmission.source_type}
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
                  <p className="text-sm text-zinc-500">Waiting for song.</p>
                )}

                {isVoter && match.status === 'voting' && (
                  <button
                    onClick={() => castVote(match.player_a_id)}
                    disabled={!!actionLoading || !!myVote}
                    className="mt-4 w-full py-2.5 bg-white text-zinc-950 rounded-xl text-sm font-bold hover:bg-zinc-200 transition-colors disabled:opacity-50"
                  >
                    Vote Player A
                  </button>
                )}
              </div>

              <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4">
                <div className="flex items-center gap-3 mb-4">
                  {playerBProfile?.avatar_url ? (
                    <img
                      src={playerBProfile.avatar_url}
                      alt=""
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-xs text-zinc-400">
                      B
                    </div>
                  )}

                  <div>
                    <p className="text-sm font-bold text-white">{getDisplayName(playerBProfile)}</p>
                    <p className="text-xs text-zinc-500">Player B</p>
                  </div>
                </div>

                {playerBSubmission ? (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-white">{playerBSubmission.song_title}</p>
                    <p className="text-xs text-zinc-500">
                      {playerBSubmission.start_timestamp}s - {playerBSubmission.end_timestamp}s · {playerBSubmission.source_type}
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
                  <p className="text-sm text-zinc-500">Waiting for song.</p>
                )}

                {isVoter && match.status === 'voting' && (
                  <button
                    onClick={() => castVote(match.player_b_id)}
                    disabled={!!actionLoading || !!myVote}
                    className="mt-4 w-full py-2.5 bg-white text-zinc-950 rounded-xl text-sm font-bold hover:bg-zinc-200 transition-colors disabled:opacity-50"
                  >
                    Vote Player B
                  </button>
                )}
              </div>
            </div>

            {isBattler && match.status === 'submitting' && (
              <div className="p-5 border-t border-zinc-800">
                <h3 className="text-sm font-semibold text-white mb-3">
                  {mySubmission ? 'Update your song' : 'Submit your song'}
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
                    placeholder="Direct MP3/WAV link, optional"
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

                  <div className="grid grid-cols-2 gap-2">
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
                  Clip must be 10-45 seconds. Uploaded MP3/WAV files work best.
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
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden h-fit">
            <div className="px-5 py-4 border-b border-zinc-800">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Users size={15} />
                Match Roles
              </h2>
            </div>

            <div className="divide-y divide-zinc-800">
              <div className="px-5 py-4">
                <p className="text-xs text-zinc-500 mb-1">Player A</p>
                <p className="text-sm font-semibold text-white">{getDisplayName(playerAProfile)}</p>
              </div>

              <div className="px-5 py-4">
                <p className="text-xs text-zinc-500 mb-1">Player B</p>
                <p className="text-sm font-semibold text-white">{getDisplayName(playerBProfile)}</p>
              </div>

              <div className="px-5 py-4">
                <p className="text-xs text-zinc-500 mb-1">Voter</p>
                <p className="text-sm font-semibold text-white">{getDisplayName(voterProfile)}</p>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-zinc-800 bg-zinc-950/40">
              <p className="text-xs text-zinc-500">
                Winner gets +15 XP and a quick win streak. Loser gets +5 XP and streak resets.
              </p>
            </div>
          </div>
        </div>

        {match.status === 'finished' && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5 text-center">
            <Trophy size={34} className="text-emerald-400 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-white mb-1">Quick Match Complete</h2>
            <p className="text-sm text-zinc-400 mb-5">
              Winner: {match.winner_id ? getDisplayName(profiles[match.winner_id]) : 'Unknown'}
            </p>

            {match.winner_id && loserId && (
              <div className="max-w-2xl mx-auto mb-5 text-left">
                <SongWarsResultCard
                  mode="quick"
                  winnerName={getDisplayName(winnerProfile)}
                  loserName={getDisplayName(loserProfile)}
                  winnerUsername={winnerProfile?.username}
                  loserUsername={loserProfile?.username}
                  winnerAvatar={winnerProfile?.avatar_url}
                  loserAvatar={loserProfile?.avatar_url}
                  score="1-0"
                  xpReward={15}
                />
              </div>
            )}

            <button
              onClick={() => navigate({ to: '/songwars' })}
              className="px-4 py-2.5 bg-white text-zinc-950 rounded-xl text-sm font-bold hover:bg-zinc-200 transition-colors"
            >
              Back to Song Wars
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
