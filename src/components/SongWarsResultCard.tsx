import { Crown, Download, Share2, Trophy, Zap } from 'lucide-react'
import { useRef, useState } from 'react'

type SongWarsResultCardProps = {
  mode: 'quick' | 'ranked'
  winnerName: string
  loserName: string
  winnerUsername?: string | null
  loserUsername?: string | null
  winnerAvatar?: string | null
  loserAvatar?: string | null
  score?: string
  eloChange?: number | null
  xpReward?: number
  streak?: number | null
}

export function SongWarsResultCard({
  mode,
  winnerName,
  loserName,
  winnerUsername,
  loserUsername,
  winnerAvatar,
  loserAvatar,
  score,
  eloChange,
  xpReward,
  streak,
}: SongWarsResultCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null)
  const [copied, setCopied] = useState(false)

  const matchLabel = mode === 'ranked' ? 'Ranked Match' : 'Quick Match'
  const modeLabel = mode === 'ranked' ? 'Best of 3' : 'Best of 1'

  const shareText =
    mode === 'ranked'
      ? `${winnerUsername || winnerName} defeated ${loserUsername || loserName} in Ranked Song Wars on neesh.`
      : `${winnerUsername || winnerName} defeated ${loserUsername || loserName} in Quick Match Song Wars on neesh.`

  const copyShareText = async () => {
    try {
      await navigator.clipboard.writeText(shareText)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="space-y-3">
      <div
        ref={cardRef}
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-6 shadow-2xl"
      >
        <div className="absolute -top-20 -right-20 w-44 h-44 rounded-full bg-purple-500/20 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-44 h-44 rounded-full bg-yellow-500/10 blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-center justify-between gap-4 mb-8">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">
                Song Wars Result
              </p>
              <h2 className="text-2xl font-black text-white mt-1">
                {matchLabel}
              </h2>
            </div>

            <div className="w-12 h-12 rounded-2xl bg-white text-zinc-950 flex items-center justify-center">
              {mode === 'ranked' ? <Crown size={24} /> : <Zap size={24} />}
            </div>
          </div>

          <div className="flex items-center justify-center gap-5 mb-7">
            <div className="text-center flex-1">
              <div className="relative mx-auto w-20 h-20 rounded-full bg-zinc-800 border-2 border-yellow-400 overflow-hidden mb-3">
                {winnerAvatar ? (
                  <img
                    src={winnerAvatar}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-lg font-bold text-white">
                    {winnerName.slice(0, 2).toUpperCase()}
                  </div>
                )}

                <div className="absolute -bottom-1 -right-1 bg-yellow-400 text-zinc-950 rounded-full w-7 h-7 flex items-center justify-center">
                  <Trophy size={15} />
                </div>
              </div>

              <p className="text-sm font-bold text-white truncate">
                {winnerName}
              </p>
              {winnerUsername && (
                <p className="text-xs text-yellow-300 truncate">
                  @{winnerUsername.replace('@', '')}
                </p>
              )}
              <p className="text-[10px] uppercase tracking-wider text-yellow-400 mt-1">
                Winner
              </p>
            </div>

            <div className="text-center">
              <p className="text-xs text-zinc-600 mb-1">defeated</p>
              <div className="px-4 py-2 rounded-2xl bg-white/5 border border-white/10">
                <p className="text-lg font-black text-white">
                  {score || 'W'}
                </p>
              </div>
            </div>

            <div className="text-center flex-1">
              <div className="mx-auto w-20 h-20 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden mb-3 opacity-70">
                {loserAvatar ? (
                  <img
                    src={loserAvatar}
                    alt=""
                    className="w-full h-full object-cover grayscale"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-lg font-bold text-zinc-400">
                    {loserName.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>

              <p className="text-sm font-bold text-zinc-300 truncate">
                {loserName}
              </p>
              {loserUsername && (
                <p className="text-xs text-zinc-500 truncate">
                  @{loserUsername.replace('@', '')}
                </p>
              )}
              <p className="text-[10px] uppercase tracking-wider text-zinc-600 mt-1">
                Runner-up
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="rounded-2xl bg-white/5 border border-white/10 p-3 text-center">
              <p className="text-sm font-bold text-white">{modeLabel}</p>
              <p className="text-[10px] text-zinc-500">Mode</p>
            </div>

            <div className="rounded-2xl bg-white/5 border border-white/10 p-3 text-center">
              <p className="text-sm font-bold text-white">
                {xpReward ? `+${xpReward}` : '+XP'}
              </p>
              <p className="text-[10px] text-zinc-500">XP</p>
            </div>

            <div className="rounded-2xl bg-white/5 border border-white/10 p-3 text-center">
              <p className="text-sm font-bold text-white">
                {mode === 'ranked'
                  ? eloChange !== null && eloChange !== undefined
                    ? `+${eloChange}`
                    : '+ELO'
                  : streak !== null && streak !== undefined
                    ? `${streak}x`
                    : 'Streak'}
              </p>
              <p className="text-[10px] text-zinc-500">
                {mode === 'ranked' ? 'ELO' : 'Streak'}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            <p className="text-xl font-black tracking-tight text-white">
              neesh<span className="text-zinc-500">.</span>
            </p>

            <p className="text-xs text-zinc-500">
              find your people
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={copyShareText}
          className="flex items-center justify-center gap-2 rounded-xl bg-white text-zinc-950 py-2.5 text-sm font-bold hover:bg-zinc-200 transition-colors"
        >
          <Share2 size={15} />
          {copied ? 'Copied' : 'Copy Text'}
        </button>

        <button
          onClick={() => {
            alert('Screenshot this card to share it. Image export can be added next.')
          }}
          className="flex items-center justify-center gap-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 py-2.5 text-sm font-bold hover:text-white transition-colors"
        >
          <Download size={15} />
          Screenshot
        </button>
      </div>
    </div>
  )
}
