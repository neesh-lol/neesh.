import { useState, useEffect, useRef } from 'react'
import { X, UserPlus, UserCheck, UserX, Clock, Eye, Zap, Flame, Heart } from 'lucide-react'
import { VerifiedBadge } from '@/components/VerifiedBadge'
import { supabase } from '@/lib/supabase'

interface UserPopupProps {
  userId: string
  displayName: string
  avatarUrl?: string
  currentUserId: string
  position: { x: number; y: number }
  onClose: () => void
  onViewProfile?: (username: string) => void
}

interface ProfileData {
  displayName: string
  username: string | null
  bio: string
  avatarUrl: string
  totalXp: number
  currentStreak: number
  friendshipStatus: string | null
  friendshipDirection: string | null
  isSelf: boolean
  isPremium?: boolean
  isFounderOverride?: boolean
}

export function UserPopup({
  userId,
  displayName,
  avatarUrl,
  currentUserId,
  position,
  onClose,
  onViewProfile,
}: UserPopupProps) {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const loadProfile = async () => {
    setLoading(true)

    const { data: p, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error || !p) {
      console.error('Popup profile load error:', error)
      setProfile(null)
      setLoading(false)
      return
    }

    let friendshipStatus: string | null = null
    let friendshipDirection: string | null = null

    if (userId !== currentUserId) {
      const { data: friendship } = await supabase
        .from('friendships')
        .select('*')
        .or(
          `and(requester_id.eq.${currentUserId},receiver_id.eq.${userId}),and(requester_id.eq.${userId},receiver_id.eq.${currentUserId})`
        )
        .maybeSingle()

      if (friendship) {
        friendshipStatus = friendship.status
        friendshipDirection = friendship.requester_id === currentUserId ? 'sent' : 'received'
      }

      const { data: follow } = await supabase
        .from('user_follows')
        .select('id')
        .eq('follower_id', currentUserId)
        .eq('following_id', userId)
        .maybeSingle()

      setIsFollowing(!!follow)
    }

    setProfile({
      displayName: p.display_name ?? displayName ?? 'User',
      username: p.username ?? null,
      bio: p.bio ?? '',
      avatarUrl: p.avatar_url ?? avatarUrl ?? '',
      totalXp: p.total_xp ?? 0,
      currentStreak: p.current_streak ?? 0,
      friendshipStatus,
      friendshipDirection,
      isSelf: userId === currentUserId,
      isPremium: p.is_premium ?? false,
      isFounderOverride: p.is_founder_override ?? false,
    })

    setLoading(false)
  }

  useEffect(() => {
    loadProfile()
  }, [userId, currentUserId])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }

    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const friendAction = async (action: string) => {
    if (!profile?.username) return

    setActionLoading(true)

    if (action === 'add') {
      const { error } = await supabase
        .from('friendships')
        .upsert({
          requester_id: currentUserId,
          receiver_id: userId,
          status: 'pending',
          updated_at: new Date().toISOString(),
        })

      if (error) console.error('Popup add friend error:', error)
    }

    if (action === 'accept') {
      const { error } = await supabase
        .from('friendships')
        .update({
          status: 'accepted',
          updated_at: new Date().toISOString(),
        })
        .eq('requester_id', userId)
        .eq('receiver_id', currentUserId)

      if (error) console.error('Popup accept friend error:', error)
    }

    if (action === 'remove') {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .or(
          `and(requester_id.eq.${currentUserId},receiver_id.eq.${userId}),and(requester_id.eq.${userId},receiver_id.eq.${currentUserId})`
        )

      if (error) console.error('Popup remove friend error:', error)
    }

    await loadProfile()
    setActionLoading(false)
  }

  const toggleFollow = async () => {
    if (userId === currentUserId) return

    setFollowLoading(true)

    if (isFollowing) {
      const { error } = await supabase
        .from('user_follows')
        .delete()
        .eq('follower_id', currentUserId)
        .eq('following_id', userId)

      if (error) console.error('Popup unfollow error:', error)
      else setIsFollowing(false)
    } else {
      const { error } = await supabase
        .from('user_follows')
        .upsert({
          follower_id: currentUserId,
          following_id: userId,
        })

      if (error) console.error('Popup follow error:', error)
      else setIsFollowing(true)
    }

    setFollowLoading(false)
  }

  const recordView = async () => {
    if (userId === currentUserId) return

    await supabase
      .from('profile_views')
      .upsert({
        viewer_id: currentUserId,
        profile_owner_id: userId,
        viewed_at: new Date().toISOString(),
      })
  }

  const popupStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(position.x, window.innerWidth - 280),
    top: Math.min(position.y, window.innerHeight - 300),
    zIndex: 100,
  }

  return (
    <div
      ref={ref}
      style={popupStyle}
      className="w-64 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden"
    >
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
        </div>
      ) : profile ? (
        <>
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-center gap-3">
              {profile.avatarUrl || avatarUrl ? (
                <img
                  src={profile.avatarUrl || avatarUrl}
                  alt=""
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-medium text-white">
                  {profile.displayName.slice(0, 2).toUpperCase()}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white truncate flex items-center gap-1.5">
                  {profile.displayName}
                  <VerifiedBadge
                    username={profile.username}
                    isPremium={profile.isPremium}
                    isFounderOverride={profile.isFounderOverride}
                    size={14}
                  />
                </p>

                {profile.username && (
                  <p className="text-xs text-zinc-500">@{profile.username}</p>
                )}
              </div>

              <button onClick={onClose} className="text-zinc-500 hover:text-white p-1">
                <X size={14} />
              </button>
            </div>

            {!profile.isSelf && (
              <div className="flex items-center gap-3 mt-3">
                <div className="flex items-center gap-1 text-xs text-zinc-400">
                  <Zap size={12} className="text-yellow-400" />
                  {profile.totalXp?.toLocaleString() ?? 0}
                </div>

                <div className="flex items-center gap-1 text-xs text-zinc-400">
                  <Flame size={12} className="text-orange-400" />
                  {profile.currentStreak ?? 0}d
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-zinc-800 px-2 py-2 space-y-0.5">
            {profile.isSelf ? (
              <button
                onClick={() => {
                  onClose()
                  window.location.href = '/profile'
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-zinc-300 hover:bg-zinc-800 transition-colors text-left"
              >
                <Eye size={14} /> View your profile
              </button>
            ) : (
              <>
                {profile.username && onViewProfile && (
                  <button
                    onClick={async () => {
                      await recordView()
                      onClose()
                      onViewProfile(profile.username!)
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-zinc-300 hover:bg-zinc-800 transition-colors text-left"
                  >
                    <Eye size={14} /> View profile
                  </button>
                )}

                <button
                  onClick={toggleFollow}
                  disabled={followLoading}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors text-left disabled:opacity-50 ${
                    isFollowing
                      ? 'text-zinc-400 hover:bg-zinc-800'
                      : 'text-purple-400 hover:bg-zinc-800'
                  }`}
                >
                  <Heart size={14} className={isFollowing ? 'fill-current' : ''} />
                  {isFollowing ? 'Unfollow' : 'Follow'}
                </button>

                {!profile.friendshipStatus && profile.username && (
                  <button
                    onClick={() => friendAction('add')}
                    disabled={actionLoading}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-zinc-300 hover:bg-zinc-800 transition-colors text-left disabled:opacity-50"
                  >
                    <UserPlus size={14} /> Add friend
                  </button>
                )}

                {profile.friendshipStatus === 'accepted' && (
                  <button
                    onClick={() => friendAction('remove')}
                    disabled={actionLoading}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-red-400 hover:bg-zinc-800 transition-colors text-left disabled:opacity-50"
                  >
                    <UserX size={14} /> Remove friend
                  </button>
                )}

                {profile.friendshipStatus === 'pending' &&
                  profile.friendshipDirection === 'received' && (
                    <>
                      <button
                        onClick={() => friendAction('accept')}
                        disabled={actionLoading}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-emerald-400 hover:bg-zinc-800 transition-colors text-left disabled:opacity-50"
                      >
                        <UserCheck size={14} /> Accept request
                      </button>

                      <button
                        onClick={() => friendAction('remove')}
                        disabled={actionLoading}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-zinc-400 hover:bg-zinc-800 transition-colors text-left disabled:opacity-50"
                      >
                        <UserX size={14} /> Decline
                      </button>
                    </>
                  )}

                {profile.friendshipStatus === 'pending' &&
                  profile.friendshipDirection === 'sent' && (
                    <div className="flex items-center gap-2 px-3 py-2 text-xs text-zinc-500">
                      <Clock size={14} /> Request sent
                    </div>
                  )}
              </>
            )}
          </div>
        </>
      ) : (
        <div className="px-4 py-6 text-center">
          <p className="text-xs text-zinc-500">Could not load profile</p>
        </div>
      )}
    </div>
  )
}
