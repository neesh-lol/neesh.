import { createFileRoute } from '@tanstack/react-router'
import { getUser } from '@netlify/identity'
import { db } from '../../db/index.js'
import { userProfiles, friendships } from '../../db/schema.js'
import { eq, or, and, ilike, inArray } from 'drizzle-orm'
import { updateChallengeProgress } from '../lib/xp.js'

function sanitizeProfile(row: any) {
  return row
}

export const Route = createFileRoute('/api/friends')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getUser()
        if (!user) return new Response('Unauthorized', { status: 401 })

        const url = new URL(request.url)
        const action = url.searchParams.get('action')

        if (action === 'pending-count') {
          const rows = await db
            .select()
            .from(friendships)
            .where(
              and(eq(friendships.addresseeId, user.id), eq(friendships.status, 'pending')),
            )
          return Response.json({ count: rows.length })
        }

        if (action === 'profile-by-id') {
          const userId = url.searchParams.get('userId')
          if (!userId) return new Response('Missing userId', { status: 400 })
          const [profile] = await db
            .select({
              id: userProfiles.id,
              displayName: userProfiles.displayName,
              username: userProfiles.username,
              bio: userProfiles.bio,
              avatarUrl: userProfiles.avatarUrl,
              totalXp: userProfiles.totalXp,
              currentStreak: userProfiles.currentStreak,
              netlifyId: userProfiles.netlifyId,
              isPremium: userProfiles.isPremium,
              isFounderOverride: userProfiles.isFounderOverride,
              bannerUrl: userProfiles.bannerUrl,
              profileColorPrimary: userProfiles.profileColorPrimary,
              profileColorSecondary: userProfiles.profileColorSecondary,
            })
            .from(userProfiles)
            .where(eq(userProfiles.netlifyId, userId))
            .limit(1)
          if (!profile) return new Response('Not found', { status: 404 })

          const targetId = profile.netlifyId
          const [friendship] = await db
            .select()
            .from(friendships)
            .where(
              or(
                and(eq(friendships.requesterId, user.id), eq(friendships.addresseeId, targetId)),
                and(eq(friendships.requesterId, targetId), eq(friendships.addresseeId, user.id)),
              ),
            )
            .limit(1)

          return Response.json({
            ...sanitizeProfile(profile),
            friendshipStatus: friendship?.status ?? null,
            isSelf: targetId === user.id,
            friendshipDirection: friendship
              ? friendship.requesterId === user.id ? 'sent' : 'received'
              : null,
          })
        }

        if (action === 'search') {
          const q = url.searchParams.get('q')?.trim()
          if (!q || q.length < 2) return Response.json([])
          const results = await db
            .select({
              id: userProfiles.id,
              displayName: userProfiles.displayName,
              username: userProfiles.username,
              bio: userProfiles.bio,
              avatarUrl: userProfiles.avatarUrl,
              interests: userProfiles.interests,
              score: userProfiles.score,
              totalXp: userProfiles.totalXp,
              netlifyId: userProfiles.netlifyId,
            })
            .from(userProfiles)
            .where(ilike(userProfiles.username, `%${q}%`))
            .limit(20)

          const safe = results
            .filter((r) => r.netlifyId !== user.id)
            .map(sanitizeProfile)
          return Response.json(safe)
        }

        if (action === 'profile') {
          const username = url.searchParams.get('username')
          if (!username) return new Response('Missing username', { status: 400 })
          const [profile] = await db
            .select({
              id: userProfiles.id,
              displayName: userProfiles.displayName,
              username: userProfiles.username,
              bio: userProfiles.bio,
              avatarUrl: userProfiles.avatarUrl,
              interests: userProfiles.interests,
              score: userProfiles.score,
              totalXp: userProfiles.totalXp,
              messageCount: userProfiles.messageCount,
              currentStreak: userProfiles.currentStreak,
              longestStreak: userProfiles.longestStreak,
              netlifyId: userProfiles.netlifyId,
              isPremium: userProfiles.isPremium,
              isFounderOverride: userProfiles.isFounderOverride,
              bannerUrl: userProfiles.bannerUrl,
              profileTheme: userProfiles.profileTheme,
              profileColorPrimary: userProfiles.profileColorPrimary,
              profileColorSecondary: userProfiles.profileColorSecondary,
              profileViews: userProfiles.profileViews,
            })
            .from(userProfiles)
            .where(eq(userProfiles.username, username))
            .limit(1)
          if (!profile) return new Response('Not found', { status: 404 })

          const targetId = profile.netlifyId
          const [friendship] = await db
            .select()
            .from(friendships)
            .where(
              or(
                and(eq(friendships.requesterId, user.id), eq(friendships.addresseeId, targetId)),
                and(eq(friendships.requesterId, targetId), eq(friendships.addresseeId, user.id)),
              ),
            )
            .limit(1)

          return Response.json({
            ...sanitizeProfile(profile),
            friendshipStatus: friendship?.status ?? null,
            isSelf: targetId === user.id,
            friendshipDirection: friendship
              ? friendship.requesterId === user.id
                ? 'sent'
                : 'received'
              : null,
          })
        }

        const rows = await db
          .select()
          .from(friendships)
          .where(
            or(
              eq(friendships.requesterId, user.id),
              eq(friendships.addresseeId, user.id),
            ),
          )

        const friendIds = rows
          .filter((r) => r.status === 'accepted')
          .map((r) => (r.requesterId === user.id ? r.addresseeId : r.requesterId))

        const pendingReceived = rows
          .filter((r) => r.status === 'pending' && r.addresseeId === user.id)
          .map((r) => r.requesterId)

        const pendingSent = rows
          .filter((r) => r.status === 'pending' && r.requesterId === user.id)
          .map((r) => r.addresseeId)

        const allIds = [...new Set([...friendIds, ...pendingReceived, ...pendingSent])]
        let profiles: any[] = []
        if (allIds.length > 0) {
          profiles = await db
            .select({
              id: userProfiles.id,
              displayName: userProfiles.displayName,
              username: userProfiles.username,
              bio: userProfiles.bio,
              avatarUrl: userProfiles.avatarUrl,
              interests: userProfiles.interests,
              score: userProfiles.score,
              totalXp: userProfiles.totalXp,
              netlifyId: userProfiles.netlifyId,
            })
            .from(userProfiles)
            .where(inArray(userProfiles.netlifyId, allIds))
        }

        const profileMap = new Map(profiles.map((p) => [p.netlifyId, sanitizeProfile(p)]))

        return Response.json({
          friends: friendIds.map((id) => profileMap.get(id)).filter(Boolean),
          pendingReceived: pendingReceived.map((id) => profileMap.get(id)).filter(Boolean),
          pendingSent: pendingSent.map((id) => profileMap.get(id)).filter(Boolean),
        })
      },

      POST: async ({ request }) => {
        const user = await getUser()
        if (!user) return new Response('Unauthorized', { status: 401 })

        const { action, username } = await request.json()

        if (action === 'add') {
          const [target] = await db
            .select()
            .from(userProfiles)
            .where(eq(userProfiles.username, username))
            .limit(1)
          if (!target) return new Response('User not found', { status: 404 })
          if (target.netlifyId === user.id) return new Response('Cannot add yourself', { status: 400 })

          const [existing] = await db
            .select()
            .from(friendships)
            .where(
              or(
                and(eq(friendships.requesterId, user.id), eq(friendships.addresseeId, target.netlifyId)),
                and(eq(friendships.requesterId, target.netlifyId), eq(friendships.addresseeId, user.id)),
              ),
            )
            .limit(1)

          if (existing) {
            if (existing.status === 'accepted') return Response.json({ status: 'already_friends' })
            if (existing.requesterId === user.id) return Response.json({ status: 'already_sent' })
            await db
              .update(friendships)
              .set({ status: 'accepted' })
              .where(eq(friendships.id, existing.id))

            const myFriends = await db.select().from(friendships).where(and(or(eq(friendships.requesterId, user.id), eq(friendships.addresseeId, user.id)), eq(friendships.status, 'accepted')))
            await updateChallengeProgress(user.id, 'add_first_friend', myFriends.length)
            await updateChallengeProgress(user.id, 'add_10_friends', myFriends.length)
            await updateChallengeProgress(user.id, 'add_50_friends', myFriends.length)
            await updateChallengeProgress(user.id, 'add_100_friends', myFriends.length)

            const theirFriends = await db.select().from(friendships).where(and(or(eq(friendships.requesterId, target.netlifyId), eq(friendships.addresseeId, target.netlifyId)), eq(friendships.status, 'accepted')))
            await updateChallengeProgress(target.netlifyId, 'add_first_friend', theirFriends.length)
            await updateChallengeProgress(target.netlifyId, 'add_10_friends', theirFriends.length)
            await updateChallengeProgress(target.netlifyId, 'add_50_friends', theirFriends.length)
            await updateChallengeProgress(target.netlifyId, 'add_100_friends', theirFriends.length)

            return Response.json({ status: 'accepted' })
          }

          await db.insert(friendships).values({
            requesterId: user.id,
            addresseeId: target.netlifyId,
          })
          return Response.json({ status: 'sent' })
        }

        if (action === 'accept') {
          const [target] = await db
            .select()
            .from(userProfiles)
            .where(eq(userProfiles.username, username))
            .limit(1)
          if (!target) return new Response('User not found', { status: 404 })
          await db
            .update(friendships)
            .set({ status: 'accepted' })
            .where(
              and(
                eq(friendships.requesterId, target.netlifyId),
                eq(friendships.addresseeId, user.id),
                eq(friendships.status, 'pending'),
              ),
            )

          const friendCount = await db
            .select()
            .from(friendships)
            .where(
              and(
                or(eq(friendships.requesterId, user.id), eq(friendships.addresseeId, user.id)),
                eq(friendships.status, 'accepted'),
              ),
            )
          const count = friendCount.length
          await updateChallengeProgress(user.id, 'add_first_friend', count)
          await updateChallengeProgress(user.id, 'add_10_friends', count)
          await updateChallengeProgress(user.id, 'add_50_friends', count)
          await updateChallengeProgress(user.id, 'add_100_friends', count)

          const targetFriendCount = await db
            .select()
            .from(friendships)
            .where(
              and(
                or(eq(friendships.requesterId, target.netlifyId), eq(friendships.addresseeId, target.netlifyId)),
                eq(friendships.status, 'accepted'),
              ),
            )
          const tCount = targetFriendCount.length
          await updateChallengeProgress(target.netlifyId, 'add_first_friend', tCount)
          await updateChallengeProgress(target.netlifyId, 'add_10_friends', tCount)
          await updateChallengeProgress(target.netlifyId, 'add_50_friends', tCount)
          await updateChallengeProgress(target.netlifyId, 'add_100_friends', tCount)

          return Response.json({ status: 'accepted' })
        }

        if (action === 'remove') {
          const [target] = await db
            .select()
            .from(userProfiles)
            .where(eq(userProfiles.username, username))
            .limit(1)
          if (!target) return new Response('User not found', { status: 404 })
          await db
            .delete(friendships)
            .where(
              or(
                and(eq(friendships.requesterId, user.id), eq(friendships.addresseeId, target.netlifyId)),
                and(eq(friendships.requesterId, target.netlifyId), eq(friendships.addresseeId, user.id)),
              ),
            )
          return Response.json({ status: 'removed' })
        }

        return new Response('Invalid action', { status: 400 })
      },
    },
  },
})
