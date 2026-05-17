import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useIdentity } from '@/lib/identity-context'
import { supabase } from '@/lib/supabase'
import { useEffect, useState, useCallback } from 'react'
import { Search, UserPlus, UserCheck, UserX, Clock, ArrowLeft, Zap, Flame, Trophy, Heart, Eye, Users, Shield, Ban, Crown, XCircle } from 'lucide-react'
import { VerifiedBadge, FOUNDER_USERNAME } from '@/components/VerifiedBadge'

export const Route = createFileRoute('/friends')({
  component: FriendsPage,
})

interface PresenceInfo {
  status: string
  lastSeen: string | null
}

interface UserResult {
  id: any
  displayName: string
  username: string | null
  bio: string
  avatarUrl: string
  interests: string[]
  score: number
  totalXp: number
  isPremium?: boolean
  isFounderOverride?: boolean
  presence?: PresenceInfo
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

function isPresenceOnline(presence?: PresenceInfo) {
  if (!presence?.lastSeen) return false

  return (
    presence.status === 'online' &&
    Date.now() - new Date(presence.lastSeen).getTime() < 90000
  )
}

function formatLastSeen(lastSeen?: string | null) {
  if (!lastSeen) return 'Offline'

  const diffMs = Date.now() - new Date(lastSeen).getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMin < 1) return 'Active just now'
  if (diffMin < 60) return `Active ${diffMin}m ago`
  if (diffHours < 24) return `Active ${diffHours}h ago`
  return `Active ${diffDays}d ago`
}

function presenceText(presence?: PresenceInfo) {
  return isPresenceOnline(presence) ? 'Online' : formatLastSeen(presence?.lastSeen)
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

function AvatarWithPresence({
  name,
  url,
  size = 40,
  presence,
  imageStyle,
}: {
  name: string
  url?: string
  size?: number
  presence?: PresenceInfo
  imageStyle?: React.CSSProperties
}) {
  const online = isPresenceOnline(presence)
  const dotSize = size >= 60 ? 14 : 12

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {url ? (
        <img
          src={url}
          alt=""
          className="rounded-full object-cover"
          style={{ width: size, height: size, ...imageStyle }}
        />
      ) : (
        <DefaultAvatar size={size} />
      )}

      {presence && (
        <span
          className={`absolute rounded-full border-2 border-zinc-950 ${online ? 'bg-emerald-400' : 'bg-zinc-600'}`}
          style={{
            width: dotSize,
            height: dotSize,
            right: 0,
            bottom: 0,
          }}
        />
      )}
    </div>
  )
}

function mapUserResult(p: any, presence?: PresenceInfo): UserResult {
  return {
    id: p.id,
    displayName: p.display_name ?? 'User',
    username: p.username ?? null,
    bio: p.bio ?? '',
    avatarUrl: p.avatar_url ?? '',
    interests: p.interests ?? [],
    score: 0,
    totalXp: p.total_xp ?? 0,
    isPremium: p.is_premium ?? false,
    isFounderOverride: p.is_founder_override ?? false,
    presence,
  }
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

  const loadPresenceMap = async (ids: string[]) => {
    const presenceMap = new Map<string, PresenceInfo>()

    if (ids.length === 0) return presenceMap

    const { data, error } = await supabase
      .from('user_presence')
      .select('user_id,status,last_seen,updated_at')
      .in('user_id', ids)

    if (error) {
      console.error('Presence load error:', error)
      return presenceMap
    }

    for (const row of data ?? []) {
      presenceMap.set(row.user_id, {
        status: row.status ?? 'offline',
        lastSeen: row.last_seen ?? row.updated_at ?? null,
      })
    }

    return presenceMap
  }

  const loadFriends = useCallback(async () => {
    if (!user) return

    setLoading(true)

    const { data: rows, error } = await supabase
      .from('friendships')
      .select('*')
      .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`)

    if (error) {
      console.error('Friends load error:', error)
      setLoading(false)
      return
    }

    const friendships = rows ?? []

    const profileIds = Array.from(
      new Set(
        friendships
          .flatMap((f: any) => [f.requester_id, f.receiver_id])
          .filter((id: string) => id !== user.id)
      )
    )

    if (profileIds.length === 0) {
      setFriendsData({ friends: [], pendingReceived: [], pendingSent: [] })
      setLoading(false)
      return
    }

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .in('id', profileIds)

    if (profilesError) {
      console.error('Friend profile load error:', profilesError)
      setLoading(false)
      return
    }

    const presenceMap = await loadPresenceMap(profileIds)

    const profileMap = new Map<string, any>()
    for (const p of profiles ?? []) {
      profileMap.set(p.id, p)
    }

    const friends: UserResult[] = []
    const pendingReceived: UserResult[] = []
    const pendingSent: UserResult[] = []

    for (const f of friendships) {
      const otherId = f.requester_id === user.id ? f.receiver_id : f.requester_id
      const other = profileMap.get(otherId)
      if (!other) continue

      const mapped = mapUserResult(other, presenceMap.get(otherId) ?? { status: 'offline', lastSeen: null })

      if (f.status === 'accepted') {
        friends.push(mapped)
      } else if (f.status === 'pending') {
        if (f.receiver_id === user.id) {
          pendingReceived.push(mapped)
        } else {
          pendingSent.push(mapped)
        }
      }
    }

    setFriendsData({ friends, pendingReceived, pendingSent })
    setLoading(false)
  }, [user])

  useEffect(() => {
    if (user) loadFriends()
  }, [user, loadFriends])

  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel(`friends_presence_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence',
        },
        () => {
          loadFriends()

          if (query.trim().length >= 2) {
            searchUsers()
          }

          if (viewingProfile?.username) {
            viewProfile(viewingProfile.username)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, loadFriends, query, viewingProfile?.username])

  useEffect(() => {
    if (!user) return

    async function loadOwnerStatus() {
      const { data } = await supabase
        .from('profiles')
        .select('username,is_founder_override')
        .eq('id', user.id)
        .maybeSingle()

      if (data?.username === 'ceo' || data?.is_founder_override === true) {
        setIsOwner(true)
      }
    }

    loadOwnerStatus()
  }, [user])

  const searchUsers = async () => {
    if (!user || query.trim().length < 2) return

    setSearching(true)

    const q = query.trim().toLowerCase()

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
      .neq('id', user.id)
      .limit(20)

    if (error) {
      console.error('User search error:', error)
      setResults([])
      setSearching(false)
      return
    }

    const ids = (data ?? []).map((p: any) => p.id)
    const presenceMap = await loadPresenceMap(ids)

    setResults((data ?? []).map((p: any) => mapUserResult(p, presenceMap.get(p.id) ?? { status: 'offline', lastSeen: null })))
    setSearching(false)
  }

  useEffect(() => {
    const t = setTimeout(() => {
      if (query.trim().length >= 2) searchUsers()
      else setResults([])
    }, 300)

    return () => clearTimeout(t)
  }, [query])

  const loadFollowCounts = async (profileId: string) => {
    const { count: followers } = await supabase
      .from('user_follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', profileId)

    const { count: following } = await supabase
      .from('user_follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', profileId)

    setFollowCounts({
      followers: followers ?? 0,
      following: following ?? 0,
    })
  }

  const loadFollowStatus = async (profileId: string) => {
    if (!user) return

    const { data } = await supabase
      .from('user_follows')
      .select('id')
      .eq('follower_id', user.id)
      .eq('following_id', profileId)
      .maybeSingle()

    setIsFollowing(!!data)
  }

  const getFriendshipStatus = async (profileId: string) => {
    if (!user) return { status: null as string | null, direction: null as string | null }

    const { data } = await supabase
      .from('friendships')
      .select('*')
      .or(
        `and(requester_id.eq.${user.id},receiver_id.eq.${profileId}),and(requester_id.eq.${profileId},receiver_id.eq.${user.id})`
      )
      .maybeSingle()

    if (!data) return { status: null, direction: null }

    const direction = data.requester_id === user.id ? 'sent' : 'received'

    return {
      status: data.status as string,
      direction,
    }
  }

  const viewProfile = async (username: string) => {
    if (!user) return

    const { data: p, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', username)
      .maybeSingle()

    if (error) {
      console.error('Profile view load error:', error)
      alert('Could not load profile.')
      return
    }

    if (!p) {
      alert('User profile not found.')
      return
    }

    let profileViews = 0

    if (p.id && p.id !== user.id) {
      await supabase
        .from('profile_views')
        .upsert({
          viewer_id: user.id,
          profile_owner_id: p.id,
          viewed_at: new Date().toISOString(),
        })

      const { count } = await supabase
        .from('profile_views')
        .select('*', { count: 'exact', head: true })
        .eq('profile_owner_id', p.id)

      profileViews = count ?? 0
    } else {
      const { count } = await supabase
        .from('profile_views')
        .select('*', { count: 'exact', head: true })
        .eq('profile_owner_id', p.id)

      profileViews = count ?? 0
    }

    const friendship = await getFriendshipStatus(p.id)
    const presenceMap = await loadPresenceMap([p.id])
    const presence = presenceMap.get(p.id) ?? { status: 'offline', lastSeen: null }

    const mappedProfile: FriendProfile = {
      id: p.id,
      netlifyId: p.id,
      displayName: p.display_name ?? 'User',
      username: p.username ?? null,
      bio: p.bio ?? '',
      avatarUrl: p.avatar_url ?? '',
      interests: p.interests ?? [],
      score: 0,
      totalXp: p.total_xp ?? 0,
      messageCount: p.message_count ?? 0,
      currentStreak: p.current_streak ?? 0,
      longestStreak: p.longest_streak ?? 0,
      friendshipStatus: friendship.status,
      friendshipDirection: friendship.direction,
      isSelf: p.id === user.id,
      isPremium: p.is_premium ?? false,
      isFounderOverride: p.is_founder_override ?? false,
      bannerUrl: p.banner_url ?? '',
      profileTheme: p.profile_theme ?? '',
      profileColorPrimary: p.profile_color_primary ?? '',
      profileColorSecondary: p.profile_color_secondary ?? '',
      profileViews,
      presence,
    }

    setViewingProfile(mappedProfile)
    setAdminMsg('')
    setBanStatus(null)

    if (p.id) {
      await loadFollowCounts(p.id)
      await loadFollowStatus(p.id)
    }
  }

  const friendAction = async (action: string, username: string) => {
    if (!user) return

    setActionLoading(true)

    try {
      const { data: targetProfile, error: targetError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .maybeSingle()

      if (targetError || !targetProfile) {
        console.error('Friend target lookup error:', targetError)
        alert('Could not find user.')
        setActionLoading(false)
        return
      }

      const targetId = targetProfile.id

      if (action === 'add') {
        const { error } = await supabase
          .from('friendships')
          .upsert({
            requester_id: user.id,
            receiver_id: targetId,
            status: 'pending',
            updated_at: new Date().toISOString(),
          })

        if (error) {
          console.error('Add friend error:', error)
          alert('Could not send friend request.')
        }
      }

      if (action === 'accept') {
        const { error } = await supabase
          .from('friendships')
          .update({
            status: 'accepted',
            updated_at: new Date().toISOString(),
          })
          .eq('requester_id', targetId)
          .eq('receiver_id', user.id)

        if (error) {
          console.error('Accept friend error:', error)
          alert('Could not accept friend request.')
        }
      }

      if (action === 'remove') {
        const { error } = await supabase
          .from('friendships')
          .delete()
          .or(
            `and(requester_id.eq.${user.id},receiver_id.eq.${targetId}),and(requester_id.eq.${targetId},receiver_id.eq.${user.id})`
          )

        if (error) {
          console.error('Remove friend error:', error)
          alert('Could not remove friend.')
        }
      }

      if (viewingProfile?.username === username) {
        await viewProfile(username)
      }

      await loadFriends()
    } catch (error) {
      console.error('Friend action error:', error)
    }

    setActionLoading(false)
  }

  const toggleFollow = async (profileId: string) => {
    if (!user || !profileId || profileId === user.id) return

    if (isFollowing) {
      await supabase
        .from('user_follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', profileId)

      setIsFollowing(false)
      setFollowCounts((c) => ({
        ...c,
        followers: Math.max(0, c.followers - 1),
      }))
    } else {
      await supabase
        .from('user_follows')
        .upsert({
          follower_id: user.id,
          following_id: profileId,
        })

      setIsFollowing(true)
      setFollowCounts((c) => ({
        ...c,
        followers: c.followers + 1,
      }))
    }
  }

  const grantPremium = async (profileId: string) => {
    setAdminLoading(true)

    const { error } = await supabase
      .from('profiles')
      .update({ is_premium: true })
      .eq('id', profileId)

    if (error) {
      console.error('Grant premium error:', error)
      setAdminMsg('Failed to grant NEESH.+')
    } else {
      setAdminMsg('NEESH.+ granted')
      setViewingProfile((p) => p ? { ...p, isPremium: true } : p)
    }

    setAdminLoading(false)
  }

  const revokePremium = async (profileId: string) => {
    setAdminLoading(true)

    const { error } = await supabase
      .from('profiles')
      .update({
        is_premium: false,
        is_founder_override: false,
      })
      .eq('id', profileId)

    if (error) {
      console.error('Revoke premium error:', error)
      setAdminMsg('Failed to revoke NEESH.+')
    } else {
      setAdminMsg('NEESH.+ revoked')
      setViewingProfile((p) => p ? { ...p, isPremium: false, isFounderOverride: false } : p)
    }

    setAdminLoading(false)
  }

  const UserRow = ({ u, right }: { u: UserResult; right?: React.ReactNode }) => (
    <div className="flex items-center gap-3 w-full">
      <AvatarWithPresence
        name={u.displayName}
        url={u.avatarUrl || undefined}
        presence={u.presence}
      />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white truncate flex items-center gap-1.5">
          {u.displayName}
          <VerifiedBadge username={u.username} isPremium={u.isPremium} isFounderOverride={u.isFounderOverride} size={14} />
        </p>
        {u.username && <p className="text-xs text-zinc-500">@{u.username}</p>}
        <p className={`text-[11px] ${isPresenceOnline(u.presence) ? 'text-emerald-400' : 'text-zinc-600'}`}>
          {presenceText(u.presence)}
        </p>
      </div>

      {right}
    </div>
  )

  if (!ready || !user) {
    return (
      <div className="flex items-center justify-center h-full bg-zinc-950">
        <div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

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
              <p className={`text-[11px] ${isPresenceOnline(p.presence) ? 'text-emerald-400' : 'text-zinc-500'}`}>
                {presenceText(p.presence)}
              </p>
            </div>
          </div>
        )}

        <div className="max-w-lg mx-auto w-full px-5 py-8 space-y-6">
          {pHasGradient ? (
            <div className="rounded-xl p-px" style={{ background: `linear-gradient(135deg, ${p.profileColorPrimary}, ${p.profileColorSecondary})` }}>
              <div className="bg-zinc-950 rounded-xl p-4 flex items-center gap-5">
                <AvatarWithPresence
                  name={p.displayName}
                  url={p.avatarUrl || undefined}
                  size={64}
                  presence={p.presence}
                  imageStyle={{ boxShadow: `0 0 0 3px ${p.profileColorPrimary}` }}
                />
                <div>
                  <p className="text-sm font-medium text-white flex items-center gap-1.5">
                    {p.displayName}
                    <VerifiedBadge username={p.username} isPremium={p.isPremium} isFounderOverride={p.isFounderOverride} size={15} />
                  </p>
                  {p.username && <p className="text-xs text-zinc-500">@{p.username}</p>}
                  <p className={`text-[11px] ${isPresenceOnline(p.presence) ? 'text-emerald-400' : 'text-zinc-500'}`}>
                    {presenceText(p.presence)}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-5">
              <AvatarWithPresence
                name={p.displayName}
                url={p.avatarUrl || undefined}
                size={64}
                presence={p.presence}
              />
              <div>
                <p className="text-sm font-medium text-white flex items-center gap-1.5">
                  {p.displayName}
                  <VerifiedBadge username={p.username} isPremium={p.isPremium} isFounderOverride={p.isFounderOverride} size={15} />
                </p>
                {p.username && <p className="text-xs text-zinc-500">@{p.username}</p>}
                <p className={`text-[11px] ${isPresenceOnline(p.presence) ? 'text-emerald-400' : 'text-zinc-500'}`}>
                  {presenceText(p.presence)}
                </p>
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
            {pIsPremium && (
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
                onClick={() => p.netlifyId && toggleFollow(p.netlifyId)}
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
                        setBanStatus({ banned: false, ban: null })
                        setAdminMsg('User unbanned')
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
                        setAdminLoading(true)
                        setBanStatus({ banned: true, ban: { reason, permanent: false } })
                        setAdminMsg('User banned')
                        setAdminLoading(false)
                      }}
                      className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-xs font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50"
                    >
                      <Ban size={13} /> Ban User
                    </button>
                  )}

                  {p.isPremium || p.isFounderOverride ? (
                    <button
                      disabled={adminLoading || p.username === FOUNDER_USERNAME}
                      onClick={async () => {
                        if (p.username === FOUNDER_USERNAME) {
                          setAdminMsg('Founder NEESH.+ cannot be revoked')
                          return
                        }

                        if (!confirm(`Revoke NEESH.+ from ${p.displayName}?`)) return
                        if (!p.netlifyId) return
                        await revokePremium(p.netlifyId)
                      }}
                      className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-lg text-xs font-medium hover:bg-zinc-700 transition-colors disabled:opacity-50"
                    >
                      <XCircle size={13} /> Revoke NEESH.+
                    </button>
                  ) : (
                    <button
                      disabled={adminLoading}
                      onClick={async () => {
                        if (!confirm(`Grant NEESH.+ to ${p.displayName}?`)) return
                        if (!p.netlifyId) return
                        await grantPremium(p.netlifyId)
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
                <UserRow u={u} />
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
                        <UserRow u={u} />
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
                          <UserRow u={u} />
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
                          <UserRow u={u} />
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
