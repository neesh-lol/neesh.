import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useIdentity } from '@/lib/identity-context'
import { supabase } from '@/lib/supabase'
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

const PROFILE_EFFECTS = [
  { value: 'none', label: 'None', description: 'Clean default card' },
  { value: 'aurora', label: 'Aurora', description: 'Purple/cyan premium glow' },
  { value: 'glass', label: 'Glass', description: 'Frosted dark glass' },
  { value: 'neon', label: 'Neon', description: 'Pink/purple edge glow' },
  { value: 'cyber', label: 'Cyber', description: 'Blue tech grid' },
  { value: 'fire', label: 'Fire', description: 'Red/orange heat glow' },
  { value: 'frost', label: 'Frost', description: 'Cold blue shine' },
  { value: 'vhs', label: 'VHS', description: 'Retro scanline card' },
]

const PROFILE_BACKGROUNDS = [
  { value: 'none', label: 'None', description: 'Default black background' },
  { value: 'midnight', label: 'Midnight', description: 'Dark purple Discord-style profile' },
  { value: 'aurora', label: 'Aurora', description: 'Soft cyan and purple glow' },
  { value: 'ember', label: 'Ember', description: 'Red/orange dark heat' },
  { value: 'ocean', label: 'Ocean', description: 'Blue deep glow' },
  { value: 'mono', label: 'Mono', description: 'Clean gray glass look' },
]

const NAME_EFFECTS = [
  { value: 'none', label: 'None' },
  { value: 'gradient', label: 'Gradient' },
  { value: 'neon', label: 'Neon' },
  { value: 'gold', label: 'Gold' },
  { value: 'ice', label: 'Ice' },
]

interface Profile {
  id?: string
  netlifyId?: string
  displayName: string
  username: string | null
  bio: string
  avatarUrl: string
  bannerUrl: string
  profileBannerEnabled: boolean
  profileTheme: string
  profileEffect: string
  profileBackground: string
  nameEffect: string
  profileColorPrimary: string
  profileColorSecondary: string
  equippedBadges: string[]
  equippedFlair: string
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

interface Badge {
  id: string
  name: string
  description: string | null
  icon: string | null
  rarity: string | null
  earned_at?: string | null
}

const FLAIR_OPTIONS = [
  'Night Owl',
  'Future Lawyer',
  'Music Addict',
  'Collector',
  'Competitive',
  'Producer',
  'Creative',
  'Top Chatter',
]

function getBadgeRarityClass(rarity?: string | null) {
  if (rarity === 'legendary') return 'border-yellow-400/70 bg-yellow-400/10 text-yellow-200'
  if (rarity === 'epic') return 'border-purple-400/70 bg-purple-400/10 text-purple-200'
  if (rarity === 'rare') return 'border-blue-400/70 bg-blue-400/10 text-blue-200'
  return 'border-zinc-700 bg-zinc-900 text-zinc-300'
}

function getProfileLevel(totalXp: number) {
  return Math.min(100, Math.floor(totalXp / 1000) + 1)
}

function getProfileLevelInfo(totalXp: number) {
  const level = getProfileLevel(totalXp)

  if (level >= 100) {
    return {
      level,
      xpIntoLevel: 1000,
      xpForNextLevel: 1000,
      percent: 100,
      xpToNextLevel: 0,
      isMax: true,
    }
  }

  const levelStartXp = (level - 1) * 1000
  const xpIntoLevel = Math.max(0, totalXp - levelStartXp)
  const xpForNextLevel = 1000
  const xpToNextLevel = Math.max(0, xpForNextLevel - xpIntoLevel)

  return {
    level,
    xpIntoLevel,
    xpForNextLevel,
    percent: Math.min(100, (xpIntoLevel / xpForNextLevel) * 100),
    xpToNextLevel,
    isMax: false,
  }
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

function getPremiumCardStyle(
  effect: string,
  primary?: string,
  secondary?: string
): React.CSSProperties {
  const p = primary || '#a855f7'
  const s = secondary || '#06b6d4'

  if (effect === 'aurora') {
    return {
      background: `radial-gradient(circle at 20% 20%, ${p}66, transparent 35%), radial-gradient(circle at 85% 15%, ${s}55, transparent 30%), linear-gradient(135deg, rgba(24,24,27,.98), rgba(9,9,11,.96))`,
      boxShadow: `0 0 35px ${p}33, inset 0 0 35px ${s}12`,
      borderColor: `${p}88`,
    }
  }

  if (effect === 'glass') {
    return {
      background: 'linear-gradient(135deg, rgba(255,255,255,.10), rgba(255,255,255,.025))',
      backdropFilter: 'blur(18px)',
      boxShadow: '0 18px 60px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.14)',
      borderColor: 'rgba(255,255,255,.18)',
    }
  }

  if (effect === 'neon') {
    return {
      background: 'linear-gradient(135deg, rgba(24,24,27,.98), rgba(9,9,11,.98))',
      boxShadow: '0 0 18px rgba(236,72,153,.75), 0 0 42px rgba(168,85,247,.4), inset 0 0 28px rgba(236,72,153,.12)',
      borderColor: 'rgba(236,72,153,.85)',
    }
  }

  if (effect === 'cyber') {
    return {
      backgroundImage:
        'linear-gradient(rgba(34,211,238,.10) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,.10) 1px, transparent 1px), linear-gradient(135deg, rgba(6,182,212,.16), rgba(124,58,237,.10), rgba(9,9,11,.98))',
      backgroundSize: '28px 28px, 28px 28px, 100% 100%',
      boxShadow: '0 0 28px rgba(34,211,238,.22), inset 0 0 30px rgba(34,211,238,.08)',
      borderColor: 'rgba(34,211,238,.45)',
    }
  }

  if (effect === 'fire') {
    return {
      background: 'radial-gradient(circle at 25% 110%, rgba(239,68,68,.55), transparent 38%), radial-gradient(circle at 80% 115%, rgba(249,115,22,.48), transparent 36%), linear-gradient(135deg, rgba(24,24,27,.98), rgba(9,9,11,.98))',
      boxShadow: '0 0 34px rgba(249,115,22,.28), inset 0 -24px 42px rgba(239,68,68,.10)',
      borderColor: 'rgba(249,115,22,.55)',
    }
  }

  if (effect === 'frost') {
    return {
      background: 'radial-gradient(circle at 50% -20%, rgba(125,211,252,.36), transparent 38%), linear-gradient(135deg, rgba(14,165,233,.12), rgba(9,9,11,.98))',
      boxShadow: '0 0 30px rgba(14,165,233,.18), inset 0 0 28px rgba(125,211,252,.08)',
      borderColor: 'rgba(125,211,252,.5)',
    }
  }

  if (effect === 'vhs') {
    return {
      background:
        'repeating-linear-gradient(0deg, rgba(255,255,255,.035), rgba(255,255,255,.035) 1px, transparent 1px, transparent 5px), linear-gradient(135deg, rgba(39,39,42,.98), rgba(9,9,11,.98))',
      boxShadow: '0 0 24px rgba(255,255,255,.08), inset 0 0 26px rgba(255,255,255,.035)',
      borderColor: 'rgba(255,255,255,.16)',
    }
  }

  return {
    background: 'rgba(24,24,27,.92)',
    borderColor: 'rgb(39,39,42)',
  }
}

function getProfileBackgroundStyle(
  background: string,
  primary?: string,
  secondary?: string
): React.CSSProperties {
  const p = primary || '#a855f7'
  const s = secondary || '#06b6d4'

  if (background === 'midnight') {
    return {
      background:
        `radial-gradient(circle at 25% 0%, ${p}44, transparent 34%), radial-gradient(circle at 80% 12%, ${s}2f, transparent 30%), #09090b`,
    }
  }

  if (background === 'aurora') {
    return {
      background:
        `radial-gradient(circle at 15% 0%, ${p}55, transparent 35%), radial-gradient(circle at 85% 5%, ${s}4a, transparent 34%), linear-gradient(180deg, #09090b, #111827)`,
    }
  }

  if (background === 'ember') {
    return {
      background:
        `radial-gradient(circle at 20% 0%, ${p}4a, transparent 35%), radial-gradient(circle at 80% 10%, ${s}3d, transparent 32%), #09090b`,
    }
  }

  if (background === 'ocean') {
    return {
      background:
        `radial-gradient(circle at 30% 0%, ${p}4d, transparent 36%), radial-gradient(circle at 90% 20%, ${s}33, transparent 32%), #09090b`,
    }
  }

  if (background === 'mono') {
    return {
      background:
        `radial-gradient(circle at top, ${p}22, transparent 32%), radial-gradient(circle at bottom, ${s}18, transparent 34%), linear-gradient(180deg, #18181b, #09090b)`,
    }
  }

  return { background: '#09090b' }
}

function getNameEffectStyle(
  effect: string,
  primary?: string,
  secondary?: string
): React.CSSProperties {
  const p = primary || '#a855f7'
  const s = secondary || '#06b6d4'

  if (effect === 'gradient') {
    return {
      background: `linear-gradient(90deg, ${p}, ${s}, #ffffff)`,
      WebkitBackgroundClip: 'text',
      backgroundClip: 'text',
      color: 'transparent',
      fontWeight: 800,
    }
  }

  if (effect === 'neon') {
    return {
      color: '#ffffff',
      textShadow: `0 0 8px ${p}, 0 0 18px ${s}, 0 0 28px ${p}`,
      fontWeight: 800,
    }
  }

  if (effect === 'gold') {
    return {
      background: `linear-gradient(90deg, #fde68a, ${p}, #fff7ed)`,
      WebkitBackgroundClip: 'text',
      backgroundClip: 'text',
      color: 'transparent',
      fontWeight: 800,
    }
  }

  if (effect === 'ice') {
    return {
      color: '#e0f2fe',
      textShadow: `0 0 8px ${s}, 0 0 18px ${p}`,
      fontWeight: 800,
    }
  }

  return {}
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
    profileBannerEnabled: false,
    profileTheme: 'default',
    profileEffect: 'none',
    profileBackground: 'none',
    nameEffect: 'none',
    profileColorPrimary: '',
    profileColorSecondary: '',
    equippedBadges: [],
    equippedFlair: '',
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
  const [earnedBadges, setEarnedBadges] = useState<Badge[]>([])
  const [loadingBadges, setLoadingBadges] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (ready && !user) navigate({ to: '/signin' })
  }, [ready, user, navigate])

  useEffect(() => {
    if (!user) return

    async function loadProfile() {
      setLoading(true)
      setError('')

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (error) {
        console.error('Profile load error:', error)
        setError(error.message)
      }

      if (data) {
        const loadedProfile: Profile = {
          id: data.id,
          netlifyId: data.id,
          displayName: data.display_name ?? user.name ?? user.email ?? '',
          username: data.username ?? null,
          bio: data.bio ?? '',
          avatarUrl: data.avatar_url ?? '',
          bannerUrl: data.banner_url ?? '',
          profileBannerEnabled: data.banner_enabled ?? false,
          profileTheme: data.profile_theme ?? 'default',
          profileEffect: data.profile_effect ?? 'none',
          profileBackground: data.profile_background ?? 'none',
          nameEffect: data.name_effect ?? 'none',
          profileColorPrimary: data.profile_color_primary ?? '',
          profileColorSecondary: data.profile_color_secondary ?? '',
          equippedBadges: Array.isArray(data.equipped_badges) ? data.equipped_badges.slice(0, 3) : [],
          equippedFlair: data.equipped_flair ?? '',
          interests: data.interests ?? [],
          messageCount: data.message_count ?? 0,
          totalXp: data.total_xp ?? 0,
          currentStreak: data.current_streak ?? 0,
          longestStreak: data.longest_streak ?? 0,
          lastUsernameChange: data.last_username_change ?? null,
          weeklyMatchOptIn: data.weekly_match_opt_in ?? false,
          isPremium: data.is_premium ?? false,
          isFounderOverride: data.is_founder_override ?? false,
          profileViews: data.profile_views ?? 0,
        }

        setProfile(loadedProfile)
        setUsernameInput(data.username ?? '')
        setStreakInfo({ freezesRemaining: data.streak_freezes_remaining ?? 0 })
      } else {
        setProfile((p) => ({
          ...p,
          id: user.id,
          netlifyId: user.id,
          displayName: user.name ?? user.email ?? '',
        }))
      }

      setLoading(false)
    }

    loadProfile()
  }, [user])

  useEffect(() => {
    if (!user) return

    async function loadBadges() {
      setLoadingBadges(true)

      const { data, error } = await supabase
        .from('user_badges')
        .select('earned_at, badges(id, name, description, icon, rarity)')
        .eq('user_id', user.id)
        .order('earned_at', { ascending: false })

      if (error) {
        console.error('Badges load error:', error)
        setEarnedBadges([])
        setLoadingBadges(false)
        return
      }

      const badges =
        data
          ?.map((row: any) => ({
            ...(row.badges ?? {}),
            earned_at: row.earned_at,
          }))
          .filter((badge: any) => badge?.id) ?? []

      setEarnedBadges(badges)
      setLoadingBadges(false)
    }

    loadBadges()
  }, [user])

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
        setProfile((p) => ({ ...p, avatarUrl: reader.result as string }))
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
        setProfile((p) => ({ ...p, avatarUrl: canvas.toDataURL('image/jpeg', 0.8) }))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  }

  const handleBannerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const hasPremiumAccess =
      profile.isPremium ||
      profile.username === FOUNDER_USERNAME ||
      profile.isFounderOverride

    if (!file || !hasPremiumAccess) return

    if (file.size > 5 * 1024 * 1024) {
      setError('Banner must be under 5MB')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setProfile((p) => ({ ...p, bannerUrl: reader.result as string }))
    }
    reader.readAsDataURL(file)
  }

  const loadFollowers = async () => {
    setFollowersList([])
    setShowFollowers(true)
    setShowFollowing(false)
  }

  const loadFollowing = async () => {
    setFollowingList([])
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

  const toggleBadgeEquip = (badgeId: string) => {
    setProfile((p) => {
      const alreadyEquipped = p.equippedBadges.includes(badgeId)

      if (alreadyEquipped) {
        return {
          ...p,
          equippedBadges: p.equippedBadges.filter((id) => id !== badgeId),
        }
      }

      if (p.equippedBadges.length >= 3) {
        setError('You can only display 3 badges at once.')
        return p
      }

      setError('')
      return {
        ...p,
        equippedBadges: [...p.equippedBadges, badgeId],
      }
    })
  }

  const equippedBadgeObjects = profile.equippedBadges
    .map((badgeId) => earnedBadges.find((badge) => badge.id === badgeId))
    .filter(Boolean) as Badge[]

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
    if (!user) return

    setSaving(true)
    setSaved(false)
    setError('')

    const usernameChanged = usernameInput !== (profile.username ?? '')
    const hasPremiumAccess =
      profile.isPremium ||
      profile.username === FOUNDER_USERNAME ||
      profile.isFounderOverride

    const updates: any = {
      id: user.id,
      display_name: profile.displayName,
      username: usernameInput || null,
      bio: profile.bio,
      avatar_url: profile.avatarUrl,
      banner_url: profile.bannerUrl,
      banner_enabled: profile.profileBannerEnabled,
      profile_theme: profile.profileTheme,
      profile_effect: hasPremiumAccess ? profile.profileEffect : 'none',
      profile_background: hasPremiumAccess ? profile.profileBackground : 'none',
      name_effect: hasPremiumAccess ? profile.nameEffect : 'none',
      profile_color_primary: profile.profileColorPrimary,
      profile_color_secondary: profile.profileColorSecondary,
      equipped_badges: profile.equippedBadges.slice(0, 3),
      equipped_flair: profile.equippedFlair || null,
      interests: profile.interests,
      weekly_match_opt_in: profile.weeklyMatchOptIn ?? false,
      total_xp: profile.totalXp ?? 0,
      current_streak: profile.currentStreak ?? 0,
      longest_streak: profile.longestStreak ?? 0,
      message_count: profile.messageCount ?? 0,
      profile_views: profile.profileViews ?? 0,
      is_premium: profile.isPremium ?? false,
      is_founder_override: profile.isFounderOverride ?? false,
      last_username_change:
        usernameChanged && canChangeUsername()
          ? new Date().toISOString()
          : profile.lastUsernameChange,
    }

    const { data, error } = await supabase
      .from('profiles')
      .upsert(updates)
      .select()
      .single()

    if (error) {
      console.error('Profile save error:', error)
      setError(error.message || 'Failed to save')
      setSaving(false)
      return
    }

    setProfile((p) => ({
      ...p,
      username: data.username,
      lastUsernameChange: data.last_username_change,
      displayName: data.display_name ?? p.displayName,
      bio: data.bio ?? p.bio,
      avatarUrl: data.avatar_url ?? p.avatarUrl,
      bannerUrl: data.banner_url ?? p.bannerUrl,
      profileBannerEnabled: data.banner_enabled ?? p.profileBannerEnabled,
      profileTheme: data.profile_theme ?? p.profileTheme,
      profileEffect: data.profile_effect ?? p.profileEffect,
      profileBackground: data.profile_background ?? p.profileBackground,
      nameEffect: data.name_effect ?? p.nameEffect,
      profileColorPrimary: data.profile_color_primary ?? p.profileColorPrimary,
      profileColorSecondary: data.profile_color_secondary ?? p.profileColorSecondary,
      equippedBadges: Array.isArray(data.equipped_badges) ? data.equipped_badges.slice(0, 3) : p.equippedBadges,
      equippedFlair: data.equipped_flair ?? p.equippedFlair,
      interests: data.interests ?? p.interests,
      weeklyMatchOptIn: data.weekly_match_opt_in ?? p.weeklyMatchOptIn,
    }))

    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setSaving(false)
  }

  if (!ready || !user || loading) {
    return (
      <div className="flex items-center justify-center h-full bg-zinc-950">
        <div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  const cooldown = usernameCooldownRemaining()
  const isPremium = profile.isPremium || profile.username === FOUNDER_USERNAME || profile.isFounderOverride
  const hasGradient = isPremium && profile.profileColorPrimary && profile.profileColorSecondary
  const showProfileBanner = isPremium && profile.profileBannerEnabled

  const gradientStyle = hasGradient
    ? { background: `linear-gradient(135deg, ${profile.profileColorPrimary}, ${profile.profileColorSecondary})` }
    : undefined

  const profileEffect = isPremium ? profile.profileEffect || 'none' : 'none'
  const premiumCardStyle = getPremiumCardStyle(
    profileEffect,
    profile.profileColorPrimary,
    profile.profileColorSecondary
  )
  const profileBackgroundStyle = getProfileBackgroundStyle(
    isPremium ? profile.profileBackground : 'none',
    profile.profileColorPrimary,
    profile.profileColorSecondary
  )
  const nameEffectStyle = getNameEffectStyle(
    isPremium ? profile.nameEffect : 'none',
    profile.profileColorPrimary,
    profile.profileColorSecondary
  )
  const totalXp = profile.totalXp ?? 0
  const levelInfo = getProfileLevelInfo(totalXp)

  return (
    <div className="flex flex-col min-h-screen overflow-y-auto pb-24" style={profileBackgroundStyle}>
      {showProfileBanner && profile.bannerUrl ? (
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
      ) : showProfileBanner && hasGradient ? (
        <div className="relative h-32 md:h-40 flex-shrink-0" style={gradientStyle}>
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 to-transparent" />
          <button
            onClick={() => bannerInputRef.current?.click()}
            className="absolute top-3 right-3 p-2 bg-black/30 rounded-lg text-white/70 hover:text-white transition-colors text-xs flex items-center gap-1.5"
          >
            <Image size={12} /> Upload banner
          </button>
        </div>
      ) : showProfileBanner && isPremium ? (
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
          <div className="rounded-2xl border p-4 flex items-center gap-5 overflow-hidden" style={premiumCardStyle}>
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
                  <span style={nameEffectStyle}>{profile.displayName || user.email}</span>
                  <VerifiedBadge
                    username={profile.username}
                    isPremium={isPremium}
                    isFounderOverride={profile.isFounderOverride}
                    size={16}
                  />
                </p>
                {profile.username && <p className="text-xs text-zinc-500">@{profile.username}</p>}
                {profile.equippedFlair && (
                  <p className="text-[11px] text-zinc-300 mt-0.5">{profile.equippedFlair}</p>
                )}
                {equippedBadgeObjects.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {equippedBadgeObjects.map((badge) => (
                      <span
                        key={badge.id}
                        title={badge.name}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] ${getBadgeRarityClass(badge.rarity)}`}
                      >
                        <span>{badge.icon ?? '🏅'}</span>
                        <span>{badge.name}</span>
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-zinc-600 mt-1">{user.email}</p>
              </div>
          </div>
        ) : (
          <div className="rounded-2xl border p-4 flex items-center gap-5 overflow-hidden" style={premiumCardStyle}>
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
                <span style={nameEffectStyle}>{profile.displayName || user.email}</span>
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

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wider">Profile Level</p>
              <p className="text-2xl font-black text-white mt-0.5">
                Level {levelInfo.level}
              </p>
            </div>

            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500/20 to-cyan-500/10 border border-purple-500/30 flex items-center justify-center">
              <span className="text-sm font-black text-white">
                LVL {levelInfo.level}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-zinc-400">
              {levelInfo.isMax
                ? 'Max level reached'
                : `${levelInfo.xpIntoLevel.toLocaleString()} / ${levelInfo.xpForNextLevel.toLocaleString()} XP`}
            </span>

            <span className="text-zinc-500">
              {levelInfo.isMax
                ? 'MAX'
                : `${levelInfo.xpToNextLevel.toLocaleString()} XP to Level ${levelInfo.level + 1}`}
            </span>
          </div>

          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-cyan-400 rounded-full transition-all"
              style={{ width: `${levelInfo.percent}%` }}
            />
          </div>

          <p className="text-[11px] text-zinc-600 mt-2">
            Level 100 is the max level at 100,000 XP.
          </p>
        </div>

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
              <div key={f.id} className="flex items-center gap-3 py-1.5">
                <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center text-[10px] font-medium text-white">
                  {f.displayName?.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-white truncate">{f.displayName}</p>
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
              <div key={f.id} className="flex items-center gap-3 py-1.5">
                <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center text-[10px] font-medium text-white">
                  {f.displayName?.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-white truncate">{f.displayName}</p>
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
                  onClick={() => setProfile((p) => ({ ...p, avatarUrl: '' }))}
                  className="flex items-center gap-1 px-3 py-2 text-sm text-red-400 hover:text-red-300 transition-colors"
                >
                  <X size={14} /> Remove
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Trophy size={14} className="text-yellow-400" />
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Profile Decorations</span>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-white">Displayed Badges</p>
                <p className="text-xs text-zinc-500 mt-0.5">Choose up to 3 earned badges to show on your profile.</p>
              </div>
              <span className="text-xs text-zinc-500">{profile.equippedBadges.length}/3</span>
            </div>

            {loadingBadges ? (
              <p className="text-xs text-zinc-500">Loading badges…</p>
            ) : earnedBadges.length === 0 ? (
              <p className="text-xs text-zinc-500">
                You have not unlocked any badges yet. Earn badges by adding friends, sending messages, keeping streaks, and winning Song Wars.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {earnedBadges.map((badge) => {
                  const equipped = profile.equippedBadges.includes(badge.id)

                  return (
                    <button
                      key={badge.id}
                      type="button"
                      onClick={() => toggleBadgeEquip(badge.id)}
                      className={`rounded-lg border p-3 text-left transition-colors ${
                        equipped
                          ? 'border-white bg-white text-zinc-950'
                          : 'border-zinc-700 bg-zinc-950 text-zinc-300 hover:text-white hover:border-zinc-500'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-lg">{badge.icon ?? '🏅'}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold truncate">{badge.name}</p>
                          <p className={`text-[10px] mt-0.5 ${equipped ? 'text-zinc-600' : 'text-zinc-500'}`}>
                            {badge.description ?? 'Unlocked badge'}
                          </p>
                          <p className={`text-[10px] mt-1 uppercase tracking-wider ${equipped ? 'text-zinc-500' : 'text-zinc-600'}`}>
                            {equipped ? 'Displayed' : badge.rarity ?? 'common'}
                          </p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
            <div>
              <p className="text-sm text-white">Profile Flair</p>
              <p className="text-xs text-zinc-500 mt-0.5">Choose one small label to show under your name.</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setProfile((p) => ({ ...p, equippedFlair: '' }))}
                className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                  profile.equippedFlair === ''
                    ? 'border-white bg-white text-zinc-950'
                    : 'border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600'
                }`}
              >
                None
              </button>

              {FLAIR_OPTIONS.map((flair) => (
                <button
                  key={flair}
                  type="button"
                  onClick={() => setProfile((p) => ({ ...p, equippedFlair: flair }))}
                  className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                    profile.equippedFlair === flair
                      ? 'border-white bg-white text-zinc-950'
                      : 'border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600'
                  }`}
                >
                  {flair}
                </button>
              ))}
            </div>
          </div>
        </div>

        {isPremium && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Crown size={14} className="text-yellow-400" />
              <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">NEESH.+ Customization</span>
            </div>

            <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div>
                <p className="text-sm text-white">Profile Banner</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Show or hide the banner area at the top of your profile
                </p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={profile.profileBannerEnabled}
                onClick={() =>
                  setProfile((p) => ({
                    ...p,
                    profileBannerEnabled: !p.profileBannerEnabled,
                  }))
                }
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                  profile.profileBannerEnabled ? 'bg-emerald-500' : 'bg-zinc-600'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    profile.profileBannerEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {profile.profileBannerEnabled && (
              <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div>
                  <p className="text-sm text-white">Banner Image</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Upload, change, or remove your profile banner
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => bannerInputRef.current?.click()}
                    className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-300 hover:text-white hover:border-zinc-600 transition-colors"
                  >
                    {profile.bannerUrl ? 'Change' : 'Upload'}
                  </button>

                  {profile.bannerUrl && (
                    <button
                      type="button"
                      onClick={() => setProfile((p) => ({ ...p, bannerUrl: '' }))}
                      className="px-3 py-2 text-xs text-red-400 hover:text-red-300 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-2">
                Profile Background
              </label>

              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 mb-4">
                <div
                  className="h-24 rounded-xl border border-zinc-800 mb-3"
                  style={getProfileBackgroundStyle(profile.profileBackground, profile.profileColorPrimary, profile.profileColorSecondary)}
                />

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PROFILE_BACKGROUNDS.map((background) => (
                    <button
                      key={background.value}
                      type="button"
                      onClick={() => setProfile((p) => ({ ...p, profileBackground: background.value }))}
                      className={`rounded-lg border p-2 text-left transition-colors ${
                        profile.profileBackground === background.value
                          ? 'border-white bg-white text-zinc-950'
                          : 'border-zinc-700 bg-zinc-950 text-zinc-400 hover:text-white hover:border-zinc-500'
                      }`}
                    >
                      <span className="block text-xs font-semibold">{background.label}</span>
                      <span className={`block text-[10px] mt-0.5 ${profile.profileBackground === background.value ? 'text-zinc-600' : 'text-zinc-600'}`}>
                        {background.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-2">
                Name Effect
              </label>

              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 mb-4">
                <div className="h-16 rounded-xl border border-zinc-800 bg-zinc-950 flex items-center justify-center mb-3">
                  <p className="text-lg font-bold" style={getNameEffectStyle(profile.nameEffect, profile.profileColorPrimary, profile.profileColorSecondary)}>
                    {profile.displayName || 'Your Name'}
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {NAME_EFFECTS.map((effect) => (
                    <button
                      key={effect.value}
                      type="button"
                      onClick={() => setProfile((p) => ({ ...p, nameEffect: effect.value }))}
                      className={`rounded-lg border p-2 text-left transition-colors ${
                        profile.nameEffect === effect.value
                          ? 'border-white bg-white text-zinc-950'
                          : 'border-zinc-700 bg-zinc-950 text-zinc-400 hover:text-white hover:border-zinc-500'
                      }`}
                    >
                      <span className="block text-xs font-semibold">{effect.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-2">
                Premium Profile Card Style
              </label>

              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 mb-4">
                <div
                  className="h-24 rounded-xl border overflow-hidden mb-3"
                  style={getPremiumCardStyle(profile.profileEffect, profile.profileColorPrimary, profile.profileColorSecondary)}
                >
                  <div className="h-full w-full flex items-center justify-center">
                    <p className="text-xs font-semibold text-white/80">
                      {PROFILE_EFFECTS.find((e) => e.value === profile.profileEffect)?.label ?? 'None'} Preview
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PROFILE_EFFECTS.map((effect) => (
                    <button
                      key={effect.value}
                      type="button"
                      onClick={() => setProfile((p) => ({ ...p, profileEffect: effect.value }))}
                      className={`rounded-lg border p-2 text-left transition-colors ${
                        profile.profileEffect === effect.value
                          ? 'border-white bg-white text-zinc-950'
                          : 'border-zinc-700 bg-zinc-950 text-zinc-400 hover:text-white hover:border-zinc-500'
                      }`}
                    >
                      <span className="block text-xs font-semibold">{effect.label}</span>
                      <span className={`block text-[10px] mt-0.5 ${
                        profile.profileEffect === effect.value ? 'text-zinc-600' : 'text-zinc-600'
                      }`}>
                        {effect.description}
                      </span>
                    </button>
                  ))}
                </div>

                <p className="text-[10px] text-zinc-500 mt-3">
                  Your selected colors control the profile background, profile card glow, and name effects.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-2">
                <span className="flex items-center gap-1.5"><Palette size={12} /> Profile Colors</span>
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
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Profile Color Preview</span>
                  {profile.profileColorPrimary && (
                    <button
                      type="button"
                      onClick={() => setProfile((p) => ({ ...p, profileColorPrimary: '', profileColorSecondary: '' }))}
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
                    onClick={() => setProfile((p) => ({
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
                  <input
                    type="color"
                    value={profile.profileColorPrimary || '#6366f1'}
                    onChange={(e) => setProfile((p) => ({ ...p, profileColorPrimary: e.target.value }))}
                    className="w-8 h-8 rounded-lg border border-zinc-700 cursor-pointer bg-transparent"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] text-zinc-500 mb-1">Secondary</label>
                  <input
                    type="color"
                    value={profile.profileColorSecondary || '#06b6d4'}
                    onChange={(e) => setProfile((p) => ({ ...p, profileColorSecondary: e.target.value }))}
                    className="w-8 h-8 rounded-lg border border-zinc-700 cursor-pointer bg-transparent"
                  />
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
