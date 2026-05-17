import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useIdentity } from '@/lib/identity-context'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import { Target, Check } from 'lucide-react'

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

const BASE_CHALLENGES = [
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
]

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

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('message_count,total_xp')
        .eq('id', user.id)
        .maybeSingle()

      if (error) {
        console.error('Challenges load error:', error)
      }

      const messageCount = profile?.message_count ?? 0
      const totalXp = profile?.total_xp ?? 0

      const mapped: Challenge[] = BASE_CHALLENGES.map((c) => {
        const progress = c.category === 'xp' ? totalXp : messageCount
        const completed = progress >= c.target

        return {
          ...c,
          progress,
          completed,
          completedAt: completed ? new Date().toISOString() : null,
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

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      <div className="px-5 py-4 border-b border-zinc-800">
        <h1 className="text-sm font-semibold text-white flex items-center gap-2">
          <Target size={16} className="text-purple-400" /> Challenges
        </h1>
        <p className="text-xs text-zinc-500">{completed.length}/{challenges.length} completed · {totalXpEarned.toLocaleString()} XP earned</p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">
        {loading && (
          <div className="flex items-center justify-center mt-20">
            <div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
          </div>
        )}

        {!loading && active.length > 0 && (
          <div>
            <h2 className="text-xs font-medium text-zinc-600 uppercase tracking-wider mb-3">In Progress</h2>
            <div className="space-y-2">
              {active.map((c) => (
                <ChallengeCard key={c.key} challenge={c} />
              ))}
            </div>
          </div>
        )}

        {!loading && completed.length > 0 && (
          <div>
            <h2 className="text-xs font-medium text-zinc-600 uppercase tracking-wider mb-3">Completed</h2>
            <div className="space-y-2">
              {completed.map((c) => (
                <ChallengeCard key={c.key} challenge={c} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ChallengeCard({ challenge: c }: { challenge: Challenge }) {
  const pct = Math.min((c.progress / c.target) * 100, 100)

  return (
    <div className={`bg-zinc-900 border rounded-xl p-4 ${c.completed ? 'border-emerald-800/50' : 'border-zinc-800'}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {c.completed && <Check size={14} className="text-emerald-400 flex-shrink-0" />}
            <p className={`text-sm font-medium ${c.completed ? 'text-emerald-400' : 'text-white'}`}>{c.name}</p>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">{c.description}</p>
        </div>
        <span className={`text-xs font-medium flex-shrink-0 ml-3 ${c.completed ? 'text-emerald-500' : 'text-yellow-400'}`}>
          +{c.xpReward} XP
        </span>
      </div>

      {!c.completed && (
        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-500 rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs text-zinc-500">{c.progress}/{c.target}</span>
        </div>
      )}
    </div>
  )
}
