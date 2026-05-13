import { createFileRoute } from '@tanstack/react-router'
import { getUser } from '@netlify/identity'
import { db } from '../../db/index.js'
import { follows, userProfiles } from '../../db/schema.js'
import { eq, and, sql } from 'drizzle-orm'

export const Route = createFileRoute('/api/follows')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const action = url.searchParams.get('action')
        const targetId = url.searchParams.get('userId')

        if (action === 'status' && targetId) {
          const user = await getUser()
          if (!user) return Response.json({ isFollowing: false })
          const [row] = await db
            .select()
            .from(follows)
            .where(and(eq(follows.followerId, user.id), eq(follows.followingId, targetId)))
            .limit(1)
          return Response.json({ isFollowing: !!row })
        }

        if (action === 'counts' && targetId) {
          const [followers] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(follows)
            .where(eq(follows.followingId, targetId))
          const [following] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(follows)
            .where(eq(follows.followerId, targetId))
          return Response.json({
            followers: followers?.count ?? 0,
            following: following?.count ?? 0,
          })
        }

        if (action === 'followers' && targetId) {
          const rows = await db
            .select({
              id: userProfiles.id,
              netlifyId: userProfiles.netlifyId,
              displayName: userProfiles.displayName,
              username: userProfiles.username,
              avatarUrl: userProfiles.avatarUrl,
              isPremium: userProfiles.isPremium,
              isFounderOverride: userProfiles.isFounderOverride,
            })
            .from(follows)
            .innerJoin(userProfiles, eq(follows.followerId, userProfiles.netlifyId))
            .where(eq(follows.followingId, targetId))
            .limit(100)
          return Response.json(rows)
        }

        if (action === 'following' && targetId) {
          const rows = await db
            .select({
              id: userProfiles.id,
              netlifyId: userProfiles.netlifyId,
              displayName: userProfiles.displayName,
              username: userProfiles.username,
              avatarUrl: userProfiles.avatarUrl,
              isPremium: userProfiles.isPremium,
              isFounderOverride: userProfiles.isFounderOverride,
            })
            .from(follows)
            .innerJoin(userProfiles, eq(follows.followingId, userProfiles.netlifyId))
            .where(eq(follows.followerId, targetId))
            .limit(100)
          return Response.json(rows)
        }

        return new Response('Bad request', { status: 400 })
      },
      POST: async ({ request }) => {
        const user = await getUser()
        if (!user) return new Response('Unauthorized', { status: 401 })
        const { action, targetUserId } = await request.json()
        if (!targetUserId || targetUserId === user.id) return new Response('Bad request', { status: 400 })

        if (action === 'follow') {
          await db
            .insert(follows)
            .values({ followerId: user.id, followingId: targetUserId })
            .onConflictDoNothing()
          return Response.json({ followed: true })
        }

        if (action === 'unfollow') {
          await db
            .delete(follows)
            .where(and(eq(follows.followerId, user.id), eq(follows.followingId, targetUserId)))
          return Response.json({ unfollowed: true })
        }

        return new Response('Invalid action', { status: 400 })
      },
    },
  },
})
