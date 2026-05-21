import { createFileRoute, Outlet, useLocation, useNavigate } from '@tanstack/react-router'
import { useIdentity } from '@/lib/identity-context'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import {
  Music2,
  Trophy,
  Flame,
  Zap,
  Crown,
  Users,
  RefreshCcw,
  Search,
  Swords,
  Lock,
  Play,
  Timer,
  Radio,
  Shield,
  Sparkles,
} from 'lucide-react'

export const Route = createFileRoute('/songwars')({
  component: SongWarsPage,
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
  quick_wins?: number | null
  quick_losses?: number | null
  quick_win_streak?: number | null
  best_quick_win_streak?: number | null
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

type QueueRow = {
  id: string
  user_id: string
  mode?: string
  status: string
  joined_at: string
  match_id: string | null
  created_at: string
}

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

function formatTime(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function SongWarsPage() {
  const { user, ready } = useIdentity()
  const navigate = useNavigate()
  const location = useLocation()

  const isSongWarsChild =
    location.pathname.startsWith('/songwars/lobby/') ||
    location.pathname.startsWith('/songwars/leaderboard') ||
    location.pathname.startsWith('/songwars/ranks') ||
    location.pathname.startsWith('/songwars/quick/') ||
    location.pathname.startsWith('/songwars/ranked/')

  const [stats, setStats] = useState<StatsRow | null>(null)
  const [profile, setProfile] = useState<ProfileRow | null>(null)

  const [quickQueueRows, setQuickQueueRows] = useState<QueueRow[]>([])
  const [myQuickQueueRow, setMyQuickQueueRow] = useState<QueueRow | null>(null)

  const [rankedQueueRows, setRankedQueueRows] = useState<QueueRow[]>([])
  const [myRankedQueueRow, setMyRankedQueueRow] = useState<QueueRow | null>(null)

  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState('')
  const [message, setMessage] = useState('')
  const [nowTick, setNowTick] = useState(Date.now())

  const isPremium =
    profile?.is_premium === true ||
    profile?.is_founder_override === true ||
    profile?.username === 'ceo' ||
    profile?.username === '@ceo'

  const isQuickQueued = !!myQuickQueueRow && myQuickQueueRow.status === 'queued'
  const quickQueueCount = quickQueueRows.filter((row) => row.status === 'queued').length
  const quickWaitingSeconds = myQuickQueueRow?.joined_at
    ? Math.max(0, Math.floor((nowTick - new Date(myQuickQueueRow.joined_at).getTime()) / 1000))
    : 0

  const isRankedQueued = !!myRankedQueueRow && myRankedQueueRow.status === 'queued'
  const rankedQueueCount = rankedQueueRows.filter((row) => row.status === 'queued').length
  const rankedWaitingSeconds = myRankedQueueRow?.joined_at
    ? Math.max(0, Math.floor((nowTick - new Date(myRankedQueueRow.joined_at).getTime()) / 1000))
    : 0

  useEffect(() => {
    if (ready && !user) {
      navigate({ to: '/signin' })
    }
  }, [ready, user, navigate])

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const loadProfile = async () => {
    if (!user) return

    const { data, error } = await supabase
      .from('profiles')
      .select('id,username,display_name,avatar_url,is_premium,is_founder_override')
      .eq('id', user.id)
      .maybeSingle()

    if (error) {
      console.error('Song Wars profile load error:', error)
      return
    }

    setProfile(data ?? null)
  }

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

    if (createError) {
      console.error('Song Wars stats create error:', createError)
      return
    }

    setStats(created)
  }

  const loadQuickQueue = async () => {
    if (!user) return

    const { data, error } = await supabase
      .from('songwars_queue')
      .select('*')
      .eq('mode', 'quick')
      .in('status', ['queued', 'matched'])
      .order('joined_at', { ascending: true })

    if (error) {
      console.error('Song Wars quick queue load error:', error)
      setQuickQueueRows([])
      setMyQuickQueueRow(null)
      return
    }

    const rows = data ?? []
    setQuickQueueRows(rows)

    const mine = rows.find((row) => row.user_id === user.id) ?? null
    setMyQuickQueueRow(mine)

    if (mine?.status === 'matched' && mine.match_id) {
      window.location.assign(`/songwars/quick/${mine.match_id}`)
    }
  }

  const loadRankedQueue = async () => {
    if (!user) return

    const { data, error } = await supabase
      .from('songwars_ranked_queue')
      .select('*')
      .in('status', ['queued', 'matched'])
      .order('joined_at', { ascending: true })

    if (error) {
      console.error('Song Wars ranked queue load error:', error)
      setRankedQueueRows([])
      setMyRankedQueueRow(null)
      return
    }

    const rows = data ?? []
    setRankedQueueRows(rows)

    const mine = rows.find((row) => row.user_id === user.id) ?? null
    setMyRankedQueueRow(mine)

    if (mine?.status === 'matched' && mine.match_id) {
      window.location.assign(`/songwars/ranked/${mine.match_id}`)
    }
  }

  const loadAll = async (showSpinner = false) => {
    if (!user) return

    if (showSpinner) {
      setLoading(true)
    }

    await Promise.all([loadProfile(), loadStats(), loadQuickQueue(), loadRankedQueue()])

    setLoading(false)
  }

  useEffect(() => {
    if (!user || isSongWarsChild) return

    loadAll(true)

    const channel = supabase
      .channel(`songwars_home_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'songwars_queue',
        },
        () => {
          loadQuickQueue()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'songwars_quick_matches',
        },
        () => {
          loadQuickQueue()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'songwars_ranked_queue',
        },
        () => {
          loadRankedQueue()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'songwars_ranked_matches',
        },
        () => {
          loadRankedQueue()
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

    const polling = setInterval(() => {
      loadQuickQueue()
      loadRankedQueue()
    }, 2500)

    return () => {
      clearInterval(polling)
      supabase.removeChannel(channel)
    }
  }, [user, isSongWarsChild])

  const tryCreateQuickMatch = async () => {
    if (!user) return

    const { data: queuedRows, error: queueError } = await supabase
      .from('songwars_queue')
      .select('*')
      .eq('mode', 'quick')
      .eq('status', 'queued')
      .order('joined_at', { ascending: true })
      .limit(3)

    if (queueError) {
      console.error('Load quick queue error:', queueError)
      setMessage(queueError.message)
      return
    }

    const queued = queuedRows ?? []
    if (queued.length < 3) return

    const playerA = queued[0]
    const playerB = queued[1]
    const voter = queued[2]

    const submitDeadline = new Date(Date.now() + 5 * 60 * 1000).toISOString()

    const { data: match, error: matchError } = await supabase
      .from('songwars_quick_matches')
      .insert({
        player_a_id: playerA.user_id,
        player_b_id: playerB.user_id,
        voter_id: voter.user_id,
        status: 'submitting',
        round_number: 1,
        submit_deadline_at: submitDeadline,
        listening_started_at: null,
        listening_player: null,
        listening_ends_at: null,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (matchError || !match) {
      console.error('Create quick match error:', matchError)
      setMessage(matchError?.message ?? 'Could not create quick match.')
      return
    }

    const matchedIds = queued.map((row) => row.id)

    const { error: updateQueueError } = await supabase
      .from('songwars_queue')
      .update({
        status: 'matched',
        match_id: match.id,
      })
      .in('id', matchedIds)

    if (updateQueueError) {
      console.error('Update quick queue error:', updateQueueError)
      setMessage(updateQueueError.message)
      return
    }

    if (queued.some((row) => row.user_id === user.id)) {
      window.location.assign(`/songwars/quick/${match.id}`)
    }
  }

  const tryCreateRankedMatch = async () => {
    if (!user) return

    const { data: queuedRows, error: queueError } = await supabase
      .from('songwars_ranked_queue')
      .select('*')
      .eq('status', 'queued')
      .order('joined_at', { ascending: true })
      .limit(3)

    if (queueError) {
      console.error('Load ranked queue error:', queueError)
      setMessage(queueError.message)
      return
    }

    const queued = queuedRows ?? []
    if (queued.length < 3) return

    const playerA = queued[0]
    const playerB = queued[1]
    const voter = queued[2]

    const submitDeadline = new Date(Date.now() + 5 * 60 * 1000).toISOString()

    const { data: match, error: matchError } = await supabase
      .from('songwars_ranked_matches')
      .insert({
        player_a_id: playerA.user_id,
        player_b_id: playerB.user_id,
        voter_id: voter.user_id,
        status: 'submitting',
        round_number: 1,
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

    if (matchError || !match) {
      console.error('Create ranked match error:', matchError)
      setMessage(matchError?.message ?? 'Could not create ranked match.')
      return
    }

    const matchedIds = queued.map((row) => row.id)

    const { error: updateQueueError } = await supabase
      .from('songwars_ranked_queue')
      .update({
        status: 'matched',
        match_id: match.id,
      })
      .in('id', matchedIds)

    if (updateQueueError) {
      console.error('Update ranked queue error:', updateQueueError)
      setMessage(updateQueueError.message)
      return
    }

    if (queued.some((row) => row.user_id === user.id)) {
      window.location.assign(`/songwars/ranked/${match.id}`)
    }
  }

  const joinQuickQueue = async () => {
    if (!user) return

    setActionLoading('quick')
    setMessage('')

    const { data: existing, error: existingError } = await supabase
      .from('songwars_queue')
      .select('*')
      .eq('user_id', user.id)
      .eq('mode', 'quick')
      .in('status', ['queued', 'matched'])
      .maybeSingle()

    if (existingError) {
      console.error('Check quick queue error:', existingError)
      setMessage(existingError.message)
      setActionLoading('')
      return
    }

    if (existing?.status === 'matched' && existing.match_id) {
      window.location.assign(`/songwars/quick/${existing.match_id}`)
      return
    }

    if (!existing) {
      const { error } = await supabase
        .from('songwars_queue')
        .insert({
          user_id: user.id,
          mode: 'quick',
          status: 'queued',
        })

      if (error) {
        console.error('Join quick queue error:', error)
        setMessage(error.message)
        setActionLoading('')
        return
      }
    }

    await loadQuickQueue()
    await tryCreateQuickMatch()
    setActionLoading('')
  }

  const leaveQuickQueue = async () => {
    if (!user) return

    setActionLoading('leaveQuick')
    setMessage('')

    const { error } = await supabase
      .from('songwars_queue')
      .delete()
      .eq('user_id', user.id)
      .eq('mode', 'quick')
      .eq('status', 'queued')

    if (error) {
      console.error('Leave quick queue error:', error)
      setMessage(error.message)
      setActionLoading('')
      return
    }

    await loadQuickQueue()
    setActionLoading('')
  }

  const joinRankedQueue = async () => {
    if (!user) return

    setActionLoading('ranked')
    setMessage('')

    if (!isPremium) {
      setMessage('Ranked Song Wars is locked. Upgrade to NEESH.+ to play ranked.')
      setActionLoading('')
      return
    }

    const { data: existing, error: existingError } = await supabase
      .from('songwars_ranked_queue')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['queued', 'matched'])
      .maybeSingle()

    if (existingError) {
      console.error('Check ranked queue error:', existingError)
      setMessage(existingError.message)
      setActionLoading('')
      return
    }

    if (existing?.status === 'matched' && existing.match_id) {
      window.location.assign(`/songwars/ranked/${existing.match_id}`)
      return
    }

    if (!existing) {
      const { error } = await supabase
        .from('songwars_ranked_queue')
        .insert({
          user_id: user.id,
          status: 'queued',
        })

      if (error) {
        console.error('Join ranked queue error:', error)
        setMessage(error.message)
        setActionLoading('')
        return
      }
    }

    await loadRankedQueue()
    await tryCreateRankedMatch()
    setActionLoading('')
  }

  const leaveRankedQueue = async () => {
    if (!user) return

    setActionLoading('leaveRanked')
    setMessage('')

    const { error } = await supabase
      .from('songwars_ranked_queue')
      .delete()
      .eq('user_id', user.id)
      .eq('status', 'queued')

    if (error) {
      console.error('Leave ranked queue error:', error)
      setMessage(error.message)
      setActionLoading('')
      return
    }

    await loadRankedQueue()
    setActionLoading('')
  }

  if (isSongWarsChild) {
    return <Outlet />
  }

  if (!ready || !user || loading) {
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
  const peak = stats?.peak_elo ?? 1200
  const rank = rankFromElo(elo)
  const quickWins = stats?.quick_wins ?? 0
  const quickLosses = stats?.quick_losses ?? 0
  const quickStreak = stats?.quick_win_streak ?? 0
  const bestQuickStreak = stats?.best_quick_win_streak ?? 0

  return (
    <div className="flex flex-col h-full bg-zinc-950 overflow-y-auto">
      <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-sm font-semibold text-white flex items-center gap-2">
            <Music2 size={16} className="text-purple-400" />
            Song Wars
          </h1>
          <p className="text-xs text-zinc-500">Choose your mode</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => navigate({ to: '/songwars/ranks' })}
            className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors"
          >
            <Crown size={14} />
            Ranks
          </button>

          <button
            onClick={() => navigate({ to: '/songwars/leaderboard' })}
            className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors"
          >
            <Trophy size={14} />
            Ranked Leaderboard
          </button>

          <button
            onClick={() => loadAll(true)}
            className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors"
          >
            <RefreshCcw size={14} />
            Refresh
          </button>
        </div>
      </div>

      <div className="max-w-6xl w-full mx-auto px-5 py-6 space-y-6">
        {message && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-xs text-zinc-300">
            {message}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-gradient-to-br from-purple-500/10 to-zinc-900 border border-purple-500/20 rounded-2xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-purple-300 mb-1">
                  Your Song Wars Rank
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
                <Shield size={26} className="text-white" />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3 mt-5">
              <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-3">
                <Zap size={14} className="text-yellow-400 mb-1" />
                <p className="text-lg font-bold text-white">{xp}</p>
                <p className="text-[11px] text-zinc-500">Song XP</p>
              </div>

              <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-3">
                <Trophy size={14} className="text-emerald-400 mb-1" />
                <p className="text-lg font-bold text-white">{wins}-{losses}</p>
                <p className="text-[11px] text-zinc-500">{winRate(wins, losses)}% WR</p>
              </div>

              <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-3">
                <Flame size={14} className="text-orange-400 mb-1" />
                <p className="text-lg font-bold text-white">{quickStreak}</p>
                <p className="text-[11px] text-zinc-500">Quick streak</p>
              </div>

              <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-3">
                <Sparkles size={14} className="text-purple-400 mb-1" />
                <p className="text-lg font-bold text-white">{bestQuickStreak}</p>
                <p className="text-[11px] text-zinc-500">Best streak</p>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <p className="text-xs uppercase tracking-wider text-zinc-500 mb-2">
              Queue Status
            </p>

            <div className="space-y-3">
              <div className="flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3">
                <span className="text-xs text-zinc-500 flex items-center gap-2">
                  <Users size={14} />
                  Quick Queue
                </span>
                <span className="text-sm font-bold text-white">{quickQueueCount}/3</span>
              </div>

              <div className="flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3">
                <span className="text-xs text-zinc-500 flex items-center gap-2">
                  <Crown size={14} />
                  Ranked Queue
                </span>
                <span className="text-sm font-bold text-white">{rankedQueueCount}/3</span>
              </div>

              <div className="flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3">
                <span className="text-xs text-zinc-500 flex items-center gap-2">
                  <Timer size={14} />
                  Waiting
                </span>
                <span className="text-sm font-bold text-white">
                  {isQuickQueued
                    ? formatTime(quickWaitingSeconds)
                    : isRankedQueued
                      ? formatTime(rankedWaitingSeconds)
                      : '0:00'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
            <div className="p-6 bg-gradient-to-br from-emerald-500/10 to-zinc-950 border-b border-zinc-800">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Play size={18} className="text-emerald-400" />
                    <h2 className="text-2xl font-bold text-white">Quick Match</h2>
                  </div>

                  <p className="text-sm text-zinc-400">
                    Free, fast, best of 1. Win to build your quick streak.
                  </p>
                </div>

                <span className="text-[11px] px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                  FREE
                </span>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3">
                  <p className="text-lg font-bold text-white">Best of 1</p>
                  <p className="text-[11px] text-zinc-500">Fast battle</p>
                </div>

                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3">
                  <p className="text-lg font-bold text-white">XP only</p>
                  <p className="text-[11px] text-zinc-500">No ELO loss</p>
                </div>

                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3">
                  <p className="text-lg font-bold text-white">3 needed</p>
                  <p className="text-[11px] text-zinc-500">2 fight, 1 votes</p>
                </div>
              </div>

              <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-white">Looking for Match</p>
                  <p className="text-xs text-zinc-500">{quickQueueCount}/3 in queue</p>
                </div>

                <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 transition-all"
                    style={{
                      width: `${Math.min(100, (quickQueueCount / 3) * 100)}%`,
                    }}
                  />
                </div>

                <p className="text-xs text-zinc-500 mt-3">
                  {isQuickQueued
                    ? `You have been waiting ${formatTime(quickWaitingSeconds)}.`
                    : 'Queue starts when you press Look for Match.'}
                </p>
              </div>

              {isQuickQueued ? (
                <button
                  onClick={leaveQuickQueue}
                  disabled={!!actionLoading}
                  className="w-full py-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-semibold hover:bg-red-500/20 transition-colors disabled:opacity-50"
                >
                  Cancel Queue
                </button>
              ) : (
                <button
                  onClick={joinQuickQueue}
                  disabled={!!actionLoading || isRankedQueued}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-white text-zinc-950 text-sm font-bold hover:bg-zinc-200 transition-colors disabled:opacity-50"
                >
                  <Search size={16} />
                  Look for Match
                </button>
              )}

              <div className="text-xs text-zinc-500">
                Quick record: {quickWins}-{quickLosses} · Current streak: {quickStreak}
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden relative">
            {!isPremium && (
              <div className="absolute inset-0 bg-zinc-950/70 backdrop-blur-[2px] z-10 flex items-center justify-center p-6">
                <div className="text-center max-w-xs">
                  <div className="w-14 h-14 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Lock size={24} className="text-zinc-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">Ranked Locked</h3>
                  <p className="text-sm text-zinc-400 mb-4">
                    Ranked Song Wars is a NEESH.+ perk.
                  </p>
                  <button
                    onClick={() => {
                      window.location.href = '/premium'
                    }}
                    className="px-4 py-2.5 bg-white text-zinc-950 rounded-xl text-sm font-bold hover:bg-zinc-200 transition-colors"
                  >
                    Upgrade to NEESH.+
                  </button>
                </div>
              </div>
            )}

            <div className="p-6 bg-gradient-to-br from-yellow-500/10 to-zinc-950 border-b border-zinc-800">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Crown size={18} className="text-yellow-400" />
                    <h2 className="text-2xl font-bold text-white">Ranked</h2>
                  </div>

                  <p className="text-sm text-zinc-400">
                    NEESH.+ competitive mode with ELO, ranks, and leaderboard placement.
                  </p>
                </div>

                <span className="text-[11px] px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-300">
                  NEESH.+
                </span>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3">
                  <p className="text-lg font-bold text-white">Best of 3</p>
                  <p className="text-[11px] text-zinc-500">Ranked battle</p>
                </div>

                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3">
                  <p className="text-lg font-bold text-white">ELO</p>
                  <p className="text-[11px] text-zinc-500">Rank changes</p>
                </div>

                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3">
                  <p className="text-lg font-bold text-white">Top 500</p>
                  <p className="text-[11px] text-zinc-500">Legend chase</p>
                </div>
              </div>

              <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-white">Ranked Queue</p>
                  <p className="text-xs text-zinc-500">{rankedQueueCount}/3 in queue</p>
                </div>

                <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-yellow-400 transition-all"
                    style={{
                      width: `${Math.min(100, (rankedQueueCount / 3) * 100)}%`,
                    }}
                  />
                </div>

                <p className="text-xs text-zinc-500 mt-3">
                  {isRankedQueued
                    ? `You have been waiting ${formatTime(rankedWaitingSeconds)}.`
                    : `${rank} · ${elo} ELO · ${wins}-${losses} · ${winRate(wins, losses)}% win rate`}
                </p>
              </div>

              {isRankedQueued ? (
                <button
                  onClick={leaveRankedQueue}
                  disabled={!!actionLoading}
                  className="w-full py-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-semibold hover:bg-red-500/20 transition-colors disabled:opacity-50"
                >
                  Cancel Ranked Queue
                </button>
              ) : (
                <button
                  onClick={joinRankedQueue}
                  disabled={!isPremium || !!actionLoading || isQuickQueued}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-yellow-400 text-zinc-950 text-sm font-bold hover:bg-yellow-300 transition-colors disabled:opacity-50"
                >
                  <Swords size={16} />
                  Look for Ranked Match
                </button>
              )}

              <button
                onClick={() => navigate({ to: '/songwars/leaderboard' })}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-zinc-950 border border-zinc-800 text-zinc-300 text-sm font-semibold hover:text-white hover:border-zinc-700 transition-colors"
              >
                <Trophy size={16} />
                View Ranked Leaderboard
              </button>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
            <Radio size={15} />
            How Song Wars Matchmaking Works
          </h2>

          <div className="grid md:grid-cols-3 gap-3 text-xs text-zinc-500">
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
              <p className="text-white font-semibold mb-1">1. Queue</p>
              <p>Press Look for Match. A match starts when 3 users are queued.</p>
            </div>

            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
              <p className="text-white font-semibold mb-1">2. Battle</p>
              <p>Two players submit songs. The third user listens and votes.</p>
            </div>

            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
              <p className="text-white font-semibold mb-1">3. Rewards</p>
              <p>Quick gives XP and streaks. Ranked gives XP, ELO, and leaderboard movement.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
