import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useIdentity } from '@/lib/identity-context'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import { Target, Check, MessageSquare, Zap, Swords, Trophy, Crown } from 'lucide-react'

export const Route = createFileRoute('/challenges')({
  component: ChallengesPage,
})

interface Challenge {
  key: string
  name: string
  description: string
  xpReward: number
  target: number
  category: string
  progress: number
  completed: boolean
  completedAt: string | null
}

interface BaseChallenge {
  key: string
  name: string
  description: string
  xpReward: number
  target: number
  category: string
}

type ProfileStats = {
  message_count: number | null
  total_xp: number | null
}

type SongWarsStats = {
  user_id: string
  xp: number | null
  elo: number | null
  wins: number | null
  losses: number | null
  win_streak: number | null
  peak_elo: number | null
  quick_wins: number | null
  quick_losses: number | null
  quick_win_streak: number | null
  best_quick_win_streak: number | null
}

const BASE_CHALLENGES: BaseChallenge[] = [
  {
    key: 'send_1_message',
    name: 'Say Hello',
    description: 'Send your first message.',
    xpReward: 25,
    target: 1,
    category: 'chat',
  },
  {
    key: 'send_10_messages',
    name: 'Conversation Starter',
    description: 'Send 10 messages.',
    xpReward: 100,
    target: 10,
    category: 'chat',
  },
  {
    key: 'send_50_messages',
    name: 'Community Regular',
    description: 'Send 50 messages.',
    xpReward: 250,
    target: 50,
    category: 'chat',
  },
  {
    key: 'earn_100_xp',
    name: 'XP Rookie',
    description: 'Earn 100 XP.',
    xpReward: 50,
    target: 100,
    category: 'xp',
  },
  {
    key: 'songwars_first_battle',
    name: 'First Battle',
    description: 'Play your first Quick Match.',
    xpReward: 100,
    target: 1,
    category: 'songwars_quick_matches',
  },
  {
    key: 'songwars_first_win',
    name: 'First Song Wars Win',
    description: 'Win your first Song Wars match.',
    xpReward: 250,
    target: 1,
    category: 'songwars_any_wins',
  },
  {
    key: 'songwars_quick_streak',
    name: 'Quick Streak',
    description: 'Win 3 Quick Matches in a row.',
    xpReward: 500,
    target: 3,
    category: 'songwars_quick_streak',
  },
  {
    key: 'songwars_ranked_debut',
    name: 'Ranked Debut',
    description: 'Play your first Ranked Song Wars match.',
    xpReward: 300,
    target: 1,
    category: 'songwars_ranked_matches',
  },
  {
    key: 'songwars_ranked_win',
    name: 'Climb the Ladder',
    description: 'Win your first Ranked Song Wars match.',
    xpReward: 500,
    target: 1,
    category: 'songwars_ranked_wins',
  },
  {
    key: 'songwars_gold_grind',
    name: 'Gold Grind',
    description: 'Reach Gold rank in Ranked Song Wars.',
    xpReward: 1000,
    target: 1100,
    category: 'songwars_elo',
  },
  {
    key: 'songwars_legend_chase',
    name: 'Legend Chase',
    description: 'Reach Top 500 Legend rank.',
    xpReward: 5000,
    target: 1,
    category: 'songwars_legend',
  },
]

function getProgress(
  challenge: BaseChallenge,
  profile: ProfileStats | null,
  songWarsStats: SongWarsStats | null,
  isLegend: boolean
) {
  const messageCount = profile?.message_count ?? 0
  const totalXp = profile?.total_xp ?? 0

  const quickWins = songWarsStats?.quick_wins ?? 0
  const quickLosses = songWarsStats?.quick_losses ?? 0
  const quickStreak = songWarsStats?.quick_win_streak ?? 0

  const rankedWins = songWarsStats?.wins ?? 0
  const rankedLosses = songWarsStats?.losses ?? 0
  const elo = songWarsStats?.elo ?? 1200

  if (challenge.category === 'chat') return messageCount
  if (challenge.category === 'xp') return totalXp

  if (challenge.category === 'songwars_quick_matches') {
    return quickWins + quickLosses
  }

  if (challenge.category === 'songwars_any_wins') {
    return quickWins + rankedWins
  }

  if (challenge.category === 'songwars_quick_streak') {
    return quickStreak
  }

  if (challenge.category === 'songwars_ranked_matches') {
    return rankedWins + rankedLosses
  }

  if (challenge.category === 'songwars_ranked_wins') {
    return rankedWins
  }

  if (challenge.category === 'songwars_elo') {
    return elo
  }

  if (challenge.category === 'songwars_legend') {
    return isLegend ? 1 : 0
  }

  return 0
}

function isSongWarsCategory(category: string) {
  return category.startsWith('songwars_')
}

function ChallengesPage() {
  const { user, ready } = useIdentity()
  const navigate = useNavigate()
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (ready && !user) navigate({ to: '/signin' })
  }, [ready, user, navigate])

  useEffect(() => {
    if (!user) return

    async function loadChallenges() {
      setLoading(true)

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('message_count,total_xp')
        .eq('id', user.id)
        .maybeSingle()

      if (profileError) {
        console.error('Challenges profile load error:', profileError)
      }

      let profile: ProfileStats = {
        message_count: profileData?.message_count ?? 0,
        total_xp: profileData?.total_xp ?? 0,
      }

      const { data: songWarsData, error: songWarsError } = await supabase
        .from('songwars_stats')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (songWarsError) {
        console.error('Song Wars challenge stats error:', songWarsError)
      }

      const songWarsStats = songWarsData as SongWarsStats | null

      let isLegend = false

      if (songWarsStats?.elo) {
        const { data: topRows, error: legendError } = await supabase
          .from('songwars_stats')
          .select('user_id,elo')
          .order('elo', { ascending: false })
          .limit(500)

        if (legendError) {
          console.error('Legend challenge check error:', legendError)
        } else {
          isLegend = (topRows ?? []).some((row) => row.user_id === user.id)
        }
      }

      const { data: completedRows, error: completedError } = await supabase
        .from('completed_challenges')
        .select('challenge_key, completed_at')
        .eq('user_id', user.id)

      if (completedError) {
        console.error('Completed challenges load error:', completedError)
      }

      const completedMap = new Map<string, string>()

      for (const row of completedRows ?? []) {
        completedMap.set(row.challenge_key, row.completed_at)
      }

      for (const challenge of BASE_CHALLENGES) {
        const progress = getProgress(challenge, profile, songWarsStats, isLegend)
        const qualifies = progress >= challenge.target
        const alreadyCompleted = completedMap.has(challenge.key)

        if (qualifies && !alreadyCompleted) {
          const { error: insertError } = await supabase
            .from('completed_challenges')
            .insert({
              user_id: user.id,
              challenge_key: challenge.key,
              xp_reward: challenge.xpReward,
            })

          if (insertError) {
            console.error('Complete challenge error:', insertError)
            continue
          }

          const newTotalXp = (profile.total_xp ?? 0) + challenge.xpReward

          const { error: xpError } = await supabase
            .from('profiles')
            .update({
              total_xp: newTotalXp,
            })
            .eq('id', user.id)

          if (xpError) {
            console.error('Challenge XP update error:', xpError)
          }

          completedMap.set(challenge.key, new Date().toISOString())

          profile = {
            ...profile,
            total_xp: newTotalXp,
          }
        }
      }

      const mapped: Challenge[] = BASE_CHALLENGES.map((challenge) => {
        const progress = getProgress(challenge, profile, songWarsStats, isLegend)
        const completedAt = completedMap.get(challenge.key) ?? null

        return {
          ...challenge,
          progress,
          completed: completedAt !== null,
          completedAt,
        }
      })

      setChallenges(mapped)
      setLoading(false)
    }

    loadChallenges()
  }, [user])

  if (!ready || !user) return null

  const completed = challenges.filter((c) => c.completed)
  const active = challenges.filter((c) => !c.completed)
  const totalXpEarned = completed.reduce((sum, c) => sum + c.xpReward, 0)

  const activeRegular = active.filter((c) => !isSongWarsCategory(c.category))
  const activeSongWars = active.filter((c) => isSongWarsCategory(c.category))
  const completedRegular = completed.filter((c) => !isSongWarsCategory(c.category))
  const completedSongWars = completed.filter((c) => isSongWarsCategory(c.category))

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      <div className="px-5 py-4 border-b border-zinc-800">
        <h1 className="text-sm font-semibold text-white flex items-center gap-2">
          <Target size={16} className="text-purple-400" /> Challenges
        </h1>
        <p className="text-xs text-zinc-500">
          {completed.length}/{challenges.length} completed · {totalXpEarned.toLocaleString()} XP earned
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">
        {loading && (
          <div className="flex items-center justify-center mt-20">
            <div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
          </div>
        )}

        {!loading && activeSongWars.length > 0 && (
          <ChallengeSection
            title="Song Wars Challenges"
            icon="songwars"
            challenges={activeSongWars}
          />
        )}

        {!loading && activeRegular.length > 0 && (
          <ChallengeSection
            title="In Progress"
            icon="regular"
            challenges={activeRegular}
          />
        )}

        {!loading && completedSongWars.length > 0 && (
          <ChallengeSection
            title="Completed Song Wars"
            icon="songwars"
            challenges={completedSongWars}
          />
        )}

        {!loading && completedRegular.length > 0 && (
          <ChallengeSection
            title="Completed"
            icon="regular"
            challenges={completedRegular}
          />
        )}

        {!loading && challenges.length === 0 && (
          <div className="text-center text-sm text-zinc-500 mt-20">
            No challenges found.
          </div>
        )}
      </div>
    </div>
  )
}

function ChallengeSection({
  title,
  icon,
  challenges,
}: {
  title: string
  icon: 'regular' | 'songwars'
  challenges: Challenge[]
}) {
  return (
    <div>
      <h2 className="text-xs font-medium text-zinc-600 uppercase tracking-wider mb-3 flex items-center gap-2">
        {icon === 'songwars' ? (
          <Swords size={14} className="text-yellow-400" />
        ) : (
          <Target size={14} className="text-purple-400" />
        )}
        {title}
      </h2>

      <div className="space-y-2">
        {challenges.map((challenge) => (
          <ChallengeCard key={challenge.key} challenge={challenge} />
        ))}
      </div>
    </div>
  )
}

function ChallengeCard({ challenge: c }: { challenge: Challenge }) {
  const pct = Math.min((c.progress / c.target) * 100, 100)
  const songWars = isSongWarsCategory(c.category)

  return (
    <div
      className={`bg-zinc-900 border rounded-xl p-4 ${
        c.completed
          ? 'border-emerald-800/50'
          : songWars
            ? 'border-yellow-500/20'
            : 'border-zinc-800'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {c.completed ? (
              <Check size={14} className="text-emerald-400 flex-shrink-0" />
            ) : songWars ? (
              getSongWarsIcon(c.key)
            ) : (
              getRegularIcon(c.category)
            )}

            <p
              className={`text-sm font-medium ${
                c.completed
                  ? 'text-emerald-400'
                  : 'text-white'
              }`}
            >
              {c.name}
            </p>
          </div>

          <p className="text-xs text-zinc-500 mt-0.5">
            {c.description}
          </p>
        </div>

        <span
          className={`text-xs font-medium flex-shrink-0 ml-3 ${
            c.completed
              ? 'text-emerald-500'
              : songWars
                ? 'text-yellow-400'
                : 'text-purple-400'
          }`}
        >
          +{c.xpReward} XP
        </span>
      </div>

      {!c.completed && (
        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                songWars ? 'bg-yellow-400' : 'bg-purple-500'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>

          <span className="text-xs text-zinc-500">
            {c.progress}/{c.target}
          </span>
        </div>
      )}
    </div>
  )
}

function getRegularIcon(category: string) {
  if (category === 'chat') {
    return <MessageSquare size={14} className="text-purple-400 flex-shrink-0" />
  }

  if (category === 'xp') {
    return <Zap size={14} className="text-yellow-400 flex-shrink-0" />
  }

  return <Target size={14} className="text-purple-400 flex-shrink-0" />
}

function getSongWarsIcon(key: string) {
  if (key.includes('legend')) {
    return <Crown size={14} className="text-yellow-400 flex-shrink-0" />
  }

  if (key.includes('gold') || key.includes('ranked')) {
    return <Trophy size={14} className="text-yellow-400 flex-shrink-0" />
  }

  return <Swords size={14} className="text-yellow-400 flex-shrink-0" />
}
