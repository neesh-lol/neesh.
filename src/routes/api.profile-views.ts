import { createFileRoute } from '@tanstack/react-router'
import { getUser } from '@netlify/identity'
import { db } from '../../db/index.js'
import { profileViewLog, userProfiles } from '../../db/schema.js'
import { eq, sql, and, gt } from 'drizzle-orm'

export const Route = createFileRoute('/api/profile-views')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getUser()
        if (!user) return new Response('Unauthorized', { status: 401 })
        const { profileOwnerId } = await request.json()
        if (!profileOwnerId || profileOwnerId === user.id) {
          return Response.json({ recorded: false })
        }

        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
        const [recent] = await db
          .select()
          .from(profileViewLog)
          .where(
            and(
              eq(profileViewLog.profileOwnerId, profileOwnerId),
              eq(profileViewLog.viewerId, user.id),
              gt(profileViewLog.viewedAt, oneHourAgo)
            )
          )
          .limit(1)

        if (recent) return Response.json({ recorded: false })

        await db.insert(profileViewLog).values({
          profileOwnerId,
          viewerId: user.id,
        })
        await db
          .update(userProfiles)
          .set({ profileViews: sql`${userProfiles.profileViews} + 1` })
          .where(eq(userProfiles.netlifyId, profileOwnerId))

        return Response.json({ recorded: true })
      },
      GET: async ({ request }) => {
        const user = await getUser()
        if (!user) return new Response('Unauthorized', { status: 401 })
        const url = new URL(request.url)
        const userId = url.searchParams.get('userId') || user.id

        const [profile] = await db
          .select({ profileViews: userProfiles.profileViews })
          .from(userProfiles)
          .where(eq(userProfiles.netlifyId, userId))
          .limit(1)

        return Response.json({ views: profile?.profileViews ?? 0 })
      },
    },
  },
})
