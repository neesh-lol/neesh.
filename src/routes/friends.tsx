import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useIdentity } from '@/lib/identity-context'
import { supabase } from '@/lib/supabase'
import { useEffect, useState, useCallback } from 'react'
import { Search, UserPlus, UserCheck, UserX, Clock, ArrowLeft, Zap, Flame, Trophy, Heart, Eye, Users, Shield, Ban, Crown, XCircle } from 'lucide-react'
import { VerifiedBadge, FOUNDER_USERNAME } from '@/components/VerifiedBadge'

export const Route = createFileRoute('/friends')({
  component: FriendsPage,
})

interface UserResult {
  id: number
  displayName: string
  username: string | null
  bio: string
  avatarUrl: string
  interests: string[]
  score: number
  totalXp: number
}

interface FriendProfile extends UserResult {
  messageCount: number
  currentStreak: number
  longestStreak: number
  friendshipStatus: string | null
  friendshipDirection: string | null
  isSelf: boolean
  isPremium?: boolean
  isFounderOverride?: boolean
  bannerUrl?: string
  profileTheme?: string
  profileColorPrimary?: string
  profileColorSecondary?: string
  profileViews?: number
  netlifyId?: string
}

interface FriendsData {
  friends: UserResult[]
  pendingReceived: UserResult[]
  pendingSent: UserResult[]
}

function DefaultAvatar({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className="rounded-full shrink-0">
      <rect width="64" height="64" rx="32" fill="#52525b" />
      <circle cx="32" cy="24" r="10" fill="#a1a1aa" />
      <ellipse cx="32" cy="54" rx="18" ry="14" fill="#a1a1aa" />
    </svg>
  )
}

function FriendsPage() {
  const { user, ready } = useIdentity()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'friends' | 'pending' | 'search'>('friends')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<UserResult[]>([])
  const [searching, setSearching] = useState(false)
  const [friendsData, setFriendsData] = useState<FriendsData>({ friends: [], pendingReceived: [], pendingSent: [] })
  const [loading, setLoading] = useState(true)
  const [viewingProfile, setViewingProfile] = useState<FriendProfile | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 })
  const [isOwner, setIsOwner] = useState(false)
  const [banStatus, setBanStatus] = useState<{ banned: boolean; ban: any } | null>(null)
  const [adminLoading, setAdminLoading] = useState(false)
  const [adminMsg, setAdminMsg] = useState('')

  useEffect(() => {
    if (ready && !user) navigate({ to: '/signin' })
  }, [ready, user, navigate])

  const loadFriends = useCallback(async () => {
    const res = await fetch('/api/friends')
    if (res.ok) setFriendsData(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    if (user) loadFriends()
  }, [user, loadFriends])

  useEffect(() => {
    if (!user) return
    fetch('/api/profile')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.username === 'ceo') setIsOwner(true) })
      .catch(() => {})
  }, [user])

  const searchUsers = async () => {
    if (query.trim().length < 2) return
    setSearching(true)
    const res = await fetch(`/api/friends?action=search&q=${encodeURIComponent(query.trim())}`)
    if (res.ok) setResults(await res.json())
    setSearching(false)
  }

  useEffect(() => {
    const t = setTimeout(() => {
      if (query.trim().length >= 2) searchUsers()
      else setResults([])
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  const viewProfile = async (username: string) => {
    const res = await fetch(`/api/friends?action=profile&username=${encodeURIComponent(username)}`)
    if (res.ok) {
      const p = await res.json()
      setViewingProfile(p)
      setAdminMsg('')
      setBanStatus(null)
      if (p.netlifyId) {
        fetch(`/api/follows?action=status&userId=${p.netlifyId}`)
          .then(r => r.ok ? r.json() : null)
          .then(d => { if (d) setIsFollowing(d.isFollowing) })
          .catch(() => {})
        fetch(`/api/follows?action=counts&userId=${p.netlifyId}`)
          .then(r => r.ok ? r.json() : null)
          .then(d => { if (d) setFollowCounts(d) })
          .catch(() => {})
        if (p.netlifyId && p.netlifyId !== user.id) {
  await supabase
    .from('profile_views')
    .upsert({
      viewer_id: user.id,
      profile_owner_id: p.netlifyId,
      viewed_at: new Date().toISOString(),
    })

  const { count } = await supabase
    .from('profile_views')
    .select('*', { count: 'exact', head: true })
    .eq('profile_owner_id', p.netlifyId)

  p.profileViews = count ?? p.profileViews ?? 0
}
        if (isOwner) {
          fetch(`/api/admin?action=ban-status&userId=${p.netlifyId}`)
            .then(r => r.ok ? r.json() : null)
            .then(d => { if (d) setBanStatus(d) })
            .catch(() => {})
        }
      }
    }
  }

  const friendAction = async (action: string, username: string) => {
    setActionLoading(true)
    await fetch('/api/friends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, username }),
    })
    if (viewingProfile?.username === username) {
      await viewProfile(username)
    }
    await loadFriends()
    setActionLoading(false)
  }

  if (!ready || !user) return (
    <div className="flex items-center justify-center h-full bg-zinc-950">
      <div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
    </div>
  )

  if (viewingProfile) {
    const p = viewingProfile
    const pIsPremium = p.isPremium || p.isFounderOverride || p.username === FOUNDER_USERNAME
    const pHasGradient = pIsPremium && p.profileColorPrimary && p.profileColorSecondary
    return (
      <div className="flex flex-col h-full bg-zinc-950 overflow-y-auto">
        {pIsPremium && p.bannerUrl ? (
          <div className="relative h-28 md:h-36 flex-shrink-0">
            <img src={p.bannerUrl} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 to-transparent" />
            <button onClick={() => setViewingProfile(null)} className="absolute top-3 left-3 p-2 bg-black/50 rounded-lg text-white/70 hover:text-white transition-colors">
              <ArrowLeft size={16} />
            </button>
          </div>
        ) : pHasGradient ? (
          <div
            className="relative h-28 md:h-36 flex-shrink-0"
            style={{ background: `linear-gradient(135deg, ${p.profileColorPrimary}, ${p.profileColorSecondary})` }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 to-transparent" />
            <button onClick={() => setViewingProfile(null)} className="absolute top-3 left-3 p-2 bg-black/30 rounded-lg text-white/70 hover:text-white transition-colors">
              <ArrowLeft size={16} />
            </button>
          </div>
        ) : (
          <div className="px-5 py-4 border-b border-zinc-800 flex items-center gap-3">
            <button onClick={() => setViewingProfile(null)} className="text-zinc-400 hover:text-white">
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-sm font-semibold text-white flex items-center gap-1.5">
                {p.displayName}
                <VerifiedBadge username={p.username} isPremium={p.isPremium} isFounderOverride={p.isFounderOverride} size={15} />
              </h1>
              {p.username && <p className="text-xs text-zinc-500">@{p.username}</p>}
            </div>
          </div>
        )}
        <div className="max-w-lg mx-auto w-full px-5 py-8 space-y-6">
          {pHasGradient ? (
            <div className="rounded-xl p-px" style={{ background: `linear-gradient(135deg, ${p.profileColorPrimary}, ${p.profileColorSecondary})` }}>
              <div className="bg-zinc-950 rounded-xl p-4 flex items-center gap-5">
                {p.avatarUrl ? (
                  <img
                    src={p.avatarUrl}
                    alt="avatar"
                    className="w-16 h-16 rounded-full object-cover"
                    style={{ boxShadow: `0 0 0 3px ${p.profileColorPrimary}` }}
                  />
                ) : (
                  <DefaultAvatar size={64} />
                )}
                <div>
                  <p className="text-sm font-medium text-white flex items-center gap-1.5">
                    {p.displayName}
                    <VerifiedBadge username={p.username} isPremium={p.isPremium} isFounderOverride={p.isFounderOverride} size={15} />
                  </p>
                  {p.username && <p className="text-xs text-zinc-500">@{p.username}</p>}
                </div>
              </div>
            </div>
          ) : (
          <div className="flex items-center gap-5">
            {p.avatarUrl ? (
              <img src={p.avatarUrl} alt="avatar" className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <DefaultAvatar size={64} />
            )}
            <div>
              <p className="text-sm font-medium text-white flex items-center gap-1.5">
                {p.displayName}
                <VerifiedBadge username={p.username} isPremium={p.isPremium} isFounderOverride={p.isFounderOverride} size={15} />
              </p>
              {p.username && <p className="text-xs text-zinc-500">@{p.username}</p>}
            </div>
          </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-center">
              <Zap size={14} className="text-yellow-400 mx-auto mb-1" />
              <p className="text-sm font-bold text-white">{p.totalXp?.toLocaleString() ?? 0}</p>
              <p className="text-xs text-zinc-500">XP</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-center">
              <Flame size={14} className="text-orange-400 mx-auto mb-1" />
              <p className="text-sm font-bold text-white">{p.currentStreak ?? 0}d</p>
              <p className="text-xs text-zinc-500">Streak</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-center">
              <Trophy size={14} className="text-emerald-400 mx-auto mb-1" />
              <p className="text-sm font-bold text-white">{p.longestStreak ?? 0}d</p>
              <p className="text-xs text-zinc-500">Best</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-center">
              <Users size={14} className="text-purple-400 mx-auto mb-1" />
              <p className="text-sm font-bold text-white">{followCounts.followers}</p>
              <p className="text-xs text-zinc-500">Followers</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-center">
              <UserPlus size={14} className="text-blue-400 mx-auto mb-1" />
              <p className="text-sm font-bold text-white">{followCounts.following}</p>
              <p className="text-xs text-zinc-500">Following</p>
            </div>
            {(p.isPremium || p.isFounderOverride || p.username === FOUNDER_USERNAME) && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-center">
                <Eye size={14} className="text-cyan-400 mx-auto mb-1" />
                <p className="text-sm font-bold text-white">{p.profileViews ?? 0}</p>
                <p className="text-xs text-zinc-500">Views</p>
              </div>
            )}
          </div>

          {p.bio && (
            <div>
              <p className="text-xs font-medium text-zinc-400 mb-1">Bio</p>
              <p className="text-sm text-zinc-300">{p.bio}</p>
            </div>
          )}

          {p.interests && p.interests.length > 0 && (
            <div>
              <p className="text-xs font-medium text-zinc-400 mb-2">Interests</p>
              <div className="flex flex-wrap gap-2">
                {p.interests.map((tag) => (
                  <span key={tag} className="px-3 py-1 rounded-full text-xs border border-zinc-700 text-zinc-400">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {!p.isSelf && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={async () => {
                  if (!p.netlifyId) return
                  await fetch('/api/follows', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      action: isFollowing ? 'unfollow' : 'follow',
                      targetUserId: p.netlifyId,
                    }),
                  })
                  setIsFollowing(!isFollowing)
                  setFollowCounts(c => ({
                    ...c,
                    followers: isFollowing ? c.followers - 1 : c.followers + 1,
                  }))
                }}
                className={`flex items-center gap-2 px-4 py-2.5 font-medium rounded-lg text-sm transition-colors ${
                  isFollowing
                    ? 'bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-red-400'
                    : 'bg-purple-500 text-white hover:bg-purple-600'
                }`}
              >
                <Heart size={15} className={isFollowing ? 'fill-current' : ''} />
                {isFollowing ? 'Unfollow' : 'Follow'}
              </button>
              {p.friendshipStatus === 'accepted' && (
                <button
                  onClick={() => friendAction('remove', p.username!)}
                  disabled={actionLoading}
                  className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 border border-zinc-700 text-red-400 font-medium rounded-lg text-sm hover:bg-zinc-700 transition-colors disabled:opacity-50"
                >
                  <UserX size={15} /> Remove friend
                </button>
              )}
              {p.friendshipStatus === 'pending' && p.friendshipDirection === 'received' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => friendAction('accept', p.username!)}
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white text-zinc-950 font-medium rounded-lg text-sm hover:bg-zinc-200 transition-colors disabled:opacity-50"
                  >
                    <UserCheck size={15} /> Accept request
                  </button>
                  <button
                    onClick={() => friendAction('remove', p.username!)}
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 border border-zinc-700 text-zinc-400 font-medium rounded-lg text-sm hover:bg-zinc-700 transition-colors disabled:opacity-50"
                  >
                    <UserX size={15} /> Decline
                  </button>
                </div>
              )}
              {p.friendshipStatus === 'pending' && p.friendshipDirection === 'sent' && (
                <button
                  disabled
                  className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 border border-zinc-700 text-zinc-500 font-medium rounded-lg text-sm"
                >
                  <Clock size={15} /> Request sent
                </button>
              )}
              {!p.friendshipStatus && p.username && (
                <button
                  onClick={() => friendAction('add', p.username!)}
                  disabled={actionLoading}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white text-zinc-950 font-medium rounded-lg text-sm hover:bg-zinc-200 transition-colors disabled:opacity-50"
                >
                  <UserPlus size={15} /> Add friend
                </button>
              )}
            </div>
          )}

          {isOwner && !p.isSelf && p.netlifyId && (
            <div className="border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
                <Shield size={14} className="text-zinc-400" />
                <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Owner Controls</span>
              </div>
              <div className="p-4 space-y-3">
                {adminMsg && (
                  <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">{adminMsg}</p>
                )}

                <div className="flex flex-wrap gap-2">
                  {banStatus?.banned ? (
                    <button
                      disabled={adminLoading}
                      onClick={async () => {
                        if (!confirm(`Unban ${p.displayName}?`)) return
                        setAdminLoading(true)
                        const res = await fetch('/api/admin', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ action: 'unban-user', userId: p.netlifyId }),
                        })
                        if (res.ok) {
                          setBanStatus({ banned: false, ban: null })
                          setAdminMsg('User unbanned')
                        }
                        setAdminLoading(false)
                      }}
                      className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-medium hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                    >
                      <UserCheck size={13} /> Unban User
                    </button>
                  ) : (
                    <button
                      disabled={adminLoading}
                      onClick={async () => {
                        const reason = prompt('Ban reason (optional):')
                        if (reason === null) return
                        const permanent = confirm('Permanent ban? (Cancel for temporary 7-day ban)')
                        setAdminLoading(true)
                        const body: any = { action: 'ban-user', userId: p.netlifyId, reason, permanent }
                        if (!permanent) body.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
                        const res = await fetch('/api/admin', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(body),
                        })
                        if (res.ok) {
                          setBanStatus({ banned: true, ban: { reason, permanent } })
                          setAdminMsg('User banned')
                        }
                        setAdminLoading(false)
                      }}
                      className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-xs font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50"
                    >
                      <Ban size={13} /> Ban User
                    </button>
                  )}

                  {p.isPremium || p.isFounderOverride ? (
                    <button
                      disabled={adminLoading}
                      onClick={async () => {
                        if (!confirm(`Remove NEESH.+ from ${p.displayName}?`)) return
                        setAdminLoading(true)
                        const res = await fetch('/api/admin', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ action: 'remove-neesh-plus', userId: p.netlifyId }),
                        })
                        if (res.ok) setAdminMsg('NEESH.+ removed')
                        setAdminLoading(false)
                      }}
                      className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-lg text-xs font-medium hover:bg-zinc-700 transition-colors disabled:opacity-50"
                    >
                      <XCircle size={13} /> Remove NEESH.+
                    </button>
                  ) : (
                    <button
                      disabled={adminLoading}
                      onClick={async () => {
                        if (!confirm(`Grant NEESH.+ to ${p.displayName}?`)) return
                        setAdminLoading(true)
                        const res = await fetch('/api/admin', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ action: 'grant-neesh-plus', userId: p.netlifyId }),
                        })
                        if (res.ok) setAdminMsg('NEESH.+ granted')
                        setAdminLoading(false)
                      }}
                      className="flex items-center gap-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 rounded-lg text-xs font-medium hover:bg-yellow-500/20 transition-colors disabled:opacity-50"
                    >
                      <Crown size={13} /> Grant NEESH.+
                    </button>
                  )}
                </div>

                {banStatus?.banned && banStatus.ban && (
                  <div className="text-xs text-zinc-500 bg-zinc-900 rounded-lg px-3 py-2">
                    <span className="text-red-400 font-medium">Banned</span>
                    {banStatus.ban.reason && <span> — {banStatus.ban.reason}</span>}
                    {banStatus.ban.permanent ? <span className="text-zinc-600"> (permanent)</span> : <span className="text-zinc-600"> (temporary)</span>}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950 overflow-y-auto">
      <div className="px-5 py-4 border-b border-zinc-800">
        <h1 className="text-sm font-semibold text-white">Friends</h1>
        <p className="text-xs text-zinc-500">Find and connect with others</p>
      </div>

      <div className="px-5 pt-4">
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setTab('friends')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === 'friends' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            My Friends
          </button>
          <button
            onClick={() => setTab('pending')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${tab === 'pending' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Pending
            {(friendsData.pendingReceived.length + friendsData.pendingSent.length) > 0 && (
              <span className="bg-purple-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {friendsData.pendingReceived.length + friendsData.pendingSent.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('search')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === 'search' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Search Users
          </button>
        </div>
      </div>

      {tab === 'search' && (
        <div className="px-5 space-y-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by username..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-10 pr-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
            />
          </div>
          {searching && (
            <div className="flex justify-center py-4">
              <div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
            </div>
          )}
          {!searching && results.length === 0 && query.length >= 2 && (
            <p className="text-xs text-zinc-500 text-center py-4">No users found</p>
          )}
          <div className="space-y-2">
            {results.map((u) => (
              <button
                key={u.id}
                onClick={() => u.username && viewProfile(u.username)}
                className="w-full flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-lg p-3 hover:bg-zinc-800 transition-colors text-left"
              >
                {u.avatarUrl ? (
                  <img src={u.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <DefaultAvatar />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate flex items-center gap-1.5">
                    {u.displayName}
                    {u.username === FOUNDER_USERNAME && <VerifiedBadge username={u.username} size={14} />}
                  </p>
                  {u.username && <p className="text-xs text-zinc-500">@{u.username}</p>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === 'friends' && (
        <div className="px-5 space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {friendsData.friends.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-zinc-400 mb-2">Friends ({friendsData.friends.length})</p>
                  <div className="space-y-2">
                    {friendsData.friends.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => u.username && viewProfile(u.username)}
                        className="w-full flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-lg p-3 hover:bg-zinc-800 transition-colors text-left"
                      >
                        {u.avatarUrl ? (
                          <img src={u.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <DefaultAvatar />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate flex items-center gap-1.5">{u.displayName}{u.username === FOUNDER_USERNAME && <VerifiedBadge username={u.username} size={14} />}</p>
                          {u.username && <p className="text-xs text-zinc-500">@{u.username}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {friendsData.friends.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-sm text-zinc-500 mb-2">No friends yet</p>
                  <button
                    onClick={() => setTab('search')}
                    className="text-xs text-zinc-400 hover:text-white transition-colors"
                  >
                    Search for users to add
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'pending' && (
        <div className="px-5 space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {friendsData.pendingReceived.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-zinc-400 mb-2">Received ({friendsData.pendingReceived.length})</p>
                  <div className="space-y-2">
                    {friendsData.pendingReceived.map((u) => (
                      <div key={u.id} className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                        <button
                          onClick={() => u.username && viewProfile(u.username)}
                          className="flex items-center gap-3 flex-1 min-w-0 text-left"
                        >
                          {u.avatarUrl ? (
                            <img src={u.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                          ) : (
                            <DefaultAvatar />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white truncate flex items-center gap-1.5">{u.displayName}{u.username === FOUNDER_USERNAME && <VerifiedBadge username={u.username} size={14} />}</p>
                            {u.username && <p className="text-xs text-zinc-500">@{u.username}</p>}
                          </div>
                        </button>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => friendAction('accept', u.username!)}
                            disabled={actionLoading}
                            className="p-2 bg-white text-zinc-950 rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50"
                            title="Accept"
                          >
                            <UserCheck size={14} />
                          </button>
                          <button
                            onClick={() => friendAction('remove', u.username!)}
                            disabled={actionLoading}
                            className="p-2 bg-zinc-800 text-zinc-400 rounded-lg hover:bg-zinc-700 transition-colors disabled:opacity-50"
                            title="Decline"
                          >
                            <UserX size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {friendsData.pendingSent.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-zinc-400 mb-2">Sent ({friendsData.pendingSent.length})</p>
                  <div className="space-y-2">
                    {friendsData.pendingSent.map((u) => (
                      <div key={u.id} className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                        <button
                          onClick={() => u.username && viewProfile(u.username)}
                          className="flex items-center gap-3 flex-1 min-w-0 text-left"
                        >
                          {u.avatarUrl ? (
                            <img src={u.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                          ) : (
                            <DefaultAvatar />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white truncate flex items-center gap-1.5">{u.displayName}{u.username === FOUNDER_USERNAME && <VerifiedBadge username={u.username} size={14} />}</p>
                            {u.username && <p className="text-xs text-zinc-500">@{u.username}</p>}
                          </div>
                        </button>
                        <span className="text-xs text-zinc-600 shrink-0 flex items-center gap-1">
                          <Clock size={12} /> Pending
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {friendsData.pendingReceived.length === 0 && friendsData.pendingSent.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-sm text-zinc-500">No pending requests</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
