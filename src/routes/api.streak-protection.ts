import { createFileRoute } from '@tanstack/react-router'
import { getUser } from '@netlify/identity'
import { db } from '../../db/index.js'
import { userProfiles } from '../../db/schema.js'
import { eq } from 'drizzle-orm'
import { checkPremiumStatus } from '../lib/premium.js'

export const Route = createFileRoute('/api/streak-protection')({
  server: {
    handlers: {
      GET: async () => {
        const user = await getUser()
        if (!user) return new Response('Unauthorized', { status: 401 })

        const { isPremium } = await checkPremiumStatus(user.id)
        const [profile] = await db
          .select({
            streakFreezeUsed: userProfiles.streakFreezeUsed,
            streakFreezeResetMonth: userProfiles.streakFreezeResetMonth,
            currentStreak: userProfiles.currentStreak,
          })
          .from(userProfiles)
          .where(eq(userProfiles.netlifyId, user.id))
          .limit(1)

        const currentMonth = new Date().toISOString().slice(0, 7)
        const used = profile?.streakFreezeResetMonth === currentMonth ? (profile?.streakFreezeUsed ?? 0) : 0

        return Response.json({
          isPremium,
          freezesUsed: used,
          freezesRemaining: isPremium ? Math.max(0, 3 - used) : 0,
          currentStreak: profile?.currentStreak ?? 0,
        })
      },
      POST: async () => {
        const user = await getUser()
        if (!user) return new Response('Unauthorized', { status: 401 })

        const { isPremium } = await checkPremiumStatus(user.id)
        if (!isPremium) return Response.json({ error: 'Premium required' }, { status: 403 })

        const [profile] = await db
          .select()
          .from(userProfiles)
          .where(eq(userProfiles.netlifyId, user.id))
          .limit(1)

        if (!profile) return new Response('Not found', { status: 404 })

        const currentMonth = new Date().toISOString().slice(0, 7)
        const used = profile.streakFreezeResetMonth === currentMonth ? profile.streakFreezeUsed : 0

        if (used >= 3) {
          return Response.json({ error: 'All 3 monthly streak freezes used' }, { status: 400 })
        }

        const today = new Date().toISOString().slice(0, 10)

        await db
          .update(userProfiles)
          .set({
            lastActiveDate: today,
            streakFreezeUsed: used + 1,
            streakFreezeResetMonth: currentMonth,
            updatedAt: new Date(),
          })
          .where(eq(userProfiles.netlifyId, user.id))

        return Response.json({
          used: true,
          freezesRemaining: 2 - used,
        })
      },
    },
  },
})
