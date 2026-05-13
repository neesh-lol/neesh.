import { useState, useEffect, useRef } from 'react'
import { X, UserPlus, UserCheck, UserX, Clock, Eye, Zap, Flame, Heart } from 'lucide-react'
import { VerifiedBadge } from '@/components/VerifiedBadge'

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

export function UserPopup({ userId, displayName, avatarUrl, currentUserId, position, onClose, onViewProfile }: UserPopupProps) {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (userId === currentUserId) {
      setProfile({ displayName, username: null, bio: '', avatarUrl: avatarUrl || '', totalXp: 0, currentStreak: 0, friendshipStatus: null, friendshipDirection: null, isSelf: true })
      setLoading(false)
      return
    }
    fetch(`/api/friends?action=profile-by-id&userId=${encodeURIComponent(userId)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setProfile(d); setLoading(false) })
      .catch(() => setLoading(false))

    fetch(`/api/follows?action=status&userId=${encodeURIComponent(userId)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setIsFollowing(d.isFollowing) })
      .catch(() => {})
  }, [userId])

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
    await fetch('/api/friends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, username: profile.username }),
    })
    const res = await fetch(`/api/friends?action=profile-by-id&userId=${encodeURIComponent(userId)}`)
    if (res.ok) setProfile(await res.json())
    setActionLoading(false)
  }

  const toggleFollow = async () => {
    setFollowLoading(true)
    await fetch('/api/follows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: isFollowing ? 'unfollow' : 'follow',
        targetUserId: userId,
      }),
    })
    setIsFollowing(!isFollowing)
    setFollowLoading(false)
  }

  const recordView = () => {
    fetch('/api/profile-views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileOwnerId: userId }),
    }).catch(() => {})
  }

  const popupStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(position.x, window.innerWidth - 280),
    top: Math.min(position.y, window.innerHeight - 300),
    zIndex: 100,
  }

  return (
    <div ref={ref} style={popupStyle} className="w-64 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden">
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
        </div>
      ) : profile ? (
        <>
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-center gap-3">
              {(profile.avatarUrl || avatarUrl) ? (
                <img src={profile.avatarUrl || avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-medium text-white">
                  {displayName.slice(0, 2).toUpperCase()}
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
                {profile.username && <p className="text-xs text-zinc-500">@{profile.username}</p>}
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
                onClick={() => { onClose(); window.location.href = '/profile' }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-zinc-300 hover:bg-zinc-800 transition-colors text-left"
              >
                <Eye size={14} /> View your profile
              </button>
            ) : (
              <>
                {profile.username && onViewProfile && (
                  <button
                    onClick={() => { recordView(); onClose(); onViewProfile(profile.username!) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-zinc-300 hover:bg-zinc-800 transition-colors text-left"
                  >
                    <Eye size={14} /> View profile
                  </button>
                )}
                <button
                  onClick={toggleFollow}
                  disabled={followLoading}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors text-left disabled:opacity-50 ${
                    isFollowing ? 'text-zinc-400 hover:bg-zinc-800' : 'text-purple-400 hover:bg-zinc-800'
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
                {profile.friendshipStatus === 'pending' && profile.friendshipDirection === 'received' && (
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
                {profile.friendshipStatus === 'pending' && profile.friendshipDirection === 'sent' && (
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
