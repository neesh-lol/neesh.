import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useIdentity } from '@/lib/identity-context'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import { Target, Check, MessageSquare, Zap, Swords, Trophy, Crown, BadgeCheck, Users, Flame, Music2 } from 'lucide-react'

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

interface BadgeProgress {
  id: string
  name: string
  description: string
  icon: string
  rarity: string
  category: 'chat' | 'streak' | 'social' | 'songwars' | 'ranked' | 'special'
  progress: number
  target: number
  unlocked: boolean
  equipped: boolean
}

type ProfileStats = {
  message_count: number | null
  total_xp: number | null
  current_streak: number | null
  equipped_badges?: string[] | null
  is_premium?: boolean | null
  is_founder_override?: boolean | null
  username?: string | null
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

const BADGE_DEFINITIONS = [
  {
    id: 'first_message',
    name: 'First Words',
    description: 'Send your first message.',
    icon: '💬',
    rarity: 'common',
    category: 'chat',
    target: 1,
    metric: 'messages',
  },
  {
    id: 'hundred_messages',
    name: '100 Messages',
    description: 'Send 100 messages.',
    icon: '💬',
    rarity: 'common',
    category: 'chat',
    target: 100,
    metric: 'messages',
  },
  {
    id: 'thousand_messages',
    name: '1,000 Messages',
    description: 'Send 1,000 messages.',
    icon: '💬',
    rarity: 'rare',
    category: 'chat',
    target: 1000,
    metric: 'messages',
  },
  {
    id: 'ten_thousand_messages',
    name: '10,000 Messages',
    description: 'Send 10,000 messages.',
    icon: '💬',
    rarity: 'epic',
    category: 'chat',
    target: 10000,
    metric: 'messages',
  },
  {
    id: 'seven_day_streak',
    name: '7 Day Streak',
    description: 'Reach a 7 day streak.',
    icon: '🔥',
    rarity: 'common',
    category: 'streak',
    target: 7,
    metric: 'streak',
  },
  {
    id: 'thirty_day_streak',
    name: '30 Day Streak',
    description: 'Reach a 30 day streak.',
    icon: '🔥',
    rarity: 'rare',
    category: 'streak',
    target: 30,
    metric: 'streak',
  },
  {
    id: 'hundred_day_streak',
    name: '100 Day Streak',
    description: 'Reach a 100 day streak.',
    icon: '🔥',
    rarity: 'epic',
    category: 'streak',
    target: 100,
    metric: 'streak',
  },
  {
    id: 'year_streak',
    name: '365 Day Streak',
    description: 'Reach a 365 day streak.',
    icon: '🔥',
    rarity: 'legendary',
    category: 'streak',
    target: 365,
    metric: 'streak',
  },
  {
    id: 'first_friend',
    name: 'First Friend',
    description: 'Add your first friend.',
    icon: '🤝',
    rarity: 'common',
    category: 'social',
    target: 1,
    metric: 'friends',
  },
  {
    id: 'ten_friends',
    name: '10 Friends',
    description: 'Add 10 friends.',
    icon: '🤝',
    rarity: 'rare',
    category: 'social',
    target: 10,
    metric: 'friends',
  },
  {
    id: 'fifty_friends',
    name: '50 Friends',
    description: 'Add 50 friends.',
    icon: '🤝',
    rarity: 'epic',
    category: 'social',
    target: 50,
    metric: 'friends',
  },
  {
    id: 'hundred_friends',
    name: '100 Friends',
    description: 'Add 100 friends.',
    icon: '🤝',
    rarity: 'legendary',
    category: 'social',
    target: 100,
    metric: 'friends',
  },
  {
    id: 'songwars_first_win',
    name: 'Song Wars Winner',
    description: 'Win your first Song Wars match.',
    icon: '🎵',
    rarity: 'rare',
    category: 'songwars',
    target: 1,
    metric: 'songwarsWins',
  },
  {
    id: 'songwars_10_wins',
    name: '10 Song Wars Wins',
    description: 'Win 10 Song Wars matches.',
    icon: '🎵',
    rarity: 'rare',
    category: 'songwars',
    target: 10,
    metric: 'songwarsWins',
  },
  {
    id: 'songwars_100_wins',
    name: '100 Song Wars Wins',
    description: 'Win 100 Song Wars matches.',
    icon: '🎵',
    rarity: 'epic',
    category: 'songwars',
    target: 100,
    metric: 'songwarsWins',
  },
  {
    id: 'songwars_500_wins',
    name: '500 Song Wars Wins',
    description: 'Win 500 Song Wars matches.',
    icon: '🎵',
    rarity: 'legendary',
    category: 'songwars',
    target: 500,
    metric: 'songwarsWins',
  },
  {
    id: 'ranked_bronze',
    name: 'Bronze Competitor',
    description: 'Win 1 ranked match.',
    icon: '🥉',
    rarity: 'common',
    category: 'ranked',
    target: 1,
    metric: 'rankedWins',
  },
  {
    id: 'ranked_silver',
    name: 'Silver Competitor',
    description: 'Win 10 ranked matches.',
    icon: '🥈',
    rarity: 'rare',
    category: 'ranked',
    target: 10,
    metric: 'rankedWins',
  },
  {
    id: 'ranked_gold',
    name: 'Gold Competitor',
    description: 'Win 25 ranked matches.',
    icon: '🥇',
    rarity: 'epic',
    category: 'ranked',
    target: 25,
    metric: 'rankedWins',
  },
  {
    id: 'ranked_100_wins',
    name: 'Ranked Veteran',
    description: 'Win 100 ranked matches.',
    icon: '🏆',
    rarity: 'legendary',
    category: 'ranked',
    target: 100,
    metric: 'rankedWins',
  },
  {
    id: 'elo_1200',
    name: '1200 ELO',
    description: 'Reach 1200 ELO in ranked.',
    icon: '🏆',
    rarity: 'rare',
    category: 'ranked',
    target: 1200,
    metric: 'elo',
  },
  {
    id: 'elo_1400',
    name: '1400 ELO',
    description: 'Reach 1400 ELO in ranked.',
    icon: '💎',
    rarity: 'epic',
    category: 'ranked',
    target: 1400,
    metric: 'elo',
  },
  {
    id: 'elo_1600',
    name: '1600 ELO',
    description: 'Reach 1600 ELO in ranked.',
    icon: '👑',
    rarity: 'legendary',
    category: 'ranked',
    target: 1600,
    metric: 'elo',
  },
  {
    id: 'ranked_5_streak',
    name: '5 Ranked Win Streak',
    description: 'Win 5 ranked matches in a row.',
    icon: '🔥',
    rarity: 'rare',
    category: 'ranked',
    target: 5,
    metric: 'rankedStreak',
  },
  {
    id: 'ranked_10_streak',
    name: '10 Ranked Win Streak',
    description: 'Win 10 ranked matches in a row.',
    icon: '🔥',
    rarity: 'epic',
    category: 'ranked',
    target: 10,
    metric: 'rankedStreak',
  },
  {
    id: 'ranked_25_streak',
    name: '25 Ranked Win Streak',
    description: 'Win 25 ranked matches in a row.',
    icon: '🔥',
    rarity: 'legendary',
    category: 'ranked',
    target: 25,
    metric: 'rankedStreak',
  },
  {
    id: 'top_500',
    name: 'Top 500',
    description: 'Reach the Top 500 ranked leaderboard.',
    icon: '🌟',
    rarity: 'legendary',
    category: 'ranked',
    target: 1,
    metric: 'top500',
  },
  {
    id: 'top_100',
    name: 'Top 100',
    description: 'Reach the Top 100 ranked leaderboard.',
    icon: '⭐',
    rarity: 'legendary',
    category: 'ranked',
    target: 1,
    metric: 'top100',
  },
  {
    id: 'top_10',
    name: 'Top 10',
    description: 'Reach the Top 10 ranked leaderboard.',
    icon: '💫',
    rarity: 'legendary',
    category: 'ranked',
    target: 1,
    metric: 'top10',
  },
  {
    id: 'early_user',
    name: 'Early User',
    description: 'Joined neesh early.',
    icon: '⭐',
    rarity: 'rare',
    category: 'special',
    target: 1,
    metric: 'earnedOnly',
  },
  {
    id: 'founder',
    name: 'Founder',
    description: 'Creator of neesh.',
    icon: '👑',
    rarity: 'legendary',
    category: 'special',
    target: 1,
    metric: 'earnedOnly',
  },
  {
    id: 'neesh_plus',
    name: 'NEESH.+ Subscriber',
    description: 'Subscribe to NEESH.+.',
    icon: '💎',
    rarity: 'epic',
    category: 'special',
    target: 1,
    metric: 'premium',
  },
] as const

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

function getBadgeProgressValue(
  metric: string,
  profile: ProfileStats | null,
  songWarsStats: SongWarsStats | null,
  friendCount: number,
  ranks: { top500: boolean; top100: boolean; top10: boolean },
  earnedBadgeIds: Set<string>
) {
  const messageCount = profile?.message_count ?? 0
  const currentStreak = profile?.current_streak ?? 0
  const quickWins = songWarsStats?.quick_wins ?? 0
  const rankedWins = songWarsStats?.wins ?? 0
  const rankedStreak = songWarsStats?.win_streak ?? 0
  const elo = songWarsStats?.elo ?? 1200
  const isPremium = profile?.is_premium === true || profile?.is_founder_override === true || profile?.username === 'ceo'

  if (metric === 'messages') return messageCount
  if (metric === 'streak') return currentStreak
  if (metric === 'friends') return friendCount
  if (metric === 'songwarsWins') return quickWins + rankedWins
  if (metric === 'rankedWins') return rankedWins
  if (metric === 'rankedStreak') return rankedStreak
  if (metric === 'elo') return elo
  if (metric === 'top500') return ranks.top500 ? 1 : 0
  if (metric === 'top100') return ranks.top100 ? 1 : 0
  if (metric === 'top10') return ranks.top10 ? 1 : 0
  if (metric === 'premium') return isPremium ? 1 : 0
  if (metric === 'earnedOnly') return 0

  return 0
}

function isSongWarsCategory(category: string) {
  return category.startsWith('songwars_')
}

function getRarityClass(rarity: string) {
  if (rarity === 'legendary') return 'border-yellow-400/40 bg-yellow-400/10 text-yellow-300'
  if (rarity === 'epic') return 'border-purple-400/40 bg-purple-400/10 text-purple-300'
  if (rarity === 'rare') return 'border-blue-400/40 bg-blue-400/10 text-blue-300'
  return 'border-zinc-700 bg-zinc-900 text-zinc-300'
}

function ChallengesPage() {
  const { user, ready } = useIdentity()
  const navigate = useNavigate()
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [badges, setBadges] = useState<BadgeProgress[]>([])
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
        .select('message_count,total_xp,current_streak,equipped_badges,is_premium,is_founder_override,username')
        .eq('id', user.id)
        .maybeSingle()

      if (profileError) {
        console.error('Challenges profile load error:', profileError)
      }

      let profile: ProfileStats = {
        message_count: profileData?.message_count ?? 0,
        total_xp: profileData?.total_xp ?? 0,
        current_streak: profileData?.current_streak ?? 0,
        equipped_badges: Array.isArray(profileData?.equipped_badges) ? profileData.equipped_badges : [],
        is_premium: profileData?.is_premium ?? false,
        is_founder_override: profileData?.is_founder_override ?? false,
        username: profileData?.username ?? null,
      }

      const { data: friendRows, error: friendError } = await supabase
        .from('friendships')
        .select('id')
        .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .eq('status', 'accepted')

      if (friendError) {
        console.error('Friend badge progress error:', friendError)
      }

      const friendCount = friendRows?.length ?? 0

      const { data: songWarsData, error: songWarsError } = await supabase
        .from('songwars_stats')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (songWarsError) {
        console.error('Song Wars challenge stats error:', songWarsError)
      }

      const songWarsStats = songWarsData as SongWarsStats | null

      const ranks = {
        top500: false,
        top100: false,
        top10: false,
      }

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
          const rows = topRows ?? []
          const index = rows.findIndex((row) => row.user_id === user.id)

          if (index >= 0) {
            ranks.top500 = index < 500
            ranks.top100 = index < 100
            ranks.top10 = index < 10
            isLegend = true
          }
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

      const { data: earnedRows, error: earnedError } = await supabase
        .from('user_badges')
        .select('badge_id')
        .eq('user_id', user.id)

      if (earnedError) {
        console.error('Earned badges load error:', earnedError)
      }

      const earnedBadgeIds = new Set((earnedRows ?? []).map((row) => row.badge_id))
      const equippedBadges = new Set(profile.equipped_badges ?? [])

      const badgeProgress: BadgeProgress[] = BADGE_DEFINITIONS.map((badge) => {
        const rawProgress = getBadgeProgressValue(
          badge.metric,
          profile,
          songWarsStats,
          friendCount,
          ranks,
          earnedBadgeIds
        )

        const unlocked = earnedBadgeIds.has(badge.id) || rawProgress >= badge.target

        return {
          id: badge.id,
          name: badge.name,
          description: badge.description,
          icon: badge.icon,
          rarity: badge.rarity,
          category: badge.category,
          progress: unlocked ? badge.target : Math.min(rawProgress, badge.target),
          target: badge.target,
          unlocked,
          equipped: equippedBadges.has(badge.id),
        }
      })

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
      setBadges(badgeProgress)
      setLoading(false)
    }

    loadChallenges()
  }, [user])

  if (!ready || !user) return null

  const completed = challenges.filter((c) => c.completed)
  const active = challenges.filter((c) => !c.completed)
  const totalXpEarned = completed.reduce((sum, c) => sum + c.xpReward, 0)

  const unlockedBadges = badges.filter((b) => b.unlocked)
  const lockedBadges = badges.filter((b) => !b.unlocked)

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
          {completed.length}/{challenges.length} completed · {unlockedBadges.length}/{badges.length} badges unlocked · {totalXpEarned.toLocaleString()} XP earned
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

        {!loading && badges.length > 0 && (
          <BadgeSection
            title="Badge Progress"
            badges={[...lockedBadges, ...unlockedBadges]}
            onOpenProfile={() => navigate({ to: '/profile' })}
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

function BadgeSection({
  title,
  badges,
  onOpenProfile,
}: {
  title: string
  badges: BadgeProgress[]
  onOpenProfile: () => void
}) {
  const chatBadges = badges.filter((b) => b.category === 'chat')
  const streakBadges = badges.filter((b) => b.category === 'streak')
  const socialBadges = badges.filter((b) => b.category === 'social')
  const songWarsBadges = badges.filter((b) => b.category === 'songwars')
  const rankedBadges = badges.filter((b) => b.category === 'ranked')
  const specialBadges = badges.filter((b) => b.category === 'special')

  return (
    <div>
      <h2 className="text-xs font-medium text-zinc-600 uppercase tracking-wider mb-3 flex items-center gap-2">
        <BadgeCheck size={14} className="text-emerald-400" />
        {title}
      </h2>

      <div className="space-y-5">
        {chatBadges.length > 0 && <BadgeGroup title="Chat Badges" icon="chat" badges={chatBadges} onOpenProfile={onOpenProfile} />}
        {streakBadges.length > 0 && <BadgeGroup title="Streak Badges" icon="streak" badges={streakBadges} onOpenProfile={onOpenProfile} />}
        {socialBadges.length > 0 && <BadgeGroup title="Social Badges" icon="social" badges={socialBadges} onOpenProfile={onOpenProfile} />}
        {songWarsBadges.length > 0 && <BadgeGroup title="Song Wars Badges" icon="songwars" badges={songWarsBadges} onOpenProfile={onOpenProfile} />}
        {rankedBadges.length > 0 && <BadgeGroup title="Ranked Badges" icon="ranked" badges={rankedBadges} onOpenProfile={onOpenProfile} />}
        {specialBadges.length > 0 && <BadgeGroup title="Special Badges" icon="special" badges={specialBadges} onOpenProfile={onOpenProfile} />}
      </div>
    </div>
  )
}

function BadgeGroup({
  title,
  icon,
  badges,
  onOpenProfile,
}: {
  title: string
  icon: 'chat' | 'streak' | 'social' | 'songwars' | 'ranked' | 'special'
  badges: BadgeProgress[]
  onOpenProfile: () => void
}) {
  return (
    <div>
      <h3 className="text-[11px] text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-2">
        {getBadgeGroupIcon(icon)}
        {title}
      </h3>

      <div className="space-y-2">
        {badges.map((badge) => (
          <BadgeCard key={badge.id} badge={badge} onOpenProfile={onOpenProfile} />
        ))}
      </div>
    </div>
  )
}

function BadgeCard({
  badge,
  onOpenProfile,
}: {
  badge: BadgeProgress
  onOpenProfile: () => void
}) {
  const pct = Math.min((badge.progress / badge.target) * 100, 100)

  return (
    <div
      className={`border rounded-xl p-4 ${
        badge.unlocked
          ? 'bg-emerald-950/20 border-emerald-800/50'
          : 'bg-zinc-900 border-zinc-800'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center text-lg flex-shrink-0 ${getRarityClass(badge.rarity)}`}>
            {badge.icon}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className={`text-sm font-medium ${badge.unlocked ? 'text-emerald-400' : 'text-white'}`}>
                {badge.name}
              </p>

              <span className={`text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wider ${getRarityClass(badge.rarity)}`}>
                {badge.rarity}
              </span>

              {badge.equipped && (
                <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/20 text-white bg-white/10">
                  Equipped
                </span>
              )}
            </div>

            <p className="text-xs text-zinc-500 mt-0.5">
              {badge.description}
            </p>
          </div>
        </div>

        {badge.unlocked ? (
          <button
            type="button"
            onClick={onOpenProfile}
            className="text-xs text-emerald-400 hover:text-emerald-300 flex-shrink-0"
          >
            Equip →
          </button>
        ) : (
          <span className="text-xs text-zinc-500 flex-shrink-0">
            {badge.progress}/{badge.target}
          </span>
        )}
      </div>

      {!badge.unlocked && (
        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {badge.unlocked && (
        <div className="mt-3 flex items-center gap-2 text-xs text-emerald-500">
          <Check size={13} />
          Unlocked
        </div>
      )}
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

function getBadgeGroupIcon(icon: string) {
  if (icon === 'chat') {
    return <MessageSquare size={13} className="text-purple-400" />
  }

  if (icon === 'streak') {
    return <Flame size={13} className="text-orange-400" />
  }

  if (icon === 'social') {
    return <Users size={13} className="text-blue-400" />
  }

  if (icon === 'songwars') {
    return <Music2 size={13} className="text-yellow-400" />
  }

  if (icon === 'ranked') {
    return <Trophy size={13} className="text-yellow-400" />
  }

  return <Crown size={13} className="text-yellow-400" />
}
