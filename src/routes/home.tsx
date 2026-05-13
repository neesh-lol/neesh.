import { createFileRoute, Link } from '@tanstack/react-router'
import { useIdentity } from '@/lib/identity-context'
import { useEffect, useState } from 'react'
import { Flame, Trophy, Target, MessageSquare, Hash, Zap, Star, Crown } from 'lucide-react'
import { VerifiedBadge } from '@/components/VerifiedBadge'

export const Route = createFileRoute('/home')({
  component: HomePage,
})

interface Profile {
  displayName: string
  username: string | null
  avatarUrl: string
  totalXp: number
  currentStreak: number
  longestStreak: number
  messageCount: number
  interests: string[]
  isPremium?: boolean
  isFounderOverride?: boolean
}

interface Challenge {
  key: string
  name: string
  description: string
  xpReward: number
  target: number
  progress: number
  completed: boolean
}

function HomePage() {
  const { user, ready } = useIdentity()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [rank, setRank] = useState<number | null>(null)

  useEffect(() => {
    if (!user) return
    fetch('/api/profile').then(async (r) => {
      if (r.ok) setProfile(await r.json())
    })
    fetch('/api/challenges').then(async (r) => {
      if (r.ok) setChallenges(await r.json())
    })
    fetch('/api/leaderboard').then(async (r) => {
      if (r.ok) {
        const data = await r.json()
        const idx = data.findIndex((e: any) => e.netlifyId === user.id)
        if (idx >= 0) setRank(idx + 1)
      }
    })
  }, [user])

  if (!ready || !user) return null

  const streakDayXp = profile ? Math.min((profile.currentStreak || 1) * 100, 400) : 100
  const completedChallenges = challenges.filter((c) => c.completed).length
  const activeChallenges = challenges.filter((c) => !c.completed).slice(0, 3)

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-950">
      <div className="max-w-2xl mx-auto px-5 py-8 space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Welcome back{profile?.displayName ? `, ${profile.displayName}` : ''}
            <VerifiedBadge username={profile?.username} isPremium={profile?.isPremium} isFounderOverride={profile?.isFounderOverride} size={18} />
          </h2>
          <p className="text-zinc-500 text-sm mt-0.5">Here's your activity at a glance.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={Zap} label="Total XP" value={profile?.totalXp?.toLocaleString() ?? '0'} color="text-yellow-400" />
          <StatCard icon={Flame} label="Streak" value={`${profile?.currentStreak ?? 0}d`} color="text-orange-400" />
          <StatCard icon={Trophy} label="Rank" value={rank ? `#${rank}` : '—'} color="text-emerald-400" />
          <StatCard icon={MessageSquare} label="Messages" value={profile?.messageCount?.toLocaleString() ?? '0'} color="text-blue-400" />
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Flame size={15} className="text-orange-400" /> Daily Streak
            </h3>
            <span className="text-xs text-zinc-500">Best: {profile?.longestStreak ?? 0}d</span>
          </div>
          <div className="flex items-center gap-3">
            {[1, 2, 3, 4].map((day) => (
              <div key={day} className="flex-1 text-center">
                <div className={`text-xs font-medium mb-1 ${
                  (profile?.currentStreak ?? 0) >= day ? 'text-orange-400' : 'text-zinc-600'
                }`}>
                  Day {day}{day === 4 ? '+' : ''}
                </div>
                <div className={`text-lg font-bold ${
                  (profile?.currentStreak ?? 0) >= day ? 'text-white' : 'text-zinc-700'
                }`}>
                  {Math.min(day * 100, 400)}
                </div>
                <div className="text-xs text-zinc-600">XP</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-zinc-500 mt-3">
            Today's bonus: <span className="text-orange-400 font-medium">+{streakDayXp} XP</span> for your first message
          </p>
        </div>

        {activeChallenges.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Target size={15} className="text-purple-400" /> Challenges
              </h3>
              <Link to="/challenges" className="text-xs text-zinc-500 hover:text-white">
                View all
              </Link>
            </div>
            <div className="space-y-3">
              {activeChallenges.map((c) => (
                <div key={c.key} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{c.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-500 rounded-full transition-all"
                          style={{ width: `${Math.min((c.progress / c.target) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-zinc-500 flex-shrink-0">
                        {c.progress}/{c.target}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-yellow-400 flex-shrink-0">+{c.xpReward} XP</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-zinc-600 mt-3">{completedChallenges}/{challenges.length} completed</p>
          </div>
        )}

        {profile?.interests && profile.interests.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Star size={15} className="text-blue-400" /> Your Interests
            </h3>
            <div className="flex flex-wrap gap-2">
              {profile.interests.map((tag: string) => (
                <Link
                  key={tag}
                  to="/chat"
                  className="px-3 py-1 rounded-full text-xs border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors"
                >
                  #{tag}
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            to="/chat"
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-600 transition-colors group"
          >
            <Hash className="text-zinc-500 group-hover:text-white mb-2" size={18} />
            <p className="text-sm font-medium text-white">Interest Chat</p>
            <p className="text-xs text-zinc-600 mt-0.5">Join rooms by topic</p>
          </Link>
          <Link
            to="/community"
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-600 transition-colors group"
          >
            <MessageSquare className="text-zinc-500 group-hover:text-white mb-2" size={18} />
            <p className="text-sm font-medium text-white">Community</p>
            <p className="text-xs text-zinc-600 mt-0.5">Global chat</p>
          </Link>
          <Link
            to="/premium"
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-600 transition-colors group"
          >
            <Crown className="text-yellow-400 group-hover:text-yellow-300 mb-2" size={18} />
            <p className="text-sm font-medium text-white">NEESH.+</p>
            <p className="text-xs text-zinc-600 mt-0.5">{profile?.isPremium ? 'Premium active' : 'Upgrade now'}</p>
          </Link>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: string; color: string
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5">
      <Icon size={16} className={`${color} mb-2`} />
      <p className="text-lg font-bold text-white">{value}</p>
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  )
}
