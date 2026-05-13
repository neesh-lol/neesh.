import { createFileRoute } from '@tanstack/react-router'
import { getUser } from '@netlify/identity'
import { db } from '../../db/index.js'
import { matchGroups, matchGroupMembers, matchMessages, userProfiles } from '../../db/schema.js'
import { eq, desc, gt, and } from 'drizzle-orm'

export const Route = createFileRoute('/api/weekly-match')({
  server: {
    handlers: {
      GET: async () => {
        const user = await getUser()
        if (!user) return new Response('Unauthorized', { status: 401 })

        const now = new Date()
        const activeGroups = await db
          .select({ groupId: matchGroupMembers.groupId })
          .from(matchGroupMembers)
          .innerJoin(matchGroups, eq(matchGroupMembers.groupId, matchGroups.id))
          .where(
            and(
              eq(matchGroupMembers.netlifyId, user.id),
              gt(matchGroups.expiresAt, now)
            )
          )

        if (!activeGroups.length) {
          return Response.json({ active: false, group: null, members: [], messages: [] })
        }

        const groupId = activeGroups[0].groupId

        const members = await db
          .select({
            netlifyId: matchGroupMembers.netlifyId,
            displayName: userProfiles.displayName,
            avatarUrl: userProfiles.avatarUrl,
            username: userProfiles.username,
          })
          .from(matchGroupMembers)
          .leftJoin(userProfiles, eq(matchGroupMembers.netlifyId, userProfiles.netlifyId))
          .where(eq(matchGroupMembers.groupId, groupId))

        const messages = await db
          .select()
          .from(matchMessages)
          .where(eq(matchMessages.groupId, groupId))
          .orderBy(desc(matchMessages.createdAt))
          .limit(100)

        const [group] = await db
          .select()
          .from(matchGroups)
          .where(eq(matchGroups.id, groupId))
          .limit(1)

        return Response.json({
          active: true,
          group: { id: group.id, expiresAt: group.expiresAt },
          members,
          messages: messages.reverse(),
        })
      },
      POST: async ({ request }) => {
        const user = await getUser()
        if (!user) return new Response('Unauthorized', { status: 401 })
        const { content } = await request.json()
        if (!content?.trim()) return new Response('Bad request', { status: 400 })

        const now = new Date()
        const activeGroups = await db
          .select({ groupId: matchGroupMembers.groupId })
          .from(matchGroupMembers)
          .innerJoin(matchGroups, eq(matchGroupMembers.groupId, matchGroups.id))
          .where(
            and(
              eq(matchGroupMembers.netlifyId, user.id),
              gt(matchGroups.expiresAt, now)
            )
          )

        if (!activeGroups.length) {
          return new Response('No active match group', { status: 404 })
        }

        const groupId = activeGroups[0].groupId
        const profile = await db
          .select()
          .from(userProfiles)
          .where(eq(userProfiles.netlifyId, user.id))
          .limit(1)

        const [msg] = await db
          .insert(matchMessages)
          .values({
            groupId,
            userId: user.id,
            displayName: profile[0]?.displayName ?? user.email ?? 'User',
            avatarUrl: profile[0]?.avatarUrl ?? '',
            content: content.trim(),
          })
          .returning()

        return Response.json(msg, { status: 201 })
      },
    },
  },
})
