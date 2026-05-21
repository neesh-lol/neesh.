import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useIdentity } from '@/lib/identity-context'
import { useEffect } from 'react'
import {
  ArrowLeft,
  Trophy,
  Medal,
  Crown,
  Shield,
  Star,
  Gem,
  Flame,
  Sparkles,
} from 'lucide-react'

export const Route = createFileRoute('/songwars/ranks')({
  component: SongWarsRanksPage,
})

const RANKS = [
  {
    name: 'Bronze',
    range: '0–799 ELO',
    description: 'Starting rank for new ranked Song Wars players.',
    icon: Shield,
    style: 'border-orange-700/30 bg-orange-900/10 text-orange-400',
  },
  {
    name: 'Silver',
    range: '800–1099 ELO',
    description: 'You are learning the ranked ladder.',
    icon: Medal,
    style: 'border-zinc-400/30 bg-zinc-400/10 text-zinc-300',
  },
  {
    name: 'Gold',
    range: '1100–1399 ELO',
    description: 'You are becoming a serious Song Wars player.',
    icon: Trophy,
    style: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300',
  },
  {
    name: 'Platinum',
    range: '1400–1599 ELO',
    description: 'Above-average ranked player with strong song picks.',
    icon: Star,
    style: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  },
  {
    name: 'Diamond',
    range: '1600–1899 ELO',
    description: 'High-level player with consistent wins.',
    icon: Gem,
    style: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  },
  {
    name: 'Master',
    range: '1900–2199 ELO',
    description: 'Elite ranked competitor.',
    icon: Sparkles,
    style: 'border-purple-500/30 bg-purple-500/10 text-purple-300',
  },
  {
    name: 'Champion',
    range: '2200–2499 ELO',
    description: 'One of the best ranked players on Neesh.',
    icon: Flame,
    style: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
  },
  {
    name: 'Legend',
    range: 'Top 500',
    description: 'Reserved for the top 500 ranked Song Wars players globally.',
    icon: Crown,
    style: 'border-yellow-400/40 bg-yellow-400/10 text-yellow-300',
  },
]

function SongWarsRanksPage() {
  const { user, ready } = useIdentity()
  const navigate = useNavigate()

  useEffect(() => {
    if (ready && !user) {
      navigate({ to: '/signin' })
    }
  }, [ready, user, navigate])

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
              Song Wars Ranks
            </h1>
            <p className="text-xs text-zinc-500">
              Ranked ELO tiers and Legend requirements
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl w-full mx-auto px-5 py-6 space-y-6">
        <div className="bg-gradient-to-br from-yellow-500/10 to-zinc-900 border border-yellow-500/20 rounded-2xl p-5">
          <p className="text-xs uppercase tracking-wider text-yellow-300 mb-1">
            Ranked Song Wars
          </p>
          <h2 className="text-3xl font-bold text-white">
            Climb from Bronze to Legend
          </h2>
          <p className="text-sm text-zinc-400 mt-2 max-w-2xl">
            Win ranked Song Wars matches to gain ELO. Lose ranked matches and your ELO can drop.
            Legend is dynamic and only belongs to the top 500 players.
          </p>
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
          {RANKS.map((rank) => {
            const Icon = rank.icon

            return (
              <div
                key={rank.name}
                className={`rounded-2xl border p-5 ${rank.style}`}
              >
                <div className="w-12 h-12 rounded-2xl bg-zinc-950/60 border border-white/10 flex items-center justify-center mb-4">
                  <Icon size={24} />
                </div>

                <h3 className="text-xl font-bold text-white mb-1">
                  {rank.name}
                </h3>

                <p className="text-sm font-semibold mb-3">
                  {rank.range}
                </p>

                <p className="text-xs text-zinc-400 leading-relaxed">
                  {rank.description}
                </p>
              </div>
            )
          })}
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-white mb-3">
            How ELO works
          </h2>

          <div className="grid md:grid-cols-3 gap-3 text-xs text-zinc-500">
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
              <p className="text-white font-semibold mb-1">Win ranked matches</p>
              <p>Winning gives ELO and moves you closer to the next rank.</p>
            </div>

            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
              <p className="text-white font-semibold mb-1">Lose ranked matches</p>
              <p>Losing can lower your ELO and rank placement.</p>
            </div>

            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
              <p className="text-white font-semibold mb-1">Legend rank</p>
              <p>Legend is only for the top 500 ranked players globally.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
