import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useIdentity } from '@/lib/identity-context'
import { supabase } from '@/lib/supabase'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Search,
  Users,
  Sparkles,
  MessageSquare,
  UserPlus,
  RefreshCcw,
  BadgeCheck,
} from 'lucide-react'

export const Route = createFileRoute('/find-people')({
  component: FindPeoplePage,
})

type ProfileRow = {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  interests: string[] | null
  is_premium: boolean | null
  is_founder_override: boolean | null
  last_seen_at: string | null
}

type SuggestedUser = ProfileRow & {
  sharedInterests: string[]
  matchScore: number
}

function getDisplayName(profile: ProfileRow) {
  return profile.display_name || profile.username || 'User'
}

function formatLastSeen(value: string | null) {
  if (!value) return 'Recently active'

  const diff = Date.now() - new Date(value).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (minutes < 2) return 'Online now'
  if (minutes < 60) return `Active ${minutes}m ago`
  if (hours < 24) return `Active ${hours}h ago`
  if (days < 7) return `Active ${days}d ago`

  return 'Active recently'
}

function FindPeoplePage() {
  const { user, ready } = useIdentity()
  const navigate = useNavigate()

  const [myProfile, setMyProfile] = useState<ProfileRow | null>(null)
  const [suggestions, setSuggestions] = useState<SuggestedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (ready && !user) {
      navigate({ to: '/signin' })
    }
  }, [ready, user, navigate])

  const loadPeople = async () => {
    if (!user) return

    setLoading(true)
    setMessage('')

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id,username,display_name,avatar_url,interests,is_premium,is_founder_override,last_seen_at')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      console.error('Find people profile error:', profileError)
      setMessage(profileError.message)
      setLoading(false)
      return
    }

    setMyProfile(profile ?? null)

    const myInterests = profile?.interests ?? []

    if (myInterests.length === 0) {
      setSuggestions([])
      setLoading(false)
      return
    }

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id,username,display_name,avatar_url,interests,is_premium,is_founder_override,last_seen_at')
      .neq('id', user.id)
      .not('interests', 'is', null)
      .limit(100)

    if (profilesError) {
      console.error('Find people suggestions error:', profilesError)
      setMessage(profilesError.message)
      setSuggestions([])
      setLoading(false)
      return
    }

    const ranked = (profiles ?? [])
      .map((profile) => {
        const interests = profile.interests ?? []
        const sharedInterests = interests.filter((interest) =>
          myInterests.includes(interest)
        )

        return {
          ...profile,
          sharedInterests,
          matchScore: sharedInterests.length,
        }
      })
      .filter((profile) => profile.matchScore > 0)
      .sort((a, b) => {
        if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore

        const aTime = a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0
        const bTime = b.last_seen_at ? new Date(b.last_seen_at).getTime() : 0

        return bTime - aTime
      })

    setSuggestions(ranked)
    setLoading(false)
  }

  useEffect(() => {
    if (!user) return
    loadPeople()
  }, [user])

  const filteredSuggestions = useMemo(() => {
    const q = search.trim().toLowerCase()

    if (!q) return suggestions

    return suggestions.filter((profile) => {
      const name = getDisplayName(profile).toLowerCase()
      const username = profile.username?.toLowerCase() ?? ''
      const interests = profile.sharedInterests.join(' ').toLowerCase()

      return name.includes(q) || username.includes(q) || interests.includes(q)
    })
  }, [suggestions, search])

  const myInterests = myProfile?.interests ?? []

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
            onClick={() => navigate({ to: '/app' })}
            className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} />
          </button>

          <div>
            <h1 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sparkles size={16} className="text-purple-400" />
              Find People Like Me
            </h1>
            <p className="text-xs text-zinc-500">
              Discover people who share your interests
            </p>
          </div>
        </div>

        <button
          onClick={loadPeople}
          className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors"
        >
          <RefreshCcw size={14} />
          Refresh
        </button>
      </div>

      <div className="max-w-6xl w-full mx-auto px-5 py-6 space-y-6">
        {message && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-xs text-red-300">
            {message}
          </div>
        )}

        <div className="bg-gradient-to-br from-purple-500/10 to-zinc-900 border border-purple-500/20 rounded-2xl p-5">
          <p className="text-xs uppercase tracking-wider text-purple-300 mb-1">
            Your interests
          </p>

          <h2 className="text-2xl font-bold text-white">
            People matched by what you like
          </h2>

          <p className="text-sm text-zinc-400 mt-2">
            Neesh ranks users higher when they share more interests with you.
          </p>

          {myInterests.length > 0 ? (
            <div className="flex flex-wrap gap-2 mt-4">
              {myInterests.map((interest) => (
                <span
                  key={interest}
                  className="px-3 py-1.5 rounded-full bg-zinc-950 border border-zinc-800 text-xs text-zinc-300"
                >
                  {interest}
                </span>
              ))}
            </div>
          ) : (
            <div className="mt-4 bg-zinc-950 border border-zinc-800 rounded-xl p-4">
              <p className="text-sm text-zinc-400">
                You have no interests selected yet. Finish onboarding or edit your
                profile to get better matches.
              </p>
              <button
                onClick={() => navigate({ to: '/onboarding' })}
                className="mt-3 px-4 py-2 bg-white text-zinc-950 rounded-lg text-xs font-bold hover:bg-zinc-200 transition-colors"
              >
                Choose Interests
              </button>
            </div>
          )}
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-white">
                Suggested People
              </h2>
              <p className="text-xs text-zinc-500">
                {filteredSuggestions.length} match{filteredSuggestions.length === 1 ? '' : 'es'} found
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users/interests"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
            </div>
          ) : filteredSuggestions.length === 0 ? (
            <div className="text-center py-16 px-5">
              <Users size={34} className="text-zinc-700 mx-auto mb-3" />
              <p className="text-sm font-medium text-white mb-1">
                No matches yet
              </p>
              <p className="text-xs text-zinc-500">
                More matches will appear as users add interests.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {filteredSuggestions.map((profile) => {
                const name = getDisplayName(profile)
                const premium =
                  profile.is_premium === true ||
                  profile.is_founder_override === true ||
                  profile.username === 'ceo' ||
                  profile.username === '@ceo'

                return (
                  <div
                    key={profile.id}
                    className="px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-zinc-950/40 transition-colors"
                  >
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      {profile.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt=""
                          className="w-12 h-12 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-xs text-zinc-400 shrink-0">
                          {name.slice(0, 2).toUpperCase()}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-white truncate">
                            {name}
                          </p>

                          {premium && (
                            <BadgeCheck size={14} className="text-white shrink-0" />
                          )}

                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300">
                            {profile.matchScore} shared
                          </span>
                        </div>

                        <p className="text-xs text-zinc-500">
                          {profile.username ? `@${profile.username.replace('@', '')}` : 'No username'} · {formatLastSeen(profile.last_seen_at)}
                        </p>

                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {profile.sharedInterests.slice(0, 5).map((interest) => (
                            <span
                              key={interest}
                              className="px-2 py-1 rounded-full bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-400"
                            >
                              {interest}
                            </span>
                          ))}

                          {profile.sharedInterests.length > 5 && (
                            <span className="px-2 py-1 rounded-full bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-500">
                              +{profile.sharedInterests.length - 5}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 md:shrink-0">
                      <button
                        onClick={() => navigate({ to: `/profile/${profile.id}` as any })}
                        className="flex-1 md:flex-none px-3 py-2 rounded-lg text-xs font-semibold bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-600 transition-colors"
                      >
                        View Profile
                      </button>

                      <button
                        onClick={() => navigate({ to: `/messages?user=${profile.id}` as any })}
                        className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white text-zinc-950 hover:bg-zinc-200 transition-colors"
                      >
                        <MessageSquare size={13} />
                        Message
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-white mb-2">
            How matches are chosen
          </h2>

          <div className="grid md:grid-cols-3 gap-3 text-xs text-zinc-500">
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
              <p className="text-white font-semibold mb-1">Shared interests</p>
              <p>Users with more of your interests appear higher.</p>
            </div>

            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
              <p className="text-white font-semibold mb-1">Recent activity</p>
              <p>Recently active users are prioritized when scores tie.</p>
            </div>

            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
              <p className="text-white font-semibold mb-1">Better over time</p>
              <p>As more users pick interests, your suggestions improve.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
