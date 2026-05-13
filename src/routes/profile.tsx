import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useIdentity } from '@/lib/identity-context'
import { useEffect, useState, useRef } from 'react'
import { Save, Flame, Zap, Trophy, AlertCircle, Camera, X, Eye, Users, UserPlus, Crown, Image, Palette } from 'lucide-react'
import { VerifiedBadge, FOUNDER_USERNAME } from '@/components/VerifiedBadge'

export const Route = createFileRoute('/profile')({
  component: ProfilePage,
})

const ALL_INTERESTS = [
  'gaming', 'music', 'art', 'tech', 'sports', 'anime', 'movies',
  'cooking', 'books', 'fitness', 'travel', 'photography', 'science',
  'fashion', 'pets', 'investing', 'design', 'coding',
]

const GRADIENT_PRESETS = [
  { name: 'Sunset', primary: '#ff6b6b', secondary: '#ffa235' },
  { name: 'Ocean', primary: '#4facfe', secondary: '#00f2fe' },
  { name: 'Aurora', primary: '#a855f7', secondary: '#06b6d4' },
  { name: 'Twilight', primary: '#7c3aed', secondary: '#1e1b4b' },
  { name: 'Ember', primary: '#ef4444', secondary: '#f97316' },
  { name: 'Neon', primary: '#ec4899', secondary: '#06b6d4' },
  { name: 'Midnight', primary: '#6366f1', secondary: '#0f172a' },
  { name: 'Forest', primary: '#22c55e', secondary: '#059669' },
  { name: 'Candy', primary: '#f472b6', secondary: '#c084fc' },
  { name: 'Storm', primary: '#64748b', secondary: '#1e293b' },
]

interface Profile {
  id?: number
  netlifyId?: string
  displayName: string
  username: string | null
  bio: string
  avatarUrl: string
  bannerUrl: string
  profileTheme: string
  profileColorPrimary: string
  profileColorSecondary: string
  interests: string[]
  messageCount?: number
  totalXp?: number
  currentStreak?: number
  longestStreak?: number
  lastUsernameChange?: string | null
  weeklyMatchOptIn?: boolean
  isPremium?: boolean
  isFounderOverride?: boolean
  profileViews?: number
}

function DefaultAvatar({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className="rounded-full">
      <rect width="64" height="64" rx="32" fill="#52525b" />
      <circle cx="32" cy="24" r="10" fill="#a1a1aa" />
      <ellipse cx="32" cy="54" rx="18" ry="14" fill="#a1a1aa" />
    </svg>
  )
}

function ProfilePage() {
  const { user, ready } = useIdentity()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<Profile>({
    displayName: '',
    username: null,
    bio: '',
    avatarUrl: '',
    bannerUrl: '',
    profileTheme: 'default',
    profileColorPrimary: '',
    profileColorSecondary: '',
    interests: [],
  })
  const [usernameInput, setUsernameInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [showFollowers, setShowFollowers] = useState(false)
  const [showFollowing, setShowFollowing] = useState(false)
  const [followersList, setFollowersList] = useState<any[]>([])
  const [followingList, setFollowingList] = useState<any[]>([])
  const [streakInfo, setStreakInfo] = useState<{ freezesRemaining: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (profile.isPremium && file.type === 'image/gif') {
      if (file.size > 5 * 1024 * 1024) {
        setError('GIF must be under 5MB')
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        setProfile(p => ({ ...p, avatarUrl: reader.result as string }))
      }
      reader.readAsDataURL(file)
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be under 2MB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const img = new window.Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const size = 256
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')!
        const min = Math.min(img.width, img.height)
        const sx = (img.width - min) / 2
        const sy = (img.height - min) / 2
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size)
        setProfile(p => ({ ...p, avatarUrl: canvas.toDataURL('image/jpeg', 0.8) }))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  }

  const handleBannerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profile.isPremium) return
    if (file.size > 5 * 1024 * 1024) {
      setError('Banner must be under 5MB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setProfile(p => ({ ...p, bannerUrl: reader.result as string }))
    }
    reader.readAsDataURL(file)
  }

  useEffect(() => {
    if (ready && !user) navigate({ to: '/signin' })
  }, [ready, user, navigate])

  useEffect(() => {
    if (!user) return
    fetch('/api/profile').then(async (r) => {
      if (r.ok) {
        const data = await r.json()
        setProfile({
          displayName: data.displayName ?? user.name ?? '',
          username: data.username ?? null,
          bio: data.bio ?? '',
          avatarUrl: data.avatarUrl ?? '',
          bannerUrl: data.bannerUrl ?? '',
          profileTheme: data.profileTheme ?? 'default',
          profileColorPrimary: data.profileColorPrimary ?? '',
          profileColorSecondary: data.profileColorSecondary ?? '',
          interests: data.interests ?? [],
          messageCount: data.messageCount,
          totalXp: data.totalXp,
          currentStreak: data.currentStreak,
          longestStreak: data.longestStreak,
          lastUsernameChange: data.lastUsernameChange,
          weeklyMatchOptIn: data.weeklyMatchOptIn ?? false,
          isPremium: data.isPremium ?? false,
          isFounderOverride: data.isFounderOverride ?? false,
          profileViews: data.profileViews ?? 0,
          netlifyId: data.netlifyId,
        })
        setUsernameInput(data.username ?? '')

        if (data.netlifyId) {
          fetch(`/api/follows?action=counts&userId=${data.netlifyId}`)
            .then(r => r.ok ? r.json() : null)
            .then(d => { if (d) { setFollowerCount(d.followers); setFollowingCount(d.following) } })
            .catch(() => {})
        }
      } else {
        setProfile((p) => ({ ...p, displayName: user.name ?? user.email ?? '' }))
      }
      setLoading(false)
    })
    fetch('/api/streak-protection')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setStreakInfo(d) })
      .catch(() => {})
  }, [user])

  const loadFollowers = async () => {
    if (!profile.netlifyId) return
    const res = await fetch(`/api/follows?action=followers&userId=${profile.netlifyId}`)
    if (res.ok) setFollowersList(await res.json())
    setShowFollowers(true)
    setShowFollowing(false)
  }

  const loadFollowing = async () => {
    if (!profile.netlifyId) return
    const res = await fetch(`/api/follows?action=following&userId=${profile.netlifyId}`)
    if (res.ok) setFollowingList(await res.json())
    setShowFollowing(true)
    setShowFollowers(false)
  }

  const toggleInterest = (tag: string) => {
    setProfile((p) => ({
      ...p,
      interests: p.interests.includes(tag)
        ? p.interests.filter((t) => t !== tag)
        : [...p.interests, tag],
    }))
  }

  const canChangeUsername = () => {
    if (!profile.lastUsernameChange) return true
    const cooldownEnd = new Date(new Date(profile.lastUsernameChange).getTime() + 7 * 24 * 60 * 60 * 1000)
    return new Date() >= cooldownEnd
  }

  const usernameCooldownRemaining = () => {
    if (!profile.lastUsernameChange) return null
    const cooldownEnd = new Date(new Date(profile.lastUsernameChange).getTime() + 7 * 24 * 60 * 60 * 1000)
    const diff = cooldownEnd.getTime() - Date.now()
    if (diff <= 0) return null
    const days = Math.ceil(diff / (24 * 60 * 60 * 1000))
    return `${days}d`
  }

  const save = async () => {
    setSaving(true)
    setSaved(false)
    setError('')
    const body: Record<string, any> = {
      displayName: profile.displayName,
      bio: profile.bio,
      avatarUrl: profile.avatarUrl,
      interests: profile.interests,
      weeklyMatchOptIn: profile.weeklyMatchOptIn,
    }
    if (profile.isPremium) {
      body.bannerUrl = profile.bannerUrl
      body.profileTheme = profile.profileTheme
      body.profileColorPrimary = profile.profileColorPrimary
      body.profileColorSecondary = profile.profileColorSecondary
    }
    if (usernameInput !== (profile.username ?? '') && canChangeUsername()) {
      body.username = usernameInput
    }
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      const data = await res.json()
      setProfile((p) => ({ ...p, username: data.username, lastUsernameChange: data.lastUsernameChange }))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Failed to save')
    }
    setSaving(false)
  }

  if (!ready || !user || loading) return (
    <div className="flex items-center justify-center h-full bg-zinc-950">
      <div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
    </div>
  )

  const cooldown = usernameCooldownRemaining()
  const isPremium = profile.isPremium || profile.username === FOUNDER_USERNAME || profile.isFounderOverride
  const hasGradient = isPremium && profile.profileColorPrimary && profile.profileColorSecondary
  const gradientStyle = hasGradient
    ? { background: `linear-gradient(135deg, ${profile.profileColorPrimary}, ${profile.profileColorSecondary})` }
    : undefined

  return (
    <div className="flex flex-col h-full bg-zinc-950 overflow-y-auto">
      {isPremium && profile.bannerUrl ? (
        <div className="relative h-32 md:h-40 flex-shrink-0">
          <img src={profile.bannerUrl} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 to-transparent" />
          <button
            onClick={() => bannerInputRef.current?.click()}
            className="absolute top-3 right-3 p-2 bg-black/50 rounded-lg text-white/70 hover:text-white transition-colors"
          >
            <Image size={14} />
          </button>
        </div>
      ) : hasGradient ? (
        <div className="relative h-32 md:h-40 flex-shrink-0" style={gradientStyle}>
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 to-transparent" />
          <button
            onClick={() => bannerInputRef.current?.click()}
            className="absolute top-3 right-3 p-2 bg-black/30 rounded-lg text-white/70 hover:text-white transition-colors text-xs flex items-center gap-1.5"
          >
            <Image size={12} /> Upload banner
          </button>
        </div>
      ) : isPremium ? (
        <div className="relative h-24 flex-shrink-0 bg-zinc-900 border-b border-zinc-800">
          <button
            onClick={() => bannerInputRef.current?.click()}
            className="absolute top-3 right-3 p-2 bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors text-xs flex items-center gap-1.5"
          >
            <Image size={12} /> Add banner
          </button>
        </div>
      ) : (
        <div className="px-5 py-4 border-b border-zinc-800">
          <h1 className="text-sm font-semibold text-white">Profile</h1>
          <p className="text-xs text-zinc-500">How others see you</p>
        </div>
      )}

      <input
        ref={bannerInputRef}
        type="file"
        accept="image/*"
        onChange={handleBannerUpload}
        className="hidden"
      />

      <div className="max-w-lg mx-auto w-full px-5 py-8 space-y-6">
        {hasGradient ? (
          <div className="rounded-xl p-px" style={{ background: `linear-gradient(135deg, ${profile.profileColorPrimary}, ${profile.profileColorSecondary})` }}>
            <div className="bg-zinc-950 rounded-xl p-4 flex items-center gap-5">
              <div className="relative">
                {profile.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt="avatar"
                    className="w-16 h-16 rounded-full object-cover"
                    style={{ boxShadow: `0 0 0 3px ${profile.profileColorPrimary}` }}
                  />
                ) : (
                  <DefaultAvatar size={64} />
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 w-7 h-7 bg-zinc-700 hover:bg-zinc-600 border-2 border-zinc-950 rounded-full flex items-center justify-center transition-colors"
                >
                  <Camera size={13} className="text-white" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={isPremium ? 'image/*,image/gif' : 'image/*'}
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white flex items-center gap-1.5">
                  {profile.displayName || user.email}
                  <VerifiedBadge
                    username={profile.username}
                    isPremium={isPremium}
                    isFounderOverride={profile.isFounderOverride}
                    size={16}
                  />
                </p>
                {profile.username && <p className="text-xs text-zinc-500">@{profile.username}</p>}
                <p className="text-xs text-zinc-600">{user.email}</p>
              </div>
            </div>
          </div>
        ) : (
        <div className="flex items-center gap-5">
          <div className="relative">
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt="avatar"
                className="w-16 h-16 rounded-full object-cover ring-2 ring-zinc-800"
              />
            ) : (
              <DefaultAvatar size={64} />
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 w-7 h-7 bg-zinc-700 hover:bg-zinc-600 border-2 border-zinc-950 rounded-full flex items-center justify-center transition-colors"
            >
              <Camera size={13} className="text-white" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept={isPremium ? 'image/*,image/gif' : 'image/*'}
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white flex items-center gap-1.5">
              {profile.displayName || user.email}
              <VerifiedBadge
                username={profile.username}
                isPremium={isPremium}
                isFounderOverride={profile.isFounderOverride}
                size={16}
              />
            </p>
            {profile.username && <p className="text-xs text-zinc-500">@{profile.username}</p>}
            <p className="text-xs text-zinc-600">{user.email}</p>
          </div>
        </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-center">
            <Zap size={14} className="text-yellow-400 mx-auto mb-1" />
            <p className="text-sm font-bold text-white">{profile.totalXp?.toLocaleString() ?? 0}</p>
            <p className="text-xs text-zinc-500">XP</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-center">
            <Flame size={14} className="text-orange-400 mx-auto mb-1" />
            <p className="text-sm font-bold text-white">{profile.currentStreak ?? 0}d</p>
            <p className="text-xs text-zinc-500">
              Streak
              {isPremium && streakInfo && (
                <span className="text-emerald-400 ml-1">({streakInfo.freezesRemaining} freezes)</span>
              )}
            </p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-center">
            <Trophy size={14} className="text-emerald-400 mx-auto mb-1" />
            <p className="text-sm font-bold text-white">{profile.longestStreak ?? 0}d</p>
            <p className="text-xs text-zinc-500">Best</p>
          </div>
        </div>

        {isPremium && (
          <div className="grid grid-cols-3 gap-3">
            <button onClick={loadFollowers} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-center hover:border-zinc-700 transition-colors">
              <Users size={14} className="text-purple-400 mx-auto mb-1" />
              <p className="text-sm font-bold text-white">{followerCount}</p>
              <p className="text-xs text-zinc-500">Followers</p>
            </button>
            <button onClick={loadFollowing} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-center hover:border-zinc-700 transition-colors">
              <UserPlus size={14} className="text-blue-400 mx-auto mb-1" />
              <p className="text-sm font-bold text-white">{followingCount}</p>
              <p className="text-xs text-zinc-500">Following</p>
            </button>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-center">
              <Eye size={14} className="text-cyan-400 mx-auto mb-1" />
              <p className="text-sm font-bold text-white">{profile.profileViews ?? 0}</p>
              <p className="text-xs text-zinc-500">Views</p>
            </div>
          </div>
        )}

        {showFollowers && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Followers</h3>
              <button onClick={() => setShowFollowers(false)} className="text-zinc-500 hover:text-white"><X size={14} /></button>
            </div>
            {followersList.length === 0 ? (
              <p className="text-xs text-zinc-600">No followers yet</p>
            ) : followersList.map((f: any) => (
              <div key={f.netlifyId} className="flex items-center gap-3 py-1.5">
                {f.avatarUrl ? (
                  <img src={f.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center text-[10px] font-medium text-white">
                    {f.displayName?.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-white truncate flex items-center gap-1">
                    {f.displayName}
                    <VerifiedBadge username={f.username} isPremium={f.isPremium} isFounderOverride={f.isFounderOverride} size={12} />
                  </p>
                  {f.username && <p className="text-[10px] text-zinc-500">@{f.username}</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        {showFollowing && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Following</h3>
              <button onClick={() => setShowFollowing(false)} className="text-zinc-500 hover:text-white"><X size={14} /></button>
            </div>
            {followingList.length === 0 ? (
              <p className="text-xs text-zinc-600">Not following anyone yet</p>
            ) : followingList.map((f: any) => (
              <div key={f.netlifyId} className="flex items-center gap-3 py-1.5">
                {f.avatarUrl ? (
                  <img src={f.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center text-[10px] font-medium text-white">
                    {f.displayName?.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-white truncate flex items-center gap-1">
                    {f.displayName}
                    <VerifiedBadge username={f.username} isPremium={f.isPremium} isFounderOverride={f.isFounderOverride} size={12} />
                  </p>
                  {f.username && <p className="text-[10px] text-zinc-500">@{f.username}</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Display name</label>
            <input
              value={profile.displayName}
              onChange={(e) => setProfile((p) => ({ ...p, displayName: e.target.value }))}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
              placeholder="Your display name"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Username
              {cooldown && (
                <span className="ml-2 text-zinc-600 font-normal">Changeable in {cooldown}</span>
              )}
            </label>
            <div className="flex items-center">
              <span className="text-sm text-zinc-500 mr-1">@</span>
              <input
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                disabled={!canChangeUsername()}
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 disabled:opacity-50"
                placeholder="username"
                maxLength={20}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Bio</label>
            <textarea
              value={profile.bio}
              onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))}
              rows={3}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 resize-none"
              placeholder="Tell people about yourself…"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Avatar
              {isPremium && <span className="ml-2 text-emerald-400 font-normal">GIF supported</span>}
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-300 hover:text-white hover:border-zinc-600 transition-colors"
              >
                Upload photo
              </button>
              {profile.avatarUrl && (
                <button
                  type="button"
                  onClick={() => setProfile(p => ({ ...p, avatarUrl: '' }))}
                  className="flex items-center gap-1 px-3 py-2 text-sm text-red-400 hover:text-red-300 transition-colors"
                >
                  <X size={14} /> Remove
                </button>
              )}
            </div>
          </div>
        </div>

        {isPremium && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Crown size={14} className="text-yellow-400" />
              <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">NEESH.+ Customization</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-2">
                <span className="flex items-center gap-1.5"><Palette size={12} /> Profile Gradient</span>
              </label>
              <div className="rounded-xl border border-zinc-800 overflow-hidden mb-3">
                <div
                  className="h-20 w-full"
                  style={
                    profile.profileColorPrimary && profile.profileColorSecondary
                      ? { background: `linear-gradient(135deg, ${profile.profileColorPrimary}, ${profile.profileColorSecondary})` }
                      : { background: '#27272a' }
                  }
                />
                <div className="bg-zinc-900 px-3 py-2 flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Preview</span>
                  {profile.profileColorPrimary && (
                    <button
                      type="button"
                      onClick={() => setProfile(p => ({ ...p, profileColorPrimary: '', profileColorSecondary: '' }))}
                      className="text-[10px] text-zinc-500 hover:text-red-400 transition-colors"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-5 gap-2 mb-3">
                {GRADIENT_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => setProfile(p => ({
                      ...p,
                      profileColorPrimary: preset.primary,
                      profileColorSecondary: preset.secondary,
                    }))}
                    className={`group relative rounded-lg overflow-hidden h-10 border-2 transition-all ${
                      profile.profileColorPrimary === preset.primary && profile.profileColorSecondary === preset.secondary
                        ? 'border-white scale-105'
                        : 'border-transparent hover:border-zinc-600'
                    }`}
                    style={{ background: `linear-gradient(135deg, ${preset.primary}, ${preset.secondary})` }}
                    title={preset.name}
                  >
                    <span className="absolute inset-0 flex items-center justify-center text-[9px] font-medium text-white/0 group-hover:text-white/90 transition-colors drop-shadow-sm">
                      {preset.name}
                    </span>
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-[10px] text-zinc-500 mb-1">Primary</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={profile.profileColorPrimary || '#6366f1'}
                      onChange={(e) => setProfile(p => ({ ...p, profileColorPrimary: e.target.value }))}
                      className="w-8 h-8 rounded-lg border border-zinc-700 cursor-pointer bg-transparent [&::-webkit-color-swatch-wrapper]:p-0.5 [&::-webkit-color-swatch]:rounded"
                    />
                    <input
                      type="text"
                      value={profile.profileColorPrimary}
                      onChange={(e) => {
                        const v = e.target.value
                        if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setProfile(p => ({ ...p, profileColorPrimary: v }))
                      }}
                      placeholder="#6366f1"
                      className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 font-mono"
                    />
                  </div>
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] text-zinc-500 mb-1">Secondary</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={profile.profileColorSecondary || '#06b6d4'}
                      onChange={(e) => setProfile(p => ({ ...p, profileColorSecondary: e.target.value }))}
                      className="w-8 h-8 rounded-lg border border-zinc-700 cursor-pointer bg-transparent [&::-webkit-color-swatch-wrapper]:p-0.5 [&::-webkit-color-swatch]:rounded"
                    />
                    <input
                      type="text"
                      value={profile.profileColorSecondary}
                      onChange={(e) => {
                        const v = e.target.value
                        if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setProfile(p => ({ ...p, profileColorSecondary: v }))
                      }}
                      placeholder="#06b6d4"
                      className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-2">Interests</label>
          <div className="flex flex-wrap gap-2">
            {ALL_INTERESTS.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleInterest(tag)}
                className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                  profile.interests.includes(tag)
                    ? 'border-white text-white bg-zinc-800'
                    : 'border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600'
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div>
            <p className="text-sm text-white">Weekly Match Drops</p>
            <p className="text-xs text-zinc-500 mt-0.5">Get matched with 5 random users for a 24h group chat</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={profile.weeklyMatchOptIn}
            onClick={() => setProfile((p) => ({ ...p, weeklyMatchOptIn: !p.weeklyMatchOptIn }))}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
              profile.weeklyMatchOptIn ? 'bg-emerald-500' : 'bg-zinc-600'
            }`}
          >
            <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
              profile.weeklyMatchOptIn ? 'translate-x-5' : 'translate-x-0'
            }`} />
          </button>
        </div>

        {!isPremium && (
          <button
            onClick={() => navigate({ to: '/premium' })}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-zinc-800 to-zinc-900 border border-zinc-700 rounded-xl text-sm text-zinc-300 hover:text-white hover:border-zinc-600 transition-colors"
          >
            <Crown size={15} className="text-yellow-400" />
            Upgrade to NEESH.+ for badges, banners, GIF avatars & more
          </button>
        )}

        {error && (
          <p className="text-xs text-red-400 flex items-center gap-1.5">
            <AlertCircle size={13} /> {error}
          </p>
        )}

        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2.5 bg-white text-zinc-950 font-medium rounded-lg text-sm hover:bg-zinc-200 transition-colors disabled:opacity-50"
        >
          <Save size={15} />
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}
