import { BadgeCheck } from 'lucide-react'

export const FOUNDER_USERNAME = 'ceo'

export type BadgeLevel = 'founder' | 'admin' | 'moderator' | 'premium' | 'standard'

export function getBadgeLevel(username?: string | null, badgeType?: string, isPremium?: boolean, isFounderOverride?: boolean): BadgeLevel {
  if (username === FOUNDER_USERNAME || isFounderOverride) return 'founder'
  if (badgeType === 'admin') return 'admin'
  if (badgeType === 'moderator') return 'moderator'
  if (isPremium || badgeType === 'verified') return 'premium'
  return 'standard'
}

const BADGE_CONFIG = {
  founder: {
    tooltip: 'Founder & CEO',
    classes: 'text-yellow-400 drop-shadow-[0_0_6px_rgba(250,204,21,0.6)]',
    hoverClasses: 'hover:drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]',
  },
  admin: {
    tooltip: 'Admin',
    classes: 'text-red-400',
    hoverClasses: '',
  },
  moderator: {
    tooltip: 'Moderator',
    classes: 'text-blue-400',
    hoverClasses: '',
  },
  premium: {
    tooltip: 'Neesh+',
    classes: 'text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.4)]',
    hoverClasses: 'hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]',
  },
} as const

interface VerifiedBadgeProps {
  username?: string | null
  badgeType?: string
  isPremium?: boolean
  isFounderOverride?: boolean
  size?: number
  className?: string
}

export function VerifiedBadge({ username, badgeType, isPremium, isFounderOverride, size = 14, className = '' }: VerifiedBadgeProps) {
  const level = getBadgeLevel(username, badgeType, isPremium, isFounderOverride)
  if (level === 'standard') return null

  const config = BADGE_CONFIG[level]

  return (
    <span
      className={`inline-flex items-center transition-all duration-200 ${config.hoverClasses} ${className}`}
      title={config.tooltip}
    >
      <BadgeCheck
        size={size}
        className={config.classes}
        strokeWidth={2.5}
      />
    </span>
  )
}
