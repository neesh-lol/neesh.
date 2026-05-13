import { createFileRoute } from '@tanstack/react-router'
import { getUser } from '@netlify/identity'
import { db } from '../../db/index.js'
import { userProfiles } from '../../db/schema.js'
import { eq } from 'drizzle-orm'
import { updateChallengeProgress } from '../lib/xp.js'
import { FOUNDER_USERNAME } from '../components/VerifiedBadge.js'
import { ensureFounderPremium, checkPremiumStatus } from '../lib/premium.js'

export const Route = createFileRoute('/api/profile')({
  server: {
    handlers: {
      GET: async () => {
        const user = await getUser()
        if (!user) return new Response('Unauthorized', { status: 401 })
        const [profile] = await db
          .select()
          .from(userProfiles)
          .where(eq(userProfiles.netlifyId, user.id))
          .limit(1)
        if (profile) {
          await ensureFounderPremium(user.id, profile.username)
          const { isPremium } = await checkPremiumStatus(user.id)
          return Response.json({ ...profile, isPremium })
        }
        const [created] = await db
          .insert(userProfiles)
          .values({
            netlifyId: user.id,
            displayName: user.name || user.email?.split('@')[0] || 'User',
            bio: '',
            avatarUrl: '',
            interests: [],
            onboardingComplete: true,
          })
          .onConflictDoNothing()
          .returning()
        if (created) return Response.json({ ...created, isPremium: false }, { status: 201 })
        const [retry] = await db
          .select()
          .from(userProfiles)
          .where(eq(userProfiles.netlifyId, user.id))
          .limit(1)
        return retry ? Response.json({ ...retry, isPremium: false }) : new Response('Not found', { status: 404 })
      },
      PUT: async ({ request }) => {
        const user = await getUser()
        if (!user) return new Response('Unauthorized', { status: 401 })
        const data = await request.json()
        const updates: Record<string, any> = { updatedAt: new Date() }

        if (data.displayName !== undefined) updates.displayName = data.displayName
        if (data.bio !== undefined) updates.bio = data.bio
        if (data.avatarUrl !== undefined) updates.avatarUrl = data.avatarUrl
        if (data.interests !== undefined) updates.interests = data.interests
        if (data.weeklyMatchOptIn !== undefined) updates.weeklyMatchOptIn = data.weeklyMatchOptIn

        const { isPremium } = await checkPremiumStatus(user.id)
        if (isPremium) {
          if (data.bannerUrl !== undefined) updates.bannerUrl = data.bannerUrl
          if (data.profileTheme !== undefined) updates.profileTheme = data.profileTheme
          const hexColor = /^#[0-9a-fA-F]{6}$/
          if (data.profileColorPrimary !== undefined) {
            updates.profileColorPrimary = hexColor.test(data.profileColorPrimary) ? data.profileColorPrimary : ''
          }
          if (data.profileColorSecondary !== undefined) {
            updates.profileColorSecondary = hexColor.test(data.profileColorSecondary) ? data.profileColorSecondary : ''
          }
        }

        if (data.username !== undefined) {
          const [existing] = await db
            .select()
            .from(userProfiles)
            .where(eq(userProfiles.netlifyId, user.id))
            .limit(1)

          if (existing?.lastUsernameChange) {
            const cooldownEnd = new Date(existing.lastUsernameChange.getTime() + 7 * 24 * 60 * 60 * 1000)
            if (new Date() < cooldownEnd) {
              return Response.json(
                { error: 'Username can only be changed once every 7 days', cooldownEnd: cooldownEnd.toISOString() },
                { status: 429 }
              )
            }
          }

          const normalized = data.username.toLowerCase().replace(/[^a-z0-9_]/g, '')
          if (normalized.length < 3 || normalized.length > 20) {
            return Response.json({ error: 'Username must be 3-20 characters (letters, numbers, underscores)' }, { status: 400 })
          }

          if (normalized === FOUNDER_USERNAME && existing?.username !== FOUNDER_USERNAME) {
            return Response.json({ error: 'This username is reserved' }, { status: 403 })
          }

          const [taken] = await db
            .select()
            .from(userProfiles)
            .where(eq(userProfiles.username, normalized))
            .limit(1)

          if (taken && taken.netlifyId !== user.id) {
            return Response.json({ error: 'Username is already taken' }, { status: 409 })
          }

          updates.username = normalized
          updates.lastUsernameChange = new Date()
        }

        const [existing] = await db
          .select()
          .from(userProfiles)
          .where(eq(userProfiles.netlifyId, user.id))
          .limit(1)

        if (existing) {
          const [updated] = await db
            .update(userProfiles)
            .set(updates)
            .where(eq(userProfiles.netlifyId, user.id))
            .returning()

          await updateChallengeProgress(user.id, 'customize_profile', 1)
          await ensureFounderPremium(user.id, updated.username)
          return Response.json({ ...updated, isPremium })
        } else {
          const [created] = await db
            .insert(userProfiles)
            .values({
              netlifyId: user.id,
              displayName: data.displayName ?? user.name ?? user.email,
              username: data.username?.toLowerCase().replace(/[^a-z0-9_]/g, '') ?? undefined,
              bio: data.bio ?? '',
              avatarUrl: data.avatarUrl ?? '',
              interests: data.interests ?? [],
            })
            .returning()

          await updateChallengeProgress(user.id, 'customize_profile', 1)
          return Response.json({ ...created, isPremium: false }, { status: 201 })
        }
      },
    },
  },
})
