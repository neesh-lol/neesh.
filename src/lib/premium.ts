import { db } from '../../db/index.js'
import { userProfiles } from '../../db/schema.js'
import { eq } from 'drizzle-orm'
import { FOUNDER_USERNAME } from '../components/VerifiedBadge.js'

export async function checkPremiumStatus(netlifyId: string): Promise<{
  isPremium: boolean
  isFounder: boolean
}> {
  const [profile] = await db
    .select({
      username: userProfiles.username,
      isPremium: userProfiles.isPremium,
      premiumExpires: userProfiles.premiumExpires,
      isFounderOverride: userProfiles.isFounderOverride,
    })
    .from(userProfiles)
    .where(eq(userProfiles.netlifyId, netlifyId))
    .limit(1)

  if (!profile) return { isPremium: false, isFounder: false }

  const isFounder = profile.username === FOUNDER_USERNAME || profile.isFounderOverride

  if (isFounder) return { isPremium: true, isFounder: true }

  if (!profile.isPremium) return { isPremium: false, isFounder: false }

  if (profile.premiumExpires && new Date(profile.premiumExpires) < new Date()) {
    await db
      .update(userProfiles)
      .set({
        isPremium: false,
        subscriptionTier: null,
        updatedAt: new Date(),
      })
      .where(eq(userProfiles.netlifyId, netlifyId))
    return { isPremium: false, isFounder: false }
  }

  return { isPremium: true, isFounder: false }
}

export async function ensureFounderPremium(netlifyId: string, username: string | null): Promise<void> {
  if (username !== FOUNDER_USERNAME) return
  await db
    .update(userProfiles)
    .set({
      isPremium: true,
      isFounderOverride: true,
      isFounder: true,
      subscriptionTier: 'neesh_plus',
      badgeType: 'verified',
      updatedAt: new Date(),
    })
    .where(eq(userProfiles.netlifyId, netlifyId))
}
